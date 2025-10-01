import React, { useState, useEffect } from 'react';

const ProfilePanel = ({ user, schema, onStageChange }) => {
  const [formData, setFormData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user && schema) {
      // Initialize form data with current user profile
      const initialData = {};
      schema.forEach(field => {
        const currentValue = user.raw_profile?.fields?.[field.id]?.value || '';
        initialData[field.id] = currentValue;
      });
      setFormData(initialData);
      setHasChanges(false);
    }
  }, [user, schema]);

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!user || !hasChanges) return;

    // Only include fields that have changed
    const changedFields = {};
    Object.keys(formData).forEach(fieldId => {
      const currentValue = user.raw_profile?.fields?.[fieldId]?.value || '';
      if (formData[fieldId] !== currentValue) {
        changedFields[fieldId] = { value: formData[fieldId] };
      }
    });

    if (Object.keys(changedFields).length > 0) {
      onStageChange({
        type: 'profile',
        payload: {
          userId: user.id,
          fields: changedFields,
        },
      });
      setHasChanges(false);
    }
  };

  const handleCancel = () => {
    if (user && schema) {
      const initialData = {};
      schema.forEach(field => {
        const currentValue = user.raw_profile?.fields?.[field.id]?.value || '';
        initialData[field.id] = currentValue;
      });
      setFormData(initialData);
      setHasChanges(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-panel">
        <h3>Select a User</h3>
        <p style={{ color: '#6a737d', fontSize: '0.875rem' }}>
          Click on a user in the org chart to view and edit their profile.
        </p>
      </div>
    );
  }

  return (
    <div className="profile-panel">
      <h3>{user.name}</h3>
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6a737d' }}>
        {user.title}
      </div>

      <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {schema.map(field => (
          <div key={field.id} className="form-group">
            <label className="form-label">
              {field.label}
              {!field.isEditable && (
                <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>
                  (Read-only)
                </span>
              )}
            </label>
            
            {field.type === 'options' ? (
              <select
                className="form-input"
                value={formData[field.id] || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={!field.isEditable}
              >
                <option value="">Select an option</option>
                {field.raw?.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'date' ? (
              <input
                type="date"
                className="form-input"
                value={formData[field.id] || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={!field.isEditable}
              />
            ) : (
              <input
                type="text"
                className="form-input"
                value={formData[field.id] || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={!field.isEditable}
                placeholder={field.hint}
              />
            )}
            
            {field.hint && (
              <div className="form-hint">{field.hint}</div>
            )}
          </div>
        ))}

        {hasChanges && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-success">
              Save Changes
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </form>

      <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#6a737d' }}>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>Manager:</strong> {user.managerId || 'None'}</div>
        <div><strong>Last Synced:</strong> {user.syncedAt ? new Date(user.syncedAt).toLocaleString() : 'Never'}</div>
      </div>
    </div>
  );
};

export default ProfilePanel;
