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
    try {
      // Use the auth-manager as single source of truth when possible
      try {
        // Import dynamically to avoid circular dependencies
        const authManagerModule = await import('@/auth/auth-manager');
        return await authManagerModule.isAuthenticated();
      } catch (importError) {
        console.warn('WordStream Translation: Could not import auth-manager, falling back to local checks:', importError);
        
        // Fallback to direct checks if import fails
        
        // בדיקה ראשונה - גישה ישירה לאובייקט ה-window.WordStream.local
        if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated === true) {
          return true;
        }
        
        // בדיקה שנייה - storage.local (עובד גם ב-background ו-popup)
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          // Check for wordstream_user_info which is the standard key used across the application
          const result = await chrome.storage.local.get(['wordstream_user_info']);
          if (result.wordstream_user_info) {
            return true;
          }
          
          // Legacy check for old auth key for backward compatibility
          const legacyResult = await chrome.storage.local.get('isAuthenticated');
          if (legacyResult.isAuthenticated === true) {
            return true;
          }
        }
      }
      
      // אם הגענו לכאן, המשתמש לא מאומת
      return false;
    } catch (error) {
      console.error('WordStream Translation: Error checking authentication:', error);
      // במקרה של שגיאה, מחזירים שקר כברירת מחדל
      return false;
    }
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
    
    // Authentication check with fallback - don't block translation immediately if auth check fails
    let isAuthenticated = false;
    try {
      isAuthenticated = await this.isUserAuthenticated();
    } catch (authError) {
      // If auth check fails due to extension context, allow translation anyway
      // This prevents blocking translation due to temporary extension state issues
      console.warn('WordStream: Auth check failed but allowing translation:', authError);
      isAuthenticated = true;
    }
    
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
      
      // Try provider but add fallback
      try {
        const result = await this.provider.translate(text, safeTargetLang);
        return result;
      } catch (providerError) {
        console.warn('WordStream: Primary translation provider failed, trying fallback:', providerError);
        
        // Try our fallback local translation approach
        return this.fallbackTranslate(text, safeTargetLang);
      }
    } catch (error) {
      return this.handleTranslationError(error, `Error translating to ${targetLang}`);
    }
  }
  
  /**
   * Fallback translation method when primary provider fails
   * Uses an extremely basic approach for emergency cases only
   */
  private async fallbackTranslate(text: string, targetLang: string): Promise<TranslationResult> {
    try {
      // If we have predefined translations, use them
      const basicDictionary: Record<string, Record<string, string>> = {
        'en': {
          'hello': 'שלום',
          'goodbye': 'להתראות',
          'yes': 'כן',
          'no': 'לא',
          'thank you': 'תודה',
          'please': 'בבקשה'
        },
        'he': {
          'שלום': 'hello',
          'להתראות': 'goodbye',
          'כן': 'yes',
          'לא': 'no',
          'תודה': 'thank you',
          'בבקשה': 'please'
        }
      };
      
      // Very simple dictionary lookup (only for emergencies)
      const sourceKey = targetLang === 'he' ? 'en' : 'he';
      const targetDict = basicDictionary[targetLang];
      
      if (targetDict && targetDict[text.toLowerCase()]) {
        return {
          success: true,
          translatedText: targetDict[text.toLowerCase()],
          detectedSourceLanguage: sourceKey
        };
      }
      
      // If not in dictionary, just return original text with an indicator
      // that this is a fallback (better than nothing)
      return {
        success: true,
        translatedText: `${text} [!]`,
        detectedSourceLanguage: sourceKey,
        error: 'Using fallback translation'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Fallback translation failed'
      };
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