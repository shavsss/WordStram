/**
 * Broadcast messaging functionality
 * Enables communication between different browser windows/tabs
 */

import { useEffect } from 'react';
import { BroadcastMessage } from '../types';

// Helper to detect Service Worker environment 
const isServiceWorkerEnv = typeof self !== 'undefined' && typeof Window === 'undefined' && !('window' in self);

/**
 * Broadcast a message to all extension components
 * Works across different contexts (tabs, background, popup)
 */
export function broadcastMessage(message: BroadcastMessage): void {
  try {
    if (!message) {
      console.warn('WordStream: Attempted to broadcast empty message');
      return;
    }
    
    // Add timestamp if not present
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    // Save to storage for cross-context communication
    // This works in all contexts including Service Worker
    try {
      const storageKey = `wordstream_broadcast_${Date.now()}`;
      chrome.storage.local.set({ [storageKey]: messageWithTimestamp })
        .then(() => {
          // Clean up old broadcast messages after setting new one
          cleanupOldBroadcastMessages();
        })
        .catch(error => {
          console.error('WordStream: Error during storage cleanup after broadcast:', error);
        });
    } catch (storageError) {
      console.error('WordStream: Error broadcasting via storage:', storageError);
    }
    
    // Browser context: use postMessage for same-window communication
    // Only attempt this in browser context where window is available
    if (!isServiceWorkerEnv) {
      try {
        if (typeof window !== 'undefined') {
          window.postMessage(messageWithTimestamp, '*');
        }
      } catch (postMessageError) {
        console.warn('WordStream: Error using postMessage for broadcast:', postMessageError);
      }
    }
    
    // Use runtime messaging (works across all contexts)
    try {
      // Send message and ignore errors (fails silently if background isn't available)
      chrome.runtime.sendMessage(messageWithTimestamp)
        .catch(() => {
          // Silently ignore errors when background isn't active
        });
    } catch (sendError) {
      // Silently ignore errors in service worker context
    }
  } catch (error) {
    console.error('WordStream: Error in broadcastMessage:', error);
  }
}

/**
 * Clean up old broadcast messages from storage
 * Keeps only the most recent 20 messages
 */
export function cleanupOldBroadcastMessages(): void {
  try {
    // If we're in a browser context with localStorage available
    if (!isServiceWorkerEnv && typeof localStorage !== 'undefined') {
      const broadcastKeys = [];
      
      // Find all broadcast message keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('wordstream_broadcast_')) {
          broadcastKeys.push(key);
        }
      }
      
      // Sort by timestamp (most recent first)
      broadcastKeys.sort().reverse();
      
      // Remove old messages (keep only last 20)
      if (broadcastKeys.length > 20) {
        broadcastKeys.slice(20).forEach(key => localStorage.removeItem(key));
      }
    }
    
    // Also clean up chrome.storage (works in both browser and service worker)
    chrome.storage.local.get(null, (allItems) => {
      if (!allItems) return;
      
      const broadcastKeys = Object.keys(allItems)
        .filter(key => key.startsWith('wordstream_broadcast_'))
        .sort()
        .reverse();
      
      if (broadcastKeys.length > 20) {
        const keysToRemove = broadcastKeys.slice(20);
        chrome.storage.local.remove(keysToRemove);
      }
    });
  } catch (cleanupError) {
    console.warn('WordStream: Error cleaning up broadcast messages:', cleanupError);
  }
}

/**
 * Setup a listener for broadcast messages
 * Returns a cleanup function to remove the listener
 */
export function setupBroadcastListener(callback: (message: any) => void): () => void {
  // Window message listener (only in browser context)
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  
  if (!isServiceWorkerEnv && typeof window !== 'undefined') {
    messageHandler = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && 
         (event.data.action || event.data.type)) {
        callback(event.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
  }
  
  // Storage change listener
  const storageHandler = (event: StorageEvent | { key?: string; newValue?: string }) => {
    // For chrome.storage events in Service Worker
    if (!event.key && 'changes' in (event as any)) {
      const changes = (event as any).changes;
      
      for (const key in changes) {
        if (key.startsWith('wordstream_broadcast_') && changes[key].newValue) {
          try {
            const data = changes[key].newValue;
            callback(data);
          } catch (e) {
            console.error('WordStream: Error processing broadcast from storage change:', e);
          }
        }
      }
      return;
    }
    
    // For native storage events in browser context
    if (typeof event.key === 'string' && event.key.startsWith('wordstream_broadcast_')) {
      try {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        if (data) {
          callback(data);
        }
      } catch (e) {
        console.error('WordStream: Error processing broadcast message from storage event:', e);
      }
    }
  };
  
  // Add listeners (only in browser context)
  if (!isServiceWorkerEnv && typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }
  
  // Also listen to chrome.storage changes (works in all contexts)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      for (const key in changes) {
        if (key.startsWith('wordstream_broadcast_') && changes[key].newValue) {
          try {
            callback(changes[key].newValue);
          } catch (e) {
            console.error('WordStream: Error processing broadcast from chrome.storage:', e);
          }
        }
      }
    }
  });
  
  // Return cleanup function
  return () => {
    if (messageHandler && !isServiceWorkerEnv && typeof window !== 'undefined') {
      window.removeEventListener('message', messageHandler);
    }
    
    if (!isServiceWorkerEnv && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
    
    try {
      chrome.storage.onChanged.removeListener(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
  };
}

/**
 * React hook for listening to broadcast messages
 * @param callback Function to call when a message is received
 */
export function useBroadcastListener(callback: (message: any) => void): void {
  useEffect(() => {
    // Set up the broadcast listener
    const removeListener = setupBroadcastListener(callback);
    
    // Clean up the listener when the component unmounts
    return removeListener;
  }, [callback]);
} 