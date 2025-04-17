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

// Auth service import
import { useAuth } from '../hooks/useAuth';
import { useAuth as useAuthModule } from '../auth';

// Import feature components
import { GeminiChat } from '../features/gemini/GeminiChat';
import { NotesAndSummaries } from '../features/notes/NotesAndSummaries';

// Import countries list
import countries from '../utils/countries';

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
  const [showingSplash, setShowingSplash] = useState(true);
  
  // Auth context
  const { user, loading, error, isAuthenticated, signInWithGoogle: signInWithGoogleHook, logout } = useAuth();
  const authModule = useAuthModule();

  // כשהפופאפ נפתח, הצג מסך פתיחה (splash) לחצי שנייה
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowingSplash(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Check and restore authentication from storage early
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        console.log('Popup: Checking for stored authentication');
        const data = await chrome.storage.local.get(['wordstream_user_info']);
        if (data.wordstream_user_info) {
          // If we have stored authentication, ensure it's not too old
          const lastAuth = data.wordstream_user_info.lastAuthenticated || 0;
          const now = Date.now();
          // Consider auth valid if refreshed in the last 24 hours
          if (now - lastAuth < 24 * 60 * 60 * 1000) {
            // Force immediate UI update based on stored credentials
            const user = data.wordstream_user_info;
            if (user && typeof user === 'object' && user.uid) {
              console.log('Popup: Restoring auth state from storage immediately', { 
                email: user.email,
                lastAuth: new Date(lastAuth).toISOString()
              });
              
              // We have recent authentication data, force auth state update
              try {
                chrome.runtime.sendMessage({ 
                  action: "AUTH_STATE_CHANGED", 
                  user: data.wordstream_user_info,
                  isAuthenticated: true,
                  source: 'popup_restore'
                });
              } catch (messageError) {
                console.error('Popup: Error broadcasting authentication state:', messageError);
              }
              
              // Also listen for auth change confirmations
              const authChangeListener = (message: any) => {
                if (message.action === 'AUTH_STATE_CHANGED' && message.source === 'background_init') {
                  console.log('Popup: Received confirmation of auth state change');
                  // Cleanup listener after receiving confirmation
                  chrome.runtime.onMessage.removeListener(authChangeListener);
                }
              };
              
              // Add the temporary listener
              chrome.runtime.onMessage.addListener(authChangeListener);
              
              // Set a timeout to remove the listener if no confirmation is received
              setTimeout(() => {
                chrome.runtime.onMessage.removeListener(authChangeListener);
              }, 5000);
            } else {
              console.warn('Popup: Stored user data is invalid or missing UID');
            }
          } else {
            console.log('Popup: Stored authentication is too old:', {
              lastAuth: new Date(lastAuth).toISOString(),
              now: new Date(now).toISOString(),
              ageHours: Math.round((now - lastAuth) / 3600000)
            });
          }
        } else {
          console.log('Popup: No stored authentication found');
        }
      } catch (error) {
        console.error('Popup: Error checking stored auth:', error);
      }
    };

    checkStoredAuth();
  }, []);

  // Load dark mode preference
  useEffect(() => {
    chrome.storage.local.get(['darkMode'], (result) => {
      if (result.darkMode !== undefined) {
        setDarkMode(result.darkMode);
      } else {
        // Check if system prefers dark mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(prefersDark);
        chrome.storage.local.set({ darkMode: prefersDark });
      }
    });
  }, []);

  // Load language and translation settings
  useEffect(() => {
    chrome.storage.local.get(['selectedLanguage', 'isTranslationEnabled', 'showSpeedController', 'showFloatingButtons'], (result) => {
      if (result.selectedLanguage) setSelectedLanguage(result.selectedLanguage);
      if (result.isTranslationEnabled !== undefined) setIsTranslationEnabled(result.isTranslationEnabled);
      if (result.showSpeedController !== undefined) setShowSpeedController(result.showSpeedController);
      if (result.showFloatingButtons !== undefined) setShowFloatingButtons(result.showFloatingButtons);
    });
  }, []);

  // Track current tab
  useEffect(() => {
    const getCurrentTab = async () => {
      try {
        const queryOptions = { active: true, currentWindow: true };
        const [tab] = await chrome.tabs.query(queryOptions);
        if (tab && tab.url) {
          setCurrentTab({ url: tab.url, id: tab.id });
          setIsCompatibleSite(isCompatibleWebsite(tab.url));
        }
      } catch (err) {
        console.error('Error getting current tab:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    
    getCurrentTab();
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    chrome.storage.local.set({ darkMode: newValue });
  };

  // Save settings
  const saveSettings = () => {
    chrome.storage.local.set({ 
      selectedLanguage,
      isTranslationEnabled,
      showSpeedController,
      showFloatingButtons
    });

    // Send settings to content script
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'UPDATE_SETTINGS',
        settings: {
          selectedLanguage,
          isTranslationEnabled,
          showSpeedController,
          showFloatingButtons
        }
      });
    }

    alert('Settings saved successfully!');
  };

  // Handle content script injection for video sites
  const activateOnPage = () => {
    if (!currentTab?.id) return;
    
    chrome.tabs.sendMessage(
      currentTab.id,
      { 
        action: 'ACTIVATE_FEATURES',
        settings: {
          selectedLanguage,
          isTranslationEnabled,
          showSpeedController,
          showFloatingButtons
        }
      },
      (response) => {
        if (!response) {
          // Content script not loaded, inject it
          chrome.scripting.executeScript({
            target: { tabId: currentTab.id as number },
            files: ['content.js']
          }).then(() => {
            // Try sending the message again after script is loaded
            setTimeout(() => {
              if (currentTab.id) {
                chrome.tabs.sendMessage(
                  currentTab.id,
                  { 
                    action: 'ACTIVATE_FEATURES',
                    settings: {
                      selectedLanguage,
                      isTranslationEnabled,
                      showSpeedController,
                      showFloatingButtons
                    }
                  }
                );
              }
            }, 500);
          }).catch(err => {
            console.error('Error injecting content script:', err);
          });
        }
      }
    );
  };

  // Enhanced Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      console.log('Popup: Initiating Google sign-in process');
      
      // Use message passing instead of direct hook call
      const response = await chrome.runtime.sendMessage({ 
        action: "SIGN_IN_WITH_GOOGLE" 
      });
      
      if (!response || !response.success) {
        // Check for specific error message about window not defined
        if (response?.error && response.error.includes('window is not defined')) {
          console.error('Popup: Google sign-in failed due to window reference error. Using direct method.');
          // Try direct sign-in as fallback
          await authModule.signInWithGoogle();
          return;
        }
        
        console.error('Popup: Google sign-in failed:', response?.error || 'Unknown error');
        throw new Error(response?.error || "Google sign-in failed");
      }
      
      // Success - the auth state will be updated automatically
      console.log('Popup: Google sign-in successful, received user:', response.user?.email);
      
      // Set up a listener to ensure authentication state is propagated
      const authConfirmListener = (message: any) => {
        if (message.action === 'AUTH_STATE_CHANGED' && message.isAuthenticated) {
          console.log('Popup: Received auth state confirmation');
          // Remove this listener after confirmation
          setTimeout(() => {
            chrome.runtime.onMessage.removeListener(authConfirmListener);
          }, 500);
        }
      };
      
      // Add temporary listener
      chrome.runtime.onMessage.addListener(authConfirmListener);
      
      // Clean up listener after timeout if no confirmation received
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(authConfirmListener);
      }, 5000);
    } catch (error) {
      console.error("Popup: Login error:", error);
      
      // Check for specific error about window not defined
      if (error instanceof Error && error.message.includes('window is not defined')) {
        alert('אירעה שגיאה בתהליך התחברות עם גוגל. מנסה שיטה חלופית...');
        try {
          // Try direct sign-in as fallback
          await signInWithGoogleHook();
        } catch (secondError) {
          console.error('Popup: Second login attempt failed:', secondError);
          alert('ההתחברות עם גוגל נכשלה. אנא נסה שנית מאוחר יותר.');
        }
      } else {
        // Display generic error
        alert('ההתחברות נכשלה: ' + (error instanceof Error ? error.message : 'שגיאה לא ידועה'));
      }
    }
  };

  // Email/Password sign in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const handleEmailPasswordAuth = async () => {
    if (!email || !password) {
      alert('Please enter your email and password');
      return;
    }
    
    if (isSignUp) {
      // Validate form fields for sign up
      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      if (!age) {
        alert('Please enter your age');
        return;
      }
      
      if (!country) {
        alert('Please select your country');
        return;
      }
    }
    
    try {
      if (isSignUp) {
        // Register new user
        await authModule.signUpWithEmailPassword(email, password);
        // Additional user info would be saved to database here
        // We would create a user profile with age and country
      } else {
        // Sign in existing user
        await authModule.signInWithEmailPassword(email, password);
      }
    } catch (error) {
      console.error('Email/Password auth error:', error);
      // Error state is handled by the auth module
    }
  };

  // Render splash screen first
  if (showingSplash) {
    return (
      <div className={`w-[400px] min-h-[500px] flex justify-center items-center font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-white'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-r-blue-500 border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">WordStream</div>
        </div>
      </div>
    );
  }

  // Render login screen only if not authenticated
  if (!isAuthenticated) {
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
      {loading && (
        <div className="absolute top-2 right-2 z-50">
          <div className="w-5 h-5 border-2 border-t-blue-500 border-r-blue-500 border-b-gray-200 border-l-gray-200 rounded-full animate-spin"></div>
        </div>
      )}
      
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