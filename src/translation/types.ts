/**
 * Types for the translation functionality
 */

/**
 * Represents the language information for captions
 */
export interface CaptionsLanguageInfo {
  language: string;
  languageName: string;
  isAuto: boolean;
}

/**
 * Defines a source for content that can be translated
 */
export type ContentSource = 'youtube' | 'netflix' | 'universal';

/**
 * Result of a translation operation
 */
export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

/**
 * Supported language codes for translation
 */
export type SupportedLanguageCode = 
  'en' | 'he' | 'ar' | 'zh' | 'nl' | 'fr' | 'de' | 
  'hi' | 'id' | 'it' | 'ja' | 'ko' | 'pl' | 'pt' | 
  'ru' | 'es' | 'tr' | 'uk' | 'auto';

/**
 * Interface for an individual word saved after translation
 */
export interface Word {
  id: string;
  originalWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: string;
  context: {
    source: ContentSource;
    videoTitle?: string;
    url?: string;
    captionsLanguage?: string;
  };
  stats: {
    successRate: number;
    totalReviews: number;
    lastReview: string | null;
  };
} 