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

// Auth state management
let currentUser: User | null = null;
let authStateListeners: Array<(user: User | null) => void> = [];
let isAuthInitialized = false;

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
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  return signInWithEmailAndPassword(services.auth, email, password);
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  const provider = new GoogleAuthProvider();
  return signInWithPopup(services.auth, provider);
}

/**
 * Sign in with GitHub
 */
export async function signInWithGithub(): Promise<UserCredential> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  const provider = new GithubAuthProvider();
  return signInWithPopup(services.auth, provider);
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  return firebaseSignOut(services.auth);
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
 * Check if a user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  // If we have a current user, return it immediately
  if (currentUser) return currentUser;
  
  // Otherwise get from Firebase auth
  const services = await getFirebaseServices();
  if (!services.auth) throw new Error('Firebase Auth not initialized');
  
  return services.auth.currentUser;
}

/**
 * Get the current user's ID token
 */
export async function getUserIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  
  try {
    return await getIdToken(user, forceRefresh);
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
    const user = await getCurrentUser();
    if (!user) return false;
    
    // Force token refresh
    await getIdToken(user, true);
    return true;
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
  // Store the current user in chrome.storage.local for content scripts to access
  if (user) {
    const userInfo = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
    chrome.storage.local.set({ 'wordstream_user_info': userInfo }, () => {
      console.log('WordStream: User info saved to storage for content scripts');
    });
  } else {
    // Clear user info if logged out
    chrome.storage.local.remove('wordstream_user_info', () => {
      console.log('WordStream: User info removed from storage');
    });
  }

  // Notify all registered listeners
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