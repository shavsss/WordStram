import { 
  getAuth, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut,
  signInWithCredential,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { STORAGE_KEYS } from '../storage/storage-service';
import { app } from './firebase-config';

class AuthService {
  private auth;
  private currentUser: User | null = null;
  private authStateListeners: Array<(user: User | null) => void> = [];

  constructor() {
    this.auth = getAuth(app);
    
    // Set up persistent auth state monitoring
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      
      // Store minimal user info in chrome.storage for persistence
      if (user) {
        chrome.storage.local.set({
          [STORAGE_KEYS.AUTH]: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastSignIn: new Date().toISOString()
          }
        });
      } else {
        chrome.storage.local.remove(STORAGE_KEYS.AUTH);
      }
      
      // Notify all listeners
      this.notifyListeners(user);
    });
    
    // Attempt to restore auth state on initialization
    this.restoreAuthState();
  }
  
  // Attempt to restore auth from storage
  private async restoreAuthState() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
      if (result[STORAGE_KEYS.AUTH]) {
        // We have stored auth data, but we need to verify it's still valid
        // This is a minimal update to avoid full re-authentication
        console.log('Restoring auth state from storage');
      }
    } catch (error) {
      console.error('Error restoring auth state:', error);
    }
  }

  /**
   * Sign in with email and password
   * @param email User email
   * @param password User password
   * @returns The authenticated user or null
   */
  async signIn(email: string, password: string): Promise<User | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in with email/password:', error);
      throw error;
    }
  }
  
  /**
   * Sign in with Google using chrome.identity API (compatible with Manifest V3)
   * @returns The authenticated user or null
   */
  async signInWithGoogle(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      try {
        // Use chrome.identity API instead of Firebase's signInWithPopup
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome identity error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'Failed to get auth token'));
            return;
          }
          
          if (!token) {
            reject(new Error('No auth token returned'));
            return;
          }
          
          try {
            // Create a credential with the token
            const credential = GoogleAuthProvider.credential(null, token);
            
            // Sign in to Firebase with the credential
            const userCredential = await signInWithCredential(this.auth, credential);
            resolve(userCredential.user);
          } catch (error) {
            console.error('Error signing in with Google credential:', error);
            // If the token is invalid, we should revoke it
            chrome.identity.removeCachedAuthToken({ token }, () => {
              console.log('Removed invalid token');
            });
            reject(error);
          }
        });
      } catch (error) {
        console.error('Error in signInWithGoogle:', error);
        reject(error);
      }
    });
  }
  
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.auth);
      // Also clear any cached auth tokens from chrome.identity
      chrome.identity.clearAllCachedAuthTokens(() => {
        console.log('Cleared all cached auth tokens');
      });
      // Remove from storage
      chrome.storage.local.remove(STORAGE_KEYS.AUTH);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
  
  getCurrentUser(): User | null {
    return this.currentUser;
  }
  
  addAuthStateListener(listener: (user: User | null) => void): () => void {
    this.authStateListeners.push(listener);
    
    // Call the listener immediately with current state
    if (this.currentUser !== undefined) {
      listener(this.currentUser);
    }
    
    // Return a function to remove the listener
    return () => {
      this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
    };
  }
  
  private notifyListeners(user: User | null) {
    this.authStateListeners.forEach(listener => listener(user));
  }
  
  // For use in background script to initialize auth
  async initializeAuth(): Promise<void> {
    // Wait for Chrome API to be fully available
    if (!chrome?.runtime?.id) {
      throw new Error('Chrome API not available');
    }
    
    try {
      // Attempt to restore the auth state from storage
      const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
      if (result[STORAGE_KEYS.AUTH]) {
        // We've got auth data, now we need to validate it's still valid with Firebase
        console.log('Found stored auth data, validating with Firebase');
        
        // Note: Full implementation would validate token with Firebase
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }
}

// Create a singleton instance
const authService = new AuthService();
export default authService; 