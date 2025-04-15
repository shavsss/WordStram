/**
 * Notes Module Types
 * Defines interfaces for the notes functionality
 */

/**
 * Basic Note interface
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  userId: string;
  aiGenerated?: boolean;
}

/**
 * Video Note extends the basic Note with video-specific fields
 */
export interface VideoNote extends Note {
  videoId: string;
  videoTitle: string;
  videoURL?: string;
  videoTime?: number; // in seconds
  videoThumbnail?: string;
  sourceUrl?: string;
  timestamp?: number;
}

/**
 * Video with associated notes
 */
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL: string;
  lastUpdated: string; // ISO date string
  notes: VideoNote[];
  videoThumbnail?: string;
}

/**
 * Notes storage interface for local storage
 */
export interface NotesStorage {
  videos: VideoWithNotes[];
  lastSync?: string; // ISO date string
} 