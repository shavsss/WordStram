/**
 * Offline queue functionality
 * Manages operations that need to be performed when the device is back online
 */

import { PendingOperation } from '../types';

// Global state for pending operations
let pendingOperations: PendingOperation[] = [];
const QUEUE_STORAGE_KEY = 'wordstream_pending_operations';

/**
 * Initialize offline functionality by loading pending operations from storage
 */
export async function initializeOfflineQueue(): Promise<void> {
  try {
    await loadPendingOperations();
    setupNetworkListeners();
    console.log('WordStream: Offline queue initialized successfully');
  } catch (error) {
    console.error('WordStream: Error initializing offline queue:', error);
    // Initialize empty queue in case of error
    pendingOperations = [];
  }
}

/**
 * Load any pending operations from chrome.storage
 * @returns A promise that resolves when operations are loaded
 */
export async function loadPendingOperations(): Promise<void> {
  // Check if chrome.storage is available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('WordStream: Chrome storage not available, pending operations disabled');
    pendingOperations = []; // Initialize empty queue
    return;
  }
  
  try {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get([QUEUE_STORAGE_KEY], (result) => {
        if (result && result[QUEUE_STORAGE_KEY] && Array.isArray(result[QUEUE_STORAGE_KEY])) {
          pendingOperations = result[QUEUE_STORAGE_KEY];
          console.log(`WordStream: Loaded ${pendingOperations.length} pending operations from chrome.storage`);
        } else {
          pendingOperations = [];
          console.log('WordStream: No pending operations found in storage');
        }
        resolve();
      });
    });
  } catch (error) {
    console.error('WordStream: Failed to load pending operations from storage:', error);
    pendingOperations = []; // Initialize empty queue in case of error
  }
}

/**
 * Set up network status listeners
 */
export function setupNetworkListeners(): void {
  // Handle online events
  window.addEventListener('online', () => {
    console.log('WordStream: Device is back online, processing pending operations');
    processPendingOperations();
  });
  
  // Handle offline events
  window.addEventListener('offline', () => {
    console.log('WordStream: Device is offline, operations will be queued');
  });
}

/**
 * Add an operation to the queue
 * @param type Operation type
 * @param data Operation data
 */
export async function queueOperation(type: string, data: any): Promise<void> {
  // Create new operation
  const operation: PendingOperation = {
    type,
    data,
    timestamp: Date.now()
  };
  
  // Add to memory queue
  pendingOperations.push(operation);
  
  console.log(`WordStream: Queued ${type} operation for later processing`);
  
  // Store pending operations in chrome.storage for persistence
  await savePendingOperations();
}

/**
 * Save pending operations to storage
 * @returns A promise that resolves when operations are saved
 */
async function savePendingOperations(): Promise<void> {
  // Skip if chrome.storage is not available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('WordStream: Chrome storage not available, operations only stored in memory');
    return;
  }
  
  try {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ 
        [QUEUE_STORAGE_KEY]: pendingOperations 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error saving pending operations:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log(`WordStream: Saved ${pendingOperations.length} pending operations to chrome.storage`);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Failed to save pending operations to storage:', error);
  }
}

/**
 * Process operations that were queued while offline
 */
export async function processPendingOperations(): Promise<void> {
  // Skip if offline or no operations
  if (!navigator.onLine || pendingOperations.length === 0) {
    return;
  }
  
  console.log(`WordStream: Processing ${pendingOperations.length} pending operations`);
  
  try {
    // Import required functions dynamically to avoid circular dependencies
    const { saveWord } = await import('../services/words');
    const { saveNote } = await import('../services/notes');
    const { saveChat } = await import('../services/chats');
    
    // Sort operations by timestamp (oldest first)
    const operations = [...pendingOperations].sort((a, b) => a.timestamp - b.timestamp);
    
    // Clear pending operations before processing to avoid duplicates
    pendingOperations = [];
    await savePendingOperations();
    
    // Process each operation
    const failedOperations: PendingOperation[] = [];
    
    for (const operation of operations) {
      try {
        console.log(`WordStream: Processing pending ${operation.type} operation`);
        
        switch (operation.type) {
          case 'saveWord':
            await saveWord(operation.data);
            break;
          case 'saveNote':
            await saveNote(operation.data);
            break;
          case 'saveChat':
            await saveChat(operation.data);
            break;
          default:
            console.warn(`WordStream: Unknown operation type: ${operation.type}`);
            // Re-queue unknown operations
            failedOperations.push(operation);
        }
      } catch (error) {
        console.error(`WordStream: Error processing pending ${operation.type} operation:`, error);
        // Re-queue failed operations
        failedOperations.push(operation);
      }
    }
    
    // Re-queue any failed operations
    if (failedOperations.length > 0) {
      console.warn(`WordStream: Re-queuing ${failedOperations.length} failed operations`);
      pendingOperations = failedOperations;
      await savePendingOperations();
    }
  } catch (error) {
    console.error('WordStream: Error during pending operations processing:', error);
  }
}

/**
 * Get all pending operations
 * @returns Array of pending operations
 */
export function getPendingOperations(): PendingOperation[] {
  return [...pendingOperations];
}

/**
 * Check if there are any pending operations
 * @returns True if there are pending operations
 */
export function hasPendingOperations(): boolean {
  return pendingOperations.length > 0;
} 