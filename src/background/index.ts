/**
 * WordStream Background Service Worker
 * 
 * This is the main entry point for the background service worker.
 * It initializes Firebase, sets up message handlers, and manages authentication,
 * translation, and data storage functionality.
 * 
 * @version 2.0
 * @module background/index
 */

import { initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from '../config/firebase';
import { MESSAGE_PORT_NAME, MessageType } from '../shared/message-types';
import { TranslationMessageType } from '../shared/messages';
import authService from '../services/auth/auth-service';
import storageService from '../services/storage/storage-service';
import handleTranslationMessage from './handlers/translation';
import { 
  handleGeminiQuery, 
  handleGetGeminiHistory, 
  handleSaveGeminiHistory, 
  handleClearGeminiHistory 
} from './handlers/gemini';

// Service state
interface ServiceState {
  isInitialized: boolean;
  startTime: number;
  lastError: Error | null;
  errorCount: number;
}

const state: ServiceState = {
  isInitialized: false,
  startTime: Date.now(),
  lastError: null,
  errorCount: 0
};

// CRITICAL: Register a direct message listener immediately to handle messages
// before the full initialization completes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('WordStream: Received direct message:', message?.type);
  
  // If the background is not yet initialized, respond with a standardized message
  if (!state.isInitialized && message?.type !== MessageType.SYSTEM_GET_STATUS && message?.type !== MessageType.GET_AUTH_STATE) {
    console.log('WordStream: Background not yet initialized, queueing or providing defaults');
    
    // Handle certain messages with defaults even before full initialization
    if (message?.type === MessageType.GET_SETTINGS) {
      sendResponse({
        success: true,
        settings: {
          enableTranslation: true,
          showHighlights: true,
          targetLanguage: 'en',
          highlightColor: 'rgba(100, 181, 246, 0.3)',
          autoSave: false
        }
      });
      return true;
    }
    
    if (message?.type === MessageType.GET_AUTH_STATE) {
      // Always respond to auth state requests, even during initialization
      const user = authService.getCurrentUser();
      sendResponse({
        success: true,
        isAuthenticated: !!user,
        user: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        } : null
      });
      return true;
    }
    
    // For other messages, inform about initialization status
    sendResponse({
      success: false,
      error: 'Service worker still initializing',
      initializing: true
    });
    return true;
  }
  
  // Otherwise, let the regular message handler system take over
  // Return true to indicate we'll handle the response asynchronously
  return true;
});

// Keep the service worker alive using an alarm
function setupKeepAlive() {
  // Create an alarm that fires every 25 seconds
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
  
  // Listen for the alarm
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
      console.log('WordStream: Keep-alive ping');
    }
  });
}

// Set up keep-alive immediately
setupKeepAlive();

/**
 * Initialize the background service worker
 */
async function initialize() {
  try {
    console.log('Initializing WordStream background service worker...');
    
    // Initialize Firebase
    console.log('Initializing Firebase...');
    initializeApp(FIREBASE_CONFIG);
    console.log('Firebase initialized.');
    
    // Initialize services
    console.log('Initializing services...');
    await storageService.init();
    await authService.init();
    console.log('Services initialized.');
    
    // Register message handlers
    console.log('Registering message handlers...');
    registerMessageHandlers();
    console.log('Message handlers registered.');
    
    // Set initialization flag
    state.isInitialized = true;
    console.log(`WordStream background service worker initialized in ${Date.now() - state.startTime}ms.`);
    
    // Send initialization message to any connected clients
    broadcastMessage({
      type: MessageType.SYSTEM_INITIALIZED,
      payload: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    state.lastError = error instanceof Error ? error : new Error('Unknown error');
    state.errorCount++;
    console.error('Error initializing background service worker:', error);
  }
}

/**
 * Register message handlers for communication with other extension contexts
 */
function registerMessageHandlers() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== MESSAGE_PORT_NAME) {
      console.warn(`Unknown port connected: ${port.name}`);
      return;
    }
    
    console.log('Client connected to message port.');
    
    // Listen for messages
    port.onMessage.addListener(async (message) => {
      try {
        const { type } = message;
        console.log(`Received message: ${type}`);
        
        let response;
        
        // Handle messages by type
        switch (type) {
          case MessageType.SYSTEM_GET_STATUS:
            response = {
              type: MessageType.SYSTEM_STATUS,
              payload: {
                isInitialized: state.isInitialized,
                startTime: state.startTime,
                currentTime: Date.now(),
                lastError: state.lastError ? state.lastError.message : null,
                errorCount: state.errorCount
              }
            };
            break;
            
          // Translation messages
          case TranslationMessageType.TRANSLATE_WORD:
          case TranslationMessageType.SAVE_WORD:
          case TranslationMessageType.GET_WORDS:
          case TranslationMessageType.DELETE_WORD:
            const translationResult = await handleTranslationMessage(message);
            response = {
              type: `${type}_RESULT`,
              payload: translationResult
            };
            break;
            
          // Gemini AI messages
          case MessageType.GEMINI_QUERY:
            response = {
              type: MessageType.GEMINI_QUERY_RESULT,
              payload: await handleGeminiQuery(message)
            };
            break;
            
          case MessageType.GEMINI_GET_HISTORY:
            response = {
              type: MessageType.GEMINI_GET_HISTORY + '_RESULT',
              payload: await handleGetGeminiHistory()
            };
            break;
            
          case MessageType.GEMINI_SAVE_HISTORY:
            response = {
              type: MessageType.GEMINI_SAVE_HISTORY + '_RESULT',
              payload: await handleSaveGeminiHistory(message)
            };
            break;
            
          case MessageType.GEMINI_CLEAR_HISTORY:
            response = {
              type: MessageType.GEMINI_CLEAR_HISTORY + '_RESULT',
              payload: await handleClearGeminiHistory()
            };
            break;
            
          // Auth messages
          case MessageType.AUTH_SIGN_IN:
            response = {
              type: MessageType.AUTH_SIGN_IN_RESULT,
              payload: await handleAuthSignIn(message)
            };
            break;
            
          case MessageType.AUTH_SIGN_OUT:
            response = {
              type: MessageType.AUTH_SIGN_OUT_RESULT,
              payload: await handleAuthSignOut()
            };
            break;
            
          case MessageType.GET_AUTH_STATE:
            response = {
              type: MessageType.AUTH_STATE,
              payload: await handleAuthGetUser()
            };
            break;
            
          // Settings messages
          case MessageType.GET_SETTINGS:
            response = {
              type: MessageType.SETTINGS_GET_RESULT,
              payload: await handleGetSettings()
            };
            break;
            
          case MessageType.SAVE_SETTINGS:
            response = {
              type: MessageType.SETTINGS_SAVE_RESULT,
              payload: await handleSaveSettings(message)
            };
            break;
            
          // Game stats messages
          case MessageType.GET_GAME_STATS:
            response = {
              type: MessageType.GAME_STATS_GET_RESULT,
              payload: await handleGetGameStats(message)
            };
            break;
            
          case MessageType.SAVE_GAME_STATS:
            response = {
              type: MessageType.GAME_STATS_UPDATE_RESULT,
              payload: await handleUpdateGameStats(message)
            };
            break;
            
          default:
            response = {
              type: 'ERROR',
              payload: {
                success: false,
                error: `Unknown message type: ${type}`
              }
            };
        }
        
        // Send response back through the port
        if (response) {
          port.postMessage(response);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        port.postMessage({
          type: 'ERROR',
          payload: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });
    
    // Handle disconnection
    port.onDisconnect.addListener(() => {
      console.log('Client disconnected from message port.');
    });
  });
  
  // Also register a standard (non-port) message listener for simpler messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // For messages that need a quick response and don't need the persistent connection
    switch (message.type) {
      case MessageType.GET_AUTH_STATE:
        handleAuthGetUser().then(result => {
          sendResponse({
            success: true,
            isAuthenticated: result.isAuthenticated,
            user: result.user
          });
        }).catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });
        return true; // Keep message channel open for async response
        
      case MessageType.AUTH_SIGN_IN:
        handleAuthSignIn(message).then(result => {
          sendResponse({
            success: true,
            ...result
          });
        }).catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });
        return true;
        
      case MessageType.AUTH_SIGN_OUT:
        handleAuthSignOut().then(result => {
          sendResponse({
            success: true,
            ...result
          });
        }).catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });
        return true;
    }
  });
}

