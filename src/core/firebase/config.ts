/**
 * Firebase configuration - optimized asynchronous version
 */

import { initializeApp, FirebaseApp, FirebaseOptions } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Define global window property for TypeScript
declare global {
  interface Window {
    FIREBASE_API_KEY?: string;
    FIREBASE_CONFIG?: FirebaseOptions;
    FIREBASE_CONFIG_OVERRIDE?: any;
    WordStream?: any;
    handleFirebaseError?: (error: any) => any;
  }
}

// Constants for storage
const STORAGE_KEYS = {
  API_KEY: 'firebase_api_key',
  CONFIG: 'firebase_config'
};

// Hardcoded fallback API key - only used when all else fails
const FALLBACK_API_KEY = "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4";

// Add an offline backup mode
let isInOfflineMode = false;
let offlineModeStartTime = 0;
const OFFLINE_RETRY_INTERVAL = 30000; // Try to reconnect every 30 seconds

/**
 * Set the application to offline mode when Firestore connection fails
 */
export function enterOfflineMode(): void {
  if (!isInOfflineMode) {
    console.log('WordStream: Entering offline mode due to connection issues');
    isInOfflineMode = true;
    offlineModeStartTime = Date.now();
    
    // Notify all parts of the app about offline status
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wordstream_connection_change', { 
        detail: { online: false, timestamp: new Date().toISOString() } 
      }));
    }
  }
}

/**
 * Check if we should attempt to reconnect to Firestore
 */
export function shouldAttemptReconnect(): boolean {
  if (!isInOfflineMode) return false;
  
  // Only try to reconnect every OFFLINE_RETRY_INTERVAL ms
  return (Date.now() - offlineModeStartTime) > OFFLINE_RETRY_INTERVAL;
}

/**
 * Reset offline mode after successful connection
 */
export function exitOfflineMode(): void {
  if (isInOfflineMode) {
    console.log('WordStream: Exiting offline mode - connection restored');
    isInOfflineMode = false;
    
    // Notify all parts of the app about online status
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wordstream_connection_change', { 
        detail: { online: true, timestamp: new Date().toISOString() } 
      }));
    }
  }
}

/**
 * Check if the app is currently in offline mode
 */
export function isOfflineMode(): boolean {
  return isInOfflineMode;
}

/**
 * Safe check for global objects that handles environments where window doesn't exist
 */
const isWindowAvailable = () => {
  return typeof window !== 'undefined';
};

/**
 * Safe access to window properties
 * @param property Property name to access from window
 * @param defaultValue Default value if window or property doesn't exist
 */
const safeWindowAccess = (property: string, defaultValue: any) => {
  if (!isWindowAvailable()) return defaultValue;
  return (window as any)[property] || defaultValue;
};

/**
 * Get Firebase configuration with the most up-to-date API key
 * This fetches from various sources including Chrome storage
 */
export async function getFirebaseConfig(): Promise<FirebaseOptions> {
  try {
    // Try to get the latest API key
    const apiKey = await getApiKey();
    
    // Return a new config object with the updated API key
    return {
      ...FIREBASE_CONFIG,
      apiKey: apiKey || FIREBASE_CONFIG.apiKey
    };
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    return FIREBASE_CONFIG;
  }
}

/**
 * Get API key from various sources with fallbacks
 * @returns Promise that resolves to a string (never null)
 */
