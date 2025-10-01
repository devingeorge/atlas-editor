import React from 'react';

const DiffBar = ({ changes, onApply, onRevert }) => {
  if (!changes || changes.length === 0) {
    return null;
  }

  const getChangeDescription = (change) => {
    if (change.changeType === 'manager') {
      const before = change.payloadBefore.manager || 'None';
      const after = change.payloadAfter.manager || 'None';
      return `Move ${change.userName} from ${before} to ${after}`;
    } else if (change.changeType === 'profile') {
      const fieldCount = Object.keys(change.payloadAfter.fields || {}).length;
      return `Update ${fieldCount} profile field${fieldCount > 1 ? 's' : ''} for ${change.userName}`;
    }
    return 'Unknown change';
  };

  const getChangeStatusColor = (status) => {
    switch (status) {
      case 'staged': return '#0366d6';
      case 'applied': return '#28a745';
      case 'failed': return '#dc3545';
      case 'reverted': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const stagedChanges = changes.filter(c => c.status === 'staged');
  const appliedChanges = changes.filter(c => c.status === 'applied');

  return (
    <div className="diff-bar">
      <div className="diff-info">
        <div className="diff-count">
          {stagedChanges.length} staged
        </div>
        {appliedChanges.length > 0 && (
          <div className="diff-count" style={{ background: '#28a745' }}>
            {appliedChanges.length} applied
          </div>
        )}
        
        <div style={{ fontSize: '0.875rem', color: '#6a737d' }}>
          {stagedChanges.length > 0 && (
            <div>
              {stagedChanges.map(change => (
                <div key={change.id} style={{ marginBottom: '0.25rem' }}>
                  {getChangeDescription(change)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="diff-actions">
        {stagedChanges.length > 0 && (
          <button 
            className="btn btn-success"
            onClick={onApply}
          >
            Apply All Changes
          </button>
        )}
        
        {appliedChanges.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {appliedChanges.slice(0, 3).map(change => (
              <button
                key={change.id}
                className="btn btn-danger"
                onClick={() => onRevert(change.id)}
                title={`Revert: ${getChangeDescription(change)}`}
              >
                Revert
              </button>
            ))}
            {appliedChanges.length > 3 && (
              <span style={{ fontSize: '0.75rem', color: '#6a737d' }}>
                +{appliedChanges.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffBar;
