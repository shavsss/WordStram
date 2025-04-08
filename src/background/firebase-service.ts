/**
 * Firebase Service for Background
 * Standalone implementation of Firebase functionality for background script
 */

import { initializeApp, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, doc, getDoc, setDoc, collection, getDocs, 
  deleteDoc, updateDoc, serverTimestamp, query, where, 
  Timestamp, DocumentData, orderBy, limit, QueryDocumentSnapshot
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { safeGetCurrentUser, safeGetAuth, getStoredUserInfo } from './index';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Gets the Firebase app instance
 * @returns FirebaseApp instance or undefined if not initialized
 */
function getFirebaseApp(): FirebaseApp | undefined {
  try {
    return getApp();
  } catch (error) {
    console.error('WordStream: Firebase app not initialized:', error);
    return undefined;
  }
}

// Define interfaces for type safety
interface BaseDocument {
  id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface NoteDocument extends BaseDocument {
  videoId: string;
  videoTitle?: string;
  videoURL?: string;
  content?: string;
}

// Cache storage for data
const cache = {
  words: new Map<string, BaseDocument[]>(),
  notes: new Map<string, BaseDocument[]>(),
  chats: new Map<string, BaseDocument[]>(),
  stats: null as BaseDocument | null,
  documentsCache: new Map<string, BaseDocument>(),
  // Cache expiration times in milliseconds
  cacheExpiration: {
    words: 5 * 60 * 1000, // 5 minutes
    notes: 2 * 60 * 1000, // 2 minutes
    chats: 2 * 60 * 1000, // 2 minutes
    stats: 1 * 60 * 1000, // 1 minute
    documents: 5 * 60 * 1000 // 5 minutes
  },
  lastUpdated: {
    words: 0,
    notes: new Map<string, number>(),
    chats: 0,
    stats: 0,
    documents: new Map<string, number>()
  }
};

// Helper function to check if cache is valid
function isCacheValid(type: 'words' | 'notes' | 'chats' | 'stats' | 'documents', identifier: string = 'default'): boolean {
  const now = Date.now();
  if (type === 'notes') {
    const lastUpdated = cache.lastUpdated.notes.get(identifier) || 0;
    return now - lastUpdated < cache.cacheExpiration.notes;
  } else if (type === 'documents') {
    const lastUpdated = cache.lastUpdated.documents.get(identifier) || 0;
    return now - lastUpdated < cache.cacheExpiration.documents;
  } else {
    const lastUpdated = cache.lastUpdated[type];
    return now - lastUpdated < cache.cacheExpiration[type];
  }
}

// Utility functions
export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\nStack: ${error.stack || 'No stack trace'}`;
  }
  return String(error);
}

export function safeStringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return JSON.stringify(error);
  } catch (e) {
    return String(error);
  }
}

/**
 * Gets the currently logged in user ID
 * @returns Promise resolving to the user ID, or null if not logged in
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // First check if we already have a cached user ID
    const cacheResult = await chrome.storage.local.get(['wordstream_user_id', 'wordstream_user_id_timestamp']);
    
    // Check if cache is valid (less than 5 minutes old)
    if (cacheResult.wordstream_user_id && 
        cacheResult.wordstream_user_id_timestamp && 
        (Date.now() - cacheResult.wordstream_user_id_timestamp < 5 * 60 * 1000)) {
      return cacheResult.wordstream_user_id;
    }
    
    // Get a reference to Firebase Auth
    const app = getFirebaseApp();
    if (!app) {
      console.error('WordStream: Firebase app not initialized');
      return null;
    }
    
    const auth = getAuth(app);
    const user = auth.currentUser;
    
    if (!user) {
      console.error('WordStream: No authenticated user found');
      return null;
    }
    
    // Cache the user ID
    await chrome.storage.local.set({
      'wordstream_user_id': user.uid,
      'wordstream_user_id_timestamp': Date.now()
    });
    
    return user.uid;
  } catch (error) {
    console.error('WordStream: Error getting current user ID:', error);
    return null;
  }
}

// Direct implementations of Firestore operations

export async function getWords(): Promise<BaseDocument[]> {
  // Check cache first
  if (isCacheValid('words') && cache.words.has('default')) {
    console.log('WordStream: Getting words from cache');
    return cache.words.get('default') || [];
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const wordsRef = collection(db, `users/${userId}/words`);
    const snapshot = await getDocs(wordsRef);
    
    const words = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return { id: doc.id, ...doc.data() } as BaseDocument;
    });
    
    // Save to cache
    cache.words.set('default', words);
    cache.lastUpdated.words = Date.now();
    
    return words;
  } catch (error) {
    console.error('Error getting words:', formatErrorForLog(error));
    
    // On error, check if we have a cache, even if expired
    if (cache.words.has('default')) {
      console.log('WordStream: Fallback to cached words due to error');
      return cache.words.get('default') || [];
    }
    
    return [];
  }
}

export async function saveWord(wordData: any): Promise<string> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const wordId = wordData.id || doc(collection(db, `users/${userId}/words`)).id;
    const wordRef = doc(db, `users/${userId}/words`, wordId);
    
    const timestamp = new Date().toISOString();
    await setDoc(wordRef, {
      ...wordData,
      userId,
      updatedAt: timestamp,
      ...(wordData.id ? {} : { createdAt: timestamp })
    }, { merge: true });
    
    return wordId;
  } catch (error) {
    console.error('Error saving word:', error);
    throw error;
  }
}

export async function deleteWord(wordId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const wordRef = doc(db, `users/${userId}/words`, wordId);
    await deleteDoc(wordRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting word:', error);
    return false;
  }
}

export async function getNotes(videoId: string): Promise<BaseDocument[]> {
  // Check cache first
  if (isCacheValid('notes', videoId) && cache.notes.has(videoId)) {
    console.log(`WordStream: Getting notes for video ${videoId} from cache`);
    return cache.notes.get(videoId) || [];
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    console.log(`WordStream: Fetching notes for video ${videoId}`);
    
    // Query notes from Firestore
    const notesRef = collection(db, `users/${userId}/notes`);
    const q = query(notesRef, where("videoId", "==", videoId));
    const snapshot = await getDocs(q);
    
    const notes = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return { id: doc.id, ...doc.data() } as BaseDocument;
    });
    
    // Save to cache
    cache.notes.set(videoId, notes);
    cache.lastUpdated.notes.set(videoId, Date.now());
    
    // Also save to chrome.storage for additional persistence
    try {
      // Only use localStorage in browser context
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`wordstream_notes_${videoId}`, JSON.stringify(notes));
      } else {
        // In Service Worker, use chrome.storage instead
        chrome.storage.local.set({ [`wordstream_notes_${videoId}`]: notes });
      }
    } catch (err) {
      console.warn('WordStream: Could not save notes to local storage', err);
    }
    
    return notes;
  } catch (error) {
    console.error(`Error getting notes for video ${videoId}:`, formatErrorForLog(error));
    
    // On error, check if we have a cache, even if expired
    if (cache.notes.has(videoId)) {
      console.log(`WordStream: Fallback to cached notes for video ${videoId} due to error`);
      return cache.notes.get(videoId) || [];
    }
    
    // Try to get from local storage as last resort
    try {
      // Try chrome.storage first
      const storedNotes = await chrome.storage.local.get([`wordstream_notes_${videoId}`]);
      if (storedNotes && storedNotes[`wordstream_notes_${videoId}`]) {
        console.log(`WordStream: Restored notes for video ${videoId} from chrome.storage`);
        return storedNotes[`wordstream_notes_${videoId}`];
      }
      
      // As fallback in browser context, try localStorage
      if (typeof localStorage !== 'undefined') {
        const localStoredNotes = localStorage.getItem(`wordstream_notes_${videoId}`);
        if (localStoredNotes) {
          const parsedNotes = JSON.parse(localStoredNotes) as BaseDocument[];
          console.log(`WordStream: Restored notes for video ${videoId} from localStorage`);
          return parsedNotes;
        }
      }
    } catch (err) {
      console.warn('WordStream: Could not get notes from local storage', err);
    }
    
    return [];
  }
}

export async function saveNote(noteData: any): Promise<string> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const noteId = noteData.id || doc(collection(db, `users/${userId}/notes`)).id;
    const noteRef = doc(db, `users/${userId}/notes`, noteId);
    
    const timestamp = new Date().toISOString();
    await setDoc(noteRef, {
      ...noteData,
      userId,
      updatedAt: timestamp,
      ...(noteData.id ? {} : { createdAt: timestamp })
    }, { merge: true });
    
    return noteId;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const noteRef = doc(db, `users/${userId}/notes`, noteId);
    await deleteDoc(noteRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

/**
 * קבל רשימת וידאו עם הערות
 */
export async function getAllVideosWithNotes(): Promise<any[]> {
  return withAuth(async () => {
    try {
      // קבל את מזהה המשתמש
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User authentication session expired');
      }
      
      // נסה לקבל את הנתונים מ-Firestore
      // ... existing implementation ...

      // אם יש שגיאה, בדוק ב-cache
      const { wordstream_videos_cache, wordstream_videos_cache_timestamp } = 
        await chrome.storage.local.get(['wordstream_videos_cache', 'wordstream_videos_cache_timestamp']);
        
      if (wordstream_videos_cache) {
        console.log('WordStream: Retrieved videos from cache');
        return wordstream_videos_cache;
      }
      
      return [];
    } catch (error) {
      console.error('WordStream: Error getting videos with notes:', error);
      
      // בדוק ב-cache במקרה של שגיאה
      try {
        const { wordstream_videos_cache } = await chrome.storage.local.get('wordstream_videos_cache');
        if (wordstream_videos_cache) {
          console.log('WordStream: Retrieved videos from cache after error');
          return wordstream_videos_cache;
        }
      } catch (cacheError) {
        console.error('WordStream: Error accessing cache:', cacheError);
      }
      
      throw error;
    }
  });
}

/**
 * קבל רשימת שיחות
 */
export async function getChats(): Promise<BaseDocument[]> {
  return withAuth(async () => {
    try {
      // קבל את מזהה המשתמש
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User authentication session expired');
      }
      
      // נסה לקבל את הנתונים מ-Firestore
      // ... existing implementation ...

      // אם יש שגיאה, בדוק ב-cache
      const { wordstream_chats_cache, wordstream_chats_cache_timestamp } = 
        await chrome.storage.local.get(['wordstream_chats_cache', 'wordstream_chats_cache_timestamp']);
        
      if (wordstream_chats_cache) {
        console.log('WordStream: Retrieved chats from cache');
        return wordstream_chats_cache;
      }
      
      return [];
    } catch (error) {
      console.error('WordStream: Error getting chats:', error);
      
      // בדוק ב-cache במקרה של שגיאה
      try {
        const { wordstream_chats_cache } = await chrome.storage.local.get('wordstream_chats_cache');
        if (wordstream_chats_cache) {
          console.log('WordStream: Retrieved chats from cache after error');
          return wordstream_chats_cache;
        }
      } catch (cacheError) {
        console.error('WordStream: Error accessing cache:', cacheError);
      }
      
      throw error;
    }
  });
}

export async function saveChat(chatData: any): Promise<string> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const chatId = chatData.id || doc(collection(db, `users/${userId}/chats`)).id;
    const chatRef = doc(db, `users/${userId}/chats`, chatId);
    
    const timestamp = new Date().toISOString();
    await setDoc(chatRef, {
      ...chatData,
      userId,
      updatedAt: timestamp,
      ...(chatData.id ? {} : { createdAt: timestamp })
    }, { merge: true });
    
    return chatId;
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
}

export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }

    const chatRef = doc(db, `users/${userId}/chats`, chatId);
    await deleteDoc(chatRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<BaseDocument | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('WordStream: Cannot get user stats - No authenticated user');
      return null;
    }

    console.log('WordStream: Getting user stats for user', userId);
    
    // Check if we have a valid cache
    if (isCacheValid('stats')) {
      try {
        const cachedData = await chrome.storage.local.get(['wordstream_stats_cache']);
        if (cachedData && cachedData.wordstream_stats_cache) {
          console.log('WordStream: Returning cached stats');
          return cachedData.wordstream_stats_cache;
        }
      } catch (cacheError) {
        console.warn('WordStream: Error accessing stats cache:', cacheError);
      }
    }

    // Define paths for user stats (use userData/stats instead of just stats)
    // This ensures we have an even number of segments for the document path
    const statsCollectionPath = `users/${userId}/userData`;
    const statsDocId = 'stats';
    
    console.log('WordStream: Using stats path:', statsCollectionPath, 'Document ID:', statsDocId);
    
    try {
      const statsDoc = await getDoc(doc(db, statsCollectionPath, statsDocId));
      
      if (statsDoc.exists()) {
        const statsData = {
          id: statsDoc.id,
          ...statsDoc.data()
        };
        
        // Cache the stats data
        try {
          await chrome.storage.local.set({
            'wordstream_stats_cache': statsData,
            'wordstream_stats_cache_timestamp': Date.now()
          });
        } catch (storageError) {
          console.warn('WordStream: Error caching stats:', storageError);
        }
        
        return statsData;
      } else {
        console.log('WordStream: No stats document found, creating default stats');
        
        // Create empty stats document
        const defaultStats = {
          id: 'stats',
          totalWords: 0,
          totalNotes: 0,
          totalChats: 0,
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        
        // Save the default stats
        await setDoc(doc(db, statsCollectionPath, statsDocId), {
          ...defaultStats,
          userId
        });
        
        // Cache the default stats
        try {
          await chrome.storage.local.set({
            'wordstream_stats_cache': defaultStats,
            'wordstream_stats_cache_timestamp': Date.now()
          });
        } catch (storageError) {
          console.warn('WordStream: Error caching default stats:', storageError);
        }
        
        return defaultStats;
      }
    } catch (firestoreError) {
      console.error('WordStream: Firestore error getting stats:', firestoreError);
      
      // Check for an older format of stats document (directly under users/{userId})
      try {
        const oldStatsCollectionPath = `users/${userId}`;
        const oldStatsDocId = 'stats';
        const oldStatsDoc = await getDoc(doc(db, oldStatsCollectionPath, oldStatsDocId));
        
        if (oldStatsDoc.exists()) {
          const oldStatsData = {
            id: 'stats',
            ...oldStatsDoc.data()
          };
          
          console.log('WordStream: Found stats in old format, migrating to new path');
          
          // Migrate to new path
          await setDoc(doc(db, statsCollectionPath, statsDocId), {
            ...oldStatsData,
            userId,
            updatedAt: new Date().toISOString(),
            migratedAt: new Date().toISOString()
          });
          
          // Cache the migrated stats
          try {
            await chrome.storage.local.set({
              'wordstream_stats_cache': oldStatsData,
              'wordstream_stats_cache_timestamp': Date.now()
            });
          } catch (storageError) {
            console.warn('WordStream: Error caching migrated stats:', storageError);
          }
          
          return oldStatsData;
        }
      } catch (migrationError) {
        console.error('WordStream: Error checking old stats format:', migrationError);
      }
      
      // Return empty stats if all else fails
      return {
        id: 'stats',
        totalWords: 0,
        totalNotes: 0,
        totalChats: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('WordStream: Error getting user stats:', error);
    return null;
  }
}

/**
 * Saves user statistics to Firestore
 * @param statsData Statistics data to save
 * @returns Promise resolving to success boolean
 */
export async function saveUserStats(statsData: any): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      console.error('WordStream: Cannot save user stats - no authenticated user');
      return false;
    }
    
    console.log('WordStream: Saving user stats to Firestore');
    
    // Use the correct path format with userData collection and stats document
    const statsDocRef = doc(db, `users/${userId}/userData`, 'stats');
    const timestamp = new Date().toISOString();
    
    // Prepare data for saving
    const dataToSave = {
      ...statsData,
      userId,
      updatedAt: timestamp
    };
    
    // Add createdAt if this is a new document
    if (!statsData.createdAt) {
      dataToSave.createdAt = timestamp;
    }
    
    await setDoc(statsDocRef, dataToSave, { merge: true });
    
    // Update cache
    try {
      await chrome.storage.local.set({
        'wordstream_stats_cache': dataToSave,
        'wordstream_stats_cache_timestamp': Date.now()
      });
      
      console.log('WordStream: User stats saved and cached successfully');
    } catch (storageError) {
      console.warn('WordStream: Error updating stats cache:', storageError);
    }
    
    return true;
  } catch (error) {
    console.error('WordStream: Error saving user stats:', error);
    
    // Log specific details about the error
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if ('code' in error) {
        console.error('Error code:', (error as any).code);
      }
    }
    
    return false;
  }
}

/**
 * Checks the connection to Firestore and user authentication
 * @returns Promise resolving to connection status object
 */
export async function checkFirestoreConnection(): Promise<any> {
  try {
    console.log('WordStream: Checking Firestore connection...');
    
    // First check if Firebase is initialized
    const app = getFirebaseApp();
    if (!app) {
      console.error('WordStream: Firebase app not initialized');
      return {
        connected: false,
        authenticated: false,
        error: 'Firebase not initialized',
        details: 'The Firebase app is not properly initialized'
      };
    }
    
    // Next check if user is authenticated
    const auth = getAuth(app);
    if (!auth || !auth.currentUser) {
      console.log('WordStream: No authenticated user found during connection check');
      
      // Try to get user ID from storage as a backup
      try {
        const cacheResult = await chrome.storage.local.get(['wordstream_user_id']);
        if (cacheResult && cacheResult.wordstream_user_id) {
          console.log('WordStream: Found user ID in storage, but not authenticated in Firebase Auth');
          return {
            connected: true,
            authenticated: false,
            error: 'User not authenticated',
            details: 'Found user ID in storage but Firebase Auth shows no authenticated user',
            storedUserId: cacheResult.wordstream_user_id
          };
        }
      } catch (storageError) {
        console.warn('WordStream: Error checking user ID in storage:', storageError);
      }
      
      return {
        connected: true,
        authenticated: false,
        error: 'No authenticated user',
        details: 'No user is currently authenticated with Firebase'
      };
    }
    
    const userId = auth.currentUser.uid;
    if (!userId) {
      return {
        connected: true,
        authenticated: false,
        error: 'Invalid user ID',
        details: 'User is authenticated but has no valid ID'
      };
    }
    
    // Try a simple read operation to check if Firestore is working
    try {
      console.log('WordStream: Testing Firestore read operation');
      const firestore = getFirestore();
      const userDocRef = doc(firestore, `users/${userId}`);
      await getDoc(userDocRef);
      
      // If we got here, the connection is working
      console.log('WordStream: Firestore connection successful');
      return {
        connected: true,
        authenticated: true,
        userId
      };
    } catch (firestoreError) {
      console.error('WordStream: Firestore connection error:', firestoreError);
      
      // Check if this is an authentication error
      const errorString = String(firestoreError);
      if (errorString.includes('permission-denied') || 
          errorString.includes('unauthenticated') || 
          errorString.includes('auth')) {
        return {
          connected: true,
          authenticated: false,
          error: 'Authentication error',
          details: `Firestore denied access: ${errorString}`,
          userId // Include userId so caller knows who failed authentication
        };
      }
      
      // Otherwise it's a connection error
      return {
        connected: false,
        authenticated: true, // We are authenticated, just can't connect
        error: 'Firestore connection error',
        details: errorString,
        userId
      };
    }
  } catch (error) {
    console.error('WordStream: Error checking Firestore connection:', error);
    return {
      connected: false,
      authenticated: false,
      error: 'Unknown error checking connection',
      details: String(error)
    };
  }
}

export async function getDocument(collectionName: string, docId: string): Promise<BaseDocument | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }
    
    const docRef = doc(db, `users/${userId}/${collectionName}`, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as BaseDocument : null;
  } catch (error) {
    console.error('WordStream: Error getting document:', error);
    throw error;
  }
}

export async function saveDocument(collectionName: string, docId: string, data: any): Promise<string> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }
    
    const docRef = doc(db, `users/${userId}/${collectionName}`, docId);
    const timestamp = new Date().toISOString();
    
    await setDoc(docRef, { 
      ...data, 
      userId,
      updatedAt: timestamp,
      ...(data.id ? {} : { createdAt: timestamp })
    }, { merge: true });
    
    return docId;
  } catch (error) {
    console.error('WordStream: Error saving document:', error);
    throw error;
  }
}

/**
 * Deletes all notes for a specific video
 * @param videoId The ID of the video to delete notes for
 * @returns Promise resolving to the number of deleted notes
 */
export async function deleteAllNotesForVideo(videoId: string): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user');
    }
    
    // Get all notes for this video
    const notesRef = collection(db, `users/${userId}/notes`);
    const q = query(notesRef, where("videoId", "==", videoId));
    const snapshot = await getDocs(q);
    
    // No notes to delete
    if (snapshot.empty) {
      return 0;
    }
    
    // Delete each note
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Clear cache for this video
    if (cache.notes.has(videoId)) {
      cache.notes.delete(videoId);
    }
    
    // Try to remove from local storage as well
    try {
      // Remove from chrome.storage
      chrome.storage.local.remove([`wordstream_notes_${videoId}`]);
      
      // Remove from localStorage if available
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`wordstream_notes_${videoId}`);
      }
    } catch (err) {
      // Ignore localStorage errors
    }
    
    // Return count of deleted notes
    return snapshot.size;
  } catch (error) {
    console.error(`WordStream: Error deleting notes for video ${videoId}:`, error);
    throw error;
  }
}

/**
 * טיפול מתקדם בשגיאות הרשאה ב-Firestore
 * מאפשר לזהות סוגי שגיאות שונים ולהחזיר מידע מותאם
 */
export function handleFirestorePermissionError(error: any, operation: string, collection?: string, docId?: string): any {
  // בדיקה אם השגיאה היא שגיאת הרשאות
  const isPermissionError = error && (
    (error.code && (
      error.code === 'permission-denied' || 
      error.code.includes('permission') || 
      error.code.includes('unauthorized')
    )) || 
    (error.message && (
      error.message.includes('permission-denied') || 
      error.message.includes('Missing or insufficient permissions') ||
      error.message.includes('unauthorized')
    ))
  );

  if (!isPermissionError) {
    // אם זו לא שגיאת הרשאה, החזר את השגיאה המקורית
    return error;
  }

  console.warn(`WordStream: Permission error in ${operation}`, {
    collection,
    docId,
    errorCode: error.code,
    errorMessage: error.message
  });

  // בדיקה אם השגיאה מכילה מידע על חוק אבטחה ספציפי
  let securityRuleInfo = '';
  if (error.message && error.message.includes('security rule')) {
    // חילוץ מידע על חוק האבטחה שגרם לשגיאה
    const ruleMatch = error.message.match(/security rule at (.+) is preventing/);
    if (ruleMatch && ruleMatch[1]) {
      securityRuleInfo = `Security rule at ${ruleMatch[1]} prevented the operation`;
    }
  }

  // החזרת אובייקט שגיאה משופר עם מידע יותר ספציפי
  return {
    error: 'Firestore permission error',
    code: 'firestore/permission-denied',
    operation,
    collection,
    docId,
    originalMessage: error.message,
    securityRuleInfo,
    suggestions: [
      'Verify that you are signed in',
      'Check if you have access to this document',
      'The document might belong to a different user'
    ],
    timestamp: Date.now()
  };
}

/**
 * בודק אם יש למשתמש הרשאה לגשת למסמך
 * בדיקה מפושטת הבודקת רק אם המשתמש מחובר
 */
export async function checkDocumentPermission(collection: string, docId: string): Promise<boolean | any> {
  try {
    // נקבל את מזהה המשתמש הנוכחי
    const userId = await getCurrentUserId();
    
    // אם אין משתמש מחובר, אין גישה
    if (!userId) {
      return {
        hasPermission: false,
        error: 'User authentication session expired'
      };
    }
    
    return {
      hasPermission: true,
      userId
    };
  } catch (error) {
    console.error(`WordStream: Error checking document permission for ${collection}/${docId}:`, error);
    return {
      hasPermission: false,
      error: safeStringifyError(error)
    };
  }
}

/**
 * פונקציית עזר לבדיקת אימות משתמש ופעולות Firebase
 */
async function withAuth<T>(operation: () => Promise<T>): Promise<T> {
  try {
    // בדוק אם יש ID משתמש ב-storage
    const { wordstream_user_id } = await chrome.storage.local.get('wordstream_user_id');
    
    if (!wordstream_user_id) {
      throw new Error('User authentication session expired');
    }
    
    // בצע את הפעולה
    return await operation();
  } catch (error) {
    console.error('WordStream: Authentication error in Firestore operation:', error);
    throw error;
  }
} 