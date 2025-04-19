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
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { 
  authenticateWithGoogle, 
  initAuthListeners, 
  getCurrentUser,
  signOutUser 
} from './auth';
import { getFromLocalStorage, AUTH_STORAGE_KEY } from './storage';
import { 
  saveUserData, 
  saveUserTranslation, 
  saveNoteToFirebase, 
  getUserNotes,
  getUserTranslations,
  getUserChats,
  saveChatToFirebase
} from './firestore';
import { 
  registerMessageHandler, 
  initMessageBus, 
  broadcastToContentScripts,
  sendToPopup,
  getMessageBusStatus
} from './message-bus';
import { FIREBASE_CONFIG, MessageType } from './constants';
import { createMessage } from '../shared/message';

// Service state
const serviceState = {
  isInitialized: false,
  startTime: Date.now(),
  lastError: null as Error | null,
  errorCount: 0
};

// Log the initialization
console.log('WordStream: Background service initializing...');

// Global error handler
self.addEventListener('error', (event) => {
  serviceState.lastError = new Error(event.message);
  serviceState.errorCount++;
  console.error('WordStream: Unhandled error in background service', event);
});

// Unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  serviceState.lastError = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  serviceState.errorCount++;
  console.error('WordStream: Unhandled promise rejection in background service', event.reason);
});

// Initialize Firebase
let app, auth, db;
try {
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('WordStream: Firebase initialized successfully');
} catch (error) {
  console.error('WordStream: Error initializing Firebase', error);
  serviceState.lastError = error instanceof Error ? error : new Error(String(error));
  serviceState.errorCount++;
}

/**
 * Initialize all background services
 * @returns {Promise<boolean>} True if initialization was successful
 */
async function initializeBackgroundServices(): Promise<boolean> {
  try {
    // Prevent multiple initializations
    if (serviceState.isInitialized) {
      console.warn('WordStream: Background services already initialized');
      return true;
    }
    
    // Initialize auth listeners
    initAuthListeners();
    
    // Initialize message bus
    initMessageBus();
    
    // Register message handlers
    setupMessageHandlers();
    
    // Mark as initialized
    serviceState.isInitialized = true;
    
    console.log('WordStream: Background services initialized');
    
    // Broadcast that background is ready
    broadcastToContentScripts({
      type: MessageType.BACKGROUND_READY
    }).catch(error => {
      console.warn('WordStream: Error broadcasting ready message', error);
    });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error initializing background services', error);
    serviceState.lastError = error instanceof Error ? error : new Error(String(error));
    serviceState.errorCount++;
    return false;
  }
}

/**
 * Set up message handlers for communication with content scripts and popup
 */
