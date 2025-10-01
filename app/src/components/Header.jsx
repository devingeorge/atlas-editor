import React from 'react';

const Header = ({ bootstrap, onSync, onLogout }) => {
  return (
    <header className="header">
      <h1>Atlas Editor</h1>
      <div className="header-actions">
        {bootstrap?.connection?.slackConnected ? (
          <span style={{ color: '#28a745', fontSize: '0.875rem' }}>
            ✓ Connected
          </span>
        ) : (
          <span style={{ color: '#dc3545', fontSize: '0.875rem' }}>
            ✗ Disconnected
          </span>
        )}
        <button className="btn btn-secondary" onClick={onSync}>
          Sync Data
        </button>
        <button className="btn btn-secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
