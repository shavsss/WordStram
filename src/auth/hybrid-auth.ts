import { GoogleAuthProvider, signInWithCredential, Auth, UserCredential } from 'firebase/auth';

/**
 * Gets Google access token using chrome.identity API
 */
export async function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!token) {
          reject(new Error('Failed to get auth token'));
          return;
        }
        
        resolve(token);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Signs in with Google using hybrid approach:
 * 1. Get token from chrome.identity
 * 2. Use token with Firebase authentication
 */
export async function signInWithGoogleHybrid(auth: Auth): Promise<UserCredential> {
  try {
    // Get access token via chrome.identity
    const token = await getGoogleAccessToken();
    
    // Create credential from token
    const credential = GoogleAuthProvider.credential(null, token);
    
    // Sign in to Firebase with credential
    const userCredential = await signInWithCredential(auth, credential);
    
    // Store auth state in local storage for resilience
    await chrome.storage.local.set({
      'wordstream_user_info': {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
        lastAuthenticated: Date.now()
      }
    });
    
    return userCredential;
  } catch (error) {
    console.error("Error during hybrid Google sign-in:", error);
    throw error;
  }
}

/**
 * Refresh token if needed
 */
export async function refreshAuthToken(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (token) {
        // Token refreshed successfully
        resolve();
      } else {
        reject(new Error('Failed to refresh token'));
      }
    });
  });
}

/**
 * Check if user is authenticated by looking at chrome.storage and Firebase Auth
 */
export async function isUserAuthenticated(): Promise<boolean> {
  try {
    // First check Chrome storage
    const data = await chrome.storage.local.get(['wordstream_user_info']);
    const hasStorageUser = !!data.wordstream_user_info;
    
    if (hasStorageUser) {
      // If we have user info in storage, update last authentication time
      const updatedUserInfo = {
        ...data.wordstream_user_info,
        lastAuthenticated: Date.now()
      };
      
      // Save updated timestamp
      await chrome.storage.local.set({
        'wordstream_user_info': updatedUserInfo
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

/**
 * Get current user info from storage
 */
export async function getCurrentUserInfo(): Promise<any | null> {
  try {
    const data = await chrome.storage.local.get(['wordstream_user_info']);
    return data.wordstream_user_info || null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
} 