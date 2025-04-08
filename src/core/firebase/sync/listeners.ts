/**
 * Firestore listeners
 * Sets up real-time listeners for various data collections
 */

import { 
  collection, 
  doc, 
  onSnapshot, 
  query
} from 'firebase/firestore';
import { firestore } from '../config';
import { broadcastMessage } from './broadcast';
import { handleFirestoreTimestamp } from '../utils/timestamp-utils';
import { createNotesPath, createChatsPath, createWordsPath, createStatsPath } from '../utils/path-utils';

/**
 * Setup all listeners for a user
 * @param userId User ID
 * @returns Array of unsubscribe functions
 */
export async function setupListeners(userId: string): Promise<Array<() => void>> {
  console.log('WordStream: Setting up all Firestore listeners');
  
  const wordListUnsubscribe = setupWordListListener(userId);
  const chatsUnsubscribe = setupChatsListener(userId);
  const notesUnsubscribe = setupNotesListener(userId);
  const statsUnsubscribe = setupStatsListener(userId);
  
  return [
    wordListUnsubscribe,
    chatsUnsubscribe,
    notesUnsubscribe,
    statsUnsubscribe
  ];
}

/**
 * Setup listener for wordlist collection
 * @param userId User ID
 * @returns Unsubscribe function
 */
export function setupWordListListener(userId: string): () => void {
  // Create reference to words collection
  const wordsPath = createWordsPath(userId);
  const wordlistCollection = collection(firestore, wordsPath);
  
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
          broadcastMessage({ 
            action: 'WORDS_UPDATED', 
            words,
            timestamp: new Date().toISOString()
          });
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
 * @param userId User ID
 * @returns Unsubscribe function
 */
export function setupChatsListener(userId: string): () => void {
  // Create reference to chats collection
  const chatsPath = createChatsPath(userId);
  const chatsCollection = collection(firestore, chatsPath);
  
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
          broadcastMessage({ 
            action: 'CHATS_UPDATED', 
            chats,
            timestamp: new Date().toISOString()
          });
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
 * @param userId User ID
 * @returns Unsubscribe function
 */
export function setupNotesListener(userId: string): () => void {
  // Create reference to notes collection
  const notesPath = createNotesPath(userId);
  const notesCollection = collection(firestore, notesPath);
  
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
          broadcastMessage({ 
            action: 'NOTES_UPDATED', 
            notes,
            timestamp: new Date().toISOString()
          });
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
 * @param userId User ID
 * @returns Unsubscribe function
 */
export function setupStatsListener(userId: string): () => void {
  // Create reference to stats document
  const statsPath = createStatsPath(userId);
  const statsRef = doc(firestore, statsPath);
  
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
          broadcastMessage({ 
            action: 'STATS_UPDATED', 
            stats: processedStats,
            timestamp: new Date().toISOString()
          });
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