import { debounce } from '@/utils/function-utils';
import { Word } from '@/types/word';
import * as BackgroundMessaging from '@/utils/background-messaging';

/**
 * Synchronizes notes between local storage and server
 * Attempts to sync notes with Firestore if connection is available
 * @returns Promise<void>
 */
export async function syncNotes(): Promise<void> {
  try {
    // Initiate synchronization of notes between local storage and Firestore
    await BackgroundMessaging.initializeDataSync();
  } catch (error) {
    console.error('WordStream: Error syncing notes:', error);
  }
}

/**
 * Synchronizes chats between local storage and server
 * Attempts to sync chats with Firestore if connection is available
 * @returns Promise<void>
 */
export async function syncChats(): Promise<void> {
  try {
    // Initiate synchronization of chats between local storage and Firestore
    await BackgroundMessaging.initializeDataSync();
  } catch (error) {
    console.error('WordStream: Error syncing chats:', error);
  }
}

/**
 * Synchronizes all data between local storage and server
 * Attempts to sync data with Firestore if connection is available
 * @returns Promise<void>
 */
export async function syncAllData(): Promise<void> {
  try {
    // Initiate synchronization of all data between local storage and Firestore
    await BackgroundMessaging.initializeDataSync();
  } catch (error) {
    console.error('WordStream: Error syncing all data:', error);
  }
}

/**
 * Ensures all data is synchronized between local storage and server upon reconnection
 * @returns Promise<void>
 */
export async function syncDataOnReconnect(): Promise<void> {
  try {
    // Check if there is a connection and valid authentication
    const connectionStatus = await BackgroundMessaging.checkFirestoreConnection();
    
    if (connectionStatus.connected && connectionStatus.authenticated) {
      console.log('WordStream: Reconnected to Firestore, syncing data...');
      
      // Initiate synchronization of all data
      await BackgroundMessaging.initializeDataSync();
    }
  } catch (error) {
    console.error('WordStream: Error syncing data on reconnect:', error);
  }
}

// Debounced versions of sync functions for better performance
export const debouncedSyncNotes = debounce(syncNotes, 2000);
export const debouncedSyncChats = debounce(syncChats, 2000);
export const debouncedSyncAllData = debounce(syncAllData, 2000); 