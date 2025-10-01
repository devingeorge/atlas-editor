import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function TokenInput({ onTokenSet }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestToken = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setTesting(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/token/test`, {
        token: token.trim(),
      });

      if (response.data.data.valid) {
        setError(null);
        alert('✅ Token is valid! You can now save it.');
      } else {
        setError('❌ Invalid token. Please check your Slack user token.');
      }
    } catch (err) {
      setError('❌ Failed to test token. Please check your Slack user token.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/token`, {
        token: token.trim(),
      }, {
        withCredentials: true,
      });

      if (response.data.status === 'success') {
        alert('✅ Token saved successfully!');
        onTokenSet();
      } else {
        setError(response.data.message || 'Failed to save token');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="token-input-container">
      <div className="token-input-card">
        <h2>🔑 Slack User Token Required</h2>
        <p>
          To use Atlas Editor, you need to provide your Slack user token. 
          This allows the app to read and edit your organization's data.
        </p>
        
        <div className="token-input-section">
          <label htmlFor="token-input">
            <strong>Slack User Token (xoxp-...)</strong>
          </label>
          <input
            id="token-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="xoxp-your-slack-user-token-here"
            className="token-input"
          />
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="token-actions">
            <button 
              onClick={handleTestToken}
              disabled={testing || !token.trim()}
              className="test-button"
            >
              {testing ? 'Testing...' : 'Test Token'}
            </button>
            
            <button 
              onClick={handleSaveToken}
              disabled={loading || !token.trim()}
              className="save-button"
            >
              {loading ? 'Saving...' : 'Save Token'}
            </button>
          </div>
        </div>

        <div className="token-help">
          <h3>📋 How to get your Slack user token:</h3>
          <ol>
            <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">api.slack.com/apps</a></li>
            <li>Select your workspace</li>
            <li>Go to "OAuth & Permissions"</li>
            <li>Copy your "User OAuth Token" (starts with xoxp-)</li>
            <li>Paste it above and click "Save Token"</li>
          </ol>
          
          <div className="security-note">
            <strong>🔒 Security Note:</strong> This token is stored securely in your browser session 
            and is only used to communicate with Slack's API. It's not shared with any third parties.
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenInput;
