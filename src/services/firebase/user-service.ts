import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  arrayUnion 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { logger } from './logger';

// Import Firebase instances from initialization module
import { auth, db } from './firebase-init';

/**
 * Interface representing a user document in Firestore
 */
interface UserDocument {
  email: string;
  displayName?: string;
  createdAt: any; // serverTimestamp
  paid: boolean;
  words: any[];
  notes: any[];
  history: any[];
}

/**
 * Creates or updates a user document in Firestore after authentication
 * @param user The authenticated user object
 */
export async function createUserDocument(user: any): Promise<void> {
  if (!user || !user.uid) {
    logger.error('Cannot create user document: No user provided');
    throw new Error('User is required');
  }

  if (!db) {
    logger.error('Cannot create user document: Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      // Create a new user document if it doesn't exist
      await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || '',
        createdAt: serverTimestamp(),
        paid: false, // Default to unpaid
        words: [],
        notes: [],
        history: [],
      });
      logger.log('User document created successfully');
    } else {
      logger.log('User document already exists');
    }
  } catch (error) {
    logger.error('Error creating user document:', error);
    throw error;
  }
}

/**
 * Checks if the user has paid for the service
 * @param userId The user's ID
 * @returns Whether the user has paid for the service
 */
export async function checkIfUserPaid(userId: string): Promise<boolean> {
  if (!userId) {
    logger.error('Cannot check payment status: No user ID provided');
    return false;
  }

  if (!db) {
    logger.error('Cannot check payment status: Firestore not initialized');
    return false;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().paid) {
      logger.log('User has paid for the service');
      return true;
    } else {
      logger.log('User has not paid for the service');
      return false;
    }
  } catch (error) {
    logger.error('Error checking payment status:', error);
    return false;
  }
}

/**
 * Manually sets a user's payment status (for admin use only)
 * This will be replaced with an automatic payment system later
 * @param userId The user's ID
 * @param paid Whether the user has paid
 */
export async function setUserPaymentStatus(userId: string, paid: boolean): Promise<void> {
  if (!userId) {
    logger.error('Cannot set payment status: No user ID provided');
    throw new Error('User ID is required');
  }

  if (!db) {
    logger.error('Cannot set payment status: Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { paid });
    logger.log(`User payment status set to: ${paid}`);
  } catch (error) {
    logger.error('Error setting payment status:', error);
    throw error;
  }
}

/**
 * Adds a word to the user's words array in Firestore
 * @param userId The user's ID
 * @param word The word to add
 */
export async function addWord(userId: string, word: any): Promise<void> {
  if (!userId) {
    logger.error('Cannot add word: No user ID provided');
    throw new Error('User ID is required');
  }

  if (!db) {
    logger.error('Cannot add word: Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      words: arrayUnion(word)
    });
    logger.log('Word added successfully');
  } catch (error) {
    logger.error('Error adding word:', error);
    throw error;
  }
}

/**
 * Adds a note to the user's notes array in Firestore
 * @param userId The user's ID
 * @param note The note to add
 */
export async function addNote(userId: string, note: any): Promise<void> {
  if (!userId) {
    logger.error('Cannot add note: No user ID provided');
    throw new Error('User ID is required');
  }

  if (!db) {
    logger.error('Cannot add note: Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      notes: arrayUnion(note)
    });
    logger.log('Note added successfully');
  } catch (error) {
    logger.error('Error adding note:', error);
    throw error;
  }
}

/**
 * Adds an entry to the user's history array in Firestore
 * @param userId The user's ID
 * @param historyEntry The history entry to add
 */
export async function addHistoryEntry(userId: string, historyEntry: any): Promise<void> {
  if (!userId) {
    logger.error('Cannot add history entry: No user ID provided');
    throw new Error('User ID is required');
  }

  if (!db) {
    logger.error('Cannot add history entry: Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      history: arrayUnion(historyEntry)
    });
    logger.log('History entry added successfully');
  } catch (error) {
    logger.error('Error adding history entry:', error);
    throw error;
  }
}

/**
 * Gets a user's data from Firestore
 * @param userId The user's ID
 * @returns The user's data
 */
export async function getUserData(userId: string): Promise<UserDocument | null> {
  if (!userId) {
    logger.error('Cannot get user data: No user ID provided');
    return null;
  }

  if (!db) {
    logger.error('Cannot get user data: Firestore not initialized');
    return null;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserDocument;
    } else {
      logger.error('User document does not exist');
      return null;
    }
  } catch (error) {
    logger.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Sets up an auth state listener and creates a user document if needed
 */
export function setupAuthListener(): (() => void) {
  if (!auth) {
    logger.error('Cannot set up auth listener: Auth not initialized');
    return () => {}; // Return a noop function
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in, create/update their document
      await createUserDocument(user);
    }
  });
} 