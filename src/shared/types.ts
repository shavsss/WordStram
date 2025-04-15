/**
 * Shared Types
 * Common type definitions used across the application
 */

/**
 * Word
 * Represents a saved word with its properties
 */
export interface Word {
  id: string;
  text: string;
  translation?: string;
  pronunciation?: string;
  definition?: string;
  context?: string;
  source?: string;
  notes?: string;
  language?: string;
  tags?: string[];
  imageUrl?: string;
  audioUrl?: string;
  createdAt: number;
  updatedAt: number;
  reviewCount?: number;
  lastReviewed?: number;
  proficiency?: number; // 0-5 scale for user's knowledge of the word
}

/**
 * User stats interface
 * Tracks user learning progress
 */
export interface UserStats {
  totalWords: number;
  todayWords: number;
  streak: number;
  lastActive: string;
  learningRate?: number;
  averageDailyWords?: number;
  practiceStats?: {
    totalSessions: number;
    totalTime: number;
    successRate: number;
  };
  languageStats?: Record<string, {
    count: number;
    successRate: number;
  }>;
}

/**
 * User Settings
 */
export interface UserSettings {
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  targetLanguage: string;
  practiceReminders?: boolean;
  practiceRemindersTime?: string;
  dailyWordGoal?: number;
  autoPractice?: boolean;
  translationEngine?: 'google' | 'deepl' | 'azure';
}

/**
 * Auth User Info
 */
export interface UserInfo {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

/**
 * Note interface
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  videoId?: string;
  videoTimestamp?: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  language?: string;
}

/**
 * Chat interface
 */
export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  language?: string;
  context?: {
    videoId?: string;
    videoTitle?: string;
  };
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Game statistics interface
 */
export interface GameStats {
  id: string;
  gameType: 'flashcards' | 'matching' | 'quiz' | 'hangman';
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  date: string;
  wordIds: string[];
} 