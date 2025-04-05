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
  onSnapshot,
  documentId,
  orderBy,
  writeBatch,
  increment,
  deleteField
} from 'firebase/firestore';
import { app, firestore } from './config';
import AuthManager from '@/core/auth-manager';
import AuthInterceptor from '@/core/auth-interceptor';
import { handleFirestoreTimestamp } from '@/utils/date-utils';
import { ChatConversation } from '@/types/chats';
import { debounce } from '@/utils/function-utils';
import { v4 as uuidv4 } from 'uuid';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

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
  onSnapshot,
  documentId,
  orderBy
};

/**
 * ==================================================
 * 🔥 FIRESTORE CORE FUNCTIONS
 * ==================================================
 */

/**
 * Get the user document reference for the current user
 * @returns Firestore document reference or null if not authenticated
 */
export function getUserDocRef() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return doc(firestore, 'users', userId);
}

/**
 * Get the current user ID
 * @returns The user ID or null
 */
export function getCurrentUserId(): string | null {
  try {
    // Try to get the current user from AuthManager
    const user = AuthManager.getCurrentUser();
    if (user && user.uid) {
      return user.uid;
    }
    
    // Fallback to window object if AuthManager can't be used
    if (typeof window !== 'undefined' && window.WordStream?.currentUser?.uid) {
      console.log('WordStream: Using user from window.WordStream:', window.WordStream.currentUser.uid);
      return window.WordStream.currentUser.uid;
    }
    
    // Additional fallback for Firefox - check localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const authState = localStorage.getItem('wordstream_auth_state');
        const userInfo = localStorage.getItem('wordstream_user_info');
        
        if (authState === 'authenticated' && userInfo) {
          const userData = JSON.parse(userInfo);
          if (userData && userData.uid) {
            console.log('WordStream: Using user from localStorage:', userData.uid);
            return userData.uid;
          }
        }
      } catch (err) {
        console.warn('WordStream: Error reading auth from localStorage:', err);
      }
    }
    
    console.warn('WordStream: No authenticated user found');
    return null;
  } catch (error) {
    console.warn('WordStream: Error getting current user ID:', error);
    return null;
  }
}

/**
 * Ensure we have an authenticated user, refreshing token if needed
 * @returns Promise resolving to a user ID or null
 */
export async function ensureAuthenticatedUser(): Promise<string | null> {
  try {
    // First check if we already have a valid user
    const userId = getCurrentUserId();
    if (!userId) return null;
    
    // Try to verify and refresh the token
    const isTokenValid = await AuthManager.verifyTokenAndRefresh();
    if (!isTokenValid) {
      console.warn('WordStream: Token validation failed');
      return null;
    }
    
    return userId;
  } catch (error) {
    console.warn('WordStream: Auth validation error:', error);
    return null;
  }
}

/**
 * ==================================================
 * 🔄 DATA SYNCHRONIZATION
 * ==================================================
 */

/**
 * Initialize Firestore real-time sync for all data types
 * This should be called from the background script
 */
export function initializeFirestoreSync() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('WordStream: Cannot initialize Firestore sync - no user ID available');
    return;
  }

  // Setup listeners for each data type
  setupWordListListener(userId);
  setupChatsListener(userId);
  setupNotesListener(userId);
  setupStatsListener(userId);
  
  console.log('WordStream: Firestore sync initialized for user:', userId);
}

/**
 * Setup listener for wordlist collection
 */
function setupWordListListener(userId: string) {
  // Use the updated path to listen to words from userData
  const wordlistCollection = collection(firestore, 'users', userId, 'userData', 'wordlist', 'items');
  
  return onSnapshot(
    wordlistCollection,
    (snapshot) => {
      try {
        const words = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        console.log(`WordStream: Synced ${words.length} words from Firestore`);
        
        // Update local storage
        chrome.storage.sync.set({ words }, () => {
          // Broadcast to all windows/tabs
          broadcastMessage({ action: 'WORDS_UPDATED', words });
        });
      } catch (error) {
        console.error('WordStream: Error processing wordlist sync:', error);
      }
    },
    (error) => {
      console.error('WordStream: Error in wordlist sync:', error);
    }
  );
}

/**
 * Setup listener for chats collection
 */
function setupChatsListener(userId: string) {
  // Use the updated path to listen to chats from userData
  const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
  
  return onSnapshot(
    chatsCollection,
    (snapshot) => {
      try {
        const chats = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Process timestamps safely
          const chatData = {
            id: doc.id,
            ...data,
            createdAt: handleFirestoreTimestamp(data.createdAt)?.toISOString(),
            updatedAt: handleFirestoreTimestamp(data.updatedAt)?.toISOString(),
            messages: Array.isArray(data.messages) ? 
              data.messages.map((msg: any) => ({
                ...msg,
                timestamp: handleFirestoreTimestamp(msg.timestamp)?.toISOString() || new Date().toISOString()
              })) : []
          };
          
          return chatData;
        });
        
        console.log(`WordStream: Synced ${chats.length} chats from Firestore`);
        
        // Update local storage
        chrome.storage.sync.set({ chats }, () => {
          // Broadcast to all windows/tabs
          broadcastMessage({ action: 'CHATS_UPDATED', chats });
        });
      } catch (error) {
        console.error('WordStream: Error processing chats sync:', error);
      }
    },
    (error) => {
      console.error('WordStream: Error in chats sync:', error);
    }
  );
}

/**
 * Setup listener for notes collection
 */
function setupNotesListener(userId: string) {
  // Use the updated path to listen to notes from userData
  const notesCollection = collection(firestore, 'users', userId, 'userData', 'notes', 'items');
  
  return onSnapshot(
    notesCollection,
    (snapshot) => {
      try {
        const notes = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: handleFirestoreTimestamp(data.createdAt)?.toISOString(),
            updatedAt: handleFirestoreTimestamp(data.updatedAt)?.toISOString(),
          };
        });
        
        console.log(`WordStream: Synced ${notes.length} notes from Firestore`);
        
        // Update local storage
        chrome.storage.sync.set({ notes }, () => {
          // Broadcast to all windows/tabs
          broadcastMessage({ action: 'NOTES_UPDATED', notes });
        });
      } catch (error) {
        console.error('WordStream: Error processing notes sync:', error);
      }
    },
    (error) => {
      console.error('WordStream: Error in notes sync:', error);
    }
  );
}

/**
 * Setup listener for stats document
 */
function setupStatsListener(userId: string) {
  // Fix for invalid document reference - use the same format as saveUserStats
  const statsCollection = collection(firestore, 'users', userId, 'userData');
  const statsRef = doc(statsCollection, 'stats');
  
  return onSnapshot(
    statsRef,
    (snapshot) => {
      try {
        const stats = snapshot.data() || {};
        
        // Safely process any date fields
        const processedStats = {
          ...stats,
          lastActive: handleFirestoreTimestamp(stats.lastActive)?.toISOString() || new Date().toISOString()
        };
        
        console.log('WordStream: Synced stats from Firestore');
        
        // Update local storage
        chrome.storage.sync.set({ stats: processedStats }, () => {
          // Broadcast to all windows/tabs
          broadcastMessage({ action: 'STATS_UPDATED', stats: processedStats });
        });
      } catch (error) {
        console.error('WordStream: Error processing stats sync:', error);
      }
    },
    (error) => {
      console.error('WordStream: Error in stats sync:', error);
    }
  );
}

/**
 * Helper to broadcast messages to all extension contexts
 * This function handles errors gracefully and ignores common connection issues
 */
function broadcastMessage(message: any) {
  try {
    // Send message via postMessage to all windows
    if (typeof window !== 'undefined') {
      console.log('WordStream: Broadcasting message:', message);
      
      // Send via postMessage
      window.postMessage(message, '*');
      
      // Additionally save to localStorage for other tabs to pick up
      // Use a timestamp to ensure we can track the latest messages
      const timestamp = new Date().getTime();
      const broadcastKey = `wordstream_broadcast_${timestamp}`;
      
      localStorage.setItem(broadcastKey, JSON.stringify({
        ...message,
        timestamp
      }));
      
      // Clean up old broadcast messages (keep only last 20)
      try {
        const broadcastKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('wordstream_broadcast_')) {
            broadcastKeys.push(key);
          }
        }
        
        // Sort by timestamp (descending) and remove old ones
        broadcastKeys.sort().reverse();
        if (broadcastKeys.length > 20) {
          broadcastKeys.slice(20).forEach(key => localStorage.removeItem(key));
        }
      } catch (cleanupError) {
        console.warn('WordStream: Error cleaning up broadcast messages:', cleanupError);
      }
    }
  } catch (error) {
    console.error('WordStream: Error broadcasting message:', error);
  }
}

/**
 * ==================================================
 * 📝 WORDLIST OPERATIONS 
 * ==================================================
 */

/**
 * Save a word to the user's wordlist
 * @param wordData The word data to save
 * @returns Promise resolving to the word ID
 */
export async function saveWord(wordData: any): Promise<string | null> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot save word - no authenticated user');
      return null;
    }
    
    const wordlistRef = collection(firestore, 'users', userId, 'wordlist');
    
    // Check if this word already exists (based on original word and language pairs)
    const wordQuery = query(
      wordlistRef,
      where('originalWord', '==', wordData.originalWord),
      where('sourceLanguage', '==', wordData.sourceLanguage),
      where('targetLanguage', '==', wordData.targetLanguage)
    );
    
    const querySnapshot = await getDocs(wordQuery);
    
    let wordId: string;
    
    if (!querySnapshot.empty) {
      // Update existing word
      const existingDoc = querySnapshot.docs[0];
      wordId = existingDoc.id;
      
      await updateDoc(doc(wordlistRef, wordId), {
        ...wordData,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new word
      const newWordRef = await addDoc(wordlistRef, {
        ...wordData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      wordId = newWordRef.id;
    }
    
    // Update stats
    updateWordCountInStats(userId);
    
    return wordId;
  } catch (error) {
    console.error('WordStream: Error saving word:', error);
      return null;
    }
}

/**
 * Get all words for the current user
 * @returns Promise resolving to an array of words
 */
export async function getWords(): Promise<any[]> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot get words - no authenticated user');
      return [];
    }
    
    // Use the updated path to get words from userData
    const wordlistCollection = collection(firestore, 'users', userId, 'userData', 'wordlist', 'items');
    const querySnapshot = await getDocs(wordlistCollection);
    
    const words = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`WordStream: Retrieved ${words.length} words`);
    return words;
  } catch (error) {
    console.error('WordStream: Error getting words:', error);
    return [];
  }
}

/**
 * Delete a word from the user's wordlist
 * @param wordId The ID of the word to delete
 * @returns Promise resolving to a boolean indicating success
 */
export async function deleteWord(wordId: string): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot delete word - no authenticated user');
      return false;
    }
    
    // Use collection reference to access wordlist subcollection in userData
    const wordlistCollection = collection(firestore, 'users', userId, 'userData', 'wordlist', 'items');
    await deleteDoc(doc(wordlistCollection, wordId));
    
    // Update the word count
    await updateWordCountInStats(userId);
    
    console.log(`WordStream: Successfully deleted word ${wordId}`);
    return true;
  } catch (error) {
    console.error('WordStream: Error deleting word:', error);
    return false;
  }
}

