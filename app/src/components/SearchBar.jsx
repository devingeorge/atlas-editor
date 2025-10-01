import React, { useState, useMemo } from 'react';

const SearchBar = ({ users, onUserSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => 
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.title?.toLowerCase().includes(term)
    ).slice(0, 10); // Limit results
  }, [users, searchTerm]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleUserClick(filteredUsers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setSelectedIndex(-1);
    }
  };

  const handleUserClick = (user) => {
    onUserSelect(user);
    setSearchTerm('');
    setSelectedIndex(-1);
  };

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search users by name, email, or title..."
        className="search-input"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      
      {filteredUsers.length > 0 && (
        <div className="search-results">
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className={`search-result-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => handleUserClick(user)}
            >
              <div style={{ fontWeight: '600' }}>{user.name}</div>
              <div style={{ fontSize: '0.875rem', color: '#6a737d' }}>
                {user.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6a737d' }}>
                {user.email}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
