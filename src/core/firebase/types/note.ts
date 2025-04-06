/**
 * Note Types
 * Defines all note-related interfaces and types
 */

/**
 * Video metadata interface
 */
export interface VideoMetadata {
  videoId: string;
  title?: string;
  thumbnail?: string;
  channelTitle?: string;
  channelId?: string;
  publishDate?: string;
}

/**
 * Note interface
 */
export interface Note {
  id: string;
  userId: string;
  content: string;
  videoId?: string;
  videoTime?: number;
  videoTitle?: string;
  videoThumbnail?: string;
  language?: string;
  createdAt: any; // Firestore timestamp or ISO string
  updatedAt: any; // Firestore timestamp or ISO string
  isPublic?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Video with notes interface
 */
export interface VideoWithNotes {
  metadata: VideoMetadata;
  notes: Note[];
} 