/**
 * Update the word count in the user's stats
 */
async function updateWordCountInStats(userId: string) {
  try {
    const wordlistRef = collection(firestore, 'users', userId, 'wordlist');
    const querySnapshot = await getDocs(wordlistRef);
    
    // Fix for invalid document reference - use the same format as saveUserStats
    const statsCollection = collection(firestore, 'users', userId, 'userData');
    const statsRef = doc(statsCollection, 'stats');
    
    await setDoc(statsRef, { 
      totalWords: querySnapshot.size,
      lastUpdated: serverTimestamp() 
    }, { merge: true });
  } catch (error) {
    console.error('WordStream: Error updating word count in stats:', error);
  }
}

/**
 * Sync all local words to Firestore
 * @param words Array of words to sync
 * @returns Promise resolving to a boolean indicating success
 */
export async function syncWordsToFirestore(words: any[]): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot sync words - no authenticated user');
      return false;
    }
    
    // Use the updated path to access words in userData
    const wordlistCollection = collection(firestore, 'users', userId, 'userData', 'wordlist', 'items');
    
    // Use batched writes for better performance
    const batch = writeBatch(firestore);
    
    // Get existing words to avoid duplicates
    const existingWords = await getDocs(wordlistCollection);
    const existingWordsMap = new Map();
    
    existingWords.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.originalWord}-${data.sourceLanguage}-${data.targetLanguage}`;
      existingWordsMap.set(key, doc.id);
    });
    
    // Add or update each word
    let updatedCount = 0;
    let newCount = 0;
    
    for (const word of words) {
      if (!word.originalWord || !word.targetWord) {
        console.warn('WordStream: Skipping invalid word:', word);
        continue;
      }
      
      const key = `${word.originalWord}-${word.sourceLanguage}-${word.targetLanguage}`;
      
      if (existingWordsMap.has(key)) {
        // Update existing word
        const wordId = existingWordsMap.get(key);
        batch.update(doc(wordlistCollection, wordId), {
          ...word,
          updatedAt: serverTimestamp()
        });
        updatedCount++;
      } else {
        // Add new word
        const wordRef = doc(wordlistCollection);
        batch.set(wordRef, {
          ...word,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        newCount++;
      }
    }
    
    // Commit the batch
    await batch.commit();
    
    // Update stats with the updated document reference
    const statsRef = doc(collection(firestore, 'users', userId, 'userData'), 'stats');
    
    await setDoc(statsRef, { 
      totalWords: existingWordsMap.size + newCount,
      lastUpdated: serverTimestamp() 
    }, { merge: true });
    
    console.log(`WordStream: Synced words to Firestore - ${newCount} new, ${updatedCount} updated`);
    return true;
  } catch (error) {
    console.error('WordStream: Error syncing words to Firestore:', error);
    return false;
  }
}

/**
 * ==================================================
 * 💬 CHAT OPERATIONS
 * ==================================================
 */

/**
 * Save a chat conversation to Firestore
 * @param chatData The chat data to save
 * @returns The chat document ID
 */
export async function saveChat(chatData: any): Promise<string | null> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot save chat - no authenticated user');
      return null;
    }
    
    // Ensure chat data has necessary properties
    if (!chatData.id && !chatData.conversationId) {
      console.warn('WordStream: Invalid chat data - missing id or conversationId');
      return null;
    }
    
    // Standardize the ID field - use id if it exists, otherwise use conversationId
    const chatId = chatData.id || chatData.conversationId;
    
    // Create a chat document with explicit timestamps and standardized fields
    const chatWithTimestamps = {
      ...chatData,
      id: chatId, // Ensure id field exists
      conversationId: chatId, // Keep conversationId for backward compatibility
      updatedAt: serverTimestamp(),
      lastUpdated: chatData.lastUpdated || new Date().toISOString(),
      userId
    };
    
    // If it doesn't have a timestamp, add one
    if (!chatData.timestamp) {
      chatWithTimestamps.timestamp = serverTimestamp();
    }

    console.log(`WordStream: Ready to save chat with ID ${chatId}. Data:`, chatWithTimestamps);
    
    // Get proper reference to chat document in userData
    const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
    const chatRef = doc(chatsCollection, chatId);
    
    // Save the chat
    await setDoc(chatRef, chatWithTimestamps, { merge: true });
    console.log(`WordStream: Successfully saved chat to Firestore at ${chatRef.path}`);
    
    try {
      // Add reference to this chat in the user document for easier querying
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, {
        lastChatId: chatId,
        lastChatTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
        [`chatsMeta.${chatId}`]: {
          videoId: chatData.videoId,
          updatedAt: serverTimestamp()
        }
      });
      console.log(`WordStream: Updated user document with chat reference`);
    } catch (userUpdateError) {
      // Non-blocking error - the chat is still saved
      console.warn('WordStream: Error updating user document with chat reference:', userUpdateError);
    }
    
    // Update stats reference in a separate try-catch to isolate errors
    try {
      const statsRef = doc(firestore, 'users', userId, 'stats');
      
      // Update userData stats
      await updateDoc(statsRef, {
        lastChatTime: serverTimestamp(),
        totalChats: increment(1)
      });
      console.log(`WordStream: Updated stats with chat information`);
    } catch (statsError) {
      console.warn('WordStream: Error updating stats:', statsError);
      // This error shouldn't prevent returning the chat ID
    }
    
    console.log(`WordStream: Saved chat ${chatId} completely`);
    return chatId;
  } catch (error) {
    console.error('WordStream: Error saving chat:', error);
    return null;
  }
}

/**
 * Get all chats for the current user
 * @returns Promise resolving to an array of chats
 */
export async function getChats(): Promise<any[]> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot get chats - no authenticated user');
      return [];
    }
    
    // Fix: Use a proper collection path (odd number of segments)
    const chatsCollection = collection(firestore, 'users', userId, 'chats');
    const querySnapshot = await getDocs(chatsCollection);
    
    const chats = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: handleFirestoreTimestamp(data.createdAt)?.toISOString(),
        updatedAt: handleFirestoreTimestamp(data.updatedAt)?.toISOString(),
      };
    });
    
    console.log(`WordStream: Retrieved ${chats.length} chats`);
    return chats;
  } catch (error) {
    console.error('WordStream: Error getting chats:', error);
    return [];
  }
}

/**
 * Delete a chat from Firestore
 * @param chatId The ID of the chat to delete
 * @returns Promise resolving to a boolean indicating success
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot delete chat - no authenticated user');
      return false;
    }
    
    console.log(`WordStream: Deleting chat ${chatId} for user ${userId}`);
    
    // 1. Get the chat data first so we know its videoId
    const chatRef = doc(collection(firestore, 'users', userId, 'userData', 'chats', 'items'), chatId);
    const chatDoc = await getDoc(chatRef);
    let videoId = null;
    
    if (chatDoc.exists()) {
      const chatData = chatDoc.data();
      videoId = chatData.videoId;
      console.log(`WordStream: Found chat to delete with videoId: ${videoId}`);
    }
    
    // 2. Delete the chat document
    await deleteDoc(chatRef);
    console.log(`WordStream: Deleted chat document at ${chatRef.path}`);
    
    // 3. Also update the user document to remove references if we have videoId
    try {
      const userDocRef = doc(firestore, 'users', userId);
      const updates: Record<string, any> = {};
      
      // Remove the chat metadata
      updates[`chatsMeta.${chatId}`] = deleteField();
      
      // If this was the lastChatId, clear it
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().lastChatId === chatId) {
        updates.lastChatId = null;
      }
      
      await updateDoc(userDocRef, updates);
      console.log(`WordStream: Removed chat references from user document`);
    } catch (userUpdateError) {
      console.warn('WordStream: Error updating user document after chat deletion:', userUpdateError);
      // Not blocking - continue with success
    }
    
    // 4. Update video metadata if we have videoId
    if (videoId) {
      try {
        const videoDocRef = doc(collection(firestore, 'users', userId, 'userData', 'videos'), videoId);
        await updateDoc(videoDocRef, {
          [`chatIds.${chatId}`]: deleteField(),
          lastUpdated: serverTimestamp()
        });
        console.log(`WordStream: Updated video metadata after chat deletion`);
      } catch (videoUpdateError) {
        console.warn('WordStream: Error updating video document after chat deletion:', videoUpdateError);
        // Not blocking - continue with success
      }
    }
    
    // 5. Update stats - decrement totalChats
    try {
      const statsRef = doc(firestore, 'users', userId, 'stats');
      await updateDoc(statsRef, {
        totalChats: increment(-1),
        lastUpdated: serverTimestamp()
      });
      console.log(`WordStream: Updated stats after chat deletion`);
    } catch (statsError) {
      console.warn('WordStream: Error updating stats after chat deletion:', statsError);
      // Not blocking - continue with success
    }
    
    console.log(`WordStream: Successfully deleted chat ${chatId} and all references`);
    return true;
  } catch (error) {
    console.error('WordStream: Error deleting chat:', error);
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
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot delete chats - no authenticated user');
      return -1;
    }
    
    // Query all chats for this video
    const chatsRef = collection(firestore, 'users', userId, 'chats');
    const q = query(chatsRef, where('videoId', '==', videoId));
    const querySnapshot = await getDocs(q);
    
    // Delete each chat
    const batch = writeBatch(firestore);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return querySnapshot.size;
  } catch (error) {
    console.error('WordStream: Error deleting all chats for video from Firestore:', error);
    return -1;
  }
}

/**
 * Subscribe to all chats for the current user
 * @param onChatsUpdate Callback that receives the updated chats
 * @returns Unsubscribe function
 */
export function subscribeToAllChats(
  onChatsUpdate: (chats: ChatConversation[]) => void
): () => void {
  const userId = getCurrentUserId();
  
  if (!userId) {
    console.warn('WordStream: Cannot subscribe to chats - no user ID available');
    onChatsUpdate([]);
    return () => {}; // Empty unsubscribe function
  }
  
  // Track all active subscriptions
  const subscriptions: (() => void)[] = [];
  const allChats: { [chatId: string]: ChatConversation } = {};
  
  // Helper function to push unique chats to the callback
  const updateChatsCallback = () => {
    // Convert chats object to array and sort by date
    const chatsList = Object.values(allChats)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    
    console.log(`WordStream: Sending ${chatsList.length} chats to callback`);
    onChatsUpdate(chatsList);
  };
  
  // 1. First listen to the user document for chat metadata references
  try {
    console.log(`WordStream: Setting up user document listener for chat metadata`);
    const userDocRef = doc(firestore, 'users', userId);
    
    const userDocUnsubscribe = onSnapshot(
      userDocRef,
      async (docSnapshot) => {
        try {
          if (!docSnapshot.exists()) {
            console.log(`WordStream: User document not found for ${userId}`);
            return;
          }
          
          const userData = docSnapshot.data();
          const chatsMeta = userData.chatsMeta || {};
          
          console.log(`WordStream: User document has ${Object.keys(chatsMeta).length} chat references`);
          
          // Check if we need to fetch any chats
          if (Object.keys(chatsMeta).length > 0) {
            // Look for chats that we don't have in our current collection
            const missingChatIds = Object.keys(chatsMeta).filter(chatId => !allChats[chatId]);
            
            if (missingChatIds.length > 0) {
              console.log(`WordStream: Found ${missingChatIds.length} new chat references to fetch`);
              
              // Fetch these chats directly
              const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
              
              for (const chatId of missingChatIds) {
                try {
                  const chatDoc = await getDoc(doc(chatsCollection, chatId));
                  
                  if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    
                    // Create a complete chat object with both id and conversationId
                    const chatObj: ChatConversation = {
                      id: chatId,
                      conversationId: chatId,
                      videoId: chatData.videoId || '',
                      videoTitle: chatData.videoTitle || '',
                      videoURL: chatData.videoURL || '',
                      userId: userId,
                      lastUpdated: handleFirestoreTimestamp(chatData.updatedAt)?.toISOString() || 
                                  chatData.lastUpdated || 
                                  new Date().toISOString(),
                      messages: chatData.messages || []
                    };
                    
                    // Add to our collection
                    allChats[chatId] = chatObj;
                  }
                } catch (chatFetchError) {
                  console.warn(`WordStream: Error fetching individual chat ${chatId}:`, chatFetchError);
                }
              }
              
              // Update the callback with new data
              updateChatsCallback();
            }
          }
        } catch (error) {
          console.warn('WordStream: Error processing user document update:', error);
        }
      },
      (error) => {
        console.warn('WordStream: Error in user document subscription:', error);
      }
    );
    
    subscriptions.push(userDocUnsubscribe);
  } catch (userDocError) {
    console.warn('WordStream: Could not set up user document listener:', userDocError);
  }
  
  // 2. Setup listener for the chats collection
  try {
    console.log(`WordStream: Setting up chats collection listener`);
    // Updated path to the chats collection in the new structure
    const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
    
    const chatsUnsubscribe = onSnapshot(
      chatsCollection,
      (snapshot) => {
        try {
          let hasChanges = false;
          
          // Process added or modified documents
          snapshot.docChanges().forEach((change) => {
            const chatId = change.doc.id;
            const data = change.doc.data();
            
            if (change.type === 'added' || change.type === 'modified') {
              // Create structured chat object
              const chatObj: ChatConversation = {
                id: chatId,
                conversationId: chatId,
                videoId: data.videoId || '',
                videoTitle: data.videoTitle || '',
                videoURL: data.videoURL || '',
                userId: userId,
                lastUpdated: handleFirestoreTimestamp(data.updatedAt)?.toISOString() || 
                            data.lastUpdated || 
                            new Date().toISOString(),
                messages: []
              };
              
              // Safely handle messages array
              if (Array.isArray(data.messages)) {
                chatObj.messages = data.messages.map((msg: any) => {
                  if (msg && typeof msg === 'object' && msg.timestamp) {
                    try {
                      const msgDate = handleFirestoreTimestamp(msg.timestamp);
                      return {
                        ...msg,
                        timestamp: msgDate?.toISOString() || new Date().toISOString()
                      };
                    } catch (msgDateError) {
                      // If failed, return the message as is
                      return msg;
                    }
                  }
                  return msg;
                });
              }
              
              // Store in our map
              allChats[chatId] = chatObj;
              hasChanges = true;
            } else if (change.type === 'removed') {
              // Remove from our collection
              if (allChats[chatId]) {
                delete allChats[chatId];
                hasChanges = true;
              }
            }
          });
          
          // Only update if we had changes
          if (hasChanges) {
            console.log(`WordStream: Chat collection changed, updating with ${Object.keys(allChats).length} chats`);
            updateChatsCallback();
          }
        } catch (error) {
          console.warn('WordStream: Error processing chat data:', error);
        }
      },
      (error) => {
        console.warn('WordStream: Error in chats subscription:', error?.code || error);
      }
    );
    
    subscriptions.push(chatsUnsubscribe);
  } catch (chatsError) {
    console.warn('WordStream: Could not set up chats collection listener:', chatsError);
  }
  
  // Return a function that unsubscribes from all listeners
  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe());
    console.log('WordStream: Unsubscribed from all chat listeners');
  };
}

/**
 * ==================================================
 * 📝 NOTES OPERATIONS
 * ==================================================
 */

/**
 * Save a note to Firestore
 * @param note The note to save
 * @returns {Promise<string>} The note ID
 */
export async function saveNote(note: any): Promise<string> {
  try {
    // Check authentication
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot save note - user not authenticated');
      // Save to local storage anyway, but return early
      saveNoteToLocalStorage(note);
      return note.id || '';
    }
    
    // Generate ID if needed
    const noteId = note.id || uuidv4();
    const noteWithId = { 
      ...note, 
      id: noteId,
      timestamp: note.timestamp || new Date().toISOString(),
      lastSynced: new Date().toISOString(),
      userId
    };
    
    // Fix: Use a proper document path (even number of segments)
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    
    // Save to Firestore
    await setDoc(noteDocRef, noteWithId);
    
    // Save to local storage as backup
    saveNoteToLocalStorage(noteWithId);
    
    // Update user document with metadata
    try {
      const userDocRef = doc(firestore, 'users', userId);
      
      await updateDoc(userDocRef, {
        lastNoteId: noteId,
        lastNoteTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
        [`notesMetadata.${noteId}`]: {
          videoId: note.videoId,
          updatedAt: serverTimestamp()
        }
      });
    } catch (userUpdateError) {
      // Non-blocking - note is still saved
      console.warn('WordStream: Error updating user document with note metadata:', userUpdateError);
    }
    
    // Update video document with reference to the note
    if (note.videoId) {
      try {
        const videoDocRef = doc(firestore, 'users', userId, 'videos', note.videoId);
        const videoDoc = await getDoc(videoDocRef);
        
        if (videoDoc.exists()) {
          // Update existing video document
          await updateDoc(videoDocRef, {
            lastUpdated: serverTimestamp(),
            [`noteIds.${noteId}`]: true
          });
        } else {
          // Create new video document
          await setDoc(videoDocRef, {
            videoId: note.videoId,
            title: note.videoTitle || 'Unknown Video',
            url: note.videoURL || `https://www.youtube.com/watch?v=${note.videoId}`,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            noteIds: { [noteId]: true }
          });
        }
      } catch (videoError) {
        // Non-blocking - note is still saved
        console.warn('WordStream: Error updating video metadata:', videoError);
      }
    }
    
    // Broadcast note to other tabs/windows
    broadcastMessage({
      type: 'note:added',
      data: noteWithId,
      timestamp: new Date().toISOString()
    });
    
    return noteId;
  } catch (error) {
    console.error('WordStream: Error saving note to Firestore:', error);
    
    // Try to save to local storage as fallback
    if (note) {
      saveNoteToLocalStorage(note);
      return note.id || '';
    }
    
    return '';
  }
}

