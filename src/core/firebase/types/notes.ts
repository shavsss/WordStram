/**
 * Type definitions for notes functionality
 */

import { FirestoreDocument } from './common';

/**
 * Note interface representing a user note for a video
 */
export interface Note extends FirestoreDocument {
  content: string;
  videoId: string;
  videoTitle?: string;
  videoURL?: string;
  videoTime?: number;
  timestamp: string;
  lastSynced?: string;
  labels?: string[];
  isImportant?: boolean;
}

/**
 * Video metadata structure
 */
export interface VideoMetadata {
  videoId: string;
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  createdAt?: string;
  lastUpdated?: string;
  noteCount?: number;
  noteIds?: Record<string, boolean>;
}

/**
 * Video with notes structure for storage
 */
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL: string;
  lastUpdated?: string;
  notes: Note[];
} 