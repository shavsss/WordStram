/**
 * Types for Chats feature
 */

import { GeminiMessage } from '@/services/gemini/gemini-service';

/**
 * Represents a conversation with AI
 */
export interface ChatConversation {
  conversationId: string;     // Unique ID for this conversation
  videoId: string;            // YouTube/Netflix video ID
  videoTitle: string;         // Video title
  videoURL: string;           // Full URL to video
  lastUpdated: string;        // ISO timestamp of last update
  messages: GeminiMessage[];  // Array of messages in this conversation
}

/**
 * Type for the chats storage object that maps conversationIds to their conversations
 */
export interface ChatsStorage {
  [conversationId: string]: ChatConversation;
}

/**
 * Type for VideoChatsMap to organize chats by videoId for easy lookup
 */
export interface VideoChatsMap {
  [videoId: string]: string[]; // Array of conversationIds for this video
}

/**
 * Export format options (same as notes for consistency)
 */
export type ExportFormat = 'docx' | 'txt' | 'md' | 'json'; 