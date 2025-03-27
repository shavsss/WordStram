import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  GoogleAuthProvider,
  UserCredential,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase-config';

// Helper for error handling
function handleAuthError(error: any): { code: string, message: string } {
  console.error('[WordStream] Auth error:', error);
  
  const errorCode = error.code || 'auth/unknown';
  let errorMessage = 'An authentication error occurred.';
  
  // Map Firebase error codes to user-friendly messages
  switch (errorCode) {
    case 'auth/email-already-in-use':
      errorMessage = 'This email is already registered.';
      break;
    case 'auth/invalid-email':
      errorMessage = 'Please provide a valid email address.';
      break;
    case 'auth/weak-password':
      errorMessage = 'Password should be at least 6 characters.';
      break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      errorMessage = 'Invalid email or password.';
      break;
    case 'auth/too-many-requests':
      errorMessage = 'Too many failed attempts. Please try again later.';
      break;
    default:
      errorMessage = error.message || errorMessage;
  }
  
  return { code: errorCode, message: errorMessage };
}

/**
 * Register with email and password
 * Creates a new user account and initializes user document in Firestore
 */
export async function registerWithEmail(
  email: string, 
  password: string,
  displayName?: string
): Promise<{ success: boolean; error?: { code: string, message: string } }> {
  try {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    // Create the user
    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth, 
      email, 
      password
    );
    
    // Initialize user document
    await createUserDocument(userCredential.user.uid, {
      email,
      displayName: displayName || email.split('@')[0],
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: handleAuthError(error) };
  }
}

/**
 * Login with email and password
 */
export async function loginWithEmail(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: { code: string, message: string } }> {
  try {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleAuthError(error) };
  }
}

/**
 * Login with Google account
 * Uses Chrome Identity API to get auth token and then signs in to Firebase
 */
export async function loginWithGoogle(): Promise<{ success: boolean; error?: { code: string, message: string } }> {
  return new Promise((resolve) => {
    try {
      if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
      
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError || !token) {
          resolve({ 
            success: false, 
            error: {
              code: 'auth/google-token-failure',
              message: chrome.runtime.lastError?.message || 'Failed to obtain Google token'
            }
          });
          return;
        }
        
        try {
          // Create credential with the token
          const credential = GoogleAuthProvider.credential(null, token);
          
          // Sign in with credential
          if (!firebaseAuth) {
            throw new Error('Firebase Auth not initialized');
          }
          const userCredential = await signInWithCredential(firebaseAuth, credential);
          
          // Ensure user document exists
          const { uid, email, displayName } = userCredential.user;
          await createUserDocument(uid, { email, displayName });
          
          resolve({ success: true });
        } catch (error) {
          resolve({ success: false, error: handleAuthError(error) });
        }
      });
    } catch (error) {
      resolve({ success: false, error: handleAuthError(error) });
    }
  });
}

/**
 * Sign out current user
 */
export async function logout(): Promise<{ success: boolean; error?: { code: string, message: string } }> {
  try {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    await signOut(firebaseAuth);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleAuthError(error) };
  }
}

/**
 * Create or update user document in Firestore
 */
export async function createUserDocument(
  uid: string, 
  userData: { email?: string | null; displayName?: string | null }
): Promise<void> {
  try {
    if (!firebaseDb) throw new Error('Firestore not initialized');
    
    const userRef = doc(firebaseDb, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user document
      await setDoc(userRef, {
        email: userData.email || '',
        displayName: userData.displayName || '',
        paid: false,
        history: [],
        notes: [],
        words: [],
        chats: [],
        stats: {
          totalWords: 0,
          streak: 0,
          lastActive: null
        },
        createdAt: serverTimestamp()
      });
      
      console.log(`[WordStream] New user document created for ${uid}`);
    } else {
      // Update only if user data is different
      if (userData.email || userData.displayName) {
        const updateData: Record<string, any> = {};
        
        if (userData.email) updateData.email = userData.email;
        if (userData.displayName) updateData.displayName = userData.displayName;
        
        await setDoc(userRef, updateData, { merge: true });
        console.log(`[WordStream] User document updated for ${uid}`);
      }
    }
  } catch (error) {
    console.error('[WordStream] Error creating user document:', error);
    throw error;
  }
}

/**
 * Subscribe to auth state changes
 * Returns unsubscribe function
 */
export function subscribeToAuthChanges(
  callback: (user: { uid: string, email: string | null, displayName: string | null } | null) => void
): () => void {
  if (!firebaseAuth) {
    console.error('[WordStream] Firebase Auth not initialized');
    return () => {};
  }
  
  // Use type assertion since we've checked firebaseAuth is not null
  return onAuthStateChanged(firebaseAuth as any, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Get current user information
 */
export function getCurrentUser() {
  if (!firebaseAuth) {
    console.error('[WordStream] Firebase Auth not initialized');
    return null;
  }
  
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  };
} 