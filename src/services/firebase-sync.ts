import { Note } from '@/features/notes/types';
import { Chat, VideoMetadata } from '@/types';
import { getCurrentUser } from '@/core/firebase/auth';
import * as FirestoreService from '@/core/firebase/firestore';

/**
 * Syncs notes between local storage and Firestore
 * Implements two-way synchronization with conflict resolution
 */
export async function syncNotesBetweenStorageAndFirestore(): Promise<boolean> {
  try {
    console.log('WordStream: Syncing notes between storage and Firestore');
    
    // Use the new generic sync function with 'notes' type
    await FirestoreService.syncBetweenStorageAndFirestore('notes');
    return true;
  } catch (error) {
    console.error('WordStream: Error syncing notes:', error);
    return false;
  }
}

/**
 * Syncs chats between local storage and Firestore
 * Implements two-way synchronization with conflict resolution
 */
export async function syncChatsBetweenStorageAndFirestore(): Promise<boolean> {
  try {
    console.log('WordStream: Syncing chats between storage and Firestore');
    
    // Use the new generic sync function with 'chats' type
    await FirestoreService.syncBetweenStorageAndFirestore('chats');
    return true;
  } catch (error) {
    console.error('WordStream: Error syncing chats:', error);
    return false;
  }
}

/**
 * Synchronizes all data types between local storage and Firestore
 * @returns Promise resolving to a boolean indicating if all syncs were successful
 */
export async function syncAllData(): Promise<boolean> {
  try {
    console.log('WordStream: Starting comprehensive data sync');
    
    // Sync all data types using the generic sync function
    await FirestoreService.syncBetweenStorageAndFirestore('chats');
    console.log('WordStream: Chats sync completed');
    
    await FirestoreService.syncBetweenStorageAndFirestore('notes');
    console.log('WordStream: Notes sync completed');
    
    await FirestoreService.syncBetweenStorageAndFirestore('words');
    console.log('WordStream: Words sync completed');
    
    return true;
  } catch (error) {
    console.error('WordStream: Error during data sync:', error);
    return false;
  }
}

/**
 * Synchronizes data for a specific video
 * @param videoId ID of the video to sync data for
 * @returns Promise resolving to a boolean indicating if sync was successful
 */
export async function syncVideoData(videoId: string): Promise<boolean> {
  if (!videoId) {
    console.warn('WordStream: Cannot sync video data - missing videoId');
    return false;
  }
  
  try {
    console.log(`WordStream: Starting sync for video ${videoId}`);
    
    // Sync all data types that could be related to a video
    await FirestoreService.syncBetweenStorageAndFirestore('notes');
    console.log(`WordStream: Notes sync completed for video ${videoId}`);
    
    await FirestoreService.syncBetweenStorageAndFirestore('chats');
    console.log(`WordStream: Chats sync completed for video ${videoId}`);
    
    return true;
  } catch (error) {
    console.error(`WordStream: Error syncing data for video ${videoId}:`, error);
    return false;
  }
} 