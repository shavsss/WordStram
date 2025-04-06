/**
 * Type definitions for user functionality
 */

/**
 * User interface representing a registered user
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

/**
 * User statistics interface
 */
export interface UserStats {
  totalWords?: number;
  totalChats?: number;
  totalNotes?: number;
  totalVideos?: number;
  lastActive?: string;
  lastChatTime?: string;
  lastWordTime?: string;
  lastNoteTime?: string;
  lastUpdated?: string;
}

/**
 * User settings interface
 */
export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  defaultSourceLanguage?: string;
  defaultTargetLanguage?: string;
  notifications?: boolean;
  autoSync?: boolean;
} 