// Send 'popup ready' message to background service
chrome.runtime.sendMessage({ type: 'POPUP_READY' }, function(response) {
  // Popup is loaded, now check auth state
  getAuthState();
});

// References to DOM elements
const loadingElement = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const statusText = document.getElementById('status-text');
const userNameElement = document.getElementById('user-name');
const userEmailElement = document.getElementById('user-email');
const avatarElement = document.getElementById('avatar');
const googleSignInButton = document.getElementById('google-sign-in');
const signOutButton = document.getElementById('sign-out');
const enableToggle = document.getElementById('enable-toggle');
const languageSelect = document.getElementById('language-select');
const openSettingsButton = document.getElementById('open-settings');
const themeToggle = document.getElementById('theme-toggle');
const darkIcon = document.getElementById('dark-icon');
const lightIcon = document.getElementById('light-icon');

// Theme handling
function initTheme() {
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark-theme', isDarkMode);
  darkIcon.classList.toggle('hidden', !isDarkMode);
  lightIcon.classList.toggle('hidden', isDarkMode);
}

themeToggle.addEventListener('click', () => {
  const isDarkMode = document.body.classList.toggle('dark-theme');
  localStorage.setItem('darkMode', isDarkMode);
  darkIcon.classList.toggle('hidden', !isDarkMode);
  lightIcon.classList.toggle('hidden', isDarkMode);
});

// Initialize theme
initTheme();

// Check authentication state
function getAuthState() {
  // Show loading state
  loadingElement.classList.remove('hidden');
  authContainer.classList.add('hidden');
  mainContainer.classList.add('hidden');
  
  // Send message to background script
  chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, function(response) {
    // Hide loading
    loadingElement.classList.add('hidden');
    
    if (response && response.isAuthenticated) {
      // User is authenticated, show main container
      mainContainer.classList.remove('hidden');
      
      // Update user info
      if (response.user) {
        userNameElement.textContent = response.user.displayName || 'User';
        userEmailElement.textContent = response.user.email || '';
        
        // Set avatar text to first letter of display name
        const initial = (response.user.displayName || 'U').charAt(0).toUpperCase();
        avatarElement.textContent = initial;
      }
      
      // Check if extension is enabled for current page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        chrome.runtime.sendMessage({ 
          type: 'GET_PAGE_STATUS',
          payload: { url: currentTab.url }
        }, function(statusResponse) {
          if (statusResponse && statusResponse.isEnabled !== undefined) {
            enableToggle.checked = statusResponse.isEnabled;
          }
        });
      });
      
      // Get language preference
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(settingsResponse) {
        if (settingsResponse && settingsResponse.settings) {
          languageSelect.value = settingsResponse.settings.targetLanguage || 'en';
        }
      });
      
    } else {
      // User is not authenticated, show auth container
      authContainer.classList.remove('hidden');
    }
  });
}

// Event listeners

// Google Sign In
googleSignInButton.addEventListener('click', function() {
  statusText.textContent = 'Signing in...';
  chrome.runtime.sendMessage({ type: 'GOOGLE_SIGN_IN' }, function(response) {
    if (response && response.success) {
      getAuthState(); // Refresh auth state
    } else {
      statusText.textContent = 'Sign in failed';
      setTimeout(() => {
        statusText.textContent = 'Ready';
      }, 3000);
    }
  });
});

// Sign Out
signOutButton.addEventListener('click', function() {
  statusText.textContent = 'Signing out...';
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, function(response) {
    getAuthState(); // Refresh auth state
    statusText.textContent = 'Signed out';
    setTimeout(() => {
      statusText.textContent = 'Ready';
    }, 3000);
  });
});

// Enable/Disable Toggle
enableToggle.addEventListener('change', function() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    chrome.runtime.sendMessage({ 
      type: 'SET_PAGE_STATUS',
      payload: { 
        url: currentTab.url,
        isEnabled: enableToggle.checked
      }
    }, function(response) {
      if (response && response.success) {
        statusText.textContent = enableToggle.checked ? 'Enabled' : 'Disabled';
        setTimeout(() => {
          statusText.textContent = 'Ready';
        }, 2000);
      }
    });
  });
});

// Language Select
languageSelect.addEventListener('change', function() {
  chrome.runtime.sendMessage({ 
    type: 'SAVE_SETTINGS',
    payload: { settings: { targetLanguage: languageSelect.value } }
  }, function(response) {
    if (response && response.success) {
      statusText.textContent = 'Language updated';
      setTimeout(() => {
        statusText.textContent = 'Ready';
      }, 2000);
    }
  });
});

// Open Settings
openSettingsButton.addEventListener('click', function() {
  chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' }, function(response) {
    // Close popup after opening settings
    window.close();
  });
}); 