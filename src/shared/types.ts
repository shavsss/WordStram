/**
 * Saved word type that represents a word saved by the user
 */
export interface SavedWord {
  id: string;
  text: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  timestamp: number;
}

export interface VocabWord {
  id: string;
  text: string;
  translation: string;
  language: string;
  timestamp: number;
  context?: string;
}

/**
 * User interface representing an authenticated user
 */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  providerId: string;
} 