/**
 * Helper function to save a note to localStorage
 * @param note The note to save
 */
function saveNoteToLocalStorage(note: any): void {
  if (!note.id || !note.videoId) {
    console.warn('WordStream: Cannot save note to localStorage - missing id or videoId');
    return;
  }
  
  chrome.storage.local.get(['notes_storage'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
      return;
    }
    
    const storage = result.notes_storage || {};
    const videoId = note.videoId;
    
    // Create or update the video entry
    if (!storage[videoId]) {
      storage[videoId] = {
        videoId,
        videoTitle: note.videoTitle || 'Unknown Video',
        videoURL: note.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
        lastUpdated: new Date().toISOString(),
        notes: [note]
      };
    } else {
      // Check if the note already exists
      const existingNoteIndex = storage[videoId].notes.findIndex((n: any) => n.id === note.id);
      
      if (existingNoteIndex >= 0) {
        // Update existing note
        storage[videoId].notes[existingNoteIndex] = note;
      } else {
        // Add new note
        storage[videoId].notes.push(note);
      }
      
      // Update lastUpdated
      storage[videoId].lastUpdated = new Date().toISOString();
    }
    
    // Save back to storage
    chrome.storage.local.set({ notes_storage: storage }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving notes to local storage:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Get notes for a specific video
 * @param videoId The video ID to get notes for
 * @returns Promise resolving to an array of notes
 */
export async function getNotes(videoId: string): Promise<any[]> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot get notes - no authenticated user');
      return [];
    }
    
    // Fix: Use a proper collection path (odd number of segments)
    const notesRef = collection(firestore, 'users', userId, 'notes');
    
    // Query for notes with the specific videoId
    const q = query(notesRef, where('videoId', '==', videoId));
    const querySnapshot = await getDocs(q);
    
    const notes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Process timestamps to ensure they're in ISO format
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp ? handleFirestoreTimestamp(data.timestamp)?.toISOString() : new Date().toISOString(),
        lastSynced: data.lastSynced ? handleFirestoreTimestamp(data.lastSynced)?.toISOString() : null
      };
    });
    
    return notes;
  } catch (error) {
    console.error('WordStream: Error getting notes:', error);
    return [];
  }
}

/**
 * Delete a note from Firestore
 * @param noteId Note ID to delete
 * @returns Promise resolving to a boolean indicating success
 */
