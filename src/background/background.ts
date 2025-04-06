/**
 * WordStream Background Script
 * 
 * This is the central point for API key management and initialization.
 * It serves as the source of truth for Firebase API key.
 */
import { FirebaseOptions } from "firebase/app";

// Constants for storage keys
const STORAGE_KEYS = {
  API_KEY: 'firebase_api_key',
  CONFIG: 'firebase_config',
  LAST_ERROR: 'firebase_last_error'
};

// Globals for Service Worker environment (avoid using window)
const globalThis = self;

// Firebase API keys configuration
const API_KEYS = {
  // Production key - used in production environment
  PRODUCTION: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  
  // Development key - used for testing with limited permissions
  // In a real production app, this would be a different key with more restrictions
  DEVELOPMENT: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4"
};

// Basic Firebase configuration template
const FIREBASE_CONFIG_TEMPLATE: FirebaseOptions = {
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

/**
 * Get appropriate API key based on environment
 * In a real app, this would choose between production/development keys
 */
function getEnvironmentApiKey(): string {
  // For now, we'll default to the production key
  // In a real setup, this would check process.env.NODE_ENV or similar
  return API_KEYS.PRODUCTION;
}

/**
 * Initialize API key and save it to storage
 * Returns the initialized key
 */
async function initializeApiKey(): Promise<string> {
  const apiKey = getEnvironmentApiKey();
  
  try {
    // Create full Firebase config with API key
    const fullConfig = {
      ...FIREBASE_CONFIG_TEMPLATE,
      apiKey
    };
    
    // Save API key and full config to storage
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.API_KEY]: apiKey,
      [STORAGE_KEYS.CONFIG]: fullConfig
    });
    
    console.log('[WordStream] API key initialized in storage');
    return apiKey;
  } catch (error) {
    console.error('[WordStream] Failed to save API key to storage:', error);
    return apiKey; // Return key anyway, even if saving failed
  }
}

/**
 * Retrieve API key from storage or initialize if not present
 */
async function getApiKey(): Promise<string> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
    
    if (result && result[STORAGE_KEYS.API_KEY]) {
      console.log('[WordStream] Retrieved API key from storage');
      return result[STORAGE_KEYS.API_KEY];
    }
    
    // If key doesn't exist yet, initialize it
    console.log('[WordStream] API key not found in storage, initializing');
    return await initializeApiKey();
  } catch (error) {
    console.error('[WordStream] Error retrieving API key from storage:', error);
    return getEnvironmentApiKey(); // Fallback to environment key
  }
}

// Initialize API key immediately
let API_KEY = getEnvironmentApiKey(); // Temporary synchronous key for immediate use

// Then asynchronously update it
getApiKey().then(key => {
  API_KEY = key;
  console.log('[WordStream] Background script initialized with API key:', key.substring(0, 6) + '...');
  
  // Broadcast key to any open supported tabs
  broadcastApiKeyToTabs();
});

/**
 * Broadcast API key to all supported tabs
 */
async function broadcastApiKeyToTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      
      // Only target supported sites
      const isVideoSite = tab.url.includes('youtube.com') || tab.url.includes('netflix.com');
      if (!isVideoSite) continue;
      
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'UPDATE_FIREBASE_API_KEY',
          apiKey: API_KEY
        }).catch(err => {
          // Content script might not be ready, this is expected
          console.debug('[WordStream] Tab not ready for API key update:', err);
        });
      } catch (error) {
        // Ignore errors for tabs that can't receive messages
      }
    }
  } catch (error) {
    console.warn('[WordStream] Error broadcasting API key to tabs:', error);
  }
}

// Set up installation/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[WordStream] Extension ${details.reason}`, details);
  
  // Reinitialize API key on install/update
  API_KEY = await initializeApiKey();
  console.log(`[WordStream] API key reset on ${details.reason}`);
  
  // For major updates/installations, we could do additional setup here
});

// Listen for tab updates to broadcast API key to content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Only send to supported sites
    const isVideoSite = tab.url.includes('youtube.com') || tab.url.includes('netflix.com');
    
    if (isVideoSite) {
      // Send API key to content script
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'UPDATE_FIREBASE_API_KEY',
          apiKey: API_KEY
        }).catch(err => {
          // Content script might not be ready, this is expected
          console.debug('[WordStream] Tab not ready for API key update:', err);
        });
      } catch (error) {
        console.debug('[WordStream] Error communicating with tab', error);
      }
    }
  }
});

/**
 * Helper function to safely convert errors to string format
 * Prevents [object Object] errors in logs
 */
function formatErrorForLog(error: unknown): string {
  if (!error) return 'Unknown error';
  
  try {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    // Handle object-type errors
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return `Error formatting error: ${e}`;
  }
}

// Set up message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Log message for debugging (with redacted sensitive info)
  let logMessage = { ...message };
  if (logMessage.apiKey) logMessage.apiKey = logMessage.apiKey.substring(0, 6) + '...';
  console.log('[WordStream] Message received:', logMessage);
  
  // Return true immediately - this will keep the message port open for async responses
  const keepChannelOpen = true;
  
  // Store safe response function that checks if reply is possible
  const safeRespond = (response: any) => {
    try {
      sendResponse(response);
    } catch (error) {
      // Port might be closed - this is normal when sender navigates away
      console.debug('[WordStream] Cannot send response, port may be closed:', formatErrorForLog(error));
    }
  };
  
  // Handle different message types
  if (message && message.action) {
    switch (message.action) {
      case 'GET_FIREBASE_API_KEY':
        // Handle API key request
        getApiKey()
          .then(apiKey => {
            safeRespond({ apiKey });
          })
          .catch(error => {
            console.error('[WordStream] Error getting API key:', formatErrorForLog(error));
            safeRespond({ error: formatErrorForLog(error) });
          });
        return keepChannelOpen;
        
      case 'REPORT_FIREBASE_ERROR':
        // Handle error reporting
        console.error('[WordStream] Reported Firebase error:', 
          message.error ? formatErrorForLog(message.error) : 'No error details provided');
        
        // Send a new API key in response
        getApiKey()
          .then(apiKey => {
            safeRespond({ apiKey, acknowledged: true });
          })
          .catch(error => {
            safeRespond({ error: formatErrorForLog(error), acknowledged: true });
          });
        return keepChannelOpen;
      
      // Add cases for other message actions...
    }
  }
  
  // Return false for unhandled messages - no need to keep channel open
  return false;
});

// Log that we're ready
console.log('[WordStream] Background service worker initialized'); 