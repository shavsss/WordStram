/**
 * Broadcast messaging functionality
 * Enables communication between different browser windows/tabs
 */

import { useEffect } from 'react';
import { BroadcastMessage } from '../types';

/**
 * Send a message to all open windows and store in localStorage
 * @param message The message to broadcast
 */
export function broadcastMessage(message: BroadcastMessage): void {
  try {
    // Ensure a timestamp is included
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().getTime()
    };
    
    console.log('WordStream: Broadcasting message:', messageWithTimestamp);
    
    // Send via postMessage if window is available
    if (typeof window !== 'undefined') {
      window.postMessage(messageWithTimestamp, '*');
      
      // Also save to localStorage for other tabs to pick up
      const timestamp = new Date().getTime();
      const broadcastKey = `wordstream_broadcast_${timestamp}`;
      
      localStorage.setItem(broadcastKey, JSON.stringify(messageWithTimestamp));
      
      // Clean up old broadcast messages
      cleanupOldBroadcastMessages();
    }
  } catch (error) {
    console.error('WordStream: Error broadcasting message:', error);
  }
}

/**
 * Clean up old broadcast messages from localStorage
 * Keeps only the most recent 20 messages
 */
export function cleanupOldBroadcastMessages(): void {
  try {
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
  } catch (cleanupError) {
    console.warn('WordStream: Error cleaning up broadcast messages:', cleanupError);
  }
}

/**
 * Set up listeners for broadcast messages from other tabs/windows
 * @param callback Function to call when a message is received
 * @returns A function to remove the listeners
 */
export function setupBroadcastListener(callback: (message: any) => void): () => void {
  try {
    // Handle messages from postMessage
    const messageHandler = (event: MessageEvent) => {
      // Only process WordStream messages
      if (event.data && 
          (event.data.action && event.data.action.startsWith('WORDS') || 
           event.data.action && event.data.action.startsWith('NOTES') ||
           event.data.action && event.data.action.startsWith('CHATS') ||
           event.data.action && event.data.action.startsWith('STATS') ||
           event.data.action && event.data.action.startsWith('NOTE_'))) {
        callback(event.data);
      }
    };
    
    // Listen for window messages
    window.addEventListener('message', messageHandler);
    
    // Also listen for storage events to get messages from other tabs
    const storageHandler = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('wordstream_broadcast_') && event.newValue) {
        try {
          const message = JSON.parse(event.newValue);
          callback(message);
        } catch (parseError) {
          console.warn('WordStream: Error parsing broadcast message:', parseError);
        }
      }
    };
    
    window.addEventListener('storage', storageHandler);
    
    // Return function to remove listeners
    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
    };
  } catch (error) {
    console.error('WordStream: Error setting up broadcast listener:', error);
    return () => {}; // Return empty cleanup function
  }
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