export async function getApiKey(): Promise<string> {
  try {
    // First check if it's in Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await new Promise<{[key: string]: any} | null>((resolve) => {
          const timeoutId = setTimeout(() => {
            console.warn('Storage access timed out after 5 seconds');
            resolve(null);
          }, 5000);
          
          chrome.storage.local.get(['firebase_api_key'], (items) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              console.warn('Storage access error:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(items);
            }
          });
        });
        
        if (result && result.firebase_api_key) {
          return result.firebase_api_key;
        }
      } catch (e) {
        console.warn('Error accessing Chrome storage:', e);
      }
    }
    
    // Check global variables if in browser environment
    if (isWindowAvailable()) {
      // Look for it in the window object
      const windowApiKey = safeWindowAccess('FIREBASE_API_KEY', null);
      if (windowApiKey) return windowApiKey;
      
      // Look in FIREBASE_CONFIG global
      const windowConfig = safeWindowAccess('FIREBASE_CONFIG', null);
      if (windowConfig?.apiKey) return windowConfig.apiKey;
    }
    
    // Fallback to hardcoded value
    return FALLBACK_API_KEY;
  } catch (error) {
    console.error('Error getting API key:', error);
    return FALLBACK_API_KEY;
  }
}

/**
 * Update Firebase app configuration if needed
 */
export function updateFirebaseAppConfig(app: FirebaseApp, apiKey: string): void {
  if (!app) return;
  
  try {
    // Access the options object safely
    if (app.options && app.options.apiKey !== apiKey) {
      // Cast to any to access private property
      (app.options as any).apiKey = apiKey;
      console.log('Updated Firebase app API key');
    }
  } catch (e) {
    console.warn('Failed to update Firebase app config:', e);
  }
}

// Initial Firebase configuration with synchronously available key
// This will be replaced by the async version as soon as possible
export const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

// Log the configuration with masked API key
console.log(`WordStream Config: Initial Firebase config with API key: ${
  FIREBASE_CONFIG.apiKey ? FIREBASE_CONFIG.apiKey.substring(0, 6) + '...' : 'undefined'
}`);

// Make initial API key globally available for other scripts
if (typeof window !== 'undefined') {
  window.FIREBASE_API_KEY = FIREBASE_CONFIG.apiKey;
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
}

// Global error handler for Firebase errors that sends reports to background
if (typeof window !== 'undefined' && !window.handleFirebaseError) {
  window.handleFirebaseError = function(error) {
    console.error('WordStream: Firebase error:', error);
    
    // Check for network/offline errors
    if (error && 
        (error.code === 'unavailable' || 
         error.code === 'resource-exhausted' ||
         error.code === 'network-request-failed' ||
         error.message?.includes('network') ||
         error.message?.includes('offline') ||
         error.message?.includes('unavailable') ||
         error.message?.includes('failed to get document'))
    ) {
      // It's likely a connection issue, enter offline mode
      enterOfflineMode();
      
      // Report to background script
      reportErrorToBackground(error);
    }
    
    // Return the error to the caller
    return error;
  };
}

// Initialize Firebase instances
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

/**
 * Initialize Firebase asynchronously with the most up-to-date API key
 * This is the preferred method for initialization
 */
export async function initializeFirebaseAsync(): Promise<{
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}> {
  try {
    // Check if we're in offline mode but should attempt reconnection
    if (isOfflineMode() && !shouldAttemptReconnect()) {
      // Still in offline recovery period, throw an appropriate error
      throw new Error('Firebase connection unavailable - in offline mode');
    }
    
    console.log('WordStream Config: Initializing Firebase asynchronously');
    
    // Get the API key asynchronously
    const apiKey = await getApiKey();
    
    // Create configuration with retrieved key
    const config: FirebaseOptions = {
      ...FIREBASE_CONFIG,
      apiKey
    };
    
    // Update globals for consistency
    if (typeof window !== 'undefined') {
      window.FIREBASE_API_KEY = apiKey;
      window.FIREBASE_CONFIG = config;
    }
    
    // Initialize Firebase
    const asyncApp = initializeApp(config);
    const asyncAuth = getAuth(asyncApp);
    const asyncFirestore = getFirestore(asyncApp);
    
    // Set persistence
    await setPersistence(asyncAuth, browserLocalPersistence);
    
    console.log('WordStream Config: Firebase initialized asynchronously with API key:', 
      apiKey.substring(0, 6) + '...');
    
    // Update the global instances
    app = asyncApp;
    auth = asyncAuth;
    firestore = asyncFirestore;
    
    return { app, auth, firestore };
  } catch (error) {
    console.error('WordStream Config: Async Firebase initialization error:', error);
    
    // Enter offline mode on initialization failure
    enterOfflineMode();
    
    // Try to use global error handler
    if (typeof window !== 'undefined' && window.handleFirebaseError) {
      window.handleFirebaseError(error);
    }
    
    // Return existing instances or create new ones as fallback
    if (app && auth && firestore) {
      return { app, auth, firestore };
    } else {
      // Initialize with synchronous method as fallback
      return initializeFirebaseSynchronously();
    }
  }
}

