/**
 * Supported languages configuration for WordStream
 */

// List of language codes supported by the application
export type SupportedLanguageCode = 
  | 'en'  // English
  | 'es'  // Spanish
  | 'fr'  // French
  | 'de'  // German
  | 'it'  // Italian
  | 'pt'  // Portuguese
  | 'ru'  // Russian
  | 'zh'  // Chinese
  | 'ja'  // Japanese
  | 'ko'  // Korean
  | 'ar'  // Arabic
  | 'hi'  // Hindi
  | 'he'  // Hebrew
  | 'auto'; // Auto-detection

// Interface for language information
export interface LanguageInfo {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
  rtl: boolean;
}

// Languages supported by the application
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true }
];

/**
 * Check if a language is supported
 * @param code Language code to check
 * @returns True if language is supported, false otherwise
 */
export function isLanguageSupported(code: string): boolean {
  if (code === 'auto') return true;
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
}

/**
 * Get language info by code
 * @param code Language code
 * @returns Language info or null if not found
 */
export function getLanguageInfo(code: string): LanguageInfo | null {
  if (code === 'auto') {
    return {
      code: 'auto',
      name: 'Auto Detect',
      nativeName: 'Auto Detect',
      rtl: false
    };
  }
  
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  return language || null;
}

/**
 * Default language for the application
 */
export const DEFAULT_TARGET_LANGUAGE: SupportedLanguageCode = 'he'; 