export async function deleteNote(noteId: string, videoId?: string): Promise<boolean> {
  try {
    console.log(`WordStream: Starting deletion of note ${noteId}`);
    
    // Check connection first
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot delete note - ${connectionStatus.error}`);
      return false;
    }
    
    const userId = connectionStatus.userId;
    
    // Validate noteId
    if (!noteId) {
      console.error('WordStream: Cannot delete note - missing noteId');
      return false;
    }
    
    try {
      let noteData: any = null;
      
      // Attempt to get the note's data if not provided
      if (!videoId) {
        try {
          const noteRef = doc(firestore, 'users', userId as string, 'userData', 'notes', 'items', noteId);
          const noteDoc = await getDoc(noteRef);
          
          if (noteDoc.exists()) {
            noteData = noteDoc.data();
            videoId = noteData.videoId;
          }
        } catch (getError) {
          console.warn(`WordStream: Error retrieving note info: ${getError}`);
          // Continue with deletion even if we couldn't get the videoId
        }
      }
      
      // Delete the note document
      console.log(`WordStream: Deleting note document ${noteId}`);
      const noteRef = doc(firestore, 'users', userId as string, 'userData', 'notes', 'items', noteId);
      await deleteDoc(noteRef);
      
      // If we have a videoId, update metadata document to reflect the deletion
      if (videoId) {
        try {
          console.log(`WordStream: Updating metadata for video ${videoId}`);
          // Get the metadata document
          const metadataRef = doc(firestore, 'users', userId as string, 'userData', 'metadata');
          const metadataDoc = await getDoc(metadataRef);
          
          if (metadataDoc.exists() && metadataDoc.data().videos && metadataDoc.data().videos[videoId]) {
            // Get the current note count
            const currentCount = metadataDoc.data().videos[videoId].noteCount || 0;
            
            if (currentCount <= 1) {
              // If this was the last note, remove the video entry completely
              await updateDoc(metadataRef, {
                [`videos.${videoId}`]: deleteField()
              });
              console.log(`WordStream: Removed video ${videoId} from metadata (last note deleted)`);
            } else {
              // Otherwise, decrement the note count and update lastUpdated
              await updateDoc(metadataRef, {
                [`videos.${videoId}.noteCount`]: currentCount - 1,
                [`videos.${videoId}.lastUpdated`]: serverTimestamp()
              });
              console.log(`WordStream: Updated note count for video ${videoId} in metadata`);
            }
          }
        } catch (metadataError) {
          console.warn(`WordStream: Error updating metadata after note deletion: ${metadataError}`);
          // Non-critical error, continue
        }
      }
      
      // Update user document to reflect the deletion
      try {
        const userDocRef = doc(firestore, 'users', userId as string);
        await updateDoc(userDocRef, {
          lastActivity: serverTimestamp(),
          [`noteMeta.${noteId}`]: deleteField()
        });
      } catch (userUpdateError) {
        console.warn(`WordStream: Error updating user document after note deletion: ${userUpdateError}`);
        // Non-critical error, continue
      }
      
      // Save deletion to local storage for offline status
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          // Mark this note as deleted locally
          const deletedNotesKey = 'wordstream_deleted_notes';
          const deletedNotes = JSON.parse(localStorage.getItem(deletedNotesKey) || '[]');
          deletedNotes.push({
            id: noteId,
            videoId,
            timestamp: new Date().toISOString()
          });
          localStorage.setItem(deletedNotesKey, JSON.stringify(deletedNotes));
          
          // Remove from local notes storage if present
          if (videoId) {
            const localNotesKey = `wordstream_notes_${videoId}`;
            const localNotes = JSON.parse(localStorage.getItem(localNotesKey) || '[]');
            const updatedNotes = localNotes.filter((note: any) => note.id !== noteId);
            localStorage.setItem(localNotesKey, JSON.stringify(updatedNotes));
          }
        } catch (localStorageError) {
          console.warn('WordStream: Error updating local storage for deleted note:', localStorageError);
        }
      }
      
      // Broadcast the deletion to all windows/tabs
      broadcastMessage({
        action: 'NOTE_DELETED',
        noteId,
        videoId,
        timestamp: new Date().toISOString()
      });
      
      // Update chrome.storage if available
      if (typeof chrome?.storage?.local?.get === 'function') {
        try {
          chrome.storage.local.get(['notes_storage'], (result) => {
            const notesStorage = result.notes_storage || {};
            
            // If we have the videoId, remove the note from that video's notes
            if (videoId && notesStorage[videoId]) {
              const videoNotes = notesStorage[videoId];
              if (videoNotes.notes) {
                videoNotes.notes = videoNotes.notes.filter((note: any) => note.id !== noteId);
                
                // If this was the last note for the video, consider removing the video entry
                if (videoNotes.notes.length === 0) {
                  delete notesStorage[videoId];
                }
                
                // Save the updated storage
                chrome.storage.local.set({ notes_storage: notesStorage }, () => {
                  console.log('WordStream: Updated chrome.storage after note deletion');
                });
              }
            } else {
              // If we don't have the videoId, search through all videos
              let found = false;
              Object.keys(notesStorage).forEach((vid) => {
                const videoNotes = notesStorage[vid];
                if (videoNotes.notes) {
                  const originalLength = videoNotes.notes.length;
                  videoNotes.notes = videoNotes.notes.filter((note: any) => note.id !== noteId);
                  
                  if (originalLength !== videoNotes.notes.length) {
                    found = true;
                    
                    // If this was the last note for the video, consider removing the video entry
                    if (videoNotes.notes.length === 0) {
                      delete notesStorage[vid];
                    }
                  }
                }
              });
              
              if (found) {
                // Save the updated storage
                chrome.storage.local.set({ notes_storage: notesStorage }, () => {
                  console.log('WordStream: Updated chrome.storage after note deletion (searched all videos)');
                });
              }
            }
          });
        } catch (storageError) {
          console.warn(`WordStream: Error updating chrome.storage after note deletion: ${storageError}`);
          // Non-critical error, continue
        }
      }
      
      console.log(`WordStream: Successfully deleted note ${noteId}`);
      return true;
    } catch (error) {
      console.error(`WordStream: Error deleting note ${noteId}:`, error);
      return false;
    }
  } catch (error) {
    console.error('WordStream: Error in deleteNote:', error);
    return false;
  }
}

/**
 * ==================================================
 * 📊 STATS OPERATIONS
 * ==================================================
 */

/**
 * Save user statistics to Firestore
 * @param stats The statistics to save
 * @returns Promise resolving to a boolean indicating success
 */
export async function saveUserStats(stats: any): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot save stats - no authenticated user');
      return false;
    }
    
    // Fix: Use a proper document reference (even number of segments)
    const statsRef = doc(firestore, 'users', userId, 'stats');
    
    await setDoc(statsRef, { 
      ...stats,
      lastUpdated: serverTimestamp() 
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error saving user stats to Firestore:', error);
    return false;
  }
}

/**
 * Get user statistics from Firestore
 * @returns The user statistics or null if not found
 */
export async function getUserStats(): Promise<any | null> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot get stats - no authenticated user');
      return null;
    }
    
    // Fix: Use a proper collection and document path
    // Collection path should have odd segments, document path should have even segments
    const statsRef = doc(firestore, 'users', userId, 'stats');
    
    const docSnapshot = await getDoc(statsRef);
    
    if (docSnapshot.exists()) {
      return docSnapshot.data();
    }
    
    return null;
  } catch (error) {
    console.error('WordStream: Error getting user stats from Firestore:', error);
    return null;
  }
}

/**
 * ==================================================
 * 🔄 DATA MIGRATION
 * ==================================================
 */

/**
 * Migrate old chrome.storage data to the new Firestore structure
 * @returns Promise resolving to a boolean indicating success
 */
export async function migrateStorageDataToFirestore(): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot migrate data - no authenticated user');
      return false;
    }
    
    // Get all data from storage
    const storageData = await new Promise<any>((resolve) => {
      chrome.storage.sync.get(null, (result) => {
        resolve(result);
      });
    });
    
    // Migrate words
    if (storageData.words && Array.isArray(storageData.words)) {
      await syncWordsToFirestore(storageData.words);
    }
    
    // Migrate stats
    if (storageData.stats) {
      await saveUserStats(storageData.stats);
    }
    
    // Indicate migration is complete - save in user document (even number of segments)
    await setDoc(doc(firestore, 'users', userId), {
      dataMigrated: true,
      dataMigratedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('WordStream: Successfully migrated data to Firestore');
    return true;
  } catch (error) {
    console.error('WordStream: Error migrating data to Firestore:', error);
    return false;
  }
}

/**
 * Check if the user's data needs migration
 * @returns Promise resolving to a boolean indicating if migration is needed
 */
export async function checkIfMigrationNeeded(): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) return false;
    
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return !data.dataMigrated;
    }
    
    return true; // New user needs migration
  } catch (error) {
    console.error('WordStream: Error checking if migration is needed:', error);
    return false;
  }
}

/**
 * ==================================================
 * 🔄 SYNCHRONIZATION FUNCTIONS
 * ==================================================
 */

/**
 * Synchronize between local storage and Firestore
 * This ensures data consistency when the user is online
 * @param dataType Optional data type to sync ('words', 'stats', 'chats', 'notes'). If omitted, syncs all data.
 */
export async function syncBetweenStorageAndFirestore(dataType?: 'words' | 'stats' | 'chats' | 'notes'): Promise<void> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot sync data - no authenticated user');
      return;
    }

    console.log(`WordStream: Starting sync of ${dataType || 'all'} data for user ${userId}`);
    
    // Get data from storage based on requested type
    const keysToGet: string[] = [];
    
    if (dataType === 'words' || !dataType) keysToGet.push('words');
    if (dataType === 'stats' || !dataType) keysToGet.push('stats');
    if (dataType === 'chats' || !dataType) keysToGet.push('chats_storage', 'video_chats_map');
    if (dataType === 'notes' || !dataType) keysToGet.push('notes_storage');
    
    const storageData = await new Promise<any>((resolve) => {
      chrome.storage.sync.get(keysToGet, (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error getting data from storage:', chrome.runtime.lastError);
        }
        resolve(result);
      });
    });
    
    let syncResults = {
      words: { success: false, count: 0 },
      stats: { success: false },
      chats: { success: false, count: 0 },
      notes: { success: false, count: 0 }
    };
    
    // Sync each type of data if present
    if ((dataType === 'words' || !dataType) && storageData.words && Array.isArray(storageData.words)) {
      try {
        const success = await syncWordsToFirestore(storageData.words);
        syncResults.words = { success, count: storageData.words.length };
        console.log(`WordStream: Synced ${storageData.words.length} words to Firestore`);
      } catch (wordError) {
        console.error('WordStream: Error syncing words:', wordError);
      }
    }
    
    if ((dataType === 'stats' || !dataType) && storageData.stats) {
      try {
        const success = await saveUserStats(storageData.stats);
        syncResults.stats = { success };
        console.log('WordStream: Synced stats to Firestore');
      } catch (statsError) {
        console.error('WordStream: Error syncing stats:', statsError);
      }
    }
    
    if ((dataType === 'chats' || !dataType) && storageData.chats_storage) {
      try {
        // Chats are stored as { chatId: chatData }
        const chatsStorage: Record<string, any> = storageData.chats_storage || {};
        const videoChatsMap: Record<string, string[]> = storageData.video_chats_map || {};
        
        let chatCount = 0;
        let successCount = 0;
        
        // First, try to sync from local storage to Firestore
        const batch = writeBatch(firestore);
        const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
        
        // Get the list of chatIds from both the chats_storage and video_chats_map
        const chatIds = new Set<string>();
        Object.keys(chatsStorage).forEach(id => chatIds.add(id));
        Object.keys(videoChatsMap).forEach(videoId => {
          const idsForVideo = videoChatsMap[videoId] || [];
          idsForVideo.forEach(id => chatIds.add(id));
        });
        
        console.log(`WordStream: Found ${chatIds.size} chat IDs to sync`);
        
        // Create a map to track user-video relationships
        const userVideoChats: Record<string, Set<string>> = {};
        
        // Process each chat
        for (const chatId of chatIds) {
          chatCount++;
          const chat = chatsStorage[chatId];
          
          // Skip if chat doesn't exist
          if (!chat) {
            console.warn(`WordStream: Chat ID ${chatId} found in map but not in storage`);
            continue;
          }
          
          // Skip if missing required fields
          if (!chat.videoId) {
            console.warn(`WordStream: Chat ${chatId} missing videoId`);
            continue;
          }
          
          try {
            // Add standardized IDs
            const chatWithIds = {
              ...chat,
              id: chatId,
              conversationId: chatId,
              userId
            };
            
            // Add to batch
            const chatRef = doc(chatsCollection, chatId);
            batch.set(chatRef, chatWithIds, { merge: true });
            
            // Track this chat for the video
            if (!userVideoChats[chat.videoId]) {
              userVideoChats[chat.videoId] = new Set();
            }
            userVideoChats[chat.videoId].add(chatId);
            
            successCount++;
          } catch (chatError) {
            console.error(`WordStream: Error preparing chat ${chatId} for batch:`, chatError);
          }
        }
        
        // Commit the batch if we have any chats
        if (successCount > 0) {
          await batch.commit();
          console.log(`WordStream: Batch saved ${successCount} chats to Firestore`);
        }
        
        // Also update the user document with chat metadata
        if (successCount > 0) {
          try {
            const userDocRef = doc(firestore, 'users', userId);
            const updates: Record<string, any> = {};
            
            // For each chat that was successfully synced, add metadata to user doc
            Object.entries(chatsStorage).forEach(([chatId, chatData]: [string, any]) => {
              if (chatData && chatData.videoId) {
                // Add metadata entry
                updates[`chatsMeta.${chatId}`] = {
                  videoId: chatData.videoId,
                  updatedAt: serverTimestamp()
                };
              }
            });
            
            // Update the user document if we have metadata
            if (Object.keys(updates).length > 0) {
              await updateDoc(userDocRef, updates);
              console.log(`WordStream: Updated user document with chat metadata for ${Object.keys(updates).length} chats`);
            }
          } catch (userUpdateError) {
            console.warn('WordStream: Error updating user document with chat metadata:', userUpdateError);
          }
        }
        
        // For each video, also update its metadata with references to chats
        for (const [videoId, chatIds] of Object.entries(userVideoChats)) {
          try {
            if (chatIds.size > 0) {
              const videoDocRef = doc(collection(firestore, 'users', userId, 'userData', 'videos'), videoId);
              const videoDoc = await getDoc(videoDocRef);
              
              const updates: Record<string, any> = {
                lastUpdated: serverTimestamp()
              };
              
              // Add chat IDs to the video document
              chatIds.forEach(chatId => {
                updates[`chatIds.${chatId}`] = true;
              });
              
              // Create or update the video document
              if (videoDoc.exists()) {
                await updateDoc(videoDocRef, updates);
              } else {
                // If video doc doesn't exist, create it with minimal info
                await setDoc(videoDocRef, {
                  ...updates,
                  videoId,
                  createdAt: serverTimestamp()
                });
              }
              
              console.log(`WordStream: Updated video ${videoId} with ${chatIds.size} chat references`);
            }
          } catch (videoUpdateError) {
            console.warn(`WordStream: Error updating video ${videoId} with chat references:`, videoUpdateError);
          }
        }
        
        syncResults.chats = { success: successCount > 0, count: successCount };
        console.log(`WordStream: Synced ${successCount}/${chatCount} chats to Firestore`);
      } catch (chatsError) {
        console.error('WordStream: Error syncing chats:', chatsError);
      }
    }
    
    if ((dataType === 'notes' || !dataType) && storageData.notes_storage) {
      try {
        // Notes are stored as { videoId: { noteId: noteData } }
        const notesStorage = storageData.notes_storage;
        let noteCount = 0;
        let successCount = 0;
        
        // Iterate through videos
        for (const videoId in notesStorage) {
          const videoNotes = notesStorage[videoId];
          // Iterate through notes for this video
          for (const noteId in videoNotes) {
            noteCount++;
            const note = videoNotes[noteId];
            // Update the call to saveNote to match the new signature
            const result = await saveNote({
              ...note,
              videoId: videoId
            });
            if (result) successCount++;
          }
        }
        
        syncResults.notes = { success: successCount > 0, count: successCount };
        console.log(`WordStream: Synced ${successCount}/${noteCount} notes to Firestore`);
      } catch (notesError) {
        console.error('WordStream: Error syncing notes:', notesError);
      }
    }
    
    // Update user document with last sync info
    try {
      const userRef = doc(firestore, 'users', userId);
      await setDoc(userRef, {
        lastSynced: serverTimestamp(),
        syncResults: {
          words: syncResults.words,
          stats: syncResults.stats,
          chats: syncResults.chats,
          notes: syncResults.notes
        }
      }, { merge: true });
    } catch (userUpdateError) {
      console.error('WordStream: Error updating user sync info:', userUpdateError);
    }
    
    console.log(`WordStream: Successfully completed sync of ${dataType || 'all'} data`);
  } catch (error) {
    console.error(`WordStream: Error syncing ${dataType || 'all'} data between storage and Firestore:`, error);
  }
}

/**
 * Create a new document in the userData collection
 * @param docId The document ID to create or update
 * @param data The data to save
 * @returns Promise resolving to a boolean indicating success
 */
export async function saveUserData(docId: string, data: any): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot save user data - no authenticated user');
      return false;
    }
    
    // Create the userData collection reference
    const userDataCollection = collection(firestore, 'users', userId, 'userData');
    const docRef = doc(userDataCollection, docId);
    
    // Add metadata to the document
    const dataToSave = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // If createdAt doesn't exist, add it
    const docSnapshot = await getDoc(docRef);
    if (!docSnapshot.exists()) {
      dataToSave.createdAt = serverTimestamp();
    }
    
    await setDoc(docRef, dataToSave, { merge: true });
    console.log(`WordStream: Saved user data document "${docId}" successfully`);
    return true;
  } catch (error) {
    console.error(`WordStream: Error saving user data document "${docId}":`, error);
    return false;
  }
}

/**
 * Get a document from the userData collection
 * @param docId The document ID to get
 * @returns The document data or null if not found
 */
export async function getUserData(docId: string): Promise<any | null> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot get user data - no authenticated user');
      return null;
    }
    
    const userDataCollection = collection(firestore, 'users', userId, 'userData');
    const docRef = doc(userDataCollection, docId);
    
    const docSnapshot = await getDoc(docRef);
    if (docSnapshot.exists()) {
      return docSnapshot.data();
    }
    
    return null;
  } catch (error) {
    console.error(`WordStream: Error getting user data document "${docId}":`, error);
  return null;
  }
}

// Create a debounced version of the sync function
export const debouncedSyncToFirestore = debounce((dataType?: 'words' | 'stats' | 'chats' | 'notes') => 
  syncBetweenStorageAndFirestore(dataType), 2000);

/**
 * Helper function to determine if sync is required
 */
export function isSyncRequired(): boolean {
  // Check if user is authenticated
  const userId = getCurrentUserId();
  if (!userId) return false;
  
  // Check if we're online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  
  return true;
}

/**
 * Debug utility to display Firestore structure
 * Only used in development mode
 * @param options Optional parameter that can be passed for compatibility
 * @returns Debug information about the Firestore structure
 */
export async function debugFirestoreStructure(options?: any): Promise<any> {
  try {
    console.log('🔍 DEBUG: Checking Firestore structure');
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('DEBUG: No authenticated user found');
      return { error: 'No authenticated user' };
    }

    console.log(`DEBUG: User ID: ${userId}`);
    
    // Get user document
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    console.log('DEBUG: User document exists:', userDoc.exists());
    
    const result: any = {
      userId,
      userExists: userDoc.exists(),
      userData: userDoc.exists() ? userDoc.data() : null,
      collections: {},
      videos: [],
      notes: [],
      chats: []
    };
    
    if (userDoc.exists()) {
      result.userData = userDoc.data();
    }
    
    // Check collections
    const collections = ['words', 'stats', 'videos', 'notes', 'chats'];
    for (const collName of collections) {
      const collRef = collection(firestore, `users/${userId}/${collName}`);
      const snapshot = await getDocs(collRef);
      result.collections[collName] = snapshot.size;
      
      console.log(`DEBUG: Collection '${collName}' has ${snapshot.size} documents`);
      
      // Store the first few documents for each collection
      if (snapshot.size > 0) {
        const sampleDocs = snapshot.docs.slice(0, 5).map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Store in specific arrays for convenience
        if (collName === 'videos') {
          result.videos = sampleDocs;
        } else if (collName === 'notes') {
          result.notes = sampleDocs;
        } else if (collName === 'chats') {
          result.chats = sampleDocs;
        }
        
        console.log(`DEBUG: Sample documents in '${collName}':`, sampleDocs);
      }
    }
    
    return result;
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    return { error: String(error) };
  }
}

/**
 * Debug utility for chats in Firestore
 * Only used in development mode
 * @param options Optional parameter that can be passed for compatibility
 * @returns Debug information about chats in Firestore
 */
export async function debugChats(options?: any): Promise<any> {
  try {
    console.log('🔍 DEBUG: Checking chats in Firestore');
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('DEBUG: No authenticated user found');
      return { error: 'No authenticated user', total: 0, byVideoId: {} };
    }

    // Get all videos
    const videosRef = collection(firestore, `users/${userId}/videos`);
    const videosSnapshot = await getDocs(videosRef);
    console.log(`DEBUG: Found ${videosSnapshot.size} videos`);
    
    let totalChats = 0;
    const chatsByVideo: Record<string, any[]> = {};
    
    // For each video, get its chats
    for (const videoDoc of videosSnapshot.docs) {
      const videoId = videoDoc.id;
      const videoData = videoDoc.data();
      const chatsRef = collection(firestore, `users/${userId}/videos/${videoId}/chats`);
      const chatsSnapshot = await getDocs(chatsRef);
      
      console.log(`DEBUG: Video ${videoId} has ${chatsSnapshot.size} chats`);
      totalChats += chatsSnapshot.size;
      
      if (chatsSnapshot.size > 0) {
        chatsByVideo[videoId] = chatsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`DEBUG: Sample chat from video ${videoId}:`, chatsSnapshot.docs[0].data());
      } else {
        chatsByVideo[videoId] = [];
      }
    }
    
    console.log(`DEBUG: Total chats across all videos: ${totalChats}`);
    
    return {
      total: totalChats,
      byVideoId: chatsByVideo
    };
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    return { 
      error: String(error),
      total: 0,
      byVideoId: {}
    };
  }
}

/**
 * Debug function to check all data and sync status
 * This is a comprehensive debug tool to help identify sync issues
 * @returns Promise resolving to debug information
 */
export async function debugSyncStatus(): Promise<any> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      return { 
        error: 'No authenticated user', 
        userId: null, 
        isAuthenticated: false
      };
    }

    console.log('WordStream DEBUG: Starting comprehensive sync check');
    
    // Object to collect all debug info
    const debugInfo: any = {
      userId,
      isAuthenticated: true,
      timestamp: new Date().toISOString(),
      firestore: {
        user: null,
        userData: {},
        collections: {}
      },
      localStorage: {}
    };
    
    // 1. Check user document
    try {
      const userDocRef = doc(firestore, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        debugInfo.firestore.user = userDoc.data();
    } else {
        debugInfo.firestore.user = { exists: false };
      }
    } catch (userError) {
      debugInfo.firestore.user = { error: String(userError) };
    }
    
    // 2. Check userData document
    try {
      const userDataCollection = collection(firestore, 'users', userId, 'userData');
      const userDataDocs = await getDocs(userDataCollection);
      
      userDataDocs.forEach(doc => {
        debugInfo.firestore.userData[doc.id] = doc.data();
      });
    } catch (userDataError) {
      debugInfo.firestore.userData.error = String(userDataError);
    }
    
    // 3. Check specific collections
    const collectionsToCheck = [
      ['userData', 'chats', 'items'],
      ['userData', 'notes', 'items'],
      ['userData', 'wordlist', 'items'],
      ['userData', 'videos'],
    ];
    
    for (const collectionPath of collectionsToCheck) {
      const collectionName = collectionPath.join('/');
      try {
        const collRef = collection(firestore, 'users', userId, ...collectionPath);
        const snapshot = await getDocs(collRef);
        
        const items: any[] = [];
        snapshot.forEach(doc => {
          items.push({
            id: doc.id,
            data: doc.data()
          });
        });
        
        debugInfo.firestore.collections[collectionName] = {
          count: items.length,
          items: items.slice(0, 5) // Only show first 5 items
        };
      } catch (collError) {
        debugInfo.firestore.collections[collectionName] = { 
          error: String(collError),
          count: 0
        };
      }
    }
    
    // 4. Check localStorage data
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const storageData = await new Promise<any>(resolve => {
          chrome.storage.local.get(null, data => resolve(data));
        });
        
        // Only get metadata about the data, not all the data itself (could be large)
        const storageKeys = Object.keys(storageData);
        storageKeys.forEach(key => {
          const value = storageData[key];
          
          if (key === 'chats_storage') {
            const chatIds = Object.keys(value || {});
            debugInfo.localStorage.chats_storage = {
              count: chatIds.length,
              chatIds
            };
          } else if (key === 'video_chats_map') {
            const videoIds = Object.keys(value || {});
            debugInfo.localStorage.video_chats_map = {
              videoCount: videoIds.length,
              mappings: value
            };
          } else if (key === 'notes_storage') {
            const videoIds = Object.keys(value || {});
            let totalNotes = 0;
            videoIds.forEach(videoId => {
              const notesForVideo = Object.keys(value[videoId] || {}).length;
              totalNotes += notesForVideo;
            });
            
            debugInfo.localStorage.notes_storage = {
              videoCount: videoIds.length,
              totalNotes
            };
          } else if (key === 'words') {
            debugInfo.localStorage.words = {
              count: Array.isArray(value) ? value.length : 0
            };
          } else if (typeof value === 'object') {
            debugInfo.localStorage[key] = {
              type: 'object',
              size: JSON.stringify(value).length
            };
          } else {
            debugInfo.localStorage[key] = {
              type: typeof value,
              value: String(value).substring(0, 100)
            };
          }
        });
      } catch (storageError) {
        debugInfo.localStorage.error = String(storageError);
      }
    }
    
    console.log('WordStream DEBUG: Completed sync check', debugInfo);
    return debugInfo;
  } catch (error) {
    console.error('WordStream DEBUG ERROR:', error);
    return { error: String(error) };
  }
}

/**
 * Debug function to check the synchronization status and display all existing data in Firestore
 * This function is helpful to diagnose synchronization issues
 * @returns A promise that resolves to an object containing debug information
 */
export async function debugFirestoreState(): Promise<Record<string, any>> {
  console.log('WordStream: Checking Firestore state...');
  const debugInfo: Record<string, any> = {
    collections: {
      words: { exists: false, count: 0 },
      chats: { exists: false, count: 0 },
      notes: { exists: false, count: 0 }
    },
    documents: {
      stats: { exists: false },
      user: { exists: false }
    },
    localStorage: {
      words: { exists: false, count: 0 },
      chats: { exists: false, count: 0 },
      notes: { exists: false, count: 0 }
    },
    timestamps: {
      check: new Date().toISOString()
    }
  };
  
  try {
    // 1. Check if user is authenticated
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot check sync status - no authenticated user');
      return { error: 'Not authenticated' };
    }
    
    debugInfo.userId = userId;
    
    // 2. Check if user document exists
    try {
      const userDocRef = doc(firestore, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      debugInfo.documents.user.exists = userDoc.exists();
      debugInfo.documents.user.data = userDoc.exists() ? userDoc.data() : null;
    } catch (userError) {
      console.error('WordStream: Error checking user document:', userError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.userDoc = String(userError);
    }
    
    // 3. Check words collection
    try {
      const wordsCollectionRef = collection(firestore, 'users', userId, 'userData', 'words', 'items');
      const wordsSnapshot = await getDocs(wordsCollectionRef);
      debugInfo.collections.words.exists = true;
      debugInfo.collections.words.count = wordsSnapshot.size;
      debugInfo.collections.words.items = wordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (wordsError) {
      console.error('WordStream: Error checking words collection:', wordsError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.wordsCollection = String(wordsError);
    }
    
    // 4. Check chats collection
    try {
      const chatsCollectionRef = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
      const chatsSnapshot = await getDocs(chatsCollectionRef);
      debugInfo.collections.chats.exists = true;
      debugInfo.collections.chats.count = chatsSnapshot.size;
      debugInfo.collections.chats.items = chatsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (chatsError) {
      console.error('WordStream: Error checking chats collection:', chatsError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.chatsCollection = String(chatsError);
    }
    
    // 5. Check notes collection in more detail
    try {
      const notesCollectionRef = collection(firestore, 'users', userId, 'userData', 'notes', 'items');
      const notesSnapshot = await getDocs(notesCollectionRef);
      debugInfo.collections.notes.exists = true;
      debugInfo.collections.notes.count = notesSnapshot.size;
      
      // Get detailed info about notes
      interface NoteDocument {
        id: string;
        videoId?: string;
        content?: string;
        timestamp?: string;
        videoTime?: number;
        [key: string]: any;
      }
      
      const notesData: NoteDocument[] = notesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      
      // Group notes by videoId
      const notesByVideo: Record<string, NoteDocument[]> = {};
      notesData.forEach(note => {
        if (note.videoId) {
          if (!notesByVideo[note.videoId]) {
            notesByVideo[note.videoId] = [];
          }
          notesByVideo[note.videoId].push(note);
        }
      });
      
      debugInfo.collections.notes.items = notesData;
      debugInfo.collections.notes.byVideo = notesByVideo;
      
      // Check if note references exist in the user document
      if (debugInfo.documents.user.exists && debugInfo.documents.user.data?.noteMeta) {
        const noteMeta = debugInfo.documents.user.data.noteMeta;
        debugInfo.collections.notes.referencesInUser = Object.keys(noteMeta).length;
        
        // Check for mismatches between notes collection and user references
        const noteIdsInCollection = new Set(notesData.map(note => note.id));
        const noteIdsInUserDoc = new Set(Object.keys(noteMeta));
        
        const onlyInCollection = [...noteIdsInCollection].filter(id => !noteIdsInUserDoc.has(id));
        const onlyInUserDoc = [...noteIdsInUserDoc].filter(id => !noteIdsInCollection.has(id));
        
        debugInfo.collections.notes.mismatches = {
          onlyInCollection,
          onlyInUserDoc,
          hasMismatches: onlyInCollection.length > 0 || onlyInUserDoc.length > 0
        };
      }
    } catch (notesError) {
      console.error('WordStream: Error checking notes collection:', notesError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.notesCollection = String(notesError);
    }
    
    // 6. Check videos collection for note references
    try {
      const videosCollectionRef = collection(firestore, 'users', userId, 'userData', 'videos');
      const videosSnapshot = await getDocs(videosCollectionRef);
      debugInfo.collections.videos = {
        exists: true,
        count: videosSnapshot.size
      };
      
      // Check for notes references in videos
      const videosWithNotes = videosSnapshot.docs
        .filter(doc => doc.data().noteIds && Object.keys(doc.data().noteIds).length > 0)
        .map(doc => ({
          id: doc.id,
          title: doc.data().title || 'Unknown',
          noteIds: Object.keys(doc.data().noteIds || {})
        }));
      
      debugInfo.collections.videos.withNotes = videosWithNotes;
      debugInfo.collections.videos.totalNotesReferences = videosWithNotes.reduce(
        (sum, video) => sum + video.noteIds.length, 0
      );
    } catch (videosError) {
      console.error('WordStream: Error checking videos collection:', videosError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.videosCollection = String(videosError);
    }
    
    // 7. Check stats document
    try {
      const statsDocRef = doc(firestore, 'users', userId, 'userData', 'stats');
      const statsDoc = await getDoc(statsDocRef);
      debugInfo.documents.stats.exists = statsDoc.exists();
      debugInfo.documents.stats.data = statsDoc.exists() ? statsDoc.data() : null;
    } catch (statsError) {
      console.error('WordStream: Error checking stats document:', statsError);
      debugInfo.errors = debugInfo.errors || {};
      debugInfo.errors.statsDoc = String(statsError);
    }
    
    // 8. Check local storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const localStorageData = await new Promise<any>((resolve) => {
          chrome.storage.local.get(null, (result) => {
            resolve(result);
          });
        });
        
        // Count items in different storage categories
        debugInfo.localStorage.words.exists = !!localStorageData.saved_words;
        debugInfo.localStorage.words.count = localStorageData.saved_words ? 
          Object.keys(localStorageData.saved_words).length : 0;
        
        // Check for notes in storage
        const notesKeys = Object.keys(localStorageData).filter(key => key.startsWith('notes_'));
        const notesData: Record<string, any> = {};
        let totalNotesCount = 0;
        
        notesKeys.forEach(key => {
          const videoId = key.replace('notes_', '');
          const videoNotes = localStorageData[key] || [];
          notesData[videoId] = videoNotes;
          totalNotesCount += videoNotes.length;
        });
        
        debugInfo.localStorage.notes.exists = notesKeys.length > 0;
        debugInfo.localStorage.notes.count = totalNotesCount;
        debugInfo.localStorage.notes.byVideo = notesData;
        debugInfo.localStorage.notes.videoCount = notesKeys.length;
        
        // Check for chats
        debugInfo.localStorage.chats.exists = !!localStorageData.chats_storage;
        debugInfo.localStorage.chats.count = localStorageData.chats_storage ?
          Object.keys(localStorageData.chats_storage).length : 0;
      } catch (localStorageError) {
        console.error('WordStream: Error checking local storage:', localStorageError);
        debugInfo.errors = debugInfo.errors || {};
        debugInfo.errors.localStorage = String(localStorageError);
      }
    }
    
    console.log('WordStream: Debug info collected:', debugInfo);
    return debugInfo;
  } catch (error) {
    console.error('WordStream: Error in debugFirestoreState:', error);
    return { error: String(error) };
  }
}

/**
 * Forces a complete resync of chats between local storage and Firestore
 * This function is helpful when synchronization issues occur
 * @returns A promise that resolves to a boolean indicating success
 */
export async function forceResyncChats(): Promise<boolean> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot force resync chats - no authenticated user');
      return false;
    }
    
    console.log(`WordStream: Starting forced resync of chats for user ${userId}`);
    
    // Get all chats from local storage
    const storageData = await new Promise<any>((resolve) => {
      chrome.storage.sync.get(['chats_storage', 'video_chats_map'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error getting chats from storage:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result);
        }
      });
    });
    
    if (!storageData || !storageData.chats_storage) {
      console.warn('WordStream: No chats found in local storage for resync');
      return false;
    }
    
    const chatsStorage: Record<string, any> = storageData.chats_storage || {};
    const videoChatsMap: Record<string, string[]> = storageData.video_chats_map || {};
    
    // Clear existing chats in Firestore first
    try {
      const chatsCollectionRef = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
      const existingChats = await getDocs(chatsCollectionRef);
      
      if (!existingChats.empty) {
        console.log(`WordStream: Removing ${existingChats.size} existing chats before resync`);
        const batch = writeBatch(firestore);
        existingChats.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      // Also clear chat metadata from user document
      const userDocRef = doc(firestore, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().chatsMeta) {
        await updateDoc(userDocRef, {
          chatsMeta: deleteField()
        });
        console.log('WordStream: Cleared chat metadata from user document');
      }
      
    } catch (clearError) {
      console.error('WordStream: Error clearing existing chats:', clearError);
      // Continue with resync even if clearing fails
    }
    
    // Now create batches to upload all chats
    const chatIds = Object.keys(chatsStorage);
    if (chatIds.length === 0) {
      console.warn('WordStream: No chats found in local storage to resync');
      return false;
    }
    
    console.log(`WordStream: Found ${chatIds.length} chats to resync`);
    
    // Process in batches of 50 to avoid Firestore limits
    const BATCH_SIZE = 50;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const batchChatIds = chatIds.slice(i, i + BATCH_SIZE);
      const chatsMeta: Record<string, any> = {};
      
      batchChatIds.forEach(chatId => {
        const chat = chatsStorage[chatId];
        if (!chat || !chat.videoId) {
          console.warn(`WordStream: Chat ${chatId} is missing data, skipping`);
          errorCount++;
          return;
        }
        
        try {
          // Add standardized IDs and timestamps
          const now = new Date();
          const chatWithIds = {
            ...chat,
            id: chatId,
            conversationId: chatId,
            userId,
            updatedAt: chat.lastUpdated || now.toISOString(),
            lastUpdated: chat.lastUpdated || now.toISOString()
          };
          
          // Add to batch
          const chatsCollection = collection(firestore, 'users', userId, 'userData', 'chats', 'items');
          const chatRef = doc(chatsCollection, chatId);
          batch.set(chatRef, chatWithIds);
          
          // Track chat metadata for user document update
          chatsMeta[`chatsMeta.${chatId}`] = {
            videoId: chat.videoId,
            updatedAt: serverTimestamp()
          };
          
          successCount++;
        } catch (chatError) {
          console.error(`WordStream: Error preparing chat ${chatId} for batch:`, chatError);
          errorCount++;
        }
      });
      
      try {
        // Commit the batch
        await batch.commit();
        console.log(`WordStream: Batch ${Math.floor(i / BATCH_SIZE) + 1} committed with ${batchChatIds.length} chats`);
        
        // Update user document with chat metadata
        if (Object.keys(chatsMeta).length > 0) {
          const userDocRef = doc(firestore, 'users', userId);
          await updateDoc(userDocRef, chatsMeta);
        }
      } catch (batchError) {
        console.error(`WordStream: Error committing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError);
        errorCount += batchChatIds.length;
        successCount -= batchChatIds.length; // Adjust for the failed batch
      }
    }
    
    // Update video documents with chat references
    try {
      // Create a map of videoId -> chatIds
      const videoChats: Record<string, string[]> = {};
      
      // First populate from chatStorage
      Object.entries(chatsStorage).forEach(([chatId, chat]: [string, any]) => {
        if (chat && chat.videoId) {
          if (!videoChats[chat.videoId]) {
            videoChats[chat.videoId] = [];
          }
          videoChats[chat.videoId].push(chatId);
        }
      });
      
      // Then make sure to include from videoChatsMap
      Object.entries(videoChatsMap).forEach(([videoId, chats]: [string, string[]]) => {
        if (!videoChats[videoId]) {
          videoChats[videoId] = [];
        }
        // Add any missing chatIds
        chats.forEach(chatId => {
          if (!videoChats[videoId].includes(chatId)) {
            videoChats[videoId].push(chatId);
          }
        });
      });
      
      // Now update each video document
      for (const [videoId, chatIds] of Object.entries(videoChats)) {
        if (chatIds.length > 0) {
          try {
            const videoDocRef = doc(collection(firestore, 'users', userId, 'userData', 'videos'), videoId);
            const videoData: Record<string, any> = {
              videoId,
              lastUpdated: serverTimestamp()
            };
            
            // Add chat IDs to the video document
            chatIds.forEach(chatId => {
              videoData[`chatIds.${chatId}`] = true;
            });
            
            await setDoc(videoDocRef, videoData, { merge: true });
            console.log(`WordStream: Updated video ${videoId} with ${chatIds.length} chat references`);
          } catch (videoError) {
            console.error(`WordStream: Error updating video ${videoId}:`, videoError);
          }
        }
      }
    } catch (videoError) {
      console.error('WordStream: Error updating video documents:', videoError);
    }
    
    // Update stats to reflect the correct number of chats
    try {
      const statsDocRef = doc(collection(firestore, 'users', userId, 'userData'), 'stats');
      await updateDoc(statsDocRef, {
        'chats.total': successCount,
        lastUpdated: serverTimestamp()
      });
      console.log(`WordStream: Updated stats with ${successCount} total chats`);
    } catch (statsError) {
      console.warn('WordStream: Error updating stats with chat count:', statsError);
    }
    
    // Finally, update the user document with sync status
    try {
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, {
        lastForceResync: serverTimestamp(),
        forceResyncResults: {
          chats: {
            success: successCount > 0,
            count: successCount,
            errors: errorCount
          }
        }
      });
    } catch (userUpdateError) {
      console.error('WordStream: Error updating user sync info:', userUpdateError);
    }
    
    console.log(`WordStream: Completed forced resync of chats with ${successCount} successes and ${errorCount} errors`);
    return successCount > 0;
  } catch (error) {
    console.error('WordStream: Error during forced resync of chats:', error);
    return false;
  }
}

