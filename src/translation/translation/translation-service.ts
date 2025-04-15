import { LRUCache } from 'lru-cache';
import { GoogleTranslateProvider } from './providers/google-translate';
import { TranslationResult } from '@/types';
import { SupportedLanguageCode, isLanguageSupported } from '@/config/supported-languages';

/**
 * שירות תרגום מאוחד שמנהל את כל פעולות התרגום במערכת
 */
export class TranslationService {
  private static instance: TranslationService;
  private provider: GoogleTranslateProvider;
  
  // יישום Singleton pattern
  private constructor() {
    this.provider = new GoogleTranslateProvider();
  }
  
  /**
   * קבלת instance יחיד של שירות התרגום
   */
  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }
  
  /**
   * בדיקת האימות של המשתמש ממספר מקורות
   * @returns אמת אם המשתמש מחובר, שקר אחרת
   */
  private async isUserAuthenticated(): Promise<boolean> {
    // בדיקה ראשונה - גישה ישירה לאובייקט ה-window.WordStream.local
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated === true) {
      return true;
    }
    
    // בדיקה שנייה - storage.local (עובד גם ב-background ו-popup)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const result = await chrome.storage.local.get('isAuthenticated');
        if (result.isAuthenticated === true) {
          return true;
        }
      } catch (error) {
        console.error('WordStream Translation: Error checking auth in storage:', error);
      }
    }
    
    // אם הגענו לכאן, המשתמש לא מאומת
    return false;
  }
  
  /**
   * מזהה את שפת הטקסט המוזן
   * @param text טקסט לזיהוי שפה
   * @returns קוד השפה המזוהה
   */
  public detectTextLanguage(text: string): string {
    if (!text) return 'auto';
    
    // Simple detection based on character codes and patterns
    
    // Check for Hebrew characters
    const hebrewRegex = /[\u0590-\u05FF]/;
    if (hebrewRegex.test(text)) return 'he';
    
    // Check for Latin/English characters
    const latinRegex = /[a-zA-Z]/;
    if (latinRegex.test(text)) return 'en';
    
    // Default to auto detection
    return 'auto';
  }
  
  /**
   * תרגום מטקסט אנגלי לעברית
   * @param text טקסט לתרגום
   * @returns תוצאת התרגום
   */
  public async translateToHebrew(text: string): Promise<TranslationResult> {
    if (!text) {
      return {
        success: false,
        error: 'No text provided'
      };
    }
    
    // בדיקת אימות - אם לא מאומת, חסום את התרגום
    const isAuthenticated = await this.isUserAuthenticated();
    if (!isAuthenticated) {
      console.log('WordStream: Translation blocked - user not authenticated');
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    try {
      console.log('WordStream: Translating to Hebrew:', text);
      return await this.translate(text, 'he');
    } catch (error) {
      return this.handleTranslationError(error, 'Error translating to Hebrew');
    }
  }
  
  /**
   * תרגום מטקסט עברי לאנגלית
   * @param text טקסט לתרגום
   * @returns תוצאת התרגום
   */
  public async translateToEnglish(text: string): Promise<TranslationResult> {
    if (!text) {
      return {
        success: false,
        error: 'No text provided'
      };
    }
    
    // בדיקת אימות - אם לא מאומת, חסום את התרגום
    const isAuthenticated = await this.isUserAuthenticated();
    if (!isAuthenticated) {
      console.log('WordStream: Translation blocked - user not authenticated');
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    try {
      console.log('WordStream: Translating to English:', text);
      return await this.translate(text, 'en');
    } catch (error) {
      return this.handleTranslationError(error, 'Error translating to English');
    }
  }
  
  /**
   * תרגום לשפה מבוקשת
   * @param text טקסט לתרגום
   * @param targetLang שפת היעד
   * @returns תוצאת התרגום
   */
  public async translate(text: string, targetLang: string): Promise<TranslationResult> {
    if (!text) {
      return {
        success: false,
        error: 'No text provided'
      };
    }
    
    // בדיקת אימות - אם לא מאומת, חסום את התרגום
    const isAuthenticated = await this.isUserAuthenticated();
    if (!isAuthenticated) {
      console.log('WordStream: Translation blocked - user not authenticated');
      return {
        success: false,
        error: 'Authentication required'
      };
    }
    
    try {
      console.log(`WordStream: Translating to ${targetLang}:`, text);
      
      // Verify the language code is supported, default to English if not
      let safeTargetLang: SupportedLanguageCode = 'en';
      if (isLanguageSupported(targetLang)) {
        safeTargetLang = targetLang as SupportedLanguageCode;
      } else {
        console.warn(`WordStream: Language code ${targetLang} not supported, defaulting to English`);
      }
      
      return await this.provider.translate(text, safeTargetLang);
    } catch (error) {
      return this.handleTranslationError(error, `Error translating to ${targetLang}`);
    }
  }
  
  /**
   * שמירת מילים לצורך שליפה מהירה בעתיד (יישום LRU cache)
   * @param word המילה המקורית
   * @param translation תרגום המילה
   * @param sourceLanguage שפת המקור
   * @param targetLanguage שפת היעד
   */
  public async storeTranslation(
    word: string,
    translation: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<void> {
    // בשלב זה אין מימוש - נוכל להשתמש ב-Firebase בהמשך
    console.log('WordStream: Storing translation for future use', {
      word,
      translation,
      sourceLanguage,
      targetLanguage
    });
    
    // TODO: Implement caching logic and Firebase storage
  }
  
  /**
   * תרגום ושמירה למאגר
   * @param text טקסט לתרגום ושמירה
   * @param targetLang שפת היעד
   * @returns טקסט מתורגם
   */
  public async translateAndStore(text: string, targetLang: string = 'auto'): Promise<string> {
    try {
      // Auto-detect language if not specified
      let sourceLang = 'auto';
      let actualTargetLang = targetLang;
      
      if (targetLang === 'auto') {
        sourceLang = this.detectTextLanguage(text);
        actualTargetLang = sourceLang === 'en' ? 'he' : 'en';
      }
      
      // Get translation
      const result = await this.translate(text, actualTargetLang);
      
      // Store if successful
      if (result.success && result.translatedText) {
        await this.storeTranslation(
          text,
          result.translatedText,
          result.detectedSourceLanguage || sourceLang,
          actualTargetLang
        );
        
        return result.translatedText;
      } else {
        throw new Error(result.error || 'Unknown translation error');
      }
    } catch (error) {
      console.error('WordStream: Error in translateAndStore:', this.safeStringifyError(error));
      return `Translation error: ${this.safeStringifyError(error)}`;
    }
  }
  
  /**
   * טיפול בשגיאות תרגום
   */
  private handleTranslationError(error: unknown, prefix: string): TranslationResult {
    const errorMsg = this.safeStringifyError(error);
    console.error(`WordStream: ${prefix}:`, errorMsg);
    
    return {
      success: false,
      error: `${prefix}: ${errorMsg}`
    };
  }
  
  /**
   * המרה בטוחה של אובייקט שגיאה למחרוזת
   */
  private safeStringifyError(error: unknown): string {
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
} 