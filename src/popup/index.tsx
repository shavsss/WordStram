import React, { useState, useEffect, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { MessageType } from '../shared/message-types';
import messageBus from '../shared/message-bus';
import { useAuth } from '../shared/hooks/useAuth';
import { useSettings } from '../shared/hooks/useStorage';
import { Settings, User } from '../shared/types/index';
import './popup.css';

// Import only the essential components eagerly, lazy load the rest
import Login from './components/Login';
// Lazy load non-critical components
const WordList = React.lazy(() => import('./components/WordList'));
const SettingsComponent = React.lazy(() => import('./components/Settings'));
const Statistics = React.lazy(() => import('./components/Statistics'));
const Games = React.lazy(() => import('./components/Games'));
const AiAssistant = React.lazy(() => import('./components/AiAssistant'));

// Tab definitions for the UI
type Tab = 'words' | 'games' | 'settings' | 'statistics' | 'assistant';

// Define prop types for the Settings component to avoid type errors
interface SettingsProps {
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => Promise<boolean>;
}

// Helper function to check if service worker is active
async function ensureServiceWorkerActive(maxAttempts = 3, timeout = 500): Promise<boolean> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await messageBus.sendMessage({
        type: MessageType.SYSTEM_GET_STATUS
      });
      
      if (response && response.isInitialized) {
        console.log('Service worker is active');
        return true;
      }
    } catch (error) {
      console.warn(`Service worker check attempt ${attempts + 1} failed:`, error);
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, timeout));
    }
  }
  
  console.warn('Service worker could not be confirmed active');
  return false;
}

/**
 * Main Popup component
 */
function Popup() {
  const { user, isAuthenticated, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('words');
  const [isLoading, setIsLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState<any>({ backgroundReady: false });
  const [initComplete, setInitComplete] = useState(false);

  // Initialize popup and check service worker status
  useEffect(() => {
    const init = async () => {
      try {
        // Start showing UI after a maximum of 3 seconds regardless of service worker status
        const timeoutId = setTimeout(() => {
          console.log('Timeout reached, showing UI anyway');
          setIsLoading(false);
        }, 3000);

        // Check service worker in parallel
        const isServiceWorkerActive = await ensureServiceWorkerActive();
        
        // Notify background that popup is ready
        try {
          await messageBus.sendMessage({
            type: MessageType.POPUP_READY
          });
          
          // Try to get service status
          const response = await messageBus.sendMessage({
            type: MessageType.GET_SERVICE_STATUS
          });
          
          if (response && response.success) {
            setServiceStatus({
              ...response.status,
              backgroundReady: true
            });
          }
        } catch (error) {
          console.warn('Could not communicate with service worker:', error);
          setServiceStatus({ backgroundReady: isServiceWorkerActive });
        }
        
        clearTimeout(timeoutId);
        setIsLoading(false);
        setInitComplete(true);
      } catch (error) {
        console.error('Error initializing popup:', error);
        setIsLoading(false);
        setInitComplete(true);
      }
    };

    // Start loading essential services in parallel with UI initialization
    const preloadEssentialServices = async () => {
      try {
        // Preload essential modules
        import('../services/storage/storage-service');
        import('../services/firebase/auth-service');
      } catch (error) {
        console.warn('Error preloading services:', error);
      }
    };

    init();
    preloadEssentialServices();
  }, []);

  // Handle tab switching
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };
  
  // If loading, show loading indicator
  if (isLoading) {
    return (
      <div className="popup-container loading">
        <div className="loading-spinner"></div>
        <p>Loading WordStream...</p>
      </div>
    );
  }

  // If not authenticated, show login screen
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <h1>WordStream</h1>
          <p>Sign in to access your vocabulary and settings</p>
        </header>
        
        <Login onLogin={signInWithGoogle} />
        
        <footer className="popup-footer">
          <div className="service-status">
            <span className={`status-indicator ${serviceStatus.backgroundReady ? 'online' : 'offline'}`}>
              {serviceStatus.backgroundReady ? 'Service Online' : 'Service Offline'}
            </span>
          </div>
        </footer>
      </div>
    );
  }

  // Main authenticated popup view
  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>WordStream</h1>
        <div className="user-info">
          {user?.displayName || user?.email || 'User'}
          <button className="logout-button" onClick={signOut}>Logout</button>
        </div>
      </header>
      
      <main className="popup-content">
        <Suspense fallback={<div className="loading-spinner small"></div>}>
          {activeTab === 'words' && <WordList />}
          {activeTab === 'games' && <Games />}
          {activeTab === 'settings' && <SettingsComponent settings={settings} onSettingsChange={updateSettings} />}
          {activeTab === 'statistics' && <Statistics />}
          {activeTab === 'assistant' && <AiAssistant />}
        </Suspense>
      </main>
      
      <nav className="popup-tabs">
        <button 
          className={`tab-button ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => handleTabChange('words')}
        >
          Words
        </button>
        <button 
          className={`tab-button ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => handleTabChange('games')}
        >
          Games
        </button>
        <button 
          className={`tab-button ${activeTab === 'assistant' ? 'active' : ''}`}
          onClick={() => handleTabChange('assistant')}
        >
          Assistant
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          Settings
        </button>
        <button 
          className={`tab-button ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => handleTabChange('statistics')}
        >
          Stats
        </button>
      </nav>
      
      <footer className="popup-footer">
        <div className="service-status">
          <span className={`status-indicator ${serviceStatus.backgroundReady ? 'online' : 'offline'}`}>
            {serviceStatus.backgroundReady ? 'Service Online' : 'Service Offline'}
          </span>
        </div>
      </footer>
    </div>
  );
}

// Create a root and render the app
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <Popup />
);