function setupMessageHandlers() {
  // System messages
  registerMessageHandler(MessageType.CONTENT_SCRIPT_READY, async (message, sender) => {
    console.log('WordStream: Content script ready message received', {
      tabId: sender.tab?.id,
      url: sender.url
    });
    
    // Send current auth state to the content script that just connected
    const user = getCurrentUser();
    return createMessage(MessageType.AUTH_STATE_CHANGED, {
      isAuthenticated: !!user,
      user: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null
    });
  });
  
  registerMessageHandler(MessageType.POPUP_READY, async () => {
    console.log('WordStream: Popup ready message received');
    
    // Send current auth state to the popup
    const user = getCurrentUser();
    return createMessage(MessageType.AUTH_STATE_CHANGED, {
      isAuthenticated: !!user,
      user: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null
    });
  });

  // Auth handlers
  registerMessageHandler(MessageType.AUTHENTICATE, async () => {
    try {
      console.log('WordStream: Authentication request received');
      const user = await authenticateWithGoogle();
      return { 
        type: MessageType.SIGN_IN_RESULT,
        success: !!user,
        user: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        } : null
      };
    } catch (error) {
      console.error('WordStream: Authentication error', error);
      return { 
        type: MessageType.SIGN_IN_RESULT,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  });
  
  registerMessageHandler(MessageType.GET_AUTH_STATE, async () => {
    const user = getCurrentUser();
    return { 
      type: MessageType.AUTH_STATE,
      isAuthenticated: !!user,
      user: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null
    };
  });
  
  registerMessageHandler(MessageType.SIGN_OUT, async () => {
    try {
      await signOutUser();
      return { 
        type: MessageType.SIGN_OUT_RESULT,
        success: true 
      };
    } catch (error) {
      console.error('WordStream: Sign out error', error);
      return { 
        type: MessageType.SIGN_OUT_RESULT,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sign out error'
      };
    }
  });
  
  // Translation handlers
  registerMessageHandler(MessageType.TRANSLATE_TEXT, async (message) => {
    try {
      // In a real implementation, we would call a translation API here
      // For now, we're just returning a placeholder translation
      const translatedText = `[Translated] ${message.text}`;
      
      return createMessage(MessageType.TRANSLATION_RESULT, {
        originalText: message.text,
        translatedText: translatedText, 
        targetLang: message.targetLang,
        success: true
      });
    } catch (error) {
      console.error('WordStream: Error translating text:', error);
      return createMessage(MessageType.TRANSLATION_RESULT, {
        originalText: message.text,
        translatedText: '', 
        targetLang: message.targetLang,
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  registerMessageHandler(MessageType.SAVE_TRANSLATION, async (message) => {
    try {
      const id = await saveUserTranslation(message.data);
      return { success: true, id };
    } catch (error) {
      console.error('WordStream: Error saving translation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
  
  registerMessageHandler(MessageType.GET_TRANSLATIONS, async () => {
    try {
      const translations = await getUserTranslations();
      return { success: true, translations };
    } catch (error) {
      console.error('WordStream: Error getting translations:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  // Note handlers
  registerMessageHandler(MessageType.SAVE_NOTE, async (message) => {
    try {
      const id = await saveNoteToFirebase(message.data);
      return { success: true, id };
    } catch (error) {
      console.error('WordStream: Error saving note:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  registerMessageHandler(MessageType.GET_NOTES, async () => {
    try {
      const notes = await getUserNotes();
      return { success: true, notes };
    } catch (error) {
      console.error('WordStream: Error getting notes:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  // Chat handlers
  registerMessageHandler(MessageType.SAVE_CHAT, async (message) => {
    try {
      const id = await saveChatToFirebase(message.data);
      return { success: true, id };
    } catch (error) {
      console.error('WordStream: Error saving chat:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  registerMessageHandler(MessageType.GET_CHATS, async () => {
    try {
      const chats = await getUserChats();
      return { success: true, chats };
    } catch (error) {
      console.error('WordStream: Error getting chats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  // Settings handlers
  registerMessageHandler(MessageType.SAVE_SETTINGS, async (message) => {
    try {
      const id = await saveUserData({ settings: message.data });
      return { success: true, id };
    } catch (error) {
      console.error('WordStream: Error saving settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  // Get service health status
  registerMessageHandler('GET_SERVICE_STATUS', async () => {
    return {
      success: true,
      status: {
        ...serviceState,
        uptime: Date.now() - serviceState.startTime,
        messageBus: getMessageBusStatus(),
        isUserAuthenticated: !!getCurrentUser()
      }
    };
  });
}

// Initialize the background service when installed
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('WordStream: Extension installed or updated', details);
  
  // Initialize background services
  const success = await initializeBackgroundServices();
  
  if (success) {
    // Try to retrieve existing auth information
    const savedAuth = await getFromLocalStorage(AUTH_STORAGE_KEY);
    
    if (!savedAuth) {
      console.log('WordStream: No saved auth found');
    } else {
      console.log('WordStream: Found saved auth data');
    }
  } else {
    console.error('WordStream: Failed to initialize background services');
  }
});

// Handle first-time startup and ensure we initialize if the browser starts with the extension already installed
(async function startup() {
  console.log('WordStream: Starting up background service');
  
  // Wait a moment to ensure the browser is ready
  setTimeout(async () => {
    await initializeBackgroundServices();
  }, 500);
})();

// Restarting the service
chrome.runtime.onStartup.addListener(() => {
  console.log('WordStream: Browser startup detected, reinitializing services');
  
  // Reinitialize on browser startup
  setTimeout(async () => {
    await initializeBackgroundServices();
  }, 1000);
});

console.log('WordStream: Background script loaded'); 