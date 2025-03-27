import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase-config';

// Types for our data model
export interface UserData {
  email: string;
  displayName: string;
  paid: boolean;
  history: any[];
  notes: any[];
  words: any[];
  chats: any[];
  stats: {
    totalWords: number;
    streak: number;
    lastActive: any;
    [key: string]: any;
  };
  createdAt: any;
  lastUpdated: any;
}

interface Word {
  id: string;
  original: string;
  translation: string;
  context: any;
  stats: {
    successRate: number;
    totalReviews: number;
    lastReview: any;
  };
  metadata?: any;
  groups?: string[];
  increment?: number; // For incrementing stats.totalWords
}

interface Note {
  id: string;
  text: string;
  timestamp: number;
  videoId?: string;
  videoTime?: number;
  videoTitle?: string;
  videoURL?: string;
}

// Get current user ID or throw if not logged in
function getCurrentUserId(): string {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
}

// Get user document reference
function getUserDocRef(userId: string) {
  if (!firebaseDb) throw new Error('Firestore not initialized');
  return doc(firebaseDb, 'users', userId);
}

/**
 * Listen to user data changes in real-time
 * Returns unsubscribe function
 */
export function listenToUserData(
  callback: (data: UserData | null) => void
): Unsubscribe {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    return onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserData;
          callback(data);
        } else {
          console.warn(`[WordStream] User document not found for ${userId}`);
          callback(null);
        }
      },
      (error) => {
        console.error('[WordStream] Error listening to user data:', error);
        callback(null);
      }
    );
  } catch (error) {
    console.error('[WordStream] Failed to listen to user data:', error);
    return () => {}; // Return empty unsubscribe function
  }
}

/**
 * Migrate local data to Firestore
 * Extracts data from Chrome storage and adds it to Firestore
 */
export async function migrateLocalDataToFirestore(): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    
    // Get data from Chrome storage
    const localData = await new Promise<any>((resolve) => {
      chrome.storage.local.get(null, (localItems) => {
        chrome.storage.sync.get(null, (syncItems) => {
          resolve({
            local: localItems || {},
            sync: syncItems || {}
          });
        });
      });
    });
    
    console.log('[WordStream] Local data retrieved for migration:', localData);
    
    // Check if we have existing user data
    const userRef = getUserDocRef(userId);
    const userDoc = await getDoc(userRef);
    
    // Prepare data for migration
    const words = extractWords(localData);
    const notes = extractNotes(localData);
    const stats = extractStats(localData);
    
    if (userDoc.exists()) {
      // User exists, update with local data
      // Only add new items that aren't already in Firestore
      const userData = userDoc.data() as UserData;
      
      // Merge words
      const existingWordIds = new Set(userData.words.map(w => w.id));
      const newWords = words.filter(w => !existingWordIds.has(w.id));
      
      // Merge notes
      const existingNoteIds = new Set(userData.notes.map(n => n.id));
      const newNotes = notes.filter(n => !existingNoteIds.has(n.id));
      
      // Update with merged data
      if (newWords.length > 0 || newNotes.length > 0) {
        await updateDoc(userRef, {
          words: [...userData.words, ...newWords],
          notes: [...userData.notes, ...newNotes],
          stats: {
            ...userData.stats,
            ...stats,
            totalWords: (userData.stats.totalWords || 0) + newWords.length,
            lastUpdated: serverTimestamp()
          },
          lastUpdated: serverTimestamp()
        });
        console.log('[WordStream] Merged local data with existing user document');
      } else {
        console.log('[WordStream] No new data to merge');
      }
    } else {
      // Create new user document with local data
      const userData: UserData = {
        email: firebaseAuth?.currentUser?.email || '',
        displayName: firebaseAuth?.currentUser?.displayName || '',
        paid: false,
        words: words,
        notes: notes,
        history: [],
        chats: [],
        stats: stats,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      
      await setDoc(userRef, userData);
      console.log('[WordStream] New user document created with migrated data');
    }
    
    // Mark data as migrated in local storage
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({ 
        settings: { 
          ...localData.sync.settings,
          migratedToFirebase: true 
        } 
      }, () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Failed to migrate local data:', error);
    return false;
  }
}

/**
 * Extract words from Chrome storage data
 */
