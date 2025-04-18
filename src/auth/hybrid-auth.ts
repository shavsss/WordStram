import { signInWithCredential, GoogleAuthProvider, UserCredential, User, Auth } from 'firebase/auth';
import { getFirebaseServices } from './firebase-init';

/**
 * Get a Google access token using the Chrome Identity API
 * @returns Promise<string> A promise that resolves to a Google access token
 */
export const getGoogleAccessToken = async (): Promise<string> => {
  console.log('Retrieving Google access token...');
  
  try {
    // Define the auth parameters for Google Sign-In
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;
    const scopes = manifest.oauth2?.scopes || [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    console.log('Using client ID:', clientId);

    if (!clientId) {
      throw new Error('OAuth2 client_id not defined in manifest.json');
    }

    // Use chrome.identity API to get auth token
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome identity error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!token) {
          console.error('Failed to get auth token');
          reject(new Error('Failed to get auth token'));
          return;
        }
        
        console.log('Successfully retrieved auth token');
        resolve(token);
      });
    });
    
    return token;
  } catch (error) {
    console.error('Error getting Google access token:', error);
    throw error;
  }
};

/**
 * Sign in with Google using a hybrid approach for Chrome extensions
 * @param authInstance Optional Firebase Auth instance (falls back to default if not provided)
 * @returns Promise<UserCredential> A promise that resolves to a Firebase UserCredential
 */
export const signInWithGoogleHybrid = async (authInstance?: Auth): Promise<UserCredential> => {
  console.log('Starting Google Sign-in (hybrid method)...');
  
  try {
    // Get the access token from Chrome Identity API
    const accessToken = await getGoogleAccessToken();
    console.log('Access token obtained, proceeding to Firebase auth...');
    
    // Create a Google credential with the token
    const credential = GoogleAuthProvider.credential(null, accessToken);
    
    // Get the auth service
    let authToUse = authInstance;
    if (!authToUse) {
      const services = await getFirebaseServices();
      if (!services.auth) {
        throw new Error('Firebase Auth not initialized');
      }
      authToUse = services.auth;
    }
    
    // Sign in to Firebase with the Google credential
    const userCredential = await signInWithCredential(authToUse, credential);
    console.log('Successfully signed in with Google:', userCredential.user.displayName);
    
    // Save user info to storage
    await saveUserInfoToStorage(userCredential.user);
    
    return userCredential;
  } catch (error) {
    console.error('Error during Google sign-in:', error);
    throw error;
  }
};

/**
 * Save user information to Chrome storage
 * @param user The Firebase User object
 */
const saveUserInfoToStorage = async (user: User): Promise<void> => {
  console.log('Saving user info to storage...');
  
  try {
    const userInfo = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      isAuthenticated: true,
      lastLogin: new Date().toISOString(),
    };
    
    // Save to Chrome storage
    await chrome.storage.local.set({ 'userInfo': userInfo });
    console.log('User info saved to storage successfully');
  } catch (error) {
    console.error('Error saving user info to storage:', error);
    throw error;
  }
};

/**
 * Check if a token is expired
 * @param timestamp The timestamp when token was last refreshed
 * @returns Boolean indicating if token is likely expired
 */
function isTokenExpired(timestamp: number): boolean {
  if (!timestamp) return true;
  
  const now = Date.now();
  const TOKEN_LIFETIME = 45 * 60 * 1000; // 45 minutes
  return now - timestamp > TOKEN_LIFETIME;
}

/**
 * Store validated user info to local storage
 * @param userInfo User information to store
 */
export async function storeUserInfoToStorage(userInfo: any): Promise<void> {
  try {
    // Store with timestamp for persistence
    await chrome.storage.local.set({
      'wordstream_user_info': {
        ...userInfo,
        lastAuthenticated: Date.now(),
        tokenRefreshTime: Date.now()
      },
      'wordstream_auth_state': {
        isAuthenticated: true,
        lastChecked: Date.now()
      }
    });
    
    console.log('Hybrid Auth: User info stored to local storage');
  } catch (error) {
    console.error('Hybrid Auth: Error storing user info:', error);
    throw error;
  }
}

