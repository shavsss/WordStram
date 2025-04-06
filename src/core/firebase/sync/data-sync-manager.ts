/**
 * Data Synchronization Manager
 * Coordinates all real-time data synchronization with Firestore
 */

import { SyncState } from '../types';
import { getCurrentUser } from '../auth/auth-service';
import { checkFirestoreConnection } from '../utils/connection-utils';
import { setupListeners } from './listeners';
import { initializeOfflineQueue, processPendingOperations } from './offline-queue';
import { saveWord } from '../services/words';
import { saveNote } from '../services/notes';
import { saveChat } from '../services/chats';
import { saveUserStats } from '../services/settings';
import { debounce } from '@/utils/function-utils';

// Global sync state
const syncState: SyncState = {
  initialized: false,
  unsubscribeFunctions: [],
  pendingOperations: []
};

/**
 * Initialize Firestore data synchronization and listeners
 * This should be called from any component that needs real-time data
 * @returns A cleanup function to unsubscribe all listeners
 */
export async function initializeDataSync(): Promise<() => void> {
  // If already initialized, return existing cleanup function
  if (syncState.initialized) {
    console.log('WordStream: Data sync already initialized, reusing existing connection');
    return () => cleanupAllListeners();
  }

  try {
    // Check if user is authenticated
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      console.warn('WordStream: Cannot initialize data sync - no authenticated user or device offline');
      return () => {};
    }

    const user = getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot initialize data sync - no authenticated user');
      return () => {};
    }

    const userId = user.uid;
    console.log('WordStream: Initializing Firestore data sync for all components');
    
    // Initialize offline support
    initializeOfflineQueue();
    
    // Setup listeners for each data type
    const unsubscribeFunctions = await setupListeners(userId);
    
    // Store all unsubscribe functions
    syncState.unsubscribeFunctions = unsubscribeFunctions;
    
    // Mark as initialized
    syncState.initialized = true;
    
    // Process any pending operations
    processPendingOperations();
    
    console.log('WordStream: Firestore sync fully initialized for user:', userId);
    
    // Return cleanup function
    return () => cleanupAllListeners();
  } catch (error) {
    console.error('WordStream: Error initializing data sync:', error);
    return () => {};
  }
}

/**
 * Clean up all active listeners
 */
export function cleanupAllListeners(): void {
  try {
    console.log(`WordStream: Cleaning up ${syncState.unsubscribeFunctions.length} active listeners`);
    
    // Call each unsubscribe function
    syncState.unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn('WordStream: Error unsubscribing from listener:', err);
      }
    });
    
    // Reset the state
    syncState.unsubscribeFunctions = [];
    syncState.initialized = false;
    
    console.log('WordStream: All listeners cleaned up');
  } catch (error) {
    console.error('WordStream: Error cleaning up listeners:', error);
  }
}

/**
 * Check if data sync is initialized
 * @returns Whether data sync is initialized
 */
export function isSyncInitialized(): boolean {
  return syncState.initialized;
}

/**
 * Get the current sync state
 * @returns Current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Synchronize between local storage and Firestore
 * This ensures data consistency when the user is online
 * @param dataType Optional data type to sync ('words', 'stats', 'chats', 'notes'). If omitted, syncs all data.
 */
export async function syncBetweenStorageAndFirestore(dataType?: 'words' | 'stats' | 'chats' | 'notes'): Promise<void> {
  try {
    // Verify connectivity and authentication
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      console.warn('WordStream: Cannot sync data - not connected or not authenticated');
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot sync data - no authenticated user');
      return;
    }

    const userId = user.uid;
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
    
    // Track sync results
    let syncResults = {
      words: { success: false, count: 0 },
      stats: { success: false },
      chats: { success: false, count: 0 },
      notes: { success: false, count: 0 }
    };
    
    // Sync words if requested
    if ((dataType === 'words' || !dataType) && storageData.words && Array.isArray(storageData.words)) {
      try {
        let successCount = 0;
        for (const word of storageData.words) {
          const wordId = await saveWord(word);
          if (wordId) successCount++;
        }
        syncResults.words = { success: successCount > 0, count: successCount };
        console.log(`WordStream: Synced ${successCount} words to Firestore`);
      } catch (wordError) {
        console.error('WordStream: Error syncing words:', wordError);
      }
    }
    
    // Sync stats if requested
    if ((dataType === 'stats' || !dataType) && storageData.stats) {
      try {
        const success = await saveUserStats(storageData.stats);
        syncResults.stats = { success };
        console.log('WordStream: Synced stats to Firestore');
      } catch (statsError) {
        console.error('WordStream: Error syncing stats:', statsError);
      }
    }
    
    // Sync chats if requested
    if ((dataType === 'chats' || !dataType) && storageData.chats_storage) {
      try {
        // Chats are stored as { chatId: chatData }
        const chatsStorage: Record<string, any> = storageData.chats_storage || {};
        
        let successCount = 0;
        for (const [chatId, chatData] of Object.entries(chatsStorage)) {
          if (chatData) {
            const chatWithId = { ...chatData, id: chatId };
            const savedChatId = await saveChat(chatWithId);
            if (savedChatId) successCount++;
          }
        }
        
        syncResults.chats = { success: successCount > 0, count: successCount };
        console.log(`WordStream: Synced ${successCount} chats to Firestore`);
      } catch (chatsError) {
        console.error('WordStream: Error syncing chats:', chatsError);
      }
    }
    
    // Sync notes if requested
    if ((dataType === 'notes' || !dataType) && storageData.notes_storage) {
      try {
        // Notes are stored as { videoId: { notes: Note[] } }
        const notesStorage = storageData.notes_storage;
        let successCount = 0;
        
        for (const videoId in notesStorage) {
          const videoData = notesStorage[videoId];
          if (videoData && Array.isArray(videoData.notes)) {
            for (const note of videoData.notes) {
              if (note) {
                // Make sure the note has videoId
                const noteWithVideo = { ...note, videoId };
                const noteId = await saveNote(noteWithVideo);
                if (noteId) successCount++;
              }
            }
          }
        }
        
        syncResults.notes = { success: successCount > 0, count: successCount };
        console.log(`WordStream: Synced ${successCount} notes to Firestore`);
      } catch (notesError) {
        console.error('WordStream: Error syncing notes:', notesError);
      }
    }
    
    console.log(`WordStream: Completed sync of ${dataType || 'all'} data:`, syncResults);
  } catch (error) {
    console.error(`WordStream: Error syncing ${dataType || 'all'} data:`, error);
  }
}

// Create a debounced version of the sync function for better performance
export const debouncedSyncToFirestore = debounce((dataType?: 'words' | 'stats' | 'chats' | 'notes') => 
  syncBetweenStorageAndFirestore(dataType), 2000); 