/**
 * Word Types for Firebase
 * Extends the main Word type with Firebase-specific attributes
 */

import type { Word } from '../../../types/word';
import { FirestoreDocument } from './common';

// Firebase specific Word document
export interface FirebaseWordDocument extends Word, FirestoreDocument {
  userId: string;
  createdAt: string;
  updatedAt: string;
  videoId?: string;
  videoTime?: number;
}

// Collection of words keyed by ID
export interface WordsCollection {
  [id: string]: FirebaseWordDocument;
}

// Response format for word queries
export interface WordsResponse {
  words: Word[];
  total: number;
} 