/**
 * Forces a complete resync of notes between local storage and Firestore
 * This function is helpful when synchronization issues occur with notes
 * @returns A promise that resolves to a boolean indicating success
 */
export async function forceResyncNotes(): Promise<boolean> {
  try {
    console.log('WordStream: Starting forced notes resync');
    
    // Get current user ID
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.error('WordStream: Cannot resync notes - no authenticated user');
      return false;
    }
    
    // Get all notes from local storage
    const storageData = await new Promise<any>((resolve) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error getting local storage data:', chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(result);
        }
      });
    });
    
    // Extract all notes from storage
    const allNotes: any[] = [];
    const videoMetadata: Record<string, {
      title: string;
      url?: string;
      notes: any[];
      lastUpdated?: string;
    }> = {};
    
    // Process the notes_storage format if available
    if (storageData.notes_storage) {
      Object.entries(storageData.notes_storage).forEach(([videoId, videoData]: [string, any]) => {
        if (!videoId || !videoData || !videoData.notes) return;
        
        // Store video metadata for later
        videoMetadata[videoId] = {
          title: videoData.videoTitle || 'Unknown Video',
          url: videoData.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
          notes: [],
          lastUpdated: videoData.lastUpdated
        };
        
        // Process all notes for this video
        videoData.notes.forEach((note: any) => {
          if (!note || !note.id) return;
          
          // Add this note to the array and to the video's notes
          allNotes.push({
            ...note,
            videoId,
            videoTitle: videoData.videoTitle,
            videoURL: videoData.videoURL
          });
          
          videoMetadata[videoId].notes.push(note);
        });
      });
    }
    
    // Also check for old format notes (notes_{videoId})
    Object.keys(storageData).forEach(key => {
      if (key.startsWith('notes_') && key !== 'notes_storage') {
        const videoId = key.replace('notes_', '');
        const notes = storageData[key];
        
        if (Array.isArray(notes) && notes.length > 0) {
          // Add video metadata if not already present
          if (!videoMetadata[videoId]) {
            // Try to determine the video title from the first note
            const firstNote = notes[0];
            videoMetadata[videoId] = {
              title: firstNote.videoTitle || 'Unknown Video',
              url: firstNote.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
              notes: [],
              lastUpdated: firstNote.timestamp
            };
          }
          
          // Process all notes
          notes.forEach((note: any) => {
            if (!note || !note.id) return;
            
            // Add videoId if not present
            const noteWithVideo = { ...note, videoId };
            
            // Check if this note is already in our array (by id)
            const exists = allNotes.some(n => n.id === note.id);
            if (!exists) {
              allNotes.push(noteWithVideo);
              videoMetadata[videoId].notes.push(note);
            }
          });
        }
      }
    });
    
    if (allNotes.length === 0) {
      console.log('WordStream: No notes found in local storage to sync');
      return true;
    }
    
    console.log(`WordStream: Found ${allNotes.length} notes across ${Object.keys(videoMetadata).length} videos to sync`);
    
    // Prepare metadata updates for all videos
    const metadataUpdates: Record<string, any> = {};
    Object.entries(videoMetadata).forEach(([videoId, data]) => {
      metadataUpdates[`videos.${videoId}`] = {
        title: data.title,
        url: data.url || `https://www.youtube.com/watch?v=${videoId}`,
        hasNotes: true,
        noteCount: data.notes.length,
        lastUpdated: serverTimestamp()
      };
    });
    
    // Update the metadata document
    const metadataRef = doc(firestore, 'users', userId, 'userData', 'metadata');
    await setDoc(metadataRef, metadataUpdates, { merge: true });
    console.log('WordStream: Updated metadata with all videos');
    
    // Process notes in batches to avoid hitting Firestore limits
    const batchSize = 500; // Firestore batch limit is 500
    let processed = 0;
    
    // Get existing notes to avoid duplicates
    const notesCollection = collection(firestore, 'users', userId, 'userData', 'notes', 'items');
    const existingNotesSnapshot = await getDocs(notesCollection);
    const existingNoteIds = new Set(existingNotesSnapshot.docs.map(doc => doc.id));
    
    while (processed < allNotes.length) {
      const batch = writeBatch(firestore);
      const currentBatch = allNotes.slice(processed, processed + batchSize);
      let batchCount = 0;
      
      for (const note of currentBatch) {
        // Skip if this note already exists in Firestore
        if (existingNoteIds.has(note.id)) {
          continue;
        }
        
        // Ensure we have all required fields
        const normalizedNote = {
          ...note,
          videoId: note.videoId,
          content: note.content || '',
          timestamp: note.timestamp || new Date().toISOString(),
          updatedAt: note.updatedAt || new Date().toISOString(),
          videoTime: typeof note.videoTime === 'number' ? note.videoTime : 0
        };
        
        // Add to batch
        const noteRef = doc(notesCollection, note.id);
        batch.set(noteRef, normalizedNote);
        batchCount++;
      }
      
      // Only commit if we have notes to save
      if (batchCount > 0) {
        await batch.commit();
        console.log(`WordStream: Synced batch of ${batchCount} notes to Firestore`);
      }
      
      processed += currentBatch.length;
    }
    
    // Update the user document with metadata about all notes
    const userDocRef = doc(firestore, 'users', userId);
    const noteMeta: Record<string, any> = {};
    
    // Create compact metadata for each note
    allNotes.forEach(note => {
      noteMeta[`noteMeta.${note.id}`] = {
        id: note.id,
        videoId: note.videoId,
        timestamp: note.timestamp || new Date().toISOString(),
        updatedAt: note.updatedAt || new Date().toISOString()
      };
    });
    
    // Update user document with all note metadata
    await updateDoc(userDocRef, {
      ...noteMeta,
      lastActivity: serverTimestamp()
    });
    
    console.log(`WordStream: Successfully synced ${allNotes.length} notes to Firestore`);
    
    // Broadcast that notes have been synced
    broadcastMessage({
      action: 'NOTES_SYNCED',
      count: allNotes.length
    });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error in forceResyncNotes:', error);
    return false;
  }
}

