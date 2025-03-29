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
  UserCredential
} from 'firebase/auth';
import { auth, firestore } from './config';
import { doc, setDoc } from 'firebase/firestore';
import { UserData } from '@/hooks/useAuth';

/**
 * Authentication service for managing user sign-in/sign-out
 */

/**
 * Register a new user with email and password
 * and store additional user data in Firestore
 */
export async function registerWithEmail(email: string, password: string, userData?: UserData): Promise<UserCredential> {
  // Create user with Firebase Auth
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  
  // If additional user data was provided, store it in Firestore
  if (userData && credential.user) {
    const { uid } = credential.user;
    
    try {
      // Create a user document in Firestore with the additional information
      await setDoc(doc(firestore, 'users', uid), {
        email,
        ...userData,
        createdAt: new Date().toISOString()
      });
      
      console.log('WordStream Auth: User profile data saved successfully');
    } catch (error) {
      console.error('WordStream Auth: Failed to save user profile data:', error);
      // We don't throw here to prevent blocking the registration if profile data save fails
    }
  }
  
  return credential;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in with Google using Chrome's identity API with launchWebAuthFlow
 * This opens a tab/window for authentication - THE SIMPLEST APPROACH
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  console.log("WordStream: Starting Google sign-in with launchWebAuthFlow");

  if (typeof chrome === 'undefined' || !chrome.identity) {
    throw new Error("Authentication is only available in Chrome extension. Please use email and password instead.");
  }

  try {
    // Set up the provider
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    // Create the URL for Google Sign-In
    const authURL = `https://accounts.google.com/o/oauth2/auth?client_id=${encodeURIComponent('1097713470067-g34g0oqh4o6chpjfq41nt84js3r06if1.apps.googleusercontent.com')}&response_type=token&redirect_uri=${encodeURIComponent('https://vidlearn-ai.firebaseapp.com/__/auth/handler')}&scope=${encodeURIComponent('profile email')}`;
    
    // Launch external authentication flow in a separate tab/window
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authURL,
        interactive: true
      }, async (responseUrl) => {
        if (chrome.runtime.lastError) {
          console.error("WordStream: Error in web auth flow:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error("Google authentication canceled or failed"));
          return;
        }
        
        console.log("WordStream: Got response URL:", responseUrl);
        
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
          resolve(result);
        } catch (error) {
          console.error("WordStream: Error processing auth result:", error);
          reject(error);
        }
      });
    });
  } catch (error: any) {
    console.error("WordStream: Google sign-in error:", error);
    
    // User-friendly error messages in English
    if (error.message?.includes('The popup was closed')) {
      throw new Error("Authentication was canceled. Please complete the sign-in process.");
    } else if (error.message?.includes('unauthorized_client')) {
      throw new Error("Unauthorized client. Please contact the developer.");
    }
    
    // Generic error message
    throw new Error(`Google authentication failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(user: User, displayName: string): Promise<void> {
  await updateProfile(user, { displayName });
}

/**
 * Logs out the current user
 */
export async function logOut(): Promise<void> {
  try {
    console.log("WordStream: Logging out user");
    
    // Standard Firebase signOut
    await signOut(auth);
    console.log("WordStream: User successfully logged out");
    
    // Clear any local session data if needed
    localStorage.removeItem("wordstream_session");
    sessionStorage.removeItem("wordstream_session");
    
  } catch (error) {
    console.error("WordStream: Error during logout:", error);
    throw new Error("Failed to log out. Please try again.");
  }
}

/**
 * Set up an auth state listener
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  console.log('WordStream Auth: Setting up auth state listener');
  return onAuthStateChanged(auth, (user) => {
    console.log('WordStream Auth: Auth state changed:', user ? `User ${user.email}` : 'No user');
    callback(user);
  });
}

/**
 * Get the current user
 */
export function getCurrentUser(): User | null {
  const user = auth.currentUser;
  console.log('WordStream Auth: Getting current user:', user ? `User ${user.email}` : 'No user');
  return user;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  console.log('WordStream Auth: Sending password reset email to:', email);
  await sendPasswordResetEmail(auth, email);
  console.log('WordStream Auth: Password reset email sent successfully');
} 