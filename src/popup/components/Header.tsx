import React from 'react';
import { useAuth } from '../../shared/hooks/useAuth';

type HeaderProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const { user, signOut } = useAuth();

  return (
    <header className="popup-header">
      <div className="header-top">
        <h1 className="logo">WordStream</h1>
        {user && (
          <div className="user-menu">
            <div className="user-avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} />
              ) : (
                <div className="avatar-placeholder">
                  {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="user-dropdown">
              <div className="user-info">
                <p className="username">{user.displayName || 'User'}</p>
                <p className="email">{user.email}</p>
              </div>
              <button className="sign-out-button" onClick={signOut}>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'words' ? 'active' : ''}`} 
          onClick={() => onTabChange('words')}
        >
          Words
        </button>
        <button 
          className={`tab-button ${activeTab === 'games' ? 'active' : ''}`} 
          onClick={() => onTabChange('games')}
        >
          Games
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => onTabChange('settings')}
        >
          Settings
        </button>
      </div>
    </header>
  );
};

export default Header; 