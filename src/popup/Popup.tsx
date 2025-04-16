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
  Sparkles
} from 'lucide-react';

// UI components import
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';

// Auth service import
import { useAuth } from '../hooks/useAuth';

// Import feature components
import { GeminiChat } from '../features/gemini/GeminiChat';
import { NotesAndSummaries } from '../features/notes/NotesAndSummaries';

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
  
  // Auth context
  const { user, loading, error, isAuthenticated, signInWithGoogle, logout } = useAuth();

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

  // Render login screen
  if (!isAuthenticated && !loading) {
    return (
      <div className={`w-[400px] min-h-[500px] p-0 font-sans ${darkMode ? 'dark' : ''}`}>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 h-[160px] w-full relative overflow-hidden">
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
        
        <div className="px-6 pt-12 pb-6 bg-white dark:bg-gray-900 min-h-[360px] flex flex-col">
          <h1 className="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">WordStream</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Advanced Language Learning from Videos</p>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          
          <Button 
            fullWidth 
            variant="primary"
            icon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google" />}
            onClick={signInWithGoogle}
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