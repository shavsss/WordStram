/**
 * Chat Types
 * Defines all chat-related interfaces and types
 */

/**
 * Chat role type
 */
export type ChatRole = 'user' | 'system' | 'assistant';

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  role: ChatRole;
  createdAt: any; // Firestore timestamp or ISO string
  metadata?: Record<string, any>;
}

/**
 * Chat interface
 */
export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: any; // Firestore timestamp or ISO string
  updatedAt: any; // Firestore timestamp or ISO string
  lastMessageContent?: string;
  lastMessageRole?: ChatRole;
  isArchived?: boolean;
  metadata?: Record<string, any>;
} 