/**
 * Types for Notes & Summaries feature
 */

/**
 * Represents a single note taken on a video
 */
export interface VideoNote {
  id: string;                 // Unique identifier
  content: string;            // Note content
  timestamp: string;          // ISO timestamp when the note was created
  videoTime?: number;         // Time in video when note was taken (seconds)
  formattedTime?: string;     // Formatted video time (MM:SS)
}

/**
 * Represents a video with notes
 */
export interface VideoWithNotes {
  videoId: string;            // YouTube/Netflix video ID
  videoTitle: string;         // Video title
  videoURL: string;           // Full URL to video
  lastUpdated: string;        // ISO timestamp of last update
  notes: VideoNote[];         // Array of notes for this video
}

/**
 * Type for the notes storage object that maps videoIds to their notes
 */
export interface NotesStorage {
  [videoId: string]: VideoWithNotes;
}

/**
 * Export format options
 */
export type ExportFormat = 'docx' | 'txt' | 'md' | 'json'; 