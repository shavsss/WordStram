/**
 * Type definitions for WordStream
 */

/**
 * Word representation
 */
export interface Word {
  id: string;
  originalWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  timestamp: string;
  notes?: string;
  examples?: string[];
  favorite?: boolean;
  mastery?: number; // 0-100 indicating mastery level
  lastPracticed?: string;
}

/**
 * User settings
 */
export interface Settings {
  targetLanguage: string;
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  showTranslations: boolean;
  // Additional settings can be added here
}

/**
 * Game statistics
 */
export interface GameStats {
  gameType: string;
  lastPlayed: string;
  highScore: number;
  totalPlayed: number;
  averageScore: number;
  lastUpdated?: string;
  history: {
    date: string;
    score: number;
  }[];
}

/**
 * User type
 */
export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  refreshToken?: string;
}

/**
 * Video context
 */
export interface VideoContext {
  title?: string;
  url?: string;
  timestamp?: number;
  channelName?: string;
  description?: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

/**
 * Caption detector interface
 */
export interface CaptionDetector {
  source: string;
  detect(): Promise<HTMLElement | null>;
  processCaption(caption: HTMLElement): void;
  cleanup?(): void;
} 