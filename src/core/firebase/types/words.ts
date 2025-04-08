/**
 * Type definitions for words functionality
 */

import { FirestoreDocument } from './common';

/**
 * Word interface representing a saved word
 */
export interface Word extends FirestoreDocument {
  originalWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  definition?: string;
  phonetic?: string;
  partOfSpeech?: string;
  examples?: string[];
  synonyms?: string[];
  isFavorite?: boolean;
  reviewCount?: number;
  lastReviewed?: string;
} 