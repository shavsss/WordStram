/**
 * Caption Module Type Definitions
 * הגדרות טיפוסים למודול הכתוביות
 */

import { MediaInfo } from '@/types';

/**
 * Interface for all caption detectors
 * ממשק בסיסי שכל גלאי כתוביות צריך לממש
 */
export interface CaptionDetector {
  /**
   * Source identifier - youtube, netflix, etc.
   * מזהה מקור - יוטיוב, נטפליקס וכו'
   */
  source: 'youtube' | 'netflix' | 'other';
  
  /**
   * Detect captions container in the page
   * זיהוי מיכל הכתוביות בעמוד
   */
  detect(): Promise<HTMLElement | null>;
  
  /**
   * Process the caption container
   * עיבוד מיכל הכתוביות
   */
  processCaption(caption: HTMLElement): void;
  
  /**
   * Start observing the caption container for changes
   * התחלת צפייה במיכל הכתוביות לשינויים
   */
  startObserving(captionContainer: HTMLElement): void;
  
  /**
   * Stop observing the caption container
   * עצירת צפייה במיכל הכתוביות
   */
  stopObserving(): void;
  
  /**
   * Clean up resources
   * ניקוי משאבים
   */
  cleanup(): void;
  
  addFloatingControls(): void;
  removeFloatingControls(): void;
}

/**
 * Caption language information
 * מידע על שפת הכתוביות
 */
export interface CaptionsLanguageInfo {
  /**
   * Language code (e.g. 'en', 'he')
   * קוד שפה (לדוגמה 'en', 'he')
   */
  language: string;
  
  /**
   * Language name (e.g. 'English', 'Hebrew')
   * שם השפה (לדוגמה 'English', 'Hebrew')
   */
  languageName: string;
  
  /**
   * Whether captions are auto-generated
   * האם הכתוביות נוצרו באופן אוטומטי
   */
  isAuto: boolean;
}

/**
 * Caption detection result
 * תוצאת זיהוי כתוביות
 */
export interface CaptionDetectionResult {
  /**
   * Caption text
   * טקסט הכתוביות
   */
  text: string;
  
  /**
   * Language of the caption
   * שפת הכתוביות
   */
  language: string;
  
  /**
   * Timestamp of the caption in seconds
   * חותמת זמן של הכתוביות בשניות
   */
  timestamp: number;
  
  /**
   * Confidence of the caption detection (0-1)
   * ביטחון בזיהוי הכתוביות (0-1)
   */
  confidence?: number;
  
  /**
   * Media information
   * מידע על המדיה
   */
  media?: {
    /**
     * Title of the video
     * כותרת הוידאו
     */
    title?: string;
    
    /**
     * URL of the video
     * כתובת הוידאו
     */
    url?: string;
    
    /**
     * ID of the video
     * מזהה הוידאו
     */
    id?: string;
  }
}

/**
 * Caption word info
 * מידע על מילה בכתוביות
 */
export interface CaptionWordInfo {
  /**
   * The word itself
   * המילה עצמה
   */
  word: string;
  
  /**
   * Context around the word
   * הקשר סביב המילה
   */
  context: string;
  
  /**
   * Source of the word (youtube, netflix, etc.)
   * מקור המילה (יוטיוב, נטפליקס וכו')
   */
  source: 'youtube' | 'netflix' | 'other';
  
  /**
   * Information about the video
   * מידע על הוידאו
   */
  video?: {
    /**
     * Title of the video
     * כותרת הוידאו
     */
    title?: string;
    
    /**
     * URL of the video
     * כתובת הוידאו
     */
    url?: string;
    
    /**
     * ID of the video
     * מזהה הוידאו
     */
    id?: string;
    
    /**
     * Timestamp of the word in the video in seconds
     * חותמת זמן של המילה בוידאו בשניות
     */
    timestamp?: number;
  }
}

/**
 * Caption detector options
 * אפשרויות עבור גלאי כתוביות
 */
export interface CaptionDetectorOptions {
  /**
   * Whether to enable translation
   * האם לאפשר תרגום
   */
  enableTranslation?: boolean;
  
  /**
   * Whether to enable controls
   * האם לאפשר פקדים
   */
  enableControls?: boolean;
}

/**
 * Caption detector factory options
 * אפשרויות ליצירת גלאי כתוביות
 */
export interface CaptionDetectorFactoryOptions {
  /**
   * URL to detect
   * כתובת לזיהוי
   */
  url?: string;
  
  /**
   * Type of detector to create
   * סוג הגלאי ליצירה
   */
  type?: 'youtube' | 'netflix' | 'auto';
}

/**
 * Word translation request
 * בקשת תרגום מילה
 */
export interface WordTranslationRequest {
  /**
   * Word to translate
   * מילה לתרגום
   */
  word: string;
  
  /**
   * Source language
   * שפת מקור
   */
  sourceLanguage: string;
  
  /**
   * Target language
   * שפת יעד
   */
  targetLanguage: string;
}

/**
 * Word translation response
 * תשובת תרגום מילה
 */
export interface WordTranslationResponse {
  /**
   * Original word
   * מילה מקורית
   */
  originalWord: string;
  
  /**
   * Translated word
   * מילה מתורגמת
   */
  translatedWord: string;
  
  /**
   * Additional translations
   * תרגומים נוספים
   */
  alternatives?: string[];
  
  /**
   * Part of speech
   * חלק דיבור
   */
  partOfSpeech?: string;
} 