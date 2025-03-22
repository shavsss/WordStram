export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  he: 'Hebrew'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

export function isLanguageSupported(lang: string): lang is SupportedLanguage {
  return lang in SUPPORTED_LANGUAGES;
} 