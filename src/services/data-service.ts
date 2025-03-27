import { collection, doc, onSnapshot, updateDoc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../firebase/firebase-config';

// Type definitions
export interface UserData {
  stats?: {
    totalWords?: number;
    videosWatched?: number;
    totalNotes?: number;
    lastActive?: number;
    streak?: number;
  };
  words?: Record<string, Word>;
  notes?: Record<string, Note>;
  settings?: UserSettings;
}

export interface Word {
  id: string;
  original: string;
  translation: string;
  context?: string;
  videoId?: string;
  videoTitle?: string;
  timestamp: number;
  reviewData?: {
    lastReviewed?: number;
    nextReview?: number;
    reviewCount?: number;
    difficulty?: number;
  };
}

export interface Note {
  id: string;
  text: string;
  videoId?: string;
  videoTitle?: string;
  timestamp: number;
}

export interface UserSettings {
  targetLanguage: string;
  nativeLanguage: string;
  dailyGoal?: number;
  notificationsEnabled?: boolean;
  theme?: string;
}

/**
 * Listen to user data changes in Firestore
 * 
 * @param userId - The ID of the user to listen to
 * @param callback - Function to call when data changes
 * @returns Unsubscribe function to stop listening
 */
export function listenToUserData(
  userId: string, 
  callback: (data: UserData | null) => void
): () => void {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  // Set initial loading state
  callback(null);
  
  // Listen for real-time updates
  return onSnapshot(userDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.data() as UserData;
      callback(userData);
    } else {
      // Create the user document if it doesn't exist
      const initialData: UserData = {
        stats: {
          totalWords: 0,
          videosWatched: 0,
          totalNotes: 0,
          lastActive: Date.now(),
          streak: 0
        },
        words: {},
        notes: {},
        settings: {
          targetLanguage: 'en',
          nativeLanguage: 'en',
          dailyGoal: 5,
          notificationsEnabled: true,
          theme: 'light'
        }
      };
      
      setDoc(userDocRef, initialData)
        .then(() => {
          callback(initialData);
        })
        .catch((error) => {
          console.error('Error creating user data:', error);
          callback(null);
        });
    }
  }, (error) => {
    console.error('Error listening to user data:', error);
    callback(null);
  });
}

/**
 * Get user data from Firestore
 * 
 * @param userId - The ID of the user
 * @returns Promise that resolves with the user data
 */
export async function getUserData(userId: string): Promise<UserData | null> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  try {
    const snapshot = await getDoc(userDocRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as UserData;
    } else {
      // Create user document if it doesn't exist
      const initialData: UserData = {
        stats: {
          totalWords: 0,
          videosWatched: 0,
          totalNotes: 0,
          lastActive: Date.now(),
          streak: 0
        },
        words: {},
        notes: {},
        settings: {
          targetLanguage: 'en',
          nativeLanguage: 'en',
          dailyGoal: 5,
          notificationsEnabled: true,
          theme: 'light'
        }
      };
      
      await setDoc(userDocRef, initialData);
      return initialData;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Add a new word to the user's collection
 * 
 * @param userId - The ID of the user
 * @param word - The word data to add
 * @returns Promise that resolves when the word is added
 */
export async function addWord(userId: string, word: Omit<Word, 'id' | 'timestamp'>): Promise<string> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  // Generate a unique ID for the word
  const wordId = crypto.randomUUID();
  
  // Get user data to update stats
  const userSnapshot = await getDoc(userDocRef);
  
  if (userSnapshot.exists()) {
    const userData = userSnapshot.data() as UserData;
    
    // Create the complete word object
    const newWord: Word = {
      id: wordId,
      original: word.original,
      translation: word.translation,
      context: word.context,
      videoId: word.videoId,
      videoTitle: word.videoTitle,
      timestamp: Date.now(),
      reviewData: {
        lastReviewed: Date.now(),
        nextReview: Date.now() + 24 * 60 * 60 * 1000, // 1 day later
        reviewCount: 0,
        difficulty: 0.5 // Medium difficulty
      }
    };
    
    // Update the user document
    await updateDoc(userDocRef, {
      [`words.${wordId}`]: newWord,
      'stats.totalWords': (userData.stats?.totalWords || 0) + 1,
      'stats.lastActive': Date.now()
    });
    
    return wordId;
  } else {
    throw new Error('User document not found');
  }
}

/**
 * Delete a word from the user's collection
 * 
 * @param userId - The ID of the user
 * @param wordId - The ID of the word to delete
 * @returns Promise that resolves when the word is deleted
 */
export async function deleteWord(userId: string, wordId: string): Promise<void> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  try {
    // Get user data
    const userSnapshot = await getDoc(userDocRef);
    
    if (!userSnapshot.exists()) {
      throw new Error('User document not found');
    }
    
    const userData = userSnapshot.data() as UserData;
    
    // Check if word exists
    if (!userData.words || !userData.words[wordId]) {
      throw new Error('Word not found');
    }
    
    // Remove word and update stats
    await updateDoc(userDocRef, {
      [`words.${wordId}`]: deleteDoc,
      'stats.totalWords': Math.max(0, (userData.stats?.totalWords || 0) - 1),
      'stats.lastActive': Date.now()
    });
  } catch (error) {
    console.error('Error deleting word:', error);
    throw error;
  }
}