/**
 * Get all videos with notes from Firestore
 * @returns Promise resolving to an array of videos with their notes
 */
export async function getAllVideosWithNotes(): Promise<any[]> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot get videos with notes - no authenticated user');
      return [];
    }
    
    // Get all videos that have notes - use 'videos' as a document field in userData
    // instead of treating it as a collection
    const userDataRef = doc(firestore, 'users', userId, 'userData', 'metadata');
    const userDataDoc = await getDoc(userDataRef);
    
    if (!userDataDoc.exists() || !userDataDoc.data().videos) {
      console.log('WordStream: No videos with notes found in user metadata');
      
      // Alternative approach: scan all notes to find unique videoIds
      const notesCollection = collection(firestore, 'users', userId, 'userData', 'notes', 'items');
      const notesSnapshot = await getDocs(notesCollection);
      
      if (notesSnapshot.empty) {
        console.log('WordStream: No notes found');
        return [];
      }
      
      // Extract unique videoIds from notes
      const videoIdsMap: Record<string, {
        title?: string;
        url?: string;
        lastUpdated?: string;
        notes: any[];
      }> = {};
      
      // Group notes by videoId
      notesSnapshot.forEach(doc => {
        const noteData = doc.data();
        const videoId = noteData.videoId;
        
        if (!videoId) return;
        
        if (!videoIdsMap[videoId]) {
          videoIdsMap[videoId] = {
            title: noteData.videoTitle || 'Unknown Video',
            url: noteData.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
            lastUpdated: handleFirestoreTimestamp(noteData.timestamp || noteData.updatedAt)?.toISOString() || new Date().toISOString(),
            notes: []
          };
        }
        
        // Update lastUpdated if this note is newer
        const noteDate = handleFirestoreTimestamp(noteData.timestamp || noteData.updatedAt);
        const currentLastUpdated = new Date(videoIdsMap[videoId].lastUpdated || 0);
        
        if (noteDate && noteDate > currentLastUpdated) {
          videoIdsMap[videoId].lastUpdated = noteDate.toISOString();
        }
        
        // Add the note to this video's notes
        videoIdsMap[videoId].notes.push({
          ...noteData,
          id: doc.id,
          formattedTime: noteData.videoTime !== undefined ? formatVideoTime(noteData.videoTime) : null
        });
      });
      
      // Convert the map to an array
      const videos = Object.entries(videoIdsMap).map(([videoId, data]) => ({
        videoId,
        videoTitle: data.title || 'Unknown Video',
        videoURL: data.url || `https://www.youtube.com/watch?v=${videoId}`,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        notes: data.notes
      }));
      
      // Sort by lastUpdated
      return videos.sort((a, b) => {
        if (!a || !b) return 0;
        const timeA = new Date(a.lastUpdated).getTime();
        const timeB = new Date(b.lastUpdated).getTime();
        return timeB - timeA;
      });
    }
    
    // If we have video metadata in the user document
    const videoMetadata = userDataDoc.data().videos || {};
    const videoPromises = Object.keys(videoMetadata).map(async (videoId) => {
      const videoData = videoMetadata[videoId];
      
      // Skip videos without notes
      if (!videoData || !videoData.hasNotes) {
        return null;
      }
      
      // Get notes for this video
      const notes = await getNotes(videoId);
      
      if (!notes || notes.length === 0) {
        return null;
      }
      
      // Create video with notes structure
      return {
        videoId,
        videoTitle: videoData.title || 'Unknown Video',
        videoURL: videoData.url || `https://www.youtube.com/watch?v=${videoId}`,
        lastUpdated: handleFirestoreTimestamp(videoData.lastUpdated)?.toISOString() || new Date().toISOString(),
        notes: notes.map(note => ({
          ...note,
          formattedTime: note.videoTime !== undefined ? formatVideoTime(note.videoTime) : null
        }))
      };
    });
    
    const videos = await Promise.all(videoPromises);
    
    // Filter out null values and sort by lastUpdated
    return videos
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        const timeA = new Date(a.lastUpdated).getTime();
        const timeB = new Date(b.lastUpdated).getTime();
        return timeB - timeA;
      });
  } catch (error) {
    console.error('WordStream: Error getting videos with notes:', error);
    return [];
  }
}