/**
 * Refresh the authentication token
 * @returns Promise<string | null> A promise that resolves to a refreshed token or null
 */
export const refreshAuthToken = async (): Promise<string | null> => {
  console.log('Hybrid Auth: Attempting to refresh auth token...');
  
  try {
    // Check if we should try refresh based on stored timestamp
    try {
      const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
      const tokenRefreshTime = authInfo.wordstream_user_info?.tokenRefreshTime || 0;
      
      if (!isTokenExpired(tokenRefreshTime)) {
        console.log('Hybrid Auth: Token still fresh, no need to refresh');
        return "existing_token_still_valid";
      }
    } catch (checkError) {
      console.warn('Hybrid Auth: Error checking token freshness:', checkError);
    }
    
    // Use chrome.identity API to get a fresh token
    const token = await new Promise<string | null>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          console.warn('Hybrid Auth: Error refreshing token:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        if (!token) {
          console.warn('Hybrid Auth: No token returned during refresh');
          resolve(null);
          return;
        }
        
        console.log('Hybrid Auth: Auth token refreshed successfully');
        resolve(token);
      });
    });
    
    if (token) {
      // Update token refresh time in storage
      try {
        const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
        if (authInfo.wordstream_user_info) {
          await chrome.storage.local.set({
            'wordstream_user_info': {
              ...authInfo.wordstream_user_info,
              tokenRefreshTime: Date.now(),
              lastAuthenticated: Date.now()
            },
            'wordstream_auth_state': {
              isAuthenticated: true,
              lastChecked: Date.now()
            }
          });
          
          // Broadcast auth state for other components
          try {
            chrome.runtime.sendMessage({ 
              action: "AUTH_STATE_CHANGED", 
              isAuthenticated: true,
              user: {
                ...authInfo.wordstream_user_info,
                tokenRefreshTime: Date.now(),
                lastAuthenticated: Date.now()
              },
              source: 'token_refresh'
            });
          } catch (broadcastError) {
            console.warn('Hybrid Auth: Error broadcasting refreshed auth state:', broadcastError);
          }
        }
      } catch (storageError) {
        console.warn('Hybrid Auth: Error updating token refresh time:', storageError);
      }
    }
    
    return token;
  } catch (error) {
    console.error('Hybrid Auth: Error in refresh token flow:', error);
    return null;
  }
};

/**
 * Check if the user is authenticated
 * @returns Promise<boolean> A promise that resolves to a boolean indicating if the user is authenticated
 */
export const isUserAuthenticated = async (): Promise<boolean> => {
  console.log('Checking if user is authenticated...');
  
  try {
    // First check Chrome storage
    const data = await chrome.storage.local.get(['userInfo']);
    const userInfo = data.userInfo;
    
    if (userInfo?.isAuthenticated) {
      console.log('User authenticated according to storage');
      
      // Verify with Firebase Auth as well
      const services = await getFirebaseServices();
      const currentUser = services.auth?.currentUser;
      if (currentUser) {
        console.log('User also authenticated in Firebase Auth');
        return true;
      }
      
      // If we have userInfo but no currentUser in Firebase,
      // try to refresh the token
      const token = await refreshAuthToken();
      if (token) {
        console.log('Successfully refreshed token');
        return true;
      }
      
      console.log('Failed to refresh token, user not authenticated');
      return false;
    }
    
    console.log('User not authenticated according to storage');
    return false;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
};

/**
 * Get the current user information from storage
 * @returns Promise<any | null> A promise that resolves to the user information or null
 */
export const getCurrentUserInfo = async (): Promise<any | null> => {
  console.log('Retrieving current user info from storage...');
  
  try {
    const data = await chrome.storage.local.get(['userInfo']);
    const userInfo = data.userInfo;
    
    if (userInfo) {
      console.log('User info found in storage');
      return userInfo;
    }
    
    console.log('No user info found in storage');
    return null;
  } catch (error) {
    console.error('Error retrieving user info from storage:', error);
    return null;
  }
}; 