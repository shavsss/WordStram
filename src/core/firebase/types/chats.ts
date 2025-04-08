/**
 * Type definitions for chats functionality
 */

import { FirestoreDocument } from './common';

/**
 * Chat message interface representing a single message in a chat
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Chat conversation interface representing a full chat session
 */
export interface ChatConversation extends FirestoreDocument {
  conversationId: string;  // For backwards compatibility
  videoId: string;
  videoTitle?: string;
  videoURL?: string;
  lastUpdated: string;
  messages: ChatMessage[];
} 