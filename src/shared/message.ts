/**
 * Message types for communication between background, content scripts and popup
 */
export enum MessageType {
  // Auth messages
  SIGN_IN_WITH_GOOGLE = 'SIGN_IN_WITH_GOOGLE',
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
  SAVE_TRANSLATION_RESULT = 'SAVE_TRANSLATION_RESULT',
  TRANSLATIONS_UPDATED = 'TRANSLATIONS_UPDATED',
  
  // Notes messages
  SAVE_NOTE = 'SAVE_NOTE',
  SAVE_NOTE_RESULT = 'SAVE_NOTE_RESULT',
  NOTES_UPDATED = 'NOTES_UPDATED',
  
  // Gemini messages
  GET_GEMINI_RESPONSE = 'GET_GEMINI_RESPONSE',
  GEMINI_RESPONSE = 'GEMINI_RESPONSE',
  
  // System messages
  BACKGROUND_READY = 'BACKGROUND_READY'
}

/**
 * Base message interface
 */
export interface Message {
  type: MessageType;
  [key: string]: any;
}

/**
 * Standard response message with success/error
 */
export interface ResponseMessage extends Message {
  success?: boolean;
  error?: string;
}

/**
 * Message for translation requests
 */
export interface TranslateTextMessage extends Message {
  type: MessageType.TRANSLATE_TEXT;
  text: string;
  targetLang: string;
}

/**
 * Message for translation results
 */
export interface TranslationResultMessage extends ResponseMessage {
  type: MessageType.TRANSLATION_RESULT;
  translation?: string;
  detectedSourceLanguage?: string;
}

/**
 * Message for authentication state
 */
export interface AuthStateMessage extends Message {
  type: MessageType.AUTH_STATE | MessageType.AUTH_STATE_CHANGED;
  isAuthenticated: boolean;
  user: any | null;
}

/**
 * Message for Gemini requests
 */
export interface GeminiRequestMessage extends Message {
  type: MessageType.GET_GEMINI_RESPONSE;
  query: string;
  history?: any[];
  context?: any;
}

/**
 * Message for Gemini responses
 */
export interface GeminiResponseMessage extends ResponseMessage {
  type: MessageType.GEMINI_RESPONSE;
  content?: string;
} 