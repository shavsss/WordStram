/**
 * Types for notes features
 */

/**
 * Options for exporting notes
 */
export interface ExportOptions {
  format: 'docx' | 'txt' | 'pdf' | 'md' | 'json';
  includeTimestamps?: boolean;
  includeVideoInfo?: boolean;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean;
  data?: string | Blob;
  filename?: string;
  error?: string;
}

/**
 * Basic note structure
 */
export interface VideoNote {
  id: string;
  content: string;
  timestamp: string;
  videoTime?: number;
  videoId: string;
  videoTitle?: string;
  formattedTime?: string;
  lastSynced?: string;
}

/**
 * Video with associated notes
 */
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL?: string;
  lastUpdated?: string;
  lastViewed?: string;
  thumbnailURL?: string;
  platform?: string;
  notes: VideoNote[];
}

/**
 * Storage structure for notes
 */
export interface NotesStorage {
  [videoId: string]: VideoWithNotes;
}

/**
 * Export format options
 */
export type ExportFormat = 'docx' | 'txt' | 'pdf' | 'md' | 'json'; 