/**
 * WordStream Message Types
 * 
 * This file defines the types for messages used across the extension.
 * It provides type safety and documentation for all messages used in the system.
 * 
 * @version 2.0
 * @module shared/message
 */

import { MessageType } from '../background/constants';

// Re-export the MessageType enum
export { MessageType };

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
 * Save translation message interface
 * @interface SaveTranslationMessage
 */
export interface SaveTranslationMessage extends Message {
  /** Message type for saving translations */
  type: MessageType.SAVE_TRANSLATION;
  /** Translation data to save */
  data: {
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
    url?: string;
  };
}

/**
 * Get translations message interface
 * @interface GetTranslationsMessage
 */
export interface GetTranslationsMessage extends Message {
  /** Message type for getting translations */
  type: MessageType.GET_TRANSLATIONS;
  /** Optional maximum number of translations to get */
  limit?: number;
}

/**
 * Get translations response interface
 * @interface GetTranslationsResponse
 */
export interface GetTranslationsResponse extends OperationResponse {
  /** Array of translation objects */
  translations: Array<{
    id: string;
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    timestamp: any;
    context?: string;
    url?: string;
  }>;
}

/**
 * Save note message interface
 * @interface SaveNoteMessage
 */
export interface SaveNoteMessage extends Message {
  /** Message type for saving notes */
  type: MessageType.SAVE_NOTE;
  /** Note data to save */
  data: {
    title: string;
    content: string;
    tags?: string[];
    url?: string;
  };
}

/**
 * Get notes message interface
 * @interface GetNotesMessage
 */
export interface GetNotesMessage extends Message {
  /** Message type for getting notes */
  type: MessageType.GET_NOTES;
  /** Optional maximum number of notes to get */
  limit?: number;
}

/**
 * Get notes response interface
 * @interface GetNotesResponse
 */
export interface GetNotesResponse extends OperationResponse {
  /** Array of note objects */
  notes: Array<{
    id: string;
    title: string;
    content: string;
    timestamp: any;
    tags?: string[];
    url?: string;
  }>;
}

/**
 * Save chat message interface
 * @interface SaveChatMessage
 */
export interface SaveChatMessage extends Message {
  /** Message type for saving chats */
  type: MessageType.SAVE_CHAT;
  /** Chat data to save */
  data: {
    title: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: any;
    }>;
    context?: string;
  };
}

/**
 * Get chats message interface
 * @interface GetChatsMessage
 */
export interface GetChatsMessage extends Message {
  /** Message type for getting chats */
  type: MessageType.GET_CHATS;
  /** Optional maximum number of chats to get */
  limit?: number;
}

/**
 * Get chats response interface
 * @interface GetChatsResponse
 */
export interface GetChatsResponse extends OperationResponse {
  /** Array of chat objects */
  chats: Array<{
    id: string;
    title: string;
    timestamp: any;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: any;
    }>;
    context?: string;
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
 * Utility function to create a typed message
 * @template T Type of message to create
 * @param {MessageType|string} type Message type
 * @param {Omit<T, 'type'>} payload Message payload
 * @returns {T} Typed message object
 */
export function createMessage<T extends Message>(type: MessageType | string, payload: Omit<T, 'type'>): T {
  return {
    type,
    ...payload
  } as T;
} 