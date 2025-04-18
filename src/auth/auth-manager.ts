/**
 * Authentication Manager
 * 
 * Provides unified authentication functionality for the application.
 * This module uses the centralized Firebase initialization from firebase-init.ts.
 */
import { 
  getAuth,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  User,
  onAuthStateChanged,
  onIdTokenChanged,
  getIdToken,
  sendPasswordResetEmail,
  updateProfile,
  UserCredential,
} from 'firebase/auth';

// Import the central Firebase initialization
import { 
  initializeFirebase, 
  getFirebaseServices 
} from './firebase-init';

// Import the extension context validator
import { isExtensionContextValid } from './firebase-init';

// Import hybrid auth functionality
import { 
  signInWithGoogleHybrid,
  refreshAuthToken, 
  isUserAuthenticated as checkUserAuthFromStorage,
  getCurrentUserInfo
} from './hybrid-auth';

// Auth state management
let currentUser: User | null = null;
let authStateListeners: Array<(user: User | null) => void> = [];
let isAuthInitialized = false;

// Auth persistence support
let persistenceCheckInterval: NodeJS.Timeout | null = null;
const PERSISTENCE_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

/**
 * Safe wrapper to handle extension context issues
 * This function wraps Firebase auth operations and checks for extension context validity
 */
async function safeAuthOperation<T>(operation: () => Promise<T>): Promise<T> {
  // First check if extension context is valid
  if (typeof isExtensionContextValid === 'function' && !isExtensionContextValid()) {
    throw new Error('Extension context is invalid, cannot perform auth operation');
  }
  
  try {
    return await operation();
  } catch (error: any) {
    // Check if error is related to extension context
    if (error.message?.includes('extension context') || 
        error.message?.includes('Extension context') ||
        error.code === 'auth/internal-error') {
      console.error('Auth operation failed due to extension context issues:', error);
      throw new Error('Extension context is invalid or auth operation failed');
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Initialize authentication and set up listeners
 */
export async function initializeAuth(): Promise<boolean> {
  try {
    console.log('Auth: Starting authentication initialization');
    // Get firebase services from the central initialization
    const services = await getFirebaseServices();
    
    if (!services.initialized || !services.auth) {
      console.error('Auth initialization failed: Firebase services not available');
      return false;
    }
    
    const auth = services.auth;
    console.log('Auth: Firebase auth service obtained successfully');
    
    // Set up auth state monitoring with improved persistence
    onAuthStateChanged(auth, (user) => {
      console.log('Auth: Auth state changed:', { 
        isAuthenticated: !!user, 
        user: user ? { email: user.email, uid: user.uid } : null 
      });
      currentUser = user;
      notifyListeners(user);
      
      // Update storage on auth state change
      if (user) {
        try {
          const userInfo = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastAuthenticated: Date.now(),
            tokenRefreshTime: Date.now()
          };
          
          chrome.storage.local.set({
            'wordstream_user_info': userInfo,
            'wordstream_auth_state': {
              isAuthenticated: true,
              lastChecked: Date.now()
            }
          });
          console.log('Auth: Updated storage with user info for', user.email);
          
          // Set up persistence check if not already running
          if (!persistenceCheckInterval) {
            setupPersistenceCheck();
          }
        } catch (error) {
          console.error('Auth: Error updating storage with user info:', error);
        }
      } else {
        // User signed out - clear persistence
        try {
          chrome.storage.local.remove(['wordstream_user_info', 'wordstream_auth_state']);
          
          // Clear persistence check interval
          if (persistenceCheckInterval) {
            clearInterval(persistenceCheckInterval);
            persistenceCheckInterval = null;
          }
        } catch (error) {
          console.error('Auth: Error clearing auth info from storage:', error);
        }
      }
    });
    
    // Set up token change monitoring
    onIdTokenChanged(auth, async (user) => {
      console.log('Auth: ID token changed:', { isAuthenticated: !!user });
      if (user) {
        // Refresh token if needed
        try {
          await getIdToken(user, true);
          console.log('Auth: ID token refreshed successfully');
          
          // Update token refresh time in storage
          try {
            const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
            if (authInfo.wordstream_user_info) {
              await chrome.storage.local.set({
                'wordstream_user_info': {
                  ...authInfo.wordstream_user_info,
                  tokenRefreshTime: Date.now()
                }
              });
            }
          } catch (storageError) {
            console.warn('Auth: Error updating token refresh time:', storageError);
          }
        } catch (error) {
          console.error('Auth: Error refreshing token:', error);
        }
      }
    });
    
    // Check if we have stored auth state and try to restore it
    try {
      const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
      if (authInfo.wordstream_user_info && !auth.currentUser) {
        console.log('Auth: Found stored user data, attempting to restore session');
        // We have stored auth but no current user - try to refresh
        await checkAndRefreshAuth();
      }
    } catch (storageError) {
      console.warn('Auth: Error checking stored auth during init:', storageError);
    }
    
    isAuthInitialized = true;
    console.log('Auth: Authentication initialized successfully');
    return true;
  } catch (error) {
    console.error('Auth: Error initializing authentication:', error);
    return false;
  }
}

/**
 * Set up periodic check to ensure auth persistence
 */
function setupPersistenceCheck() {
  // Clear any existing interval
  if (persistenceCheckInterval) {
    clearInterval(persistenceCheckInterval);
  }
  
  // Set up new interval
  persistenceCheckInterval = setInterval(async () => {
    try {
      console.log('Auth: Running persistence check');
      await checkAndRefreshAuth();
    } catch (error) {
      console.error('Auth: Error in persistence check:', error);
    }
  }, PERSISTENCE_CHECK_INTERVAL);
  
  console.log('Auth: Persistence check interval set up');
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return safeAuthOperation(async () => {
    const services = await getFirebaseServices();
    if (!services.auth) throw new Error('Firebase Auth not initialized');
    
    return signInWithEmailAndPassword(services.auth, email, password);
  });
}

/**
 * Sign in with Google using hybrid approach
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  return safeAuthOperation(async () => {
    const services = await getFirebaseServices();
    if (!services.auth) throw new Error('Firebase Auth not initialized');
    
    return signInWithGoogleHybrid(services.auth);
  });
}

/**
 * Sign in with GitHub
 */
export async function signInWithGithub(): Promise<UserCredential> {
  return safeAuthOperation(async () => {
    const services = await getFirebaseServices();
    if (!services.auth) throw new Error('Firebase Auth not initialized');
    
    const provider = new GithubAuthProvider();
    return signInWithPopup(services.auth, provider);
  });
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  return safeAuthOperation(async () => {
    const services = await getFirebaseServices();
    if (!services.auth) throw new Error('Firebase Auth not initialized');
    
    // Remove user info from local storage
    try {
      await chrome.storage.local.remove(['wordstream_user_info']);
    } catch (error) {
      console.error('Error removing user info from storage:', error);
    }
    
    return firebaseSignOut(services.auth);
  });
}

/**
 * Check and refresh authentication if needed
 */
export async function checkAndRefreshAuth(): Promise<boolean> {
  try {
    console.log('Auth: Starting auth refresh check');
    
    // First check Firebase's current auth state
    const services = await getFirebaseServices();
    if (services.auth && services.auth.currentUser) {
      // We have a current user, refresh the token
      try {
        console.log('Auth: Firebase user found, refreshing token:', services.auth.currentUser.email);
        const token = await services.auth.currentUser.getIdToken(true);
        console.log('Auth: Token refreshed successfully via Firebase');
        
        // Update user info in storage with fresh timestamp
        const userInfo = {
          uid: services.auth.currentUser.uid,
          email: services.auth.currentUser.email,
          displayName: services.auth.currentUser.displayName,
          photoURL: services.auth.currentUser.photoURL,
          lastAuthenticated: Date.now()
        };
        
        try {
          await chrome.storage.local.set({
            'wordstream_user_info': userInfo
          });
          console.log('Auth: Storage updated with fresh authentication');
        } catch (storageError) {
          console.error('Auth: Error updating authentication in storage:', storageError);
          // Continue despite storage error
        }
        
        return true;
      } catch (tokenError) {
        console.error('Auth: Error refreshing Firebase token:', tokenError);
        // Continue to check storage as fallback
      }
    } else {
      console.log('Auth: No Firebase user found, checking storage');
    }
    
    // Check storage as fallback
    try {
      const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
      const userData = authInfo.wordstream_user_info;
      
      if (!userData) {
        console.log('Auth: No stored user data found');
        return false;
      }
      
      console.log('Auth: Found stored user data:', { email: userData.email });
      
      // Check if token needs refresh (every 45 minutes)
      const lastAuth = userData.lastAuthenticated || 0;
      const now = Date.now();
      const refreshInterval = 45 * 60 * 1000; // 45 minutes
      
      if (now - lastAuth > refreshInterval) {
        console.log('Auth: Stored auth needs refresh, last updated:', new Date(lastAuth).toISOString());
        try {
          await refreshAuthToken();
          console.log('Auth: Token refreshed via Chrome Identity API');
          
          // Update last authenticated timestamp
          try {
            await chrome.storage.local.set({
              'wordstream_user_info': {
                ...userData,
                lastAuthenticated: now
              }
            });
            console.log('Auth: Updated stored auth timestamp');
          } catch (storageError) {
            console.error('Auth: Error updating authentication timestamp:', storageError);
          }
          
          // Broadcast refreshed auth state
          try {
            chrome.runtime.sendMessage({ 
              action: "AUTH_STATE_CHANGED", 
              user: {
                ...userData,
                lastAuthenticated: now
              },
              isAuthenticated: true,
              source: 'refresh_auth'
            });
            console.log('Auth: Broadcasted refreshed auth state');
          } catch (broadcastError) {
            console.error('Auth: Error broadcasting refreshed auth state:', broadcastError);
          }
        } catch (refreshError) {
          console.error('Auth: Failed to refresh token via Chrome Identity API:', refreshError);
          // Still return true since we have stored credentials, even if refresh failed
        }
      } else {
        console.log('Auth: Stored auth is recent, no refresh needed');
      }
      
      return true;
    } catch (storageError) {
      console.error('Auth: Error checking stored authentication:', storageError);
      return false;
    }
  } catch (error) {
    console.error('Auth: Error in checkAndRefreshAuth:', error);
    return false;
  }
}

/**
 * Check if user is authenticated
 * First checks local storage and then Firebase if available
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    // First check local storage for cached auth state - fastest response
    try {
      const authInfo = await chrome.storage.local.get(['wordstream_user_info', 'wordstream_auth_state']);
      
      if (authInfo.wordstream_user_info?.uid) {
        const lastAuth = authInfo.wordstream_auth_state?.lastChecked || 0;
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        // If we checked auth recently, trust the stored state
        if (now - lastAuth < ONE_DAY) {
          return true;
        }
        
        // Otherwise, we'll verify with Firebase below
        console.log('Auth: Stored auth state is old, verifying with Firebase');
      }
    } catch (storageError) {
      console.warn('Auth: Error checking auth from storage:', storageError);
      // Continue with Firebase check
    }
    
    // Check with Firebase auth as the source of truth
    try {
      // If we already have currentUser cached, use it
      if (currentUser) {
        // Update storage just to be safe
        try {
          const userInfo = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            lastAuthenticated: Date.now()
          };
          
          chrome.storage.local.set({
            'wordstream_user_info': userInfo,
            'wordstream_auth_state': {
              isAuthenticated: true,
              lastChecked: Date.now()
            }
          });
        } catch (storageError) {
          console.warn('Auth: Error updating storage in isAuthenticated:', storageError);
        }
        
        return true;
      }
      
      // Otherwise check Firebase directly
      const services = await getFirebaseServices();
      if (services.auth?.currentUser) {
        // Update storage for faster future checks
        try {
          const userInfo = {
            uid: services.auth.currentUser.uid,
            email: services.auth.currentUser.email,
            displayName: services.auth.currentUser.displayName,
            photoURL: services.auth.currentUser.photoURL,
            lastAuthenticated: Date.now()
          };
          
          chrome.storage.local.set({
            'wordstream_user_info': userInfo,
            'wordstream_auth_state': {
              isAuthenticated: true,
              lastChecked: Date.now()
            }
          });
        } catch (storageError) {
          console.warn('Auth: Error updating storage in isAuthenticated:', storageError);
        }
        
        return true;
      }
      
      // Try refresh as last resort
      const refreshed = await checkAndRefreshAuth();
      return refreshed;
    } catch (firebaseError) {
      console.error('Auth: Error checking Firebase auth:', firebaseError);
      
      // Last resort fallback - check storage again and use it if available
      try {
        const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
        if (authInfo.wordstream_user_info?.uid) {
          console.log('Auth: Firebase check failed but found user in storage, assuming authenticated');
          return true;
        }
      } catch (storageError) {
        console.error('Auth: Fatal error checking authentication:', storageError);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Auth: Error in isAuthenticated:', error);
    return false;
  }
}

/**
 * Create a new user with email and password
 */
export async function createUser(email: string, password: string): Promise<UserCredential> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  return createUserWithEmailAndPassword(services.auth, email, password);
}

/**
 * Reset password for an email address
 */
export async function resetPassword(email: string): Promise<void> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  return sendPasswordResetEmail(services.auth, email);
}

