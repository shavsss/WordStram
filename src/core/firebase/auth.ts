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
      throw new Error("The sign-in window was closed. Please try again to complete authentication.");
    } else if (error.message?.includes('unauthorized_client')) {
      throw new Error("There's an issue with application authorization. Please contact support for assistance.");
    } else if (error.message?.includes('network')) {
      throw new Error("Network connection issue. Please check your internet and try again.");
    } else if (error.message?.includes('timeout')) {
      throw new Error("The authentication request timed out. Please try again.");
    } else if (error.message?.includes('popup_blocked')) {
      throw new Error("Pop-up window was blocked. Please allow pop-ups for this site and try again.");
    }
    
    // Generic error message
    throw new Error(`Authentication couldn't be completed. Please try again or use email login.`);
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
    throw new Error("We couldn't sign you out properly. Please refresh the page and try again.");
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
 * יכולת משופרת לגילוי משתמש מחובר במגוון סביבות
 */
export function getCurrentUser(): User | null {
  // בדיקה ראשית - מתוך האובייקט auth
  const user = auth.currentUser;
  
  console.log('WordStream Auth: Getting current user from auth:', user ? `User ${user.email} (uid: ${user.uid})` : 'No user in auth object');
  
  // בדיקה נוספת - אולי יש משתמש בזיכרון המקומי
  try {
    // בדיקה האם המשתמש קיים בחלון אם אנחנו בסביבת דפדפן
    if (!user && typeof window !== 'undefined' && window.WordStream && window.WordStream.currentUser) {
      console.log('WordStream Auth: Found user in window.WordStream:', window.WordStream.currentUser);
      return window.WordStream.currentUser as User;
    }
    
    // בדיקה באחסון מקומי של הדפדפן, אם אנחנו בסביבת דפדפן
    if (!user && typeof localStorage !== 'undefined') {
      const storedUser = localStorage.getItem('wordstream_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('WordStream Auth: Found user in localStorage:', parsedUser);
          return parsedUser as User;
        } catch (parseError) {
          console.warn('WordStream Auth: Error parsing stored user:', parseError);
        }
      }
    }
  } catch (error) {
    console.error('WordStream Auth: Error in additional user checks:', error);
  }
  
  // בדיקת מצב האימות הכללי
  console.log('WordStream Auth: Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated',
            'SignIn methods count:', auth.languageCode !== null ? 'Available' : 'Not available');
  
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