'use client';

/**
 * ==============================================
 * IMPORTS
 * ==============================================
 */

// React and core libraries
import React, { useEffect, useState } from 'react';

// Icons import
import { 
  Moon, 
  Sun, 
  Languages, 
  MessageSquare, 
  FileText, 
  UserRound, 
  LogOut, 
  Settings, 
  Edit3, 
  BookOpen,
  Globe,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';

// UI components import
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';

// Port Connection
import { getPortConnection } from '../utils/port-connection';
import { MessageType, AuthStateMessage } from '../shared/message';

// Import feature components
import { GeminiChat } from '../features/gemini/GeminiChat';
import { NotesAndSummaries } from '../features/notes/NotesAndSummaries';

// Import countries list
import countries from '../utils/countries';
import { AuthErrorBanner } from './components/AuthErrorBanner';

// Create a connection to the background service
const portConnection = getPortConnection({ 
  name: 'popup',
  reconnect: true,
  onDisconnect: () => {
    console.log('WordStream: Connection to background service lost, attempting to reconnect...');
  }
});

/**
 * Checks if the current website is a compatible site
 */
function isCompatibleWebsite(url?: string): boolean {
  if (!url) return false;
  
  // Check for specific Google domains
  const googleDomains = [
    'google.com',
    'google.co.uk',
    'google.co.in',
    'google.ca',
    'google.com.au',
    'google.de',
    'google.fr',
    'google.es',
    'google.it',
    'google.co.jp',
    'google.com.br',
    'google.ru'
  ];
  
  // Check if the URL contains any of these Google domains
  if (googleDomains.some(domain => url.includes(domain))) {
      return true;
  }
  
  // Original video sites still supported
  const videoSites = [
    'youtube.com',
    'youtu.be',
    'netflix.com',
    'udemy.com',
    'coursera.org',
    'vimeo.com',
    'ted.com',
    'hulu.com',
    'primevideo.com',
    'disneyplus.com',
    'hotstar.com',
    'zee5.com',
    'sonyliv.com'
  ];
  
  return videoSites.some(site => url.includes(site));
}

/**
 * Context Recovery Popup Component
 * This component is shown when extension context is invalid
 */
function ExtensionContextErrorRecovery() {
  const handleReload = () => {
    window.location.reload();
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 dark:bg-red-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
          Extension Context Error
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          The extension context has become invalid. This can happen if the extension was updated or temporarily disabled.
        </p>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Please try reloading the extension to restore functionality.
        </p>
        <div className="flex justify-center">
          <button 
            onClick={handleReload}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Reload Extension
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Authentication Error Recovery
 */
function AuthenticationErrorRecovery({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mt-4">
      <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400 mb-3">
        Authentication Problem
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        There was an issue with your authentication. This can happen if your session expired or if there was a connection issue.
      </p>
      <div className="flex justify-center">
        <button 
          onClick={onRefresh}
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Refresh Authentication
        </button>
      </div>
    </div>
  );
}

/**
 * Custom hook for authentication with the background service
 */
function useBackgroundAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Set up listener for auth state changes
    portConnection.addListener(MessageType.AUTH_STATE_CHANGED, (message: AuthStateMessage) => {
      console.log('Received auth state update:', message);
      setIsAuthenticated(message.isAuthenticated);
      setUser(message.user);
      setLoading(false);
    });

    // Request initial auth state
    const getInitialAuthState = async () => {
      try {
        setLoading(true);
        const response = await portConnection.sendMessage(
          { type: MessageType.GET_AUTH_STATE },
          MessageType.AUTH_STATE
        );
        
        setIsAuthenticated(response.isAuthenticated);
        setUser(response.user);
      } catch (error: any) {
        console.error('Error getting auth state:', error);
        setError(error.message || 'Failed to get authentication state');
      } finally {
        setLoading(false);
      }
    };

    getInitialAuthState();

    // Cleanup listeners when component unmounts
    return () => {
      portConnection.removeListener(MessageType.AUTH_STATE_CHANGED, () => {});
    };
  }, []);

  // Function to sign in with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await portConnection.sendMessage(
        { type: MessageType.SIGN_IN_WITH_GOOGLE },
        MessageType.SIGN_IN_RESULT
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Sign in failed');
      }
      
      setIsAuthenticated(true);
      setUser(response.user);
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Failed to sign in with Google');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Function to sign out
  const logout = async () => {
    try {
      setLoading(true);
      const response = await portConnection.sendMessage(
        { type: MessageType.SIGN_OUT },
        MessageType.SIGN_OUT_RESULT
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Sign out failed');
      }
      
      setIsAuthenticated(false);
      setUser(null);
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, isAuthenticated, signInWithGoogle, logout };
}

