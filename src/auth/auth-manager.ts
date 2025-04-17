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
    // Get firebase services from the central initialization
    const services = await getFirebaseServices();
    
    if (!services.initialized || !services.auth) {
      console.error('Auth initialization failed: Firebase services not available');
      return false;
    }
    
    const auth = services.auth;
    
    // Set up auth state monitoring
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      notifyListeners(user);
    });
    
    // Set up token change monitoring
    onIdTokenChanged(auth, async (user) => {
      if (user) {
        // Refresh token if needed
        try {
          await getIdToken(user, true);
        } catch (error) {
          console.error('Error refreshing token:', error);
        }
      }
    });
    
    isAuthInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing authentication:', error);
    return false;
  }
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
    const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
    const userData = authInfo.wordstream_user_info;
    
    if (!userData) return false;
    
    // Check if token needs refresh (every 45 minutes)
    const lastAuth = userData.lastAuthenticated || 0;
    const now = Date.now();
    const refreshInterval = 45 * 60 * 1000; // 45 minutes
    
    if (now - lastAuth > refreshInterval) {
      await refreshAuthToken();
      
      // Update last authenticated timestamp
      await chrome.storage.local.set({
        'wordstream_user_info': {
          ...userData,
          lastAuthenticated: now
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error checking/refreshing auth:', error);
    return false;
  }
}

/**
 * Check if user is authenticated
 * First checks local storage and then Firebase if available
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    // First check local storage for cached auth state
    const isAuthenticatedFromStorage = await checkUserAuthFromStorage();
    if (isAuthenticatedFromStorage) return true;
    
    // Fallback to Firebase check
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    console.error('Error checking authentication status:', error);
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