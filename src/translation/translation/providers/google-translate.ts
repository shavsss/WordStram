import { TranslationResult } from '@/types';
import { SupportedLanguageCode } from '@/config/supported-languages';

// פונקציית עזר משופרת לטיפול בשגיאות
function safeStringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch (e) {
        return 'Object error - cannot stringify';
      }
    }
    
    return String(error);
  } catch (e) {
    return 'Unknown error - cannot format';
  }
}

// שיטה פשוטה וישירה - עבדה בעבר
export class GoogleTranslateProvider {
  async translate(text: string, targetLang: SupportedLanguageCode): Promise<TranslationResult> {
    try {
      if (!chrome || !chrome.runtime) {
        console.error('WordStream: Chrome runtime API not available');
        return { 
          success: false, 
          error: 'Chrome runtime not available' 
        };
      }
      
      console.log('WordStream: Translating word:', text, 'to language:', targetLang);
      
      // עדכון לשימוש בהודעה מתאימה לקובץ הרקע החדש שלנו
      const message = { 
        type: 'TRANSLATE',
        data: {
          text: text,
          targetLang: targetLang
        }
      };
      
      try {
        const response = await chrome.runtime.sendMessage(message);
        
        if (!response) {
          console.error('WordStream: No translation response received');
          return { 
            success: false, 
            error: 'No response from background script' 
          };
        }
        
        if (!response.success) {
          console.error('WordStream: Translation failed:', response.error);
          return { 
            success: false, 
            error: response.error || 'Translation failed' 
          };
        }
        
        console.log('WordStream: Translation succeeded:', response.translation);
        return {
          success: true,
          translatedText: response.translation,
          detectedSourceLanguage: response.detectedSourceLanguage
        };
      } catch (sendError) {
        console.error('WordStream: Error sending translation message:', safeStringifyError(sendError));
        return { 
          success: false, 
          error: `Error sending message: ${safeStringifyError(sendError)}` 
        };
      }
    } catch (error) {
      console.error('WordStream: Translation provider error:', safeStringifyError(error));
      return { 
        success: false, 
        error: `Translation error: ${safeStringifyError(error)}` 
      };
    }
  }
} 