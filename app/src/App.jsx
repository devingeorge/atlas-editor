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
import TokenInput from './components/TokenInput';

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
  const [needsToken, setNeedsToken] = useState(false);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has a token in localStorage
      const userToken = localStorage.getItem('slack_user_token');
      if (!userToken) {
        setNeedsToken(true);
        setLoading(false);
        return;
      }

      // Bootstrap the app with token in header
      const bootstrapResponse = await axios.get(`${API_BASE_URL}/api/bootstrap`, {
        headers: {
          'X-Slack-Token': userToken,
        },
      });
      setBootstrap(bootstrapResponse.data.data);

      // Load org chart data
      const orgResponse = await axios.get(`${API_BASE_URL}/api/org`, {
        headers: {
          'X-Slack-Token': userToken,
        },
      });
      setOrgData(orgResponse.data.data);

      // Load profile schema
      const schemaResponse = await axios.get(`${API_BASE_URL}/api/profile-schema`, {
        headers: {
          'X-Slack-Token': userToken,
        },
      });
      setProfileSchema(schemaResponse.data.data);

      // Load staged changes
      const diffResponse = await axios.get(`${API_BASE_URL}/api/diff`, {
        headers: {
          'X-Slack-Token': userToken,
        },
      });
      setStagedChanges(diffResponse.data.data);

    } catch (err) {
      console.error('Failed to initialize app:', err);
      setError(err.response?.data?.message || 'Failed to load application data');
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
      console.log('🔍 Frontend - Sync button pressed');
      setLoading(true);
      
      // Get token from localStorage
      const userToken = localStorage.getItem('slack_user_token');
      console.log('🔍 Frontend - Token from localStorage:', userToken ? userToken.substring(0, 10) + '...' : 'none');
      
      if (!userToken) {
        throw new Error('No token found in localStorage');
      }
      
      console.log('🔍 Frontend - Sending sync request with token header');
      await axios.post(`${API_BASE_URL}/sync/full`, {}, {
        headers: {
          'X-Slack-Token': userToken,
        },
      });
      
      console.log('🔍 Frontend - Sync completed, refreshing data');
      // Refresh all data
      await initializeApp();
      
      alert('Sync completed successfully');
    } catch (err) {
      console.error('❌ Frontend - Failed to sync:', err);
      setError(err.response?.data?.message || 'Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear token from localStorage
      localStorage.removeItem('slack_user_token');
      
      // Reset app state
      setNeedsToken(true);
      setBootstrap(null);
      setOrgData([]);
      setProfileSchema([]);
      setStagedChanges([]);
      setSelectedUser(null);
    } catch (err) {
      console.error('Failed to logout:', err);
      setError('Failed to logout');
    }
  };

  const handleTokenSet = () => {
    setNeedsToken(false);
    initializeApp();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (needsToken) {
    return <TokenInput onTokenSet={handleTokenSet} />;
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