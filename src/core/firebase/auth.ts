import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  User,
  sendPasswordResetEmail,
  updateProfile,
  UserCredential,
  getIdToken
} from 'firebase/auth';
import { auth, firestore } from './config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Interface for additional user data
export interface UserData {
  gender?: string;
  age?: number;
  location?: string;
  displayName?: string;
  [key: string]: any;
}

/**
 * Authentication service for managing user sign-in/sign-out
 */

/**
 * Register a new user with email and password
 * @param email User email
 * @param password User password
 * @param userData Optional additional user data
 */
export async function registerWithEmail(
  email: string, 
  password: string, 
  userData?: UserData
): Promise<UserCredential> {
  try {
    // Create user with Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    
    // If additional user data was provided, store it in Firestore
    if (userData && credential.user) {
      await storeUserProfile(credential.user.uid, { email, ...userData });
    }
    
    // Save auth state to storage
    await saveAuthState(credential.user);
    
    return credential;
  } catch (error) {
    console.error('WordStream Auth: Registration failed:', error);
    throw error;
  }
}

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    
    // Save auth state to storage
    await saveAuthState(credential.user);
    
    return credential;
  } catch (error) {
    console.error('WordStream Auth: Email sign-in failed:', error);
    throw error;
  }
}

/**
 * Sign in with Google using Chrome's identity API
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    console.log("WordStream: Starting Google sign-in");
    
    if (typeof chrome === 'undefined' || !chrome.identity) {
      throw new Error("Authentication is only available in Chrome extension");
    }
    
    // Set up the provider
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    // Create the URL for Google Sign-In
    const authURL = `https://accounts.google.com/o/oauth2/auth?client_id=${encodeURIComponent('1097713470067-g34g0oqh4o6chpjfq41nt84js3r06if1.apps.googleusercontent.com')}&response_type=token&redirect_uri=${encodeURIComponent('https://vidlearn-ai.firebaseapp.com/__/auth/handler')}&scope=${encodeURIComponent('profile email')}`;
    
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authURL,
        interactive: true
      }, async (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error("Google authentication canceled or failed"));
          return;
        }
        
        try {
          // Extract the access token from the URL
          const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
          const accessToken = hashParams.get('access_token');
          
          if (!accessToken) {
            reject(new Error("No access token received during authentication"));
            return;
          }
          
          // Create auth credential with the token
          const credential = GoogleAuthProvider.credential(null, accessToken);
          
          // Sign in with Firebase using the credential
          const result = await signInWithCredential(auth, credential);
          console.log("WordStream: Successfully signed in with Google");
          
          // Save auth state to storage
          await saveAuthState(result.user);
          
          // Check if this is a new user and store profile if needed
          const userDocRef = doc(firestore, 'users', result.user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            await storeUserProfile(result.user.uid, {
              email: result.user.email || '',
              displayName: result.user.displayName || ''
            });
          }
          
          resolve(result);
        } catch (error) {
          console.error("WordStream: Error processing auth result:", error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("WordStream: Google sign-in error:", error);
    throw error;
  }
}

/**
 * Store a user's profile in Firestore
 * @param uid User ID
 * @param userData User data to store
 */
export async function storeUserProfile(uid: string, userData: UserData): Promise<void> {
  try {
    await setDoc(doc(firestore, 'users', uid), {
      ...userData,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    console.log('WordStream Auth: User profile data saved');
  } catch (error) {
    console.error('WordStream Auth: Failed to save user profile data:', error);
    throw error;
  }
}

/**
 * Update user profile
 * @param displayName New display name
 */
export async function updateUserProfile(displayName: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    await updateProfile(user, { displayName });
    
    // Also update in Firestore
    await setDoc(doc(firestore, 'users', user.uid), {
      displayName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('WordStream Auth: Profile updated successfully');
  } catch (error) {
    console.error('WordStream Auth: Failed to update profile:', error);
    throw error;
  }
}

/**
 * Log out the current user
 */
export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
    await clearAuthState();
    console.log('WordStream Auth: User logged out successfully');
  } catch (error) {
    console.error('WordStream Auth: Logout failed:', error);
    throw error;
  }
}

/**
 * Subscribe to authentication state changes
 * @param callback Function to call when auth state changes
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    console.log('WordStream Auth: Auth state changed:', user ? 'User logged in' : 'User logged out');
    
    // Save auth state to storage when it changes
    if (user) {
      await saveAuthState(user);
    } else {
      await clearAuthState();
    }
    
    callback(user);
  });
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Refresh ID token
 * This should be called regularly to ensure the token doesn't expire
 */
export async function refreshIdToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    
    // Force refresh the token
    const token = await getIdToken(user, true);
    console.log('WordStream Auth: Token refreshed successfully');
    return token;
  } catch (error) {
    console.error('WordStream Auth: Token refresh failed:', error);
    return null;
  }
}

/**
 * Send a password reset email
 * @param email Email address to send the password reset to
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('WordStream Auth: Password reset email sent');
  } catch (error) {
    console.error('WordStream Auth: Failed to send password reset email:', error);
    throw error;
  }
}

/**
 * Save authentication state to storage
 * @param user User to save
 */
async function saveAuthState(user: User | null): Promise<void> {
  if (!user) return clearAuthState();
  
  try {
    // Don't store sensitive information
    const userInfo = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified
    };
    
    // Save to chrome.storage.local for persistence across service worker restarts
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        'wordstream_auth_state': 'authenticated',
        'wordstream_user_info': userInfo,
        'wordstream_auth_timestamp': Date.now()
      });
    }
    
    // Also update background script via messaging if in content script
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        await chrome.runtime.sendMessage({
          action: 'AUTH_STATE_UPDATED',
          isAuthenticated: true,
          userInfo
        });
      } catch (error) {
        // Background script might not be ready yet, which is okay
        console.log('WordStream Auth: Background not available for auth update');
      }
    }
  } catch (error) {
    console.error('WordStream Auth: Failed to save auth state:', error);
  }
}

/**
 * Clear authentication state from storage
 */
async function clearAuthState(): Promise<void> {
  try {
    // Clear from chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove([
        'wordstream_auth_state',
        'wordstream_user_info',
        'wordstream_auth_timestamp'
      ]);
    }
    
    // Notify background script
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      try {
        await chrome.runtime.sendMessage({
          action: 'AUTH_STATE_UPDATED',
          isAuthenticated: false,
          userInfo: null
        });
      } catch (error) {
        // Background script might not be ready yet, which is okay
        console.log('WordStream Auth: Background not available for auth update');
      }
    }
  } catch (error) {
    console.error('WordStream Auth: Failed to clear auth state:', error);
  }
} 