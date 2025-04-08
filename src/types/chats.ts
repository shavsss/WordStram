/**
 * Types for Chats feature
 */

import { GeminiMessage } from '@/services/gemini/gemini-service';

/**
 * Represents a single message in a chat conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'; // System for introductory messages or warnings
  content: string;
  timestamp: string;
}

/**
 * Represents a single chat conversation
 */
export interface ChatConversation {
  conversationId: string;
  id?: string;
  videoId: string;
  videoTitle: string;
  videoURL: string;
  userId?: string;
  lastUpdated: string;
  messages: ChatMessage[];
}

/**
 * Mapping of conversation IDs to chat conversations
 */
export interface ChatsStorage {
  [conversationId: string]: ChatConversation;
}

/**
 * Mapping of video IDs to conversation IDs
 */
export interface VideoChatsMap {
  [videoId: string]: string[]; // Array of conversation IDs
}

/**
 * Format options for exporting chat conversations
 */
export enum ExportFormat {
  TEXT = 'text',
  HTML = 'html',
  DOCX = 'docx',
  JSON = 'json'
}

/**
 * Options for chat export
 */
export interface ExportOptions {
  format: ExportFormat;
  includeTimestamps?: boolean;
  includeVideoInfo?: boolean;
  includeUserInfo?: boolean;
}

/**
 * Result of a chat export operation
 */
export interface ExportResult {
  success: boolean;
  data?: string | Blob;
  filename?: string;
  error?: string;
}

/**
 * Filters for chat search and filtering
 */
export interface ChatFilters {
  videoId?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  searchText?: string;
} 