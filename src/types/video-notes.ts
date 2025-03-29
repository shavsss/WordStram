/**
 * Type definitions for the video notes feature
 */

// Note item data structure
export interface Note {
  id: string;
  content: string;
  timestamp: string; // ISO date string
  videoTime?: number; // Time in the video (seconds)
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