import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Components
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import OrgChart from './components/OrgChart';
import ProfilePanel from './components/ProfilePanel';
import DiffBar from './components/DiffBar';
import LoadingSpinner from './components/LoadingSpinner';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orgData, setOrgData] = useState([]);
  const [profileSchema, setProfileSchema] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stagedChanges, setStagedChanges] = useState([]);
  const [bootstrap, setBootstrap] = useState(null);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication first
      const authResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
        withCredentials: true,
      });

      if (!authResponse.data.data) {
        // Not authenticated, redirect to OAuth
        const authUrlResponse = await axios.get(`${API_BASE_URL}/auth/slack/authorize`);
        window.location.href = authUrlResponse.data.data.authUrl;
        return;
      }

      // Bootstrap the app
      const bootstrapResponse = await axios.get(`${API_BASE_URL}/api/bootstrap`);
      setBootstrap(bootstrapResponse.data.data);

      // Load org chart data
      const orgResponse = await axios.get(`${API_BASE_URL}/api/org`);
      setOrgData(orgResponse.data.data);

      // Load profile schema
      const schemaResponse = await axios.get(`${API_BASE_URL}/api/profile-schema`);
      setProfileSchema(schemaResponse.data.data);

      // Load staged changes
      const diffResponse = await axios.get(`${API_BASE_URL}/api/diff`);
      setStagedChanges(diffResponse.data.data);

    } catch (err) {
      console.error('Failed to initialize app:', err);
      if (err.response?.status === 401) {
        // Authentication failed, redirect to OAuth
        try {
          const authUrlResponse = await axios.get(`${API_BASE_URL}/auth/slack/authorize`);
          window.location.href = authUrlResponse.data.data.authUrl;
        } catch (authErr) {
          setError('Authentication failed. Please try again.');
        }
      } else {
        setError(err.response?.data?.message || 'Failed to load application data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleStageChange = async (changeData) => {
    try {
      let endpoint = '';
      if (changeData.type === 'manager') {
        endpoint = '/api/stage/manager-move';
      } else if (changeData.type === 'profile') {
        endpoint = '/api/stage/profile-update';
      }

      await axios.post(`${API_BASE_URL}${endpoint}`, changeData.payload);
      
      // Refresh staged changes
      const diffResponse = await axios.get(`${API_BASE_URL}/api/diff`);
      setStagedChanges(diffResponse.data.data);

      // Refresh org data if manager change
      if (changeData.type === 'manager') {
        const orgResponse = await axios.get(`${API_BASE_URL}/api/org`);
        setOrgData(orgResponse.data.data);
      }

    } catch (err) {
      console.error('Failed to stage change:', err);
      setError(err.response?.data?.message || 'Failed to stage change');
    }
  };

  const handleApplyChanges = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/apply`);
      
      // Refresh all data
      await initializeApp();
      
      alert(`Applied ${response.data.data.results.length} changes successfully`);
    } catch (err) {
      console.error('Failed to apply changes:', err);
      setError(err.response?.data?.message || 'Failed to apply changes');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertChange = async (changeId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/revert/${changeId}`);
      
      // Refresh all data
      await initializeApp();
      
      alert('Change reverted successfully');
    } catch (err) {
      console.error('Failed to revert change:', err);
      setError(err.response?.data?.message || 'Failed to revert change');
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/sync/full`, {}, {
        withCredentials: true,
      });
      
      // Refresh all data
      await initializeApp();
      
      alert('Sync completed successfully');
    } catch (err) {
      console.error('Failed to sync:', err);
      setError(err.response?.data?.message || 'Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        withCredentials: true,
      });
      
      // Redirect to OAuth
      const authUrlResponse = await axios.get(`${API_BASE_URL}/auth/slack/authorize`);
      window.location.href = authUrlResponse.data.data.authUrl;
    } catch (err) {
      console.error('Failed to logout:', err);
      setError('Failed to logout');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={initializeApp}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Header 
        bootstrap={bootstrap}
        onSync={handleSync}
        onLogout={handleLogout}
      />
      
      <div className="app-content">
        <div className="left-panel">
          <SearchBar 
            users={orgData}
            onUserSelect={handleUserSelect}
          />
        </div>
        
        <div className="center-panel">
          <OrgChart 
            data={orgData}
            selectedUser={selectedUser}
            onUserSelect={handleUserSelect}
            onStageChange={handleStageChange}
          />
        </div>
        
        <div className="right-panel">
          <ProfilePanel 
            user={selectedUser}
            schema={profileSchema}
            onStageChange={handleStageChange}
          />
        </div>
      </div>
      
      <DiffBar 
        changes={stagedChanges}
        onApply={handleApplyChanges}
        onRevert={handleRevertChange}
      />
    </div>
  );
}

export default App;