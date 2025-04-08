/**
 * Type definitions for the video notes feature
 */

// Note item data structure
export interface Note {
  id: string;
  content: string;
  timestamp: string; // ISO string
  videoTime?: number; // Time in the video (seconds)
  lastSynced?: string; // For sync tracking
  videoId?: string; // ID of the video the note belongs to
  formattedTime?: string; // Optional pre-formatted time string
}

// Props for the NotesPanel component
export interface NotesPanelProps {
  videoId: string;
  videoTitle: string;
  isVisible: boolean;
  onClose: () => void;
  currentTime?: number; // Current video time in seconds
}

// Props for the NoteItem component
export interface NoteItemProps {
  note: Note;
  onDelete: (id: string) => void;
  onJumpToTime: (time?: number) => void;
  formatVideoTime: (seconds?: number) => string;
  isDarkMode: boolean;
}

// Panel sizing options
export type SizeOption = 'small' | 'medium' | 'large';

export interface SizeConfig {
  width: number;
  height: number;
}

export const SIZES: Record<SizeOption, SizeConfig> = {
  small: { width: 320, height: 400 },
  medium: { width: 400, height: 550 },
  large: { width: 500, height: 700 }
}; 

// Video notes hook options
export interface UseVideoNotesOptions {
  videoId: string;
  currentTime?: number;
}

// Synchronization result type
export interface NoteSyncResult {
  success: boolean;
  notes?: Note[];
  error?: string;
}

/**
 * Represents a note with video metadata
 */
export interface VideoNote {
  id: string;
  content: string;
  timestamp: string;
  videoTime?: number;
  videoId: string;
  videoTitle?: string;
  lastSynced?: string;
  formattedTime?: string;
}

/**
 * Represents a video with its associated notes
 */
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL?: string;
  thumbnailURL?: string;
  lastViewed?: string;
  lastUpdated?: string;
  notes: VideoNote[];
}

/**
 * Storage interface for notes
 */
export interface NotesStorage {
  [videoId: string]: VideoWithNotes;
}

/**
 * Format options for exporting notes
 */
export type ExportFormat = 'docx' | 'txt' | 'html' | 'json'; 