function extractWords(localData: any): Word[] {
  // Extract words from Chrome storage
  const words = localData.sync.words || [];
  const wordsMetadata = localData.sync.words_metadata || {};
  const wordsGroups = localData.sync.words_groups || [];
  
  // Combine into a structured format
  return words.map((word: any) => {
    // Make sure all words have IDs
    if (!word.id) {
      word.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
    
    return {
      ...word,
      metadata: wordsMetadata[word.id] || {},
      groups: wordsGroups.filter((group: string) => 
        (wordsMetadata[word.id]?.groups || []).includes(group)
      )
    };
  });
}

/**
 * Extract notes from Chrome storage data
 */
function extractNotes(localData: any): Note[] {
  // Extract notes from local storage
  let notes: Note[] = [];
  
  // Handle different note storage formats
  if (localData.local.videoNotes) {
    // Format: { videoId: [notes] }
    Object.entries(localData.local.videoNotes).forEach(([videoId, videoNotes]: [string, any]) => {
      notes = notes.concat(
        (videoNotes as any[]).map((note: any) => ({
          ...note,
          id: note.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          videoId
        }))
      );
    });
  }
  
  if (localData.local.notes_storage) {
    // Unified storage format
    Object.values(localData.local.notes_storage).forEach((videoData: any) => {
      if (videoData.notes && Array.isArray(videoData.notes)) {
        notes = notes.concat(
          videoData.notes.map((note: any) => ({
            ...note,
            id: note.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
            videoId: videoData.videoId,
            videoTitle: videoData.videoTitle,
            videoURL: videoData.videoURL
          }))
        );
      }
    });
  }
  
  return notes;
}

/**
 * Extract statistics from Chrome storage data
 */
function extractStats(localData: any): UserData['stats'] {
  // Get existing stats or create default
  const stats = localData.sync.stats || {
    totalWords: 0,
    streak: 0,
    lastActive: null
  };
  
  // Update word count if needed
  if (localData.sync.words && !stats.totalWords) {
    stats.totalWords = localData.sync.words.length;
  }
  
  return stats;
}

/**
 * Add a word to the user's collection
 */
export async function addWord(word: Partial<Word>): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Generate ID if not provided
    if (!word.id) {
      word.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
    
    // Set default stats if not provided
    if (!word.stats) {
      word.stats = {
        successRate: 0,
        totalReviews: 0,
        lastReview: new Date()
      };
    }
    
    // Add word to user's words array
    await updateDoc(userRef, {
      words: arrayUnion(word),
      'stats.totalWords': word.increment || 1,
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error adding word:', error);
    return false;
  }
}

/**
 * Add a note to the user's collection
 */
export async function addNote(note: Partial<Note>): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Generate ID if not provided
    if (!note.id) {
      note.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
    
    // Add timestamp if not provided
    if (!note.timestamp) {
      note.timestamp = Date.now();
    }
    
    // Add note to user's notes array
    await updateDoc(userRef, {
      notes: arrayUnion(note),
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error adding note:', error);
    return false;
  }
}

/**
 * Update a word in the user's collection
 */
export async function updateWord(wordId: string, updates: Partial<Word>): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Get current words
    const doc = await getDoc(userRef);
    if (!doc.exists()) return false;
    
    const userData = doc.data() as UserData;
    const words = userData.words || [];
    
    // Find the word to update
    const wordIndex = words.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return false;
    
    // Update the word
    const updatedWords = [...words];
    updatedWords[wordIndex] = {
      ...updatedWords[wordIndex],
      ...updates
    };
    
    // Save back to Firestore
    await updateDoc(userRef, {
      words: updatedWords,
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error updating word:', error);
    return false;
  }
}

/**
 * Delete a word from the user's collection
 */
export async function deleteWord(wordId: string): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Get current user data
    const doc = await getDoc(userRef);
    if (!doc.exists()) return false;
    
    const userData = doc.data() as UserData;
    
    // Find the word to delete
    const word = userData.words.find(w => w.id === wordId);
    if (!word) return false;
    
    // Remove the word
    await updateDoc(userRef, {
      words: arrayRemove(word),
      'stats.totalWords': Math.max(0, (userData.stats.totalWords || 0) - 1),
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error deleting word:', error);
    return false;
  }
}

/**
 * Delete a note from the user's collection
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Get current notes
    const doc = await getDoc(userRef);
    if (!doc.exists()) return false;
    
    const userData = doc.data() as UserData;
    
    // Find the note to delete
    const note = userData.notes.find(n => n.id === noteId);
    if (!note) return false;
    
    // Remove the note
    await updateDoc(userRef, {
      notes: arrayRemove(note),
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error deleting note:', error);
    return false;
  }
}

/**
 * Update user statistics
 */
export async function updateStats(statsUpdate: Partial<UserData['stats']>): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    const updates: Record<string, any> = {};
    
    // Format updates for Firestore
    Object.entries(statsUpdate).forEach(([key, value]) => {
      updates[`stats.${key}`] = value;
    });
    
    // Always update lastActive
    updates['stats.lastActive'] = serverTimestamp();
    updates['lastUpdated'] = serverTimestamp();
    
    await updateDoc(userRef, updates);
    return true;
  } catch (error) {
    console.error('[WordStream] Error updating stats:', error);
    return false;
  }
}

/**
 * Get all user data
 */
export async function getUserData(): Promise<UserData | null> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    const doc = await getDoc(userRef);
    if (!doc.exists()) return null;
    
    return doc.data() as UserData;
  } catch (error) {
    console.error('[WordStream] Error getting user data:', error);
    return null;
  }
}

/**
 * Add an entry to user history
 */
export async function addToHistory(entry: any): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const userRef = getUserDocRef(userId);
    
    // Ensure entry has a timestamp
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }
    
    await updateDoc(userRef, {
      history: arrayUnion(entry),
      'stats.lastActive': serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('[WordStream] Error adding to history:', error);
    return false;
  }
}

/**
 * Check if user is a premium/paid user
 */
export async function isPaidUser(): Promise<boolean> {
  try {
    const userData = await getUserData();
    return userData?.paid === true;
  } catch (error) {
    console.error('[WordStream] Error checking premium status:', error);
    return false;
  }
} 