/**
 * Delete all notes for a specific video
 * @param videoId The ID of the video to delete notes for
 * @returns Promise resolving to the number of deleted notes
 */
export async function deleteAllNotesForVideo(videoId: string): Promise<number> {
  try {
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot delete notes - no authenticated user');
      return 0;
    }
    
    console.log(`WordStream: Deleting all notes for video ${videoId}`);
    
    // Get all notes for this video
    const notesCollection = collection(firestore, 'users', userId, 'userData', 'notes', 'items');
    const q = query(notesCollection, where('videoId', '==', videoId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log(`WordStream: No notes found for video ${videoId}`);
      return 0;
    }
    
    // Delete all notes in batches
    const batch = writeBatch(firestore);
    let deletedCount = 0;
    
    // Store the noteIds for broadcasting later
    const noteIds: string[] = [];
    
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      noteIds.push(doc.id);
      deletedCount++;
    });
    
    // Update the user metadata document instead of video document
    try {
      const userDataRef = doc(firestore, 'users', userId, 'userData', 'metadata');
      const userDataDoc = await getDoc(userDataRef);
      
      if (userDataDoc.exists() && userDataDoc.data().videos && userDataDoc.data().videos[videoId]) {
        // Update the user document to remove video reference
        batch.update(userDataRef, {
          [`videos.${videoId}`]: deleteField()
        });
      }
    } catch (videoError) {
      console.warn(`WordStream: Error updating user metadata document: ${videoError}`);
      // Non-critical error, continue with deletion
    }
    
    // Update user document to remove note references
    try {
      const userDocRef = doc(firestore, 'users', userId);
      
      // Create an object with all fields to delete
      const fieldsToDelete: Record<string, any> = {};
      noteIds.forEach((noteId: string) => {
        fieldsToDelete[`noteMeta.${noteId}`] = deleteField();
      });
      
      // Add the user document update to the batch
      batch.update(userDocRef, {
        ...fieldsToDelete,
        lastActivity: serverTimestamp()
      });
    } catch (userError) {
      console.warn(`WordStream: Error updating user document: ${userError}`);
      // Non-critical error, continue with deletion
    }
    
    // Commit the batch
    await batch.commit();
    
    // Broadcast the deletion to all windows
    noteIds.forEach(noteId => {
      broadcastMessage({
        action: 'NOTE_DELETED',
        noteId,
        videoId
      });
    });
    
    console.log(`WordStream: Successfully deleted ${deletedCount} notes for video ${videoId}`);
    return deletedCount;
  } catch (error) {
    console.error(`WordStream: Error deleting notes for video ${videoId}:`, error);
    return 0;
  }
}

