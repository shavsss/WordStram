/**
 * Firebase Authentication Service
 * Manages user authentication and token validation
 */

// import AuthManager from '@/core/auth-manager';
import { User } from '../types';
import { auth } from '../config';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Get the current user ID
 * @returns Promise resolving to the user ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // Try to get the current user from auth
    const user = auth.currentUser;
    if (user && user.uid) {
      return user.uid;
    }
    
    // בדיקה האם אנחנו בסביבת דפדפן או בסביבת service worker
    const isServiceWorker = typeof self !== 'undefined' && typeof Window === 'undefined';
    
    // Fallback to global object if available and we're in browser environment
    if (!isServiceWorker && typeof globalThis !== 'undefined' && (globalThis as any).WordStream?.currentUser?.uid) {
      console.log('WordStream: Using user from globalThis.WordStream:', (globalThis as any).WordStream.currentUser.uid);
      return (globalThis as any).WordStream.currentUser.uid;
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
    // Try to get the current user from auth
    const user = auth.currentUser;
    if (user && user.uid) {
      return user.uid;
    }
    
    // בדיקה האם אנחנו בסביבת דפדפן או בסביבת service worker
    const isServiceWorker = typeof self !== 'undefined' && typeof Window === 'undefined';
    
    // Fallback to global object if available and we're in browser environment
    if (!isServiceWorker && typeof globalThis !== 'undefined' && (globalThis as any).WordStream?.currentUser?.uid) {
      return (globalThis as any).WordStream.currentUser.uid;
    }
    
    // We can't access chrome.storage.local synchronously, so just return null
    return null;
  } catch (error) {
    console.warn('WordStream: Error getting current user ID synchronously:', error);
    return null;
  }
}

/**
 * ניסיון יזום לרענון טוקן אימות
 * @returns Promise שמתרכז לאמת אם רענון הטוקן הצליח
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    console.log('WordStream: Attempting to refresh auth token');
    
    // אם אנחנו בסביבת Service Worker בלי גישה לסביבת דפדפן, לנסות רענון באמצעות Firebase SDK
    if (typeof self !== 'undefined' && typeof Window === 'undefined' && auth) {
      // בסביבת Service Worker ננסה לגשת ל-currentUser של firebase/auth
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        try {
          // ניסיון לרענן טוקן עם Firebase
          await currentUser.getIdToken(true);
          console.log('WordStream: Successfully refreshed token using Firebase SDK');
          return true;
        } catch (tokenError) {
          console.error('WordStream: Failed to refresh token using Firebase SDK:', tokenError);
          // נכשל ברענון - סימן שהסשן כנראה פג באמת
          return false;
        }
      } else {
        console.warn('WordStream: No current user available to refresh token');
        return false;
      }
    }
    
    // בסביבת דפדפן, ננסה לחדש את הטוקן באופן מנואלי
    // נסיון לקבל טוקן חדש באמצעות currentUser
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true);
        return true;
      } catch (err) {
        console.error('WordStream: Failed to manually refresh token:', err);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('WordStream: Error refreshing auth token:', error);
    return false;
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
    const isTokenValid = await refreshAuthToken();
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
    const user = auth.currentUser;
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

/**
 * מאזין לשינויים במצב האימות
 * @param callback פונקציה שתקבל עדכונים על שינויים במצב האימות
 * @returns פונקציה לביטול המאזין
 */
export function subscribeToAuthChanges(
  callback: (user: any) => void
): () => void {
  try {
    // הוספת מאזין למצב האימות באמצעות מופע האימות הקיים
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // המרת אובייקט המשתמש של Firebase לטיפוס המתאים
      const user = firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || undefined,
        photoURL: firebaseUser.photoURL || undefined
      } : null;
      
      callback(user);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('WordStream: Error subscribing to auth changes:', error);
    // החזרת פונקציה ריקה במקרה של שגיאה
    return () => {};
  }
} 