// Initialize the background service worker
initialize();

// Helper function to broadcast a message to all connected clients
function broadcastMessage(message: any) {
  chrome.runtime.sendMessage(message).catch(error => {
    // Suppress errors about receiving end not existing
    if (!error.message.includes('receiving end does not exist')) {
      console.error('Error broadcasting message:', error);
    }
  });
}

async function handleAuthSignIn(message: any): Promise<any> {
  try {
    const { email, password, provider, method } = message.payload || message.data || {};
    
    let user;
    if (provider === 'google' || method === 'google') {
      user = await authService.signInWithGoogle();
    } else {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      user = await authService.signIn(email, password);
    }
    
    if (!user) {
      throw new Error('Sign-in failed');
    }
    
    return { 
      success: true, 
      isAuthenticated: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };
  } catch (error) {
    console.error('WordStream: Error signing in:', error);
    return { 
      success: false, 
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error during sign-in'
    };
  }
}

async function handleAuthSignOut(): Promise<any> {
  try {
    await authService.signOut();
    return { 
      success: true,
      isAuthenticated: false,
      user: null
    };
  } catch (error) {
    console.error('WordStream: Error signing out:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during sign-out'
    };
  }
}

async function handleAuthGetUser(): Promise<any> {
  try {
    const authState = await authService.getAuthState();
    return { 
      success: true,
      ...authState
    };
  } catch (error) {
    console.error('WordStream: Error getting auth state:', error);
    return { 
      success: false, 
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error getting auth state'
    };
  }
}

async function handleGetSettings(): Promise<any> {
  try {
    const settings = await storageService.getSettings();
    return { 
      success: true, 
      settings 
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error getting settings'
    };
  }
}

async function handleSaveSettings(message: any): Promise<any> {
  try {
    const { settings } = message.payload || {};
    if (!settings) {
      throw new Error('Settings object is required');
    }
    
    await storageService.saveSettings(settings);
    
    // Broadcast settings update to all clients
    broadcastMessage({
      type: MessageType.SETTINGS_UPDATED,
      payload: { settings }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error saving settings'
    };
  }
}

async function handleGetGameStats(message: any): Promise<any> {
  try {
    const { gameType } = message.payload || {};
    if (!gameType) {
      throw new Error('Game type is required');
    }
    
    const stats = await storageService.getGameStats(gameType);
    return { 
      success: true, 
      stats 
    };
  } catch (error) {
    console.error('Error getting game stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error getting game stats'
    };
  }
}

async function handleUpdateGameStats(message: any): Promise<any> {
  try {
    const { gameType, stats } = message.payload || {};
    if (!gameType || !stats) {
      throw new Error('Game type and stats are required');
    }
    
    await storageService.saveGameStats(gameType, stats);
    return { success: true };
  } catch (error) {
    console.error('Error updating game stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error updating game stats'
    };
  }
} 