/**
 * Format video time (seconds) into MM:SS format
 * @param seconds The time in seconds
 * @returns Formatted time string
 */
function formatVideoTime(seconds: number): string {
  if (seconds === undefined || seconds === null) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * ==================================================
 * 🔄 SYNCHRONIZATION FUNCTIONS
 * ==================================================
 */

/**
 * Verifies connection to Firestore and authentication status
 * @returns Object with status information
 */
export async function checkFirestoreConnection(): Promise<{
  connected: boolean;
  authenticated: boolean;
  userId: string | null;
  error?: string;
}> {
  try {
    console.log('WordStream: Checking Firestore connection...');
    
    // Check if Firestore is initialized
    if (!firestore) {
      return {
        connected: false,
        authenticated: false,
        userId: null,
        error: 'Firestore not initialized'
      };
    }
    
    // Check authentication
    const userId = await ensureAuthenticatedUser();
    const authenticated = !!userId;
    
    // Try a simple read operation to verify connection
    if (authenticated) {
      try {
        const userDocRef = doc(firestore, 'users', userId as string);
        await getDoc(userDocRef);
        console.log('WordStream: Successfully connected to Firestore and authenticated');
        
        return {
          connected: true,
          authenticated: true,
          userId
        };
      } catch (readError: any) {
        console.error('WordStream: Error reading from Firestore:', readError);
        return {
          connected: false,
          authenticated: true,
          userId,
          error: `Read error: ${readError?.message || readError}`
        };
      }
    }
    
    return {
      connected: false,
      authenticated: false,
      userId: null,
      error: 'Not authenticated'
    };
  } catch (error: any) {
    console.error('WordStream: Error checking Firestore connection:', error);
    return {
      connected: false,
      authenticated: false,
      userId: null,
      error: error?.message || String(error)
    };
  }
}

/**
 * Start listening for broadcast messages from localStorage
 * This complements the postMessage mechanism for better cross-tab communication
 */
export function setupBroadcastListener(callback: (message: any) => void) {
  if (typeof window === 'undefined') return () => {};
  
  const storageHandler = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith('wordstream_broadcast_')) return;
    
    try {
      const message = JSON.parse(e.newValue || '{}');
      callback(message);
    } catch (error) {
      console.warn('WordStream: Error processing broadcast from localStorage:', error);
    }
  };
  
  window.addEventListener('storage', storageHandler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('storage', storageHandler);
  };
}

/**
 * Update user statistics in Firestore
 * @param stats The stats to update
 * @returns {Promise<boolean>} Success or failure
 */
export async function updateUserStats(stats: any): Promise<boolean> {
  try {
    // Check for authenticated user
    const userId = await ensureAuthenticatedUser();
    if (!userId) {
      console.warn('WordStream: Cannot update stats - user not authenticated');
      return false;
    }
    
    const userRef = doc(firestore, 'users', userId);
    const statsRef = doc(collection(userRef, 'userData'), 'stats');
    
    const updates: any = {};
    
    // Process increments
    Object.entries(stats).forEach(([key, value]) => {
      if (value && typeof value === 'object' && 'increment' in value) {
        const incrementValue = typeof value.increment === 'number' ? value.increment : 1;
        updates[key] = increment(incrementValue);
      } else {
        updates[key] = value;
      }
    });
    
    // Always add lastUpdated
    if (!updates.lastUpdated) {
      updates.lastUpdated = new Date().toISOString();
    }
    
    // Update the stats document
    await setDoc(statsRef, updates, { merge: true });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error updating user stats:', error);
    return false;
  }
}