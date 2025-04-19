/**
 * WordStream Constants
 * 
 * This file contains constants used throughout the extension,
 * including message types for the message bus and Firebase configuration.
 * 
 * @version 2.0
 * @module background/constants
 */

/**
 * Message types for communication between components
 */
export enum MessageType {
  // System messages
  BACKGROUND_READY = 'BACKGROUND_READY',
  CONTENT_SCRIPT_READY = 'CONTENT_SCRIPT_READY',
  POPUP_READY = 'POPUP_READY',
  
  // Auth messages
  AUTHENTICATE = 'AUTHENTICATE',
  SIGN_IN_RESULT = 'SIGN_IN_RESULT',
  SIGN_OUT = 'SIGN_OUT',
  SIGN_OUT_RESULT = 'SIGN_OUT_RESULT',
  GET_AUTH_STATE = 'GET_AUTH_STATE',
  AUTH_STATE = 'AUTH_STATE',
  AUTH_STATE_CHANGED = 'AUTH_STATE_CHANGED',
  
  // Translation messages
  TRANSLATE_TEXT = 'TRANSLATE_TEXT',
  TRANSLATION_RESULT = 'TRANSLATION_RESULT',
  SAVE_TRANSLATION = 'SAVE_TRANSLATION',
  GET_TRANSLATIONS = 'GET_TRANSLATIONS',
  
  // Notes messages
  SAVE_NOTE = 'SAVE_NOTE',
  GET_NOTES = 'GET_NOTES',
  
  // Chat messages
  SAVE_CHAT = 'SAVE_CHAT',
  GET_CHATS = 'GET_CHATS',
  
  // Settings messages
  SAVE_SETTINGS = 'SAVE_SETTINGS',
  GET_SETTINGS = 'GET_SETTINGS',
  
  // Service status
  GET_SERVICE_STATUS = 'GET_SERVICE_STATUS',
  SERVICE_STATUS = 'SERVICE_STATUS'
}

/**
 * Firebase configuration
 * Replace with your own Firebase project config
 */
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

/**
 * Default settings for the extension
 */
export const DEFAULT_SETTINGS = {
  targetLanguage: 'en',
  autoTranslate: false,
  saveHistory: true,
  theme: 'light'
};

/**
 * Connection settings
 */
export const CONNECTION_CONFIG = {
  maxRetries: 5,
  initialBackoffMs: 100,
  maxBackoffMs: 10000,
  backoffMultiplier: 1.5,
  healthCheckIntervalMs: 60000, // 1 minute
};

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  AUTH: 'wordstream_auth',
  SETTINGS: 'wordstream_settings',
  USER_DATA: 'wordstream_user_data'
}; 