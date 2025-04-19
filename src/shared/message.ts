/**
 * Message Types
 */
export enum MessageType {
  // General messages
  READY = 'READY',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  
  // Content script messages
  CONTENT_READY = 'CONTENT_READY',
  CONTENT_CLOSED = 'CONTENT_CLOSED',
  
  // Popup messages
  POPUP_READY = 'POPUP_READY',
  POPUP_CLOSED = 'POPUP_CLOSED',
  
  // Word tracking messages
  WORD_SELECTED = 'WORD_SELECTED',
  WORD_TRANSLATED = 'WORD_TRANSLATED',
  WORD_SAVED = 'WORD_SAVED',
  
  // Settings messages
  GET_SETTINGS = 'GET_SETTINGS',
  SET_SETTINGS = 'SET_SETTINGS',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  
  // AI messages
  AI_REQUEST = 'AI_REQUEST',
  AI_RESPONSE = 'AI_RESPONSE',
  
  // Authentication messages
  AUTH_STATE_CHANGED = 'AUTH_STATE_CHANGED',
  AUTH_REQUEST = 'AUTH_REQUEST',
  AUTH_RESPONSE = 'AUTH_RESPONSE'
}

/**
 * Base Message Interface
 */
export interface Message {
  type: string;
  data?: any;
  error?: string;
  timestamp?: number;
}

/**
 * Create a new message
 */
export function createMessage(type: string, data?: any): Message {
  return {
    type,
    data,
    timestamp: Date.now()
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(type: string, error: string, data?: any): Message {
  return {
    type,
    data,
    error,
    timestamp: Date.now()
  };
} 