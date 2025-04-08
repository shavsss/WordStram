/**
 * Vocabulary Types
 * טיפוסים למודול אוצר המילים
 */

/**
 * Interface for a vocabulary word
 */
export interface Word {
  id: string;
  word: string; // המילה המקורית
  translation: string; // התרגום
  context?: WordContext; // הקשר המילה
  timestamp: number; // חותמת זמן כמספר (לא כמחרוזת)
  language: string; // שפת המקור
  targetLanguage: string; // שפת היעד
  favorite?: boolean; // האם מסומנת כמועדפת
  tags?: string[]; // תגיות
  lastReviewed?: number; // מועד תרגול אחרון
  reviewCount?: number; // מספר פעמים שתורגל
  difficulty?: 'easy' | 'medium' | 'hard'; // רמת קושי
  notes?: string; // הערות
}

/**
 * Context for a word
 */
export interface WordContext {
  source?: string; // מקור התוכן (youtube, netflix, book, etc.)
  text?: string; // טקסט מסביב למילה
  url?: string; // כתובת מקור
  videoId?: string; // מזהה וידאו
  videoTitle?: string; // כותרת הוידאו
  videoTimestamp?: number; // מיקום בוידאו
  captionsLanguage?: string; // שפת הכתוביות
}

/**
 * Interface for word statistics
 */
export interface WordStats {
  totalWords: number; // סה"כ מילים
  todayWords: number; // מילים שנוספו היום
  streak: number; // רצף ימים
  lastActive: string; // תאריך פעילות אחרון (כמחרוזת)
  languages?: Record<string, number>; // ספירה לפי שפה
  tags?: Record<string, number>; // ספירה לפי תגית
}

/**
 * Interface for a group of words
 */
export interface WordGroup {
  id: string;
  title: string;
  words: string[]; // IDs of words
  timestamp: number;
  userId: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

/**
 * Interface for app settings
 */
export interface AppSettings {
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  targetLanguage: string;
}

/**
 * Interface for vocabulary filter options
 */
export interface VocabularyFilter {
  language: string;
  dateRange?: {
    from: string | null;
    to: string | null;
  };
  dateFilter: 'all' | 'today' | 'week' | 'month' | 'custom';
  customDate?: string;
  searchText?: string;
  tags?: string[];
  groupByLanguage: boolean;
}

/**
 * Storage data interface for Chrome storage
 */
export interface StorageData {
  settings?: AppSettings;
  words?: Word[];
  stats?: WordStats;
  words_metadata?: any;
  words_groups?: string[];
} 