/**
 * Initialize Firebase synchronously - used only as fallback
 * Prefer initializeFirebaseAsync when possible
 */
function initializeFirebaseSynchronously() {
  try {
    console.log('WordStream Config: Initializing Firebase synchronously');
    
    // Initialize Firebase with synchronously available config
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    firestore = getFirestore(app);
    
    // Set persistence (can't await here)
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log('WordStream Config: Auth persistence set to local'))
      .catch(err => {
        console.warn('WordStream Config: Auth persistence error:', err);
        
        if (typeof window !== 'undefined' && window.handleFirebaseError) {
          window.handleFirebaseError(err);
        }
      });
    
    console.log('WordStream Config: Firebase initialized synchronously');
    
    // Start async update process in background
    updateFirebaseConfig();
    
    return { app, auth, firestore };
  } catch (error) {
    console.error('WordStream Config: Synchronous Firebase initialization error:', error);
    
    if (typeof window !== 'undefined' && window.handleFirebaseError) {
      window.handleFirebaseError(error);
    }
    
    // Create fallback instances for critical failure scenario
    console.warn('WordStream Config: Creating fallback Firebase instances');
    
    try {
      // Try again with fallback key
      const fallbackConfig = {
        ...FIREBASE_CONFIG,
        apiKey: FALLBACK_API_KEY
      };
      
      app = initializeApp(fallbackConfig);
      auth = getAuth(app);
      firestore = getFirestore(app);
      
      console.log('WordStream Config: Fallback Firebase initialized with hardcoded API key');
    } catch (fallbackError) {
      console.error('WordStream Config: Critical failure initializing Firebase:', fallbackError);
      
      // Create minimal implementations to avoid crashing
      app = {} as FirebaseApp;
      auth = {} as Auth;
      firestore = {} as Firestore;
    }
    
    return { app, auth, firestore };
  }
}

/**
 * Update Firebase configuration with asynchronously retrieved API key
 * Used to update the config after initial synchronous setup
 */
async function updateFirebaseConfig() {
  try {
    // Get API key asynchronously
    const apiKey = await getApiKey();
    
    // Update global references
    if (typeof window !== 'undefined') {
      window.FIREBASE_API_KEY = apiKey;
      
      if (window.FIREBASE_CONFIG) {
        window.FIREBASE_CONFIG.apiKey = apiKey;
      }
    }
    
    console.log('WordStream Config: Updated Firebase config with async API key');
  } catch (error) {
    console.warn('WordStream Config: Error updating Firebase config:', error);
  }
}

// Initialize Firebase synchronously for immediate use
// This will be potentially updated later by async processes
const result = initializeFirebaseSynchronously();
app = result.app;
auth = result.auth;
firestore = result.firestore;

// Start async update process
updateFirebaseConfig();

// Export the Firebase instances
export { app, auth, firestore }; 

/**
 * Report errors to the background script
 */
async function reportErrorToBackground(error: any): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Format the error for sending
      const errorInfo = {
        message: error.message || 'Unknown error',
        code: error.code || 'unknown',
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      // Send error to background script
      chrome.runtime.sendMessage({
        action: 'REPORT_FIREBASE_ERROR',
        error: errorInfo
      }).catch(err => {
        console.warn('WordStream: Failed to report error to background:', err);
      });
    }
  } catch (e) {
    console.warn('WordStream: Error reporting to background:', e);
  }
} 