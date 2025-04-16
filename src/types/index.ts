/**
 * Central types definitions for the WordStream application
 */

// Translation result interface
export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

// Information about captions/subtitles language
export interface CaptionsLanguageInfo {
  code: string;
  name: string;
  confidence: number;
}

// Content source type
export type ContentSource = 'youtube' | 'netflix' | 'universal' | 'none'; 