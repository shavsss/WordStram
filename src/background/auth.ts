/**
 * Authentication utilities for the background service
 */

import {
  getAuth,
  GoogleAuthProvider, 
  signInWithCredential,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { saveAuthLocal } from './storage';
import { MessageType } from './constants';

// Global auth state
let currentUser: User | null = null;

/**
 * Authenticate with Google using Chrome Identity API
 * @returns The authenticated user or null if authentication failed
 */
export async function authenticateWithGoogle(): Promise<User | null> {
  try {
    const token = await getAuthToken({ interactive: true });
    if (!token) {
      console.error('WordStream: No auth token received');
      return null;
    }
    
    const auth = getAuth();
    const credential = GoogleAuthProvider.credential(null, token);
    const userCredential = await signInWithCredential(auth, credential);
    currentUser = userCredential.user;
    
    // Save user info to local storage
    await saveAuthLocal({
      uid: currentUser.uid,
      email: currentUser.email,
      refreshToken: currentUser.refreshToken,
      displayName: currentUser.displayName
    });
    
    return currentUser;
  } catch (error) {
    console.error('WordStream: Authentication error:', error);
    return null;
  }
}

/**
 * Get auth token from Chrome Identity API
 * @param options Token options
 * @returns Auth token
 */
function getAuthToken(options: chrome.identity.TokenDetails): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(options, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token || '');
      }
    });
  });
}

/**
 * Initialize auth state listeners
 */
export function initAuthListeners() {
  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    // Send update to all clients
    chrome.runtime.sendMessage({
      type: MessageType.AUTH_STATE_CHANGED,
      payload: {
        isAuthenticated: !!user,
        user: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        } : null
      }
    });
  });
}

/**
 * Get current authenticated user
 * @returns Current user or null if not authenticated
 */
export function getCurrentUser(): User | null {
  return currentUser;
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<void> {
  const auth = getAuth();
  await signOut(auth);
  currentUser = null;
  
  // Clear auth data from local storage
  await chrome.storage.local.remove('wordstream_auth');
  
  // Clear cached auth tokens
  return new Promise((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(resolve);
  });
} 