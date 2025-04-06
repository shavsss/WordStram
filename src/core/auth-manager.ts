import { User } from 'firebase/auth';
import { auth } from '@/core/firebase/config';
import { getCurrentUser as getFirebaseCurrentUser } from '@/core/firebase/auth';
import {
  getDoc,
  doc,
  firestore,
  setDoc
} from '@/core/firebase/firestore';

// Central object that manages authentication
const AuthManager = {
  /**
   * Get the current user from any possible source
   */
  getCurrentUser(): User | null {
    // 1. Try to get from Firebase
    const firebaseUser = getFirebaseCurrentUser();
    if (firebaseUser) {
      this.updateAuthState(firebaseUser);
      return firebaseUser;
    }

    // 2. Try to get from global object
    if (typeof window !== 'undefined' && window.WordStream?.currentUser) {
      return window.WordStream.currentUser as User;
    }

    // 3. Try to get from local storage (async, but returns null for now)
    this.checkStorageAuth();
    
    return null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },

  /**
   * Update authentication state in all relevant places
   */
  updateAuthState(user: User | null): void {
    // Update global object
    if (typeof window !== 'undefined') {
      if (!window.WordStream) {
        window.WordStream = {};
      }
      
      if (user) {
        // Store minimum required information
        window.WordStream.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        window.WordStream.isAuthenticated = true;
      } else {
        window.WordStream.currentUser = undefined;
        window.WordStream.isAuthenticated = false;
      }
    }

    // Save to local storage
    this.saveToStorage(user);
  },

  /**
   * Save authentication information to local storage
   */
  async saveToStorage(user: User | null): Promise<void> {
    try {
      // Save to chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const data = user ? {
          wordstream_auth_state: 'authenticated',
          wordstream_user_info: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          },
          isAuthenticated: true,
          userInfo: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          },
          lastAuthCheck: new Date().toISOString()
        } : {
          wordstream_auth_state: null,
          wordstream_user_info: null,
          isAuthenticated: false,
          userInfo: null,
          lastAuthCheck: new Date().toISOString()
        };

        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
              console.warn('WordStream AuthManager: Error saving auth state:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error saving auth state:', error);
    }
  },

  /**
   * Check storage for authentication and update global state if found
   */
  async checkStorageAuth(): Promise<User | null> {
    try {
      // Try to get from chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await new Promise<any>((resolve) => {
          chrome.storage.local.get([
            'isAuthenticated', 
            'userInfo', 
            'wordstream_auth_state', 
            'wordstream_user_info'
          ], (data) => {
            if (chrome.runtime.lastError) {
              console.warn('WordStream: Error accessing storage:', chrome.runtime.lastError);
              resolve({});
            } else {
              resolve(data);
            }
          });
        });
        
        // Check in new structure
        if (result.isAuthenticated && result.userInfo) {
          // Update global object
          if (typeof window !== 'undefined') {
            if (!window.WordStream) {
              window.WordStream = {};
            }
            window.WordStream.currentUser = result.userInfo;
            window.WordStream.isAuthenticated = true;
          }
          
          return result.userInfo as User;
        }
        
        // Check in old structure
        if (result.wordstream_auth_state === 'authenticated' && result.wordstream_user_info) {
          const user = result.wordstream_user_info;
          
          // Update global object
          if (typeof window !== 'undefined') {
            if (!window.WordStream) {
              window.WordStream = {};
            }
            window.WordStream.currentUser = user;
            window.WordStream.isAuthenticated = true;
          }
          
          return user as User;
        }
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error checking storage auth:', error);
    }
    
    return null;
  },

  /**
   * Verify token validity and refresh if needed
   * @returns Promise resolving to whether the token is valid
   */
  async verifyTokenAndRefresh(): Promise<boolean> {
    try {
      // Check if there's a current user
      const user = this.getCurrentUser();
      if (!user) {
        console.warn('WordStream AuthManager: No user found to refresh authentication token');
        return false;
      }

      // Check if we have a recently refreshed token in cache
      try {
        const tokenCache = await chrome.storage.local.get(['wordstream_auth_token', 'wordstream_auth_token_timestamp']);
        const tokenTimestamp = tokenCache.wordstream_auth_token_timestamp || 0;
        const now = Date.now();
        
        // If token was refreshed less than 5 minutes ago, consider it valid
        if (tokenCache.wordstream_auth_token && (now - tokenTimestamp < 5 * 60 * 1000)) {
          console.log('WordStream AuthManager: Using cached token (refreshed within last 5 minutes)');
          return true;
        }
      } catch (cacheError) {
        console.warn('WordStream AuthManager: Error checking token cache:', cacheError);
        // Continue with normal token refresh
      }

      // More aggressive approach - try to reload the user if possible
      if (auth.currentUser) {
        try {
          console.log('WordStream AuthManager: Reloading existing user for fresh authentication state');
          await auth.currentUser.reload();
          
          // After reload, double-check currentUser still exists
          if (!auth.currentUser) {
            console.warn('WordStream AuthManager: User account no longer exists after reload');
            return false;
          }
        } catch (reloadError) {
          console.warn('WordStream AuthManager: Error reloading user - potential authentication issue:', reloadError);
          // Continue with token refresh attempt despite reload failure
        }
      } else {
        // Critical warning if no auth.currentUser
        console.warn('WordStream AuthManager: Firebase auth session not found - user may need to sign in again');
      }

      // Force token refresh and wait to ensure it propagates
      let token: string | undefined;
      
      // First try with currentUser (most reliable)
      if (auth.currentUser && typeof auth.currentUser.getIdToken === 'function') {
        try {
          console.log('WordStream AuthManager: Refreshing authentication token via Firebase auth');
          token = await auth.currentUser.getIdToken(true);
        } catch (firebaseTokenError) {
          console.warn('WordStream AuthManager: Firebase token refresh failed - token may be expired:', firebaseTokenError);
          // Continue with backup method
        }
      }
      
      // Backup: try with our cached user object
      if (!token && typeof user.getIdToken === 'function') {
        try {
          console.log('WordStream AuthManager: Attempting token refresh via cached user credentials');
          token = await user.getIdToken(true);
        } catch (userTokenError) {
          console.warn('WordStream AuthManager: Failed to refresh authentication - user may need to sign in again:', userTokenError);
          return false;
        }
      }
      
      if (!token) {
        console.warn('WordStream AuthManager: Could not obtain authentication token - please sign in again');
        return false;
      }
      
      // Wait longer for the token to propagate through Firebase systems
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Cache the refreshed token
      try {
        await chrome.storage.local.set({
          'wordstream_auth_token': token,
          'wordstream_auth_token_timestamp': Date.now()
        });
        console.log('WordStream AuthManager: Successfully cached authentication token');
      } catch (cacheError) {
        console.warn('WordStream AuthManager: Failed to cache authentication token:', cacheError);
        // Non-critical error, continue
      }
      
      // Update auth state with refreshed user
      const refreshedUser = auth.currentUser || user;
      this.updateAuthState(refreshedUser);
      
      console.log('WordStream AuthManager: Authentication refreshed successfully');
      return true;
    } catch (error) {
      console.warn('WordStream AuthManager: Authentication refresh failed:', error);
      return false;
    }
  },

  /**
   * Check user permissions for accessing Firestore data
   * @returns Promise resolving to whether the user has valid permissions
   */
  async checkPermissions(): Promise<boolean> {
    try {
      // Check if user is authenticated
      if (!this.isAuthenticated()) {
        console.warn('WordStream AuthManager: Cannot verify permissions - user not authenticated');
        
        // Try to reauthenticate if no user is found
        const reauthResult = await this.reauthenticateIfNeeded();
        if (!reauthResult) {
          console.error('WordStream AuthManager: Reauthentication failed during permissions check');
          return false;
        }
        
        // Check again after reauthentication attempt
        if (!this.isAuthenticated()) {
          console.error('WordStream AuthManager: Still not authenticated after reauthentication attempt');
          return false;
        }
      }
      
      const user = this.getCurrentUser();
      if (!user || !user.uid) {
        console.warn('WordStream AuthManager: Cannot verify permissions - invalid user ID');
        return false;
      }
      
      // Try to perform a basic read operation from Firestore as a permissions check
      try {
        console.log('WordStream AuthManager: Verifying database permissions with test read');
        // Reading user's own profile typically requires minimal permissions
        const userProfile = await getUserProfileDocument();
        
        if (!userProfile) {
          console.warn('WordStream AuthManager: Permissions check failed - could not read user profile');
          return false;
        }
        
        console.log('WordStream AuthManager: Permissions verified successfully');
        return true;
      } catch (error) {
        console.error('WordStream AuthManager: Permissions check failed with error:', error);
        
        // If we get a permission-denied error, try to refresh the token
        if (error instanceof Error && 
            (error.message.includes('permission-denied') || 
             error.message.includes('unauthenticated') || 
             error.message.includes('invalid-argument'))) {
          
          console.log('WordStream AuthManager: Detected permission issue, attempting to refresh token');
          const refreshResult = await this.verifyTokenAndRefresh();
          
          if (refreshResult) {
            console.log('WordStream AuthManager: Token refreshed, retrying permission check');
            return await this.checkPermissions(); // Try again after refresh
          }
        }
        
        return false;
      }
    } catch (error) {
      console.error('WordStream AuthManager: Error checking permissions:', error);
      return false;
    }
  },

  /**
   * Reauthenticate if needed (token expired or user state changed)
   * @returns Promise resolving to success status
   */
  async reauthenticateIfNeeded(): Promise<boolean> {
    try {
      console.log('WordStream AuthManager: Checking if reauthentication is needed');
      
      // Check if there's a stored auth state in chrome.storage.local
      const storedUser = await this.checkStorageAuth();
      
      if (storedUser) {
        console.log('WordStream AuthManager: Found stored user auth, refreshing token');
        return await this.verifyTokenAndRefresh();
      }
      
      // If we have a current user but token might be expired
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        console.log('WordStream AuthManager: Current user exists, refreshing token');
        return await this.verifyTokenAndRefresh();
      }
      
      console.log('WordStream AuthManager: No stored or current user found for reauthentication');
      return false;
    } catch (error) {
      console.error('WordStream AuthManager: Error during reauthentication:', error);
      return false;
    }
  }
};

export default AuthManager;

async function getUserProfileDocument() {
  try {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot get user profile - no authenticated user');
      return null;
    }
    
    // Use the new approach with direct Firestore functions
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    } else {
      // Create the user document if it doesn't exist
      console.log('WordStream: Creating new user profile document');
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date()
      };
      
      await setDoc(userDocRef, userData);
      return userData;
    }
  } catch (error) {
    console.error('WordStream: Error accessing user profile document:', error);
    return null;
  }
} 