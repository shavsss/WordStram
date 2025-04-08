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
  formattedTime?: string; // Formatted time for display
}

// Video note with additional formatting
export interface VideoNote extends Note {
  formattedTime: string; // HH:MM:SS format
}

// Video with associated notes
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL: string;
  lastUpdated: string; // ISO string
  notes: VideoNote[];
}

// Storage structure for notes
export interface NotesStorage {
  [videoId: string]: VideoWithNotes;
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