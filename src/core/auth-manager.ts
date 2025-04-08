import { User } from 'firebase/auth';
import { auth } from '@/core/firebase/config';
import { refreshIdToken } from '@/core/firebase/auth';

/**
 * AuthManager - Simple authentication state manager
 * A central point for authentication state in the application
 */
const AuthManager = {
  /**
   * Get the current authenticated user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Check if a user is authenticated
   */
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  },

  /**
   * Update authentication state across the application
   */
  updateAuthState(user: User | null): void {
    // Update global object in browser context
    if (typeof window !== 'undefined') {
      if (!window.WordStream) {
        window.WordStream = {};
      }
      
      if (user) {
        window.WordStream.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        window.WordStream.isAuthenticated = true;
      } else {
        window.WordStream.currentUser = null;
        window.WordStream.isAuthenticated = false;
      }
    }

    // Save to chrome.storage if in extension context
    this.saveToStorage(user);
  },

  /**
   * Save user information to storage
   */
  async saveToStorage(user: User | null): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        if (user) {
          // Save minimal user info without sensitive data
          await chrome.storage.local.set({
            wordstream_auth_state: 'authenticated',
            wordstream_user_info: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            },
            wordstream_auth_timestamp: Date.now()
          });
        } else {
          // Clear user data
          await chrome.storage.local.remove([
            'wordstream_auth_state',
            'wordstream_user_info',
            'wordstream_auth_timestamp'
          ]);
        }
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error saving auth state:', error);
    }
  },

  /**
   * Verify and refresh the Firebase token if needed
   */
  async verifyTokenAndRefresh(): Promise<boolean> {
    try {
      // If no user, authentication is invalid
      if (!this.isAuthenticated()) {
        return false;
      }
      
      // Try to refresh the token - this will throw if token is invalid
      const refreshedToken = await refreshIdToken();
      return !!refreshedToken;
    } catch (error) {
      console.error('WordStream: Token refresh failed:', error);
      return false;
    }
  },

  /**
   * Check permissions (simply verifies authentication)
   */
  async checkPermissions(): Promise<boolean> {
    return this.isAuthenticated();
  },

  /**
   * Force reauthentication when needed
   */
  async reauthenticateIfNeeded(): Promise<boolean> {
    // If already authenticated, just refresh token
    if (this.isAuthenticated()) {
      return this.verifyTokenAndRefresh();
    }
    
    // Otherwise, we need to redirect to auth page
    // This should be handled by the application components
    return false;
  }
};

export default AuthManager;

/**
 * Verify current authentication state 
 * Can be used to check if user session is valid
 */
export async function verifyAuthentication(): Promise<boolean> {
  return AuthManager.verifyTokenAndRefresh();
} 