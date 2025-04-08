/**
 * Notes Module Exports
 * 
 * יצוא המודולים העיקריים של אזור הפתקים
 */

// Export main components
export { NotesPanel, createNotesPanel } from './components/NotesPanel';
export { NotesAndSummaries } from './components/NotesAndSummaries';

// Export hook
export { useNotesService } from './hooks/useNotesService';

// Export service
export { notesService } from './services/notes-service';

// Export types
export type {
  Note,
  VideoNote,
  VideoWithNotes,
  NotesStorage
} from './types';

// Export constants
export {
  MAX_NOTE_LENGTH,
  MAX_TAGS_PER_NOTE,
  AUTO_SAVE_INTERVAL,
  SYNC_INTERVALS,
  STORAGE_KEYS,
  EXPORT_FORMATS,
  NOTE_ACTIONS
} from './constants'; 