/**
 * Main Popup Component
 */
export default function Popup() {
  // State hooks
  const [darkMode, setDarkMode] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url: string; id?: number } | null>(null);
  const [isCompatibleSite, setIsCompatibleSite] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeView, setActiveView] = useState<'main' | 'settings' | 'translations' | 'notes' | 'statistics' | 'games'>('main');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(true);
  const [showSpeedController, setShowSpeedController] = useState(true);
  const [showFloatingButtons, setShowFloatingButtons] = useState(true);
  
  // Email/Password auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Auth context using the custom hook
  const { user, loading, error, isAuthenticated, signInWithGoogle, logout } = useBackgroundAuth();

  const [extensionContextError, setExtensionContextError] = useState(false);
  const [authenticationError, setAuthenticationError] = useState(false);
  
  // Check for extension context validity
  useEffect(() => {
    try {
      // Simple check for extension context validity
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) {
        setExtensionContextError(true);
      }
      
      // More thorough context check
      const performContextCheck = async () => {
        try {
          // Try to access chrome API
          await chrome.storage.local.get(['ping']);
        } catch (error) {
          console.error('Popup: Extension context check failed:', error);
          setExtensionContextError(true);
        }
      };
      
      performContextCheck();
    } catch (error) {
      console.error('Popup: Error checking extension context:', error);
      setExtensionContextError(true);
    }
  }, []);
  
  // Check for authentication errors
  useEffect(() => {
    if (error && 
        (error.includes('Authentication required') || 
         error.includes('User not signed in') || 
         error.includes('auth') || 
         error.includes('token'))) {
      setAuthenticationError(true);
    } else {
      setAuthenticationError(false);
    }
  }, [error]);
  
  // Handle auth refresh
  const handleAuthRefresh = async () => {
    setAuthenticationError(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Popup: Error during manual auth refresh:', error);
    }
  };
  
  // Show context error recovery if extension context is invalid
  if (extensionContextError) {
    return <ExtensionContextErrorRecovery />;
  }

  // Load saved settings and get the current tab 
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await chrome.storage.local.get([
          'darkMode',
          'selectedLanguage',
          'isTranslationEnabled',
          'showSpeedController',
          'showFloatingButtons'
        ]);
        
        setDarkMode(settings.darkMode === true);
        setSelectedLanguage(settings.selectedLanguage || 'en');
        setIsTranslationEnabled(settings.isTranslationEnabled !== false);
        setShowSpeedController(settings.showSpeedController !== false);
        setShowFloatingButtons(settings.showFloatingButtons !== false);
        
        console.log('Popup: Settings loaded', settings);
      } catch (error) {
        console.error('Popup: Error loading settings', error);
      }
    };
    
    loadSettings();
    getCurrentTab();
    
    // Apply dark mode if needed
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
    setIsLoaded(true);
  }, []);
  
  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // Get the current tab URL
  const getCurrentTab = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs[0] && tabs[0].url) {
        const newTab = { url: tabs[0].url, id: tabs[0].id };
        setCurrentTab(newTab);
        setIsCompatibleSite(isCompatibleWebsite(newTab.url));
      }
    } catch (error) {
      console.error('Popup: Error getting current tab', error);
    }
  };
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    chrome.storage.local.set({ darkMode: newDarkMode });
  };
  
  // Save settings
  const saveSettings = () => {
    const settings = {
      selectedLanguage,
      isTranslationEnabled,
      showSpeedController,
      showFloatingButtons
    };
    
    chrome.storage.local.set(settings);
    
    // Send settings to content script
    if (currentTab && currentTab.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'UPDATE_SETTINGS',
        settings
      });
    }
    
    setActiveView('main');
  };
  
  // Activate extension on the current page
  const activateOnPage = () => {
    if (currentTab && currentTab.id) {
      // Save current settings first
      const settings = {
        selectedLanguage,
        isTranslationEnabled,
        showSpeedController,
        showFloatingButtons
      };
      
      chrome.storage.local.set(settings);
      
      // Send the activation message
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'ACTIVATE_FEATURES',
        settings
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Popup: Error sending activation message', chrome.runtime.lastError);
          
          // Inject the content script if not already loaded
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id as number },
            files: ['content/content.js']
          }).then(() => {
            // Now try sending the activation message again
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id as number, {
                action: 'ACTIVATE_FEATURES',
                settings
              });
            }, 500);
          }).catch(error => {
            console.error('Popup: Error injecting content script', error);
          });
          
          return;
        }
        
        console.log('Popup: Activation message sent successfully', response);
      });
    }
  };

  // Now using our background auth service
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Popup: Google sign in error', error);
    }
  };

  // Simple stub for email/password auth to be implemented later
  const handleEmailPasswordAuth = async () => {
    alert('Email/password authentication is not implemented in the new architecture yet.');
  };

  // Render login screen
  if (!isAuthenticated && !loading) {
    return (
      <div className={`w-[400px] min-h-[500px] p-0 font-sans ${darkMode ? 'dark' : ''}`}>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 h-[120px] w-full relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleDarkMode}
              className="text-white hover:bg-white/20"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white/10 to-transparent"></div>
          
          <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg">
              <Languages size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        
        <div className="px-6 pt-12 pb-6 bg-white dark:bg-gray-900 min-h-[380px] flex flex-col dark:text-white">
          <h1 className="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">WordStream</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-6">Advanced Language Learning from Videos</p>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{isSignUp ? 'Sign Up with Email' : 'Sign In with Email'}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 dark:text-blue-400"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  // Clear fields when switching modes
                  setConfirmPassword('');
                  setAge('');
                  setCountry('');
                }}
              >
                {isSignUp ? 'Already have an account? Sign In' : 'No account? Sign Up'}
              </Button>
            </div>
            
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              
              {isSignUp && (
                <>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400"
                    >
                      {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  
                  <input
                    type="number"
                    placeholder="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min="1"
                    max="120"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              
              <Button
                className="w-full h-10"
                onClick={handleEmailPasswordAuth}
                isLoading={loading}
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
            </div>
          </div>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or</span>
            </div>
          </div>
          
          <Button 
            fullWidth 
            variant="primary"
            icon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google" />}
            onClick={handleGoogleSignIn}
            isLoading={loading}
            className="h-11 mb-3"
          >
            Sign in with Google
          </Button>
          
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Signing in allows you to save and sync all your words, translations and notes across all your devices.
          </p>
        </div>
      </div>
    );
  }

  // Render settings view
  if (activeView === 'settings') {
    return (
      <div className={`w-[400px] min-h-[500px] p-5 font-sans ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('main')}
            className="text-gray-500"
          >
            Back
          </Button>
        </div>
          
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                  <span>Dark Mode</span>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                  onClick={toggleDarkMode}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Feature Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Show Speed Controller</span>
                  <div 
                    className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${showSpeedController ? 'bg-blue-600' : 'bg-gray-300'}`}
                    onClick={() => setShowSpeedController(!showSpeedController)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${showSpeedController ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Show Floating Buttons</span>
                  <div 
                    className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${showFloatingButtons ? 'bg-blue-600' : 'bg-gray-300'}`}
                    onClick={() => setShowFloatingButtons(!showFloatingButtons)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${showFloatingButtons ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Enable Automatic Translation</span>
                  <div 
                    className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${isTranslationEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    onClick={() => setIsTranslationEnabled(!isTranslationEnabled)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isTranslationEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Target Language</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="he">Hebrew</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ru">Russian</option>
                    <option value="ar">Arabic</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <UserRound size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div>
                  <div className="font-medium">{user?.displayName || 'User'}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="primary"
                onClick={saveSettings}
              >
                Save Settings
              </Button>
              <Button
                variant="danger"
                icon={<LogOut size={16} />}
                onClick={logout}
              >
                Sign Out
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Render translations view
  if (activeView === 'translations') {
    return (
      <div className={`w-[400px] min-h-[500px] p-5 font-sans ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Saved Translations</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('main')}
            className="text-gray-500"
          >
            Back
          </Button>
        </div>
                          
        <div className="space-y-4">
          <div className="text-center py-8">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Globe size={28} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Translations Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
              Translations you save while watching videos will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render notes view
  if (activeView === 'notes') {
    return (
      <div className={`w-[400px] min-h-[500px] p-5 font-sans ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Notes</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('main')}
            className="text-gray-500"
          >
            Back
          </Button>
        </div>
        
        <NotesAndSummaries onBack={() => setActiveView('main')} />
      </div>
    );
  }

  // Render statistics view
  if (activeView === 'statistics') {
    return (
      <div className={`w-[400px] min-h-[500px] p-5 font-sans ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Statistics</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('main')}
            className="text-gray-500"
          >
            Back
          </Button>
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Words Learned</span>
                    <span className="text-sm font-medium">72/100</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '72%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Videos Watched</span>
                    <span className="text-sm font-medium">15</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Notes Created</span>
                    <span className="text-sm font-medium">8</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Usage Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">72</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Words</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-500">15</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Videos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-500">8</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Notes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render games view
  if (activeView === 'games') {
    return (
      <div className={`w-[400px] min-h-[500px] p-5 font-sans ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Learning Games</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('main')}
            className="text-gray-500"
          >
            Back
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-auto mb-3 flex items-center justify-center">
                <Globe size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-medium mb-1">Flashcards</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review your saved words</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-3 flex items-center justify-center">
                <BookOpen size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium mb-1">Word Quiz</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Test your knowledge</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full mx-auto mb-3 flex items-center justify-center">
                <Edit3 size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-medium mb-1">Fill the Gap</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Complete sentences</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full mx-auto mb-3 flex items-center justify-center">
                <MessageSquare size={24} className="text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-medium mb-1">Conversation</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Practice with AI</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render main view (default)
  return (
    <div className={`w-[400px] min-h-[500px] p-0 font-sans ${darkMode ? 'dark' : ''}`}>
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 h-[160px] w-full relative overflow-hidden">
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('settings')}
            className="text-white hover:bg-white/20"
            aria-label="Settings"
          >
            <Settings size={18} />
          </Button>
          <Button 
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            className="text-white hover:bg-white/20"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
        
        {user?.photoURL ? (
          <div className="absolute left-4 top-4 flex items-center gap-2 bg-white/10 p-1 pr-3 rounded-full">
            <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" />
            <span className="text-white text-sm font-medium">{user.displayName}</span>
          </div>
        ) : (
          <div className="absolute left-4 top-4 flex items-center gap-2 bg-white/10 p-1 pr-3 rounded-full">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <UserRound size={16} className="text-white" />
            </div>
            <span className="text-white text-sm font-medium">{user?.displayName || 'User'}</span>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white/10 to-transparent"></div>
        
        <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg">
            <Languages size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
      
      <div className="px-6 pt-12 pb-6 bg-white dark:bg-gray-900 min-h-[340px]">
        <h1 className="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">WordStream</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Advanced Language Learning from Videos</p>
        
        {/* Show auth error banner when needed */}
        {authenticationError && <AuthErrorBanner onRefresh={handleAuthRefresh} />}
        
        {!isLoaded ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : isCompatibleSite ? (
          <div className="space-y-4">
            <Card className="border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20">
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Sparkles size={20} />
                  <span className="font-medium">Compatible Site Detected</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Activate WordStream features on this site.
                </p>
                <Button
                  onClick={activateOnPage}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                >
                  Enable Tools on This Page
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-gray-500 dark:text-gray-400">This page is not a compatible site.</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Visit a Google site or video platform to use the WordStream tools.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Card
            isHoverable
            isClickable
            onClick={() => setActiveView('translations')}
            className="text-center"
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3">
                <Globe size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-medium">Translations</h3>
            </CardContent>
          </Card>
          
          <Card
            isHoverable
            isClickable
            onClick={() => setActiveView('notes')}
            className="text-center"
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
                <FileText size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-medium">Notes</h3>
            </CardContent>
          </Card>
          
          <Card
            isHoverable
            isClickable
            onClick={() => setActiveView('statistics')}
            className="text-center"
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-3">
                <FileText size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium">Statistics</h3>
            </CardContent>
          </Card>
          
          <Card
            isHoverable
            isClickable
            onClick={() => setActiveView('games')}
            className="text-center"
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-3">
                <BookOpen size={24} className="text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-medium">Learning Games</h3>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 