/**
 * Notes Constants
 * 
 * קבועים למודול הפתקים
 */

/**
 * Maximum length for note content in characters
 */
export const MAX_NOTE_LENGTH = 5000;

/**
 * Maximum number of tags per note
 */
export const MAX_TAGS_PER_NOTE = 10;

/**
 * Default auto-save interval in milliseconds
 */
export const AUTO_SAVE_INTERVAL = 2000;

/**
 * Sync intervals with cloud
 */
export const SYNC_INTERVALS = {
  AUTO: 60000, // 1 minute auto-sync
  RETRY: 5000, // retry after 5 seconds on failure
  MAX_RETRIES: 3, // maximum number of retries
};

/**
 * Animation durations
 */
export const ANIMATION_DURATIONS = {
  FADE: 300,
  SLIDE: 500,
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  NOTES: 'wordstream-notes',
  LAST_SYNCED: 'wordstream-notes-last-synced',
  DRAFT: 'wordstream-notes-draft',
};

/**
 * Export file formats
 */
export const EXPORT_FORMATS = {
  DOCX: 'docx',
  TXT: 'txt',
  HTML: 'html',
  JSON: 'json',
} as const;

/**
 * Note actions
 */
export const NOTE_ACTIONS = {
  ADD: 'NOTE_ADDED',
  UPDATE: 'NOTE_UPDATED',
  DELETE: 'NOTE_DELETED',
  SYNC: 'NOTES_SYNCED',
} as const; 