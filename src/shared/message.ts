/**
 * WordStream Message Types
 * 
 * This file defines the types for messages used across the extension.
 * It provides type safety and documentation for all messages used in the system.
 * 
 * @version 2.0
 * @module shared/message
 */

import { MessageType } from './message-types';

/**
 * Base message interface that all message types must implement
 * @interface Message
 */
export interface Message {
  /** Message type identifier */
  type: MessageType | string;
  /** Optional success flag for responses */
  success?: boolean;
  /** Optional error message for failed operations */
  error?: string;
  /** Additional properties can be added as needed */
  [key: string]: any;
}

/**
 * Standard response interface for operations
 * @interface OperationResponse
 */
export interface OperationResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Optional error message if the operation failed */
  error?: string;
  /** Optional document ID if a document was created */
  id?: string;
}

/**
 * Authentication state message interface
 * @interface AuthStateMessage
 */
export interface AuthStateMessage extends Message {
  /** Message type for auth state messages */
  type: MessageType.AUTH_STATE_CHANGED | MessageType.AUTH_STATE;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** The authenticated user information, or null if not authenticated */
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
}

/**
 * Translation request message interface
 * @interface TranslateTextMessage
 */
export interface TranslateTextMessage extends Message {
  /** Message type for translation requests */
  type: MessageType.TRANSLATE_TEXT;
  /** Text to translate */
  text: string;
  /** Target language code (e.g., "en", "he", "es") */
  targetLang: string;
  /** Optional source language code */
  sourceLang?: string;
}

/**
 * Translation result message interface
 * @interface TranslationResultMessage
 */
export interface TranslationResultMessage extends Message {
  /** Message type for translation results */
  type: MessageType.TRANSLATION_RESULT;
  /** The original text that was translated */
  originalText: string;
  /** The translated text */
  translatedText: string;
  /** The target language code */
  targetLang: string;
  /** Whether the translation was successful */
  success: boolean;
  /** Optional error message if the translation failed */
  error?: string;
}

/**
 * Save word message interface
 * @interface SaveWordMessage
 */
export interface SaveWordMessage extends Message {
  /** Message type for saving words */
  type: MessageType.SAVE_WORD;
  /** Word data to save */
  data: {
    originalWord: string;
    targetWord: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
    url?: string;
  };
}

/**
 * Get words message interface
 * @interface GetWordsMessage
 */
export interface GetWordsMessage extends Message {
  /** Message type for getting words */
  type: MessageType.GET_WORDS;
  /** Optional maximum number of words to get */
  limit?: number;
}

/**
 * Get words response interface
 * @interface GetWordsResponse
 */
export interface GetWordsResponse extends OperationResponse {
  /** Array of word objects */
  words: Array<{
    id: string;
    originalWord: string;
    targetWord: string;
    sourceLang: string;
    targetLang: string;
    timestamp: any;
    context?: string;
    url?: string;
  }>;
}

/**
 * Save settings message interface
 * @interface SaveSettingsMessage
 */
export interface SaveSettingsMessage extends Message {
  /** Message type for saving settings */
  type: MessageType.SAVE_SETTINGS;
  /** Settings data to save */
  data: {
    enabled?: boolean;
    targetLanguage?: string;
    showTranslations?: boolean;
    autoTranslate?: boolean;
    theme?: 'light' | 'dark' | 'system';
    fontSize?: number;
    [key: string]: any;
  };
}

/**
 * Get settings message interface
 * @interface GetSettingsMessage
 */
export interface GetSettingsMessage extends Message {
  /** Message type for getting settings */
  type: MessageType.GET_SETTINGS;
}

/**
 * Get settings response interface
 * @interface GetSettingsResponse
 */
export interface GetSettingsResponse extends OperationResponse {
  /** Settings object */
  settings: {
    enabled?: boolean;
    targetLanguage?: string;
    showTranslations?: boolean;
    autoTranslate?: boolean;
    theme?: 'light' | 'dark' | 'system';
    fontSize?: number;
    [key: string]: any;
  };
}

/**
 * Gemini query message interface
 * @interface GeminiQueryMessage
 */
export interface GeminiQueryMessage extends Message {
  /** Message type for querying Gemini */
  type: MessageType.GEMINI_QUERY;
  /** Query data */
  data: {
    query: string;
    videoContext?: {
      title?: string;
      url?: string;
      transcript?: string;
    };
  };
}

/**
 * Gemini query result message interface
 * @interface GeminiQueryResultMessage
 */
export interface GeminiQueryResultMessage extends OperationResponse {
  /** Response from Gemini */
  response?: string;
  /** Whether the operation succeeded */
  success: boolean;
}

/**
 * Get Gemini history message interface
 * @interface GetGeminiHistoryMessage
 */
export interface GetGeminiHistoryMessage extends Message {
  /** Message type for getting Gemini history */
  type: MessageType.GEMINI_GET_HISTORY;
}

/**
 * Get Gemini history response interface
 * @interface GetGeminiHistoryResponse
 */
export interface GetGeminiHistoryResponse extends OperationResponse {
  /** History items */
  history: Array<{
    id: string;
    query: string;
    response: string;
    timestamp: number;
    videoContext?: {
      title?: string;
      url?: string;
    };
  }>;
}

/**
 * Save Gemini history message interface
 * @interface SaveGeminiHistoryMessage
 */
export interface SaveGeminiHistoryMessage extends Message {
  /** Message type for saving Gemini history */
  type: MessageType.GEMINI_SAVE_HISTORY;
  /** History data to save */
  data: {
    id: string;
    query: string;
    response: string;
    timestamp: number;
    videoContext?: {
      title?: string;
      url?: string;
    };
  };
}

/**
 * Clear Gemini history message interface
 * @interface ClearGeminiHistoryMessage
 */
export interface ClearGeminiHistoryMessage extends Message {
  /** Message type for clearing Gemini history */
  type: MessageType.GEMINI_CLEAR_HISTORY;
}

/**
 * Message type
 * @type {Message}
 */
export type Message = 
  | SystemMessage 
  | AuthStateMessage 
  | TranslateMessage 
  | TranslateResponse
  | GetSettingsMessage
  | SaveSettingsMessage
  | GeminiQueryMessage
  | GetGeminiHistoryMessage
  | SaveGeminiHistoryMessage
  | ClearGeminiHistoryMessage;

/**
 * Helper function to create messages of a specified type with a payload
 * @param type The message type
 * @param payload Additional message properties
 * @returns A message object
 */
export function createMessage(type: MessageType | string, payload: any = {}): Message {
  return {
    type,
    ...payload,
  };
} 