/**
 * Firebase Authentication Service
 * Manages user authentication and token validation
 */

import AuthManager from '@/core/auth-manager';
import { User } from '../types';

/**
 * Get the current user ID
 * @returns Promise resolving to the user ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // Try to get the current user from AuthManager
    const user = AuthManager.getCurrentUser();
    if (user && user.uid) {
      return user.uid;
    }
    
    // Fallback to window object if AuthManager can't be used
    if (typeof window !== 'undefined' && window.WordStream?.currentUser?.uid) {
      console.log('WordStream: Using user from window.WordStream:', window.WordStream.currentUser.uid);
      return window.WordStream.currentUser.uid;
    }
    
    // In a background/service worker context, localStorage isn't available
    // Instead, check chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        return new Promise<string | null>((resolve) => {
          chrome.storage.local.get(['wordstream_user_info'], (result) => {
            if (chrome.runtime.lastError) {
              console.warn('WordStream: Error reading user from storage:', chrome.runtime.lastError);
              resolve(null);
              return;
            }
            
            if (result && result.wordstream_user_info && result.wordstream_user_info.uid) {
              console.log('WordStream: Using user from chrome.storage:', result.wordstream_user_info.uid);
              resolve(result.wordstream_user_info.uid);
              return;
            }
            
            resolve(null);
          });
        });
      } catch (storageError) {
        console.warn('WordStream: Error accessing chrome.storage:', storageError);
        return null;
      }
    }
    
    console.warn('WordStream: No authenticated user found');
    return null;
  } catch (error) {
    console.warn('WordStream: Error getting current user ID:', error);
    return null;
  }
}

/**
 * Synchronous version of getCurrentUserId for backwards compatibility
 * @returns The user ID or null
 * @deprecated Use the async getCurrentUserId instead
 */
export function getCurrentUserIdSync(): string | null {
  try {
    // Try to get the current user from AuthManager
    const user = AuthManager.getCurrentUser();
    if (user && user.uid) {
      return user.uid;
    }
    
    // Fallback to window object if AuthManager can't be used
    if (typeof window !== 'undefined' && window.WordStream?.currentUser?.uid) {
      return window.WordStream.currentUser.uid;
    }
    
    // We can't access chrome.storage.local synchronously, so just return null
    return null;
  } catch (error) {
    console.warn('WordStream: Error getting current user ID synchronously:', error);
    return null;
  }
}

/**
 * Ensure we have an authenticated user, refreshing token if needed
 * @returns Promise resolving to a user ID or null
 */
export async function ensureAuthenticatedUser(): Promise<string | null> {
  try {
    // First check if we have a valid user
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('WordStream: No user ID found during authentication check');
      return null;
    }
    
    // Try to verify and refresh the token
    const isTokenValid = await AuthManager.verifyTokenAndRefresh();
    if (!isTokenValid) {
      console.warn('WordStream: Token validation failed');
      
      // Clear invalid authentication data
      try {
        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove(['wordstream_auth_state', 'wordstream_user_info']);
          console.log('WordStream: Cleared invalid auth data from storage');
        }
      } catch (clearError) {
        console.error('WordStream: Error clearing invalid auth data:', clearError);
      }
      
      return null;
    }
    
    return userId;
  } catch (error) {
    console.warn('WordStream: Auth validation error:', error);
    return null;
  }
}

/**
 * Check connection to Firestore and authenticate user
 * @returns A promise with connection status
 */
export async function checkFirestoreConnection(): Promise<{ connected: boolean; userId?: string | null; error?: string }> {
  // Check if we're online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { connected: false, error: 'Device is offline' };
  }

  // Check if we have an authenticated user
  const userId = await ensureAuthenticatedUser();
  if (!userId) {
    return { connected: false, error: 'No authenticated user' };
  }

  return { connected: true, userId };
}

/**
 * Get the current user information
 * @returns User object or null
 */
export function getCurrentUser(): User | null {
  try {
    const user = AuthManager.getCurrentUser();
    if (user) {
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined
      };
    }
    
    return null;
  } catch (error) {
    console.error('WordStream: Error getting current user:', error);
    return null;
  }
} 