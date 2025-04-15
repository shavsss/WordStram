import { 
  getAuth, 
  onAuthStateChanged,
  User, 
  UserInfo
} from 'firebase/auth';
import { FirebaseApp, initializeApp } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.firebasestorage.app",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806"
};

// Initialize Firebase
let firebaseApp: FirebaseApp | null = null;
let auth = getAuth();

/**
 * Initialize Firebase background service
 * This function initializes Firebase and sets up auth state listeners
 */
export async function initializeBackgroundService(onAuthStateChange?: (isAuthenticated: boolean, user: User | UserInfo | null) => void): Promise<FirebaseApp> {
  try {
    console.log('WordStream: Initializing Firebase background service...');
    
    // Store API keys securely
    const apiKeysToStore = {
      GOOGLE_CLIENT_ID: "1097713470067-4o18jnj4sgujpu4f9o4kogen53e2bknj.apps.googleusercontent.com",
      GOOGLE_API_KEY: firebaseConfig.apiKey
    };
    
    // Save API keys to secure storage if they don't exist
    chrome.storage.local.get(['api_keys'], (result) => {
      if (!result.api_keys) {
        chrome.storage.local.set({ 'api_keys': apiKeysToStore }, () => {
          console.log('WordStream: Saved API keys to secure storage');
        });
      }
    });
    
    // Initialize Firebase if not already initialized
    if (!firebaseApp) {
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    // Get Auth instance and set up auth state listener
    auth = getAuth(firebaseApp);
    
    // Set up auth state change listener
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('WordStream: Auth state changed - User logged in:', user.uid);
        
        // Update all tabs about auth change
        notifyAllTabsAboutAuthChange(true, user);
        
        // Call the callback if provided
        if (onAuthStateChange) {
          onAuthStateChange(true, user);
        }
      } else {
        console.log('WordStream: Auth state changed - User logged out');
        
        // Update all tabs about auth change
        notifyAllTabsAboutAuthChange(false, null);
        
        // Call the callback if provided
        if (onAuthStateChange) {
          onAuthStateChange(false, null);
        }
      }
    });
    
    if (firebaseApp) {
      return firebaseApp;
    } else {
      throw new Error('Failed to initialize Firebase app');
    }
  } catch (error) {
    console.error('WordStream: Error initializing Firebase background service:', error);
    throw error;
  }
}

/**
 * Notify all tabs about auth state changes
 */
export async function notifyAllTabsAboutAuthChange(isAuthenticated: boolean, user: User | UserInfo | null): Promise<void> {
  try {
    console.log('WordStream: Notifying all tabs about auth change:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
    
    // Save auth state to storage
    await chrome.storage.local.set({
      'wordstream_auth_state': isAuthenticated ? 'authenticated' : 'unauthenticated',
      'wordstream_auth_change_time': Date.now()
    });
    
    // Save user info to storage if user is authenticated
    if (isAuthenticated && user) {
      const userInfo = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      };
      
      // Save user info to local storage
      await chrome.storage.local.set({ 'wordstream_user_info': userInfo });
    } else if (!isAuthenticated) {
      // Remove user info from storage on logout
      await chrome.storage.local.remove(['wordstream_user_info']);
      await chrome.storage.session.remove(['current_user']);
    }
    
    // Find all open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          try {
            // Send message to each tab about auth state change
            chrome.tabs.sendMessage(tab.id, {
              action: 'AUTH_STATE_CHANGED',
              data: {
                isAuthenticated,
                timestamp: Date.now(),
                userInfo: isAuthenticated && user ? {
                  uid: user.uid,
                  email: user.email || '',
                  displayName: user.displayName || ''
                } : null
              }
            }).catch(e => {
              // Don't report error - tab might not be listening
              console.debug('WordStream: Error sending auth message to tab', tab.id, e);
            });
          } catch (tabError) {
            // Ignore communication errors with tabs
            console.debug('WordStream: Failed to notify tab', tab.id, tabError);
          }
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Error notifying tabs about auth change:', error);
  }
}

/**
 * Helper function for retrying operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  onFailure?: (error: any, attempt: number) => boolean
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`WordStream: Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      
      // If onFailure returns false, stop retrying
      if (onFailure && !onFailure(error, attempt + 1)) {
        break;
      }
      
      // Wait before next retry, with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)));
      }
    }
  }
  
  throw lastError;
} 