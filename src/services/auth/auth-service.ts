import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { FIREBASE_CONFIG } from '../../config/firebase';
import { MessageType } from '../../shared/message-types';
import { User } from '../../shared/types';

// Storage keys
const AUTH_STORAGE_KEY = 'wordstream_auth_state';

class AuthService {
  private auth: Auth;
  private currentUser: FirebaseUser | null = null;
  private authStateListeners: Array<(user: FirebaseUser | null) => void> = [];
  private isInitialized: boolean = false;

  constructor() {
    // Initialize Firebase if it hasn't been initialized yet
    try {
      // Try to get the existing Firebase app instance
      const app = initializeApp(FIREBASE_CONFIG);
      this.auth = getAuth(app);
    } catch (error) {
      // If an app already exists, just get it
      console.log('Firebase already initialized, getting auth instance');
      this.auth = getAuth();
    }
  }

  /**
   * Initialize the auth service and set up listeners
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('WordStream: Initializing auth service');
    
    // Set up auth state listener
    onAuthStateChanged(this.auth, (user) => {
      console.log('WordStream: Auth state changed:', !!user);
      this.currentUser = user;
      
      // Store user info in Chrome storage for persistence
      if (user) {
        this.persistUserToStorage(user);
      } else {
        chrome.storage.local.remove(AUTH_STORAGE_KEY);
      }
      
      // Notify listeners
      this.notifyListeners(user);
      
      // Broadcast auth state to all extension parts
      this.broadcastAuthState(!!user, this.transformUserToPlainObject(user));
    });
    
    // Try to restore auth state from storage
    await this.restoreAuthState();
    
    this.isInitialized = true;
  }

  /**
   * Broadcast authentication state to all extension parts
   */
  private broadcastAuthState(isAuthenticated: boolean, userInfo: Partial<User> | null): void {
    try {
      chrome.runtime.sendMessage({
        type: MessageType.AUTH_STATE_CHANGED,
        data: {
          isAuthenticated,
          user: userInfo
        }
      });
    } catch (error) {
      console.error('WordStream: Error broadcasting auth state:', error);
    }
  }

  /**
   * Attempt to restore authentication state from storage
   */
  private async restoreAuthState(): Promise<void> {
    try {
      const data = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get(AUTH_STORAGE_KEY, (result) => {
          resolve(result);
        });
      });
      
      const storedAuth = data[AUTH_STORAGE_KEY];
      
      if (storedAuth && storedAuth.user) {
        console.log('WordStream: Found stored auth state');
        // We don't need to set currentUser here as the Firebase Auth
        // will trigger onAuthStateChanged if there's a valid session
      } else {
        console.log('WordStream: No stored auth state found');
      }
    } catch (error) {
      console.error('WordStream: Error restoring auth state:', error);
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<FirebaseUser | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('WordStream: Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<FirebaseUser | null> {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(this.auth, provider);
      return userCredential.user;
    } catch (error) {
      console.error('WordStream: Google sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.auth);
      chrome.storage.local.remove(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('WordStream: Sign out error:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return this.currentUser;
  }

  /**
   * Add an auth state listener
   * Returns a function to remove the listener
   */
  addAuthStateListener(listener: (user: FirebaseUser | null) => void): () => void {
    this.authStateListeners.push(listener);
    
    // Call the listener with the current state immediately
    if (this.isInitialized) {
      listener(this.currentUser);
    }
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of auth state changes
   */
  private notifyListeners(user: FirebaseUser | null) {
    this.authStateListeners.forEach(listener => listener(user));
  }
  
  /**
   * Transform Firebase user to plain object
   */
  private transformUserToPlainObject(user: FirebaseUser | null): Partial<User> | null {
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email || undefined,
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined
    };
  }
  
  /**
   * Persist user to Chrome storage
   */
  private persistUserToStorage(user: FirebaseUser): void {
    const userData = this.transformUserToPlainObject(user);
    
    chrome.storage.local.set({ 
      [AUTH_STORAGE_KEY]: {
        user: userData,
        isAuthenticated: true,
        lastLoginTime: Date.now()
      }
    });
  }
  
  /**
   * Get auth state (for responding to message requests)
   */
  async getAuthState(): Promise<{ 
    isAuthenticated: boolean; 
    user: Partial<User> | null 
  }> {
    return {
      isAuthenticated: !!this.currentUser,
      user: this.transformUserToPlainObject(this.currentUser)
    };
  }
}

// Create a singleton instance
const authService = new AuthService();
export default authService; 