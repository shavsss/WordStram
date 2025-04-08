import { TranslationService } from '../../../services/translation/translation-service';

// Get singleton instance of the translation service
const translationService = TranslationService.getInstance();

/**
 * המרה בטוחה של אובייקט שגיאה למחרוזת
 */
function safeStringifyError(error: unknown): string {
  if (!error) return 'Unknown error';
  
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unserializable error';
  }
}

/**
 * מזהה את שפת הטקסט המוזן
 * @param text טקסט לזיהוי שפה
 * @returns קוד השפה המזוהה ('en' לאנגלית, 'he' לעברית, או קוד אחר)
 */
export function detectTextLanguage(text: string): string {
  return translationService.detectTextLanguage(text);
}

/**
 * מתרגם טקסט מאנגלית לעברית
 * @param text הטקסט לתרגום
 * @returns הטקסט המתורגם
 */
export async function translateToHebrew(text: string): Promise<string> {
  if (!text) return '';
  
  try {
    const result = await translationService.translateToHebrew(text);
    
    if (!result.success) {
      console.error('WordStream: Translation to Hebrew failed:', result.error);
      return `Translation error: ${result.error}`;
    }
    
    return result.translatedText || '';
  } catch (error) {
    console.error('WordStream: Error translating to Hebrew:', error);
    return `Translation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * מתרגם טקסט מעברית לאנגלית
 * @param text הטקסט לתרגום
 * @returns הטקסט המתורגם
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text) return '';
  
  try {
    const result = await translationService.translateToEnglish(text);
    
    if (!result.success) {
      console.error('WordStream: Translation to English failed:', result.error);
      return `Translation error: ${result.error}`;
    }
    
    return result.translatedText || '';
  } catch (error) {
    console.error('WordStream: Error translating to English:', error);
    return `Translation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * מתרגם טקסט לשפה המבוקשת
 * @param text הטקסט לתרגום
 * @param targetLang קוד השפה המבוקשת
 * @returns הטקסט המתורגם
 */
export async function translateToLanguage(text: string, targetLang: string): Promise<string> {
  if (!text) return '';
  
  try {
    const result = await translationService.translate(text, targetLang);
    
    if (!result.success) {
      console.error(`WordStream: Translation to ${targetLang} failed:`, result.error);
      return `Translation error: ${result.error}`;
    }
    
    return result.translatedText || '';
  } catch (error) {
    console.error(`WordStream: Error translating to ${targetLang}:`, error);
    return `Translation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
} 