/**
 * Update user profile
 */
export async function updateUserProfile(displayName: string, photoURL?: string): Promise<void> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  if (!services.auth.currentUser) throw new Error('No user logged in');
  
  return updateProfile(services.auth.currentUser, {
    displayName,
    photoURL: photoURL || null
  });
}

/**
 * Get the current authenticated user
 * First tries from memory cache, then Firebase auth, and finally storage
 */
export async function getCurrentUser(): Promise<User | null> {
  // If we have a current user, return it immediately
  if (currentUser) return currentUser;
  
  try {
    // Try to get from Firebase auth
    const services = await getFirebaseServices();
    if (services.auth) {
      const firebaseUser = services.auth.currentUser;
      if (firebaseUser) return firebaseUser;
    }
    
    // Last resort: check storage for user info
    const userInfo = await getCurrentUserInfo();
    if (userInfo) {
      // We have user info in storage, but no actual User object
      // This is a placeholder situation to help UI know user is logged in
      return userInfo as unknown as User;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get the current user's ID token
 */
export async function getUserIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  
  try {
    // If we have a Firebase User object
    if (typeof user.getIdToken === 'function') {
      return await getIdToken(user, forceRefresh);
    }
    
    // If we only have storage info, try to refresh the token
    await refreshAuthToken();
    return 'token_managed_by_chrome_identity'; // Placeholder since we don't have direct access
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

/**
 * Verify and refresh the authentication token
 */
export async function verifyTokenAndRefresh(): Promise<boolean> {
  try {
    return await checkAndRefreshAuth();
  } catch (error) {
    console.error('Error refreshing auth token:', error);
    return false;
  }
}

/**
 * Add a listener for authentication state changes
 */
export function addAuthStateListener(listener: (user: User | null) => void): void {
  authStateListeners.push(listener);
  
  // Call immediately with current user if we already have it
  if (isAuthInitialized) {
    listener(currentUser);
  }
}

/**
 * Remove a listener for authentication state changes
 */
export function removeAuthStateListener(listener: (user: User | null) => void): void {
  const index = authStateListeners.indexOf(listener);
  if (index !== -1) {
    authStateListeners.splice(index, 1);
  }
}

/**
 * Notify all listeners of an auth state change
 */
function notifyListeners(user: User | null): void {
  for (const listener of authStateListeners) {
    try {
      listener(user);
    } catch (error) {
      console.error('Error in auth state listener:', error);
    }
  }
}

// Initialize auth as soon as the module is loaded
initializeAuth().catch(error => {
  console.error('Failed to initialize auth:', error);
}); 