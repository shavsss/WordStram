import { LRUCache } from 'lru-cache';
import { GoogleTranslateProvider } from './providers/google-translate';
import { TranslationResult } from '@/types';
import { SupportedLanguageCode, isLanguageSupported } from '@/config/supported-languages';

declare global {
  interface Window {
    WordStream?: {
      auth?: {
        isAuthenticated: boolean;
        email?: string | null;
        displayName?: string | null;
        userId?: string | null;
        [key: string]: any;
      };
      [key: string]: any;
    };
    firebase?: {
      auth: () => {
        currentUser: {
          email?: string | null;
          displayName?: string | null;
          uid?: string | null;
        } | null;
      };
    };
  }
}

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
   * בודק אם המשתמש מחובר ורשאי להשתמש בפיצ'רים פרימיום
   * מבצע בדיקה רב-שכבתית של האימות
   */
  async checkAuthentication(): Promise<boolean> {
    try {
      console.log('WordStream: Checking authentication status in Translation Service');

      // 1. Fastest check: using the injected global object if available
      if (window.WordStream?.auth?.isAuthenticated !== undefined) {
        console.log('WordStream: Authentication quick check from window object:', window.WordStream.auth.isAuthenticated);
        return window.WordStream.auth.isAuthenticated;
      }

      // 2. Reliable check: ask the background script (authoritative source)
      try {
        const response = await new Promise<{isAuthenticated: boolean, authDetails?: any}>((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'IS_AUTHENTICATED' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('WordStream: Error checking auth with background script:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
              }
              
              if (response && typeof response === 'object') {
                resolve(response);
              } else {
                reject(new Error('Invalid response format from background script'));
              }
            }
          );
          
          // Set a timeout in case the background script doesn't respond
          setTimeout(() => {
            reject(new Error('Authentication check timed out'));
          }, 5000);
        });
        
        // Update the global window object with the latest auth data from background
        if (window.WordStream) {
          window.WordStream.auth = {
            isAuthenticated: response.isAuthenticated,
            ...(response.authDetails || {})
          };
        }
        
        console.log('WordStream: Authentication check from background:', response.isAuthenticated);
        return response.isAuthenticated;
      } catch (error) {
        console.error('WordStream: Error during background auth check:', error);
        // Continue to the next check method
      }
      
      // 3. Last resort: direct check with Firebase (if available in content script)
      try {
        if (window.firebase && window.firebase.auth) {
          const user = window.firebase.auth().currentUser;
          const isAuthenticated = !!user;
          console.log('WordStream: Authentication direct check with Firebase:', isAuthenticated);
          
          // Update window object with this data
          if (window.WordStream) {
            window.WordStream.auth = {
              isAuthenticated,
              email: user?.email || null,
              displayName: user?.displayName || null,
              userId: user?.uid || null
            };
          }
          
          return isAuthenticated;
        }
      } catch (error) {
        console.error('WordStream: Error during direct Firebase check:', error);
      }
      
      console.error('WordStream: All authentication checks failed');
      return false;
    } catch (error) {
      console.error('WordStream: Error in checkAuthentication:', error);
      return false;
    }
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
    
    // בדיקת אימות משופרת משולשת
    const isAuthenticated = await this.checkAuthentication();
    
    // אם המשתמש לא מחובר ואנחנו דורשים אימות
    // החלטה זו צריכה להתקבל ברמה עסקית - האם לדרוש אימות לתרגום
    // כרגע אנחנו מאפשרים תרגום גם למשתמשים לא מחוברים
    const requireAuth = false; // הגדרה האם לדרוש אימות לתרגום
    
    if (requireAuth && !isAuthenticated) {
      return {
        success: false,
        error: 'Authentication required for translation'
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
    
    // בדיקת אימות משופרת משולשת
    const isAuthenticated = await this.checkAuthentication();
    
    // אם המשתמש לא מחובר ואנחנו דורשים אימות
    // החלטה זו צריכה להתקבל ברמה עסקית - האם לדרוש אימות לתרגום
    // כרגע אנחנו מאפשרים תרגום גם למשתמשים לא מחוברים
    const requireAuth = false; // הגדרה האם לדרוש אימות לתרגום
    
    if (requireAuth && !isAuthenticated) {
      return {
        success: false,
        error: 'Authentication required for translation'
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
    
    // בדיקת אימות משופרת משולשת
    const isAuthenticated = await this.checkAuthentication();
    
    // אם המשתמש לא מחובר ואנחנו דורשים אימות
    // החלטה זו צריכה להתקבל ברמה עסקית - האם לדרוש אימות לתרגום
    // כרגע אנחנו מאפשרים תרגום גם למשתמשים לא מחוברים
    const requireAuth = false; // הגדרה האם לדרוש אימות לתרגום
    
    if (requireAuth && !isAuthenticated) {
      return {
        success: false,
        error: 'Authentication required for translation'
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
  
  /**
   * בדיקה האם המשתמש מחובר לפי Firebase Auth
   */
  private isAuthenticatedFromFirebase(): boolean {
    try {
      // נסיון לגשת לפונקציה של Firebase שקיימת בגלובל סקופ
      return !!(window as any).firebase?.auth?.currentUser;
    } catch (error) {
      console.error('WordStream: Error checking Firebase auth:', error);
      return false;
    }
  }
} 