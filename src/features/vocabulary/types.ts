/**
 * מייצג מילה במילון המשתמש
 */
export interface Word {
  id: string;
  word: string;
  translation: string;
  language: string;
  date: string;
  tags?: string[];
  examples?: string[];
  notes?: string;
  level?: number;
  lastReviewed?: string;
  reviewCount?: number;
}

/**
 * סטטיסטיקות עבור מילים לפי שפה
 */
export interface WordStats {
  totalWords: number;
  byLanguage: Record<string, number>;
  byDate: Record<string, number>;
  byLevel?: Record<string, number>;
}

/**
 * אפשרויות סינון מילים
 */
export interface WordFilter {
  language?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  tags?: string[];
  searchTerm?: string;
  level?: number;
  groupByLanguage?: boolean;
}

/**
 * מייצג העדפות משתמש במערכת המילים
 */
export interface VocabularyPreferences {
  defaultLanguage: string;
  showTranslation: boolean;
  showExamples: boolean;
  enableAutoTranslate: boolean;
  reviewFrequency: 'daily' | 'weekly' | 'monthly';
} 