/**
 * Add a new note to the user's collection
 * 
 * @param userId - The ID of the user
 * @param note - The note data to add
 * @returns Promise that resolves when the note is added
 */
export async function addNote(userId: string, note: Omit<Note, 'id' | 'timestamp'>): Promise<string> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  // Generate a unique ID for the note
  const noteId = crypto.randomUUID();
  
  // Get user data to update stats
  const userSnapshot = await getDoc(userDocRef);
  
  if (userSnapshot.exists()) {
    const userData = userSnapshot.data() as UserData;
    
    // Create the complete note object
    const newNote: Note = {
      id: noteId,
      text: note.text,
      videoId: note.videoId,
      videoTitle: note.videoTitle,
      timestamp: Date.now()
    };
    
    // Update the user document
    await updateDoc(userDocRef, {
      [`notes.${noteId}`]: newNote,
      'stats.totalNotes': (userData.stats?.totalNotes || 0) + 1,
      'stats.lastActive': Date.now()
    });
    
    return noteId;
  } else {
    throw new Error('User document not found');
  }
}

/**
 * Delete a note from the user's collection
 * 
 * @param userId - The ID of the user
 * @param noteId - The ID of the note to delete
 * @returns Promise that resolves when the note is deleted
 */
export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  try {
    // Get user data
    const userSnapshot = await getDoc(userDocRef);
    
    if (!userSnapshot.exists()) {
      throw new Error('User document not found');
    }
    
    const userData = userSnapshot.data() as UserData;
    
    // Check if note exists
    if (!userData.notes || !userData.notes[noteId]) {
      throw new Error('Note not found');
    }
    
    // Remove note and update stats
    await updateDoc(userDocRef, {
      [`notes.${noteId}`]: deleteDoc,
      'stats.totalNotes': Math.max(0, (userData.stats?.totalNotes || 0) - 1),
      'stats.lastActive': Date.now()
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

/**
 * Update user settings in Firestore
 * 
 * @param userId - The ID of the user
 * @param settings - The settings to update
 * @returns Promise that resolves when settings are updated
 */
export async function updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  await updateDoc(userDocRef, {
    'settings': settings,
    'stats.lastActive': Date.now()
  });
}

/**
 * Update video statistics after watching
 * 
 * @param userId - The ID of the user
 * @param videoId - The ID of the video watched
 * @returns Promise that resolves when stats are updated
 */
export async function updateVideoWatched(userId: string, videoId: string): Promise<void> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, 'users', userId);
  
  // Get user data to update stats
  const userSnapshot = await getDoc(userDocRef);
  
  if (userSnapshot.exists()) {
    const userData = userSnapshot.data() as UserData;
    
    await updateDoc(userDocRef, {
      'stats.videosWatched': (userData.stats?.videosWatched || 0) + 1,
      'stats.lastActive': Date.now()
    });
  }
} 