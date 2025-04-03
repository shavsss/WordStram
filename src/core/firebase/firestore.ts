import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { app, firestore } from './config';

// Export the firestore instance and methods
export { 
  firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  onSnapshot
};

/**
 * Helper function to check if a document exists
 * @param collectionName The name of the collection
 * @param docId The document ID
 * @returns A boolean indicating whether the document exists
 */
export async function documentExists(collectionName: string, docId: string): Promise<boolean> {
  try {
    const docRef = doc(firestore, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error(`Error checking if document exists in ${collectionName}:`, error);
    return false;
  }
}

/**
 * Helper function to create or update a document
 * @param collectionName The name of the collection
 * @param docId The document ID
 * @param data The data to set/update
 * @param merge Whether to merge the data with existing data (default: true)
 * @returns A promise that resolves when the operation is complete
 */
export async function createOrUpdateDocument(
  collectionName: string, 
  docId: string, 
  data: any,
  merge = true
): Promise<void> {
  try {
    const docRef = doc(firestore, collectionName, docId);
    await setDoc(docRef, data, { merge });
  } catch (error) {
    console.error(`Error creating/updating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Helper function to get a document
 * @param collectionName The name of the collection
 * @param docId The document ID
 * @returns The document data or null if not found
 */
export async function getDocument(collectionName: string, docId: string): Promise<any | null> {
  try {
    const docRef = doc(firestore, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Helper function to delete a document
 * @param collectionName The name of the collection
 * @param docId The document ID
 * @returns A promise that resolves when the deletion is complete
 */
export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  try {
    const docRef = doc(firestore, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Helper function to query documents
 * @param collectionName The name of the collection
 * @param whereConditions Array of where conditions [field, operator, value]
 * @returns Array of documents that match the query
 */
export async function queryDocuments(
  collectionName: string,
  whereConditions: [string, string, any][]
): Promise<any[]> {
  try {
    const collectionRef = collection(firestore, collectionName);
    let q = query(collectionRef);
    
    whereConditions.forEach(condition => {
      q = query(q, where(condition[0], condition[1] as any, condition[2]));
    });
    
    const querySnapshot = await getDocs(q);
    const results: any[] = [];
    
    querySnapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });
    
    return results;
  } catch (error) {
    console.error(`Error querying documents from ${collectionName}:`, error);
    throw error;
  }
}

// Function to synchronize notes between storage and Firestore
export async function syncNotesBetweenStorageAndFirestore(): Promise<void> {
  // Implementation can be added later
  console.log('Syncing notes between storage and Firestore');
  return Promise.resolve();
}

/**
 * Save a chat conversation to Firestore
 * @param chatData The chat data to save
 * @returns The chat document ID
 */
export async function saveChat(chatData: any): Promise<string | null> {
  try {
    const { conversationId, videoId, videoTitle, videoURL, messages } = chatData;
    
    if (!conversationId || !videoId) {
      console.error('Missing required fields for chat');
      return null;
    }
    
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to save chat');
      return null;
    }
    
    // Create chat data structure
    const chatToSave = {
      conversationId,
      userId,
      videoId,
      videoTitle: videoTitle || '',
      videoURL: videoURL || '',
      timestamp: serverTimestamp(),
      messages: messages || [],
      lastUpdated: new Date().toISOString()
    };
    
    // Save to user's chats collection
    const chatsCollectionPath = `users/${userId}/chats`;
    await createOrUpdateDocument(chatsCollectionPath, conversationId, chatToSave);
    
    return conversationId;
  } catch (error) {
    console.error('Error saving chat to Firestore:', error);
    return null;
  }
}

/**
 * Delete a chat from Firestore
 * @param conversationId The conversation ID to delete
 * @param videoId The video ID (for updating references)
 * @returns Whether the deletion was successful
 */
export async function deleteChat(conversationId: string, videoId?: string): Promise<boolean> {
  try {
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to delete chat');
      return false;
    }
    
    // Delete from user's chats collection
    const chatsCollectionPath = `users/${userId}/chats`;
    await deleteDocument(chatsCollectionPath, conversationId);
    
    return true;
  } catch (error) {
    console.error('Error deleting chat from Firestore:', error);
    return false;
  }
}

/**
 * Delete all chats for a specific video
 * @param videoId The video ID to delete chats for
 * @returns Number of chats deleted or -1 on error
 */
export async function deleteAllChatsForVideo(videoId: string): Promise<number> {
  try {
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to delete chats');
      return -1;
    }
    
    // Query all chats for this video
    const chatsCollectionPath = `users/${userId}/chats`;
    const chats = await queryDocuments(chatsCollectionPath, [['videoId', '==', videoId]]);
    
    // Delete each chat
    const deletePromises = chats.map(chat => 
      deleteDocument(chatsCollectionPath, chat.conversationId)
    );
    
    await Promise.all(deletePromises);
    return chats.length;
  } catch (error) {
    console.error('Error deleting all chats for video from Firestore:', error);
    return -1;
  }
}

/**
 * Save user statistics to Firestore
 * @param stats The user statistics to save
 * @returns Whether the save was successful
 */
export async function saveUserStats(stats: any): Promise<boolean> {
  try {
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to save stats');
      return false;
    }
    
    // Save to user's document
    await createOrUpdateDocument('users', userId, { stats }, true);
    
    return true;
  } catch (error) {
    console.error('Error saving user stats to Firestore:', error);
    return false;
  }
}

/**
 * Get user statistics from Firestore
 * @returns The user statistics or null if not found
 */
export async function getUserStats(): Promise<any | null> {
  try {
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to get stats');
      return null;
    }
    
    // Get user document
    const userData = await getDocument('users', userId);
    
    return userData?.stats || null;
  } catch (error) {
    console.error('Error getting user stats from Firestore:', error);
    return null;
  }
}

/**
 * Synchronize chats between storage and Firestore
 * @returns Whether the sync was successful
 */
export async function syncChatsBetweenStorageAndFirestore(): Promise<boolean> {
  try {
    console.log('Syncing chats between storage and Firestore');
    // Implementation can be added as needed
    return true;
  } catch (error) {
    console.error('Error syncing chats between storage and Firestore:', error);
    return false;
  }
}

/**
 * Subscribe to all chats for the current user
 * @param callback The callback to call when chats are updated
 * @returns Unsubscribe function
 */
export function subscribeToAllChats(callback: (chats: any[]) => void): () => void {
  try {
    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to subscribe to chats');
      return () => {};
    }
    
    // Create collection reference
    const chatsCollectionPath = `users/${userId}/chats`;
    const chatsCollection = collection(firestore, chatsCollectionPath);
    
    // Subscribe to changes
    const unsubscribe = onSnapshot(chatsCollection, snapshot => {
      const chats: any[] = [];
      snapshot.forEach(doc => {
        chats.push({ id: doc.id, ...doc.data() });
      });
      callback(chats);
    }, error => {
      console.error('Error in chats subscription:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up chat subscription:', error);
    return () => {};
  }
}

/**
 * Debug Firestore structure for a user
 * @param userId The user ID to debug
 * @returns Debug results with counts of various documents
 */
export async function debugFirestoreStructure(userId: string): Promise<any> {
  try {
    if (!userId) {
      throw new Error('User ID is required for debugging');
    }
    
    // Results object
    const results = {
      videos: 0,
      notes: 0,
      chats: 0,
      settings: false
    };
    
    // Check for videos
    const videosQuery = await queryDocuments(`users/${userId}/videos`, []);
    results.videos = videosQuery.length;
    
    // Check for notes
    const notesQuery = await queryDocuments(`users/${userId}/notes`, []);
    results.notes = notesQuery.length;
    
    // Check for chats
    const chatsQuery = await queryDocuments(`users/${userId}/chats`, []);
    results.chats = chatsQuery.length;
    
    // Check for user settings
    const userSettings = await getDocument('users', userId);
    results.settings = !!userSettings;
    
    return results;
  } catch (error) {
    console.error('Error debugging Firestore structure:', error);
    throw error;
  }
}

/**
 * Debug chats for a user
 * @param userId The user ID to debug
 * @returns Debug results with chat counts
 */
export async function debugChats(userId: string): Promise<any> {
  try {
    if (!userId) {
      throw new Error('User ID is required for debugging chats');
    }
    
    // Get all chats
    const chatsQuery = await queryDocuments(`users/${userId}/chats`, []);
    
    // Group by videoId
    const byVideoId: Record<string, any[]> = {};
    chatsQuery.forEach(chat => {
      if (!byVideoId[chat.videoId]) {
        byVideoId[chat.videoId] = [];
      }
      byVideoId[chat.videoId].push(chat);
    });
    
    return {
      total: chatsQuery.length,
      byVideoId
    };
  } catch (error) {
    console.error('Error debugging chats:', error);
    throw error;
  }
}

/**
 * Helper function to get the current user ID
 * @returns The current user ID or null if not authenticated
 */
function getCurrentUserId(): string | null {
  if (typeof window !== 'undefined' && 
      window.WordStream && 
      window.WordStream.currentUser) {
    return window.WordStream.currentUser.uid;
  }
  return null;
}

/**
 * Synchronize videos to local storage
 */
export async function syncVideosToLocalStorage(): Promise<boolean> {
  try {
    // Implementation to be added
    console.log('Syncing videos to local storage');
    return true;
  } catch (error) {
    console.error('Error syncing videos to local storage:', error);
    return false;
  }
}

/**
 * Synchronize chats to local storage
 */
export async function syncChatsToLocalStorage(): Promise<boolean> {
  try {
    // Implementation to be added
    console.log('Syncing chats to local storage');
    return true;
  } catch (error) {
    console.error('Error syncing chats to local storage:', error);
    return false;
  }
}

/**
 * Synchronize notes to local storage
 */
export async function syncNotesToLocalStorage(): Promise<boolean> {
  try {
    // Implementation to be added
    console.log('Syncing notes to local storage');
    return true;
  } catch (error) {
    console.error('Error syncing notes to local storage:', error);
    return false;
  }
}

/**
 * Save a note to Firestore
 */
export async function saveNote(note: any, videoId: string): Promise<string | null> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to save note');
      return null;
    }
    
    const notesCollectionPath = `users/${userId}/notes/${videoId}/items`;
    
    if (note.id) {
      // Update existing note
      await createOrUpdateDocument(`${notesCollectionPath}/${videoId}/items`, note.id, note);
      return note.id;
    } else {
      // Create new note with generated ID
      const noteData = { ...note, userId, videoId };
      const docRef = await addDoc(collection(firestore, `${notesCollectionPath}/${videoId}/items`), noteData);
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving note to Firestore:', error);
    return null;
  }
}

/**
 * Get notes from Firestore
 */
export async function getNotes(videoId: string): Promise<any[]> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to get notes');
      return [];
    }
    
    const notesCollectionPath = `users/${userId}/notes/${videoId}/items`;
    return await queryDocuments(notesCollectionPath, []);
  } catch (error) {
    console.error('Error getting notes from Firestore:', error);
    return [];
  }
}

/**
 * Delete a note from Firestore
 */
export async function deleteNote(noteId: string, videoId: string): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No authenticated user to delete note');
      return false;
    }
    
    const notePath = `users/${userId}/notes/${videoId}/items`;
    await deleteDocument(notePath, noteId);
    return true;
  } catch (error) {
    console.error('Error deleting note from Firestore:', error);
    return false;
  }
} 