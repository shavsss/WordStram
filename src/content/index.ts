/**
 * WordStream Content Script
 * 
 * This is the main entry point for the content script injected into web pages.
 * It handles communication with the background service and provides translation functionality.
 * 
 * @version 2.0
 * @module content/index
 */

import { MessageType } from '../shared/message';

// Connection state management
interface ConnectionState {
  isConnected: boolean;
  lastAttempt: number;
  retryCount: number;
  maxRetries: number;
  backoffInterval: number;
}

// Global state
const state = {
  connection: {
    isConnected: false,
    lastAttempt: 0,
    retryCount: 0,
    maxRetries: 5,
    backoffInterval: 2000 // Start with 2 seconds, will increase with backoff
  } as ConnectionState,
  settings: {
    enabled: true,
    targetLanguage: 'he'
  }
};

/**
 * Initialize the content script
 */
function initialize() {
  console.log('WordStream: Content script initializing...');
  
  // Set up message listeners
  setupMessageListeners();
  
  // Connect to background service
  connectToBackgroundService();
  
  // Set up periodic connection check (every 30 seconds)
  setInterval(checkConnection, 30000);
}

/**
 * Set up message listeners for communication with the background service
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;
    
    try {
      // Handle incoming messages
      switch (message.type) {
        case MessageType.BACKGROUND_READY:
          handleBackgroundReady();
          break;
          
        case MessageType.TRANSLATION_RESULT:
          handleTranslationResult(message);
          break;
          
        case MessageType.AUTH_STATE_CHANGED:
          handleAuthStateChanged(message);
          break;
          
        default:
          // Unknown message type
          console.log('WordStream: Received unknown message type', message.type);
          break;
      }
      
      // Required for async response handling
      return true;
    } catch (error) {
      console.error('WordStream: Error handling message', error);
      return false;
    }
  });
}

/**
 * Send a message to the background service with error handling
 * @param message The message to send
 * @returns Promise that resolves with the response
 */
function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!chrome.runtime?.id) {
      reject(new Error('Extension context invalidated'));
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        // Check for chrome runtime errors
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          // Handle specific error cases
          if (runtimeError.message?.includes('receiving end does not exist')) {
            state.connection.isConnected = false;
            connectToBackgroundService(); // Try to reconnect
          }
          console.warn('WordStream: Runtime error sending message', runtimeError);
          reject(runtimeError);
          return;
        }
        
        // Check for application-level errors
        if (response && response.error) {
          console.warn('WordStream: Application error in response', response.error);
          reject(new Error(response.error));
    return;
  }
  
        // Success case
        resolve(response);
      });
  } catch (error) {
      console.error('WordStream: Exception sending message', error);
      reject(error);
    }
  });
}

/**
 * Connect to the background service
 */
async function connectToBackgroundService() {
  // Check if extension is still valid
  if (!chrome.runtime?.id) {
    console.error('WordStream: Extension context invalidated');
    return;
  }
  
  // Prevent connection attempts if we've exceeded retry limits
  if (state.connection.retryCount >= state.connection.maxRetries) {
    console.warn('WordStream: Maximum connection retries exceeded. Will try again later.');
    
    // Reset retry count after 2 minutes to try again
    setTimeout(() => {
      state.connection.retryCount = 0;
      connectToBackgroundService();
    }, 120000);
    
    return;
  }
  
  try {
    // Update connection attempt state
    state.connection.lastAttempt = Date.now();
    state.connection.retryCount++;
    
    // Try to send a message to the background service
    const response = await sendMessage({ type: MessageType.CONTENT_SCRIPT_READY })
      .catch(error => {
        if (error.message?.includes('Extension context invalidated')) {
          console.error('WordStream: Extension context invalidated, stopping retries');
          return null;
        }
        throw error;
      });

    if (response) {
      console.log('WordStream: Successfully connected to background service');
      state.connection.isConnected = true;
      state.connection.retryCount = 0;
      
      // If this was a response with auth state, handle it
      if (response.type === MessageType.AUTH_STATE_CHANGED) {
        handleAuthStateChanged(response);
      }
    } else {
      // Use exponential backoff for retry
      const backoffTime = state.connection.backoffInterval * Math.pow(2, state.connection.retryCount - 1);
      setTimeout(() => connectToBackgroundService(), backoffTime);
    }
    } catch (error) {
    console.error('WordStream: Error connecting to background service', error);
    state.connection.isConnected = false;
    
    // Use exponential backoff for retry
    const backoffTime = state.connection.backoffInterval * Math.pow(2, state.connection.retryCount - 1);
    setTimeout(() => connectToBackgroundService(), backoffTime);
    }
}

/**
 * Check if we're still connected to the background service
 */
function checkConnection() {
  if (!state.connection.isConnected) {
    // If we're not connected, try to reconnect
    if (Date.now() - state.connection.lastAttempt > 60000) { // Don't retry if we tried recently
      state.connection.retryCount = 0; // Reset retry count for a fresh start
      connectToBackgroundService();
    }
    return;
  }
  
  // Ping the background service to check connection
  sendMessage({ type: MessageType.GET_AUTH_STATE })
    .then(response => {
      // We got a response, so we're still connected
      state.connection.isConnected = true;
    })
    .catch(error => {
      console.warn('WordStream: Connection check failed, will try to reconnect', error);
      state.connection.isConnected = false;
      state.connection.retryCount = 0; // Reset retry count for a reconnection attempt
      connectToBackgroundService();
    });
}

/**
 * Handle background service ready message
 */
function handleBackgroundReady() {
  console.log('WordStream: Background service is ready');
  state.connection.isConnected = true;
  state.connection.retryCount = 0;
  
  // Load settings from background
  sendMessage({ type: MessageType.GET_SETTINGS })
    .then(response => {
      if (response && response.success && response.settings) {
        state.settings = response.settings;
      }
    })
    .catch(error => {
      console.error('WordStream: Failed to load settings', error);
    });
}

/**
 * Handle translation result message
 */
function handleTranslationResult(message: any) {
  if (message.success) {
    console.log('WordStream: Translation received', {
      original: message.originalText,
      translated: message.translatedText,
      language: message.targetLang
    });
    
    // Here you would update the UI with the translation
    // For now, we just log it
    } else {
    console.error('WordStream: Translation failed', message.error);
  }
}

/**
 * Handle auth state changed message
 */
function handleAuthStateChanged(message: any) {
  console.log('WordStream: Auth state changed', {
    isAuthenticated: message.isAuthenticated,
    user: message.user ? message.user.email : 'none'
  });
  
  // Here you would update the UI based on auth state
}

/**
 * Request a translation from the background service
 * @param text The text to translate
 * @param targetLang The target language
 * @returns Promise that resolves with the translation result
 */
function requestTranslation(text: string, targetLang: string = state.settings.targetLanguage): Promise<any> {
  return sendMessage({
    type: MessageType.TRANSLATE_TEXT,
    text,
    targetLang
  });
}

// Initialize the content script
initialize();

// Export public API
export {
  requestTranslation
}; 