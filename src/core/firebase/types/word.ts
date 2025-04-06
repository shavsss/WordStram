/**
 * Word Types
 * Defines all word-related interfaces and types
 */

/**
 * Word interface
 */
export interface Word {
  id: string;
  userId: string;
  originalWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  videoId?: string;
  videoTime?: number;
  definition?: string;
  pronunciation?: string;
  examples?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastReviewed?: any; // Firestore timestamp or ISO string
  proficiency?: number; // 0-5 scale
  tags?: string[];
  isFavorite?: boolean;
  metadata?: Record<string, any>;
  timestamp: string;
  mediaUrl?: string;
  frequency?: number;
  mastery?: number;
} 