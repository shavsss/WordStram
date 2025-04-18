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

/**
 * Send a message to the background script with retries
 * @param message Message to send
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise resolving to the response
 */
async function sendMessageToBackground(message: any, maxRetries = 3): Promise<any> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout waiting for translation response'));
        }, 10000); // 10 second timeout for translations
        
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!response) {
            reject(new Error('No response received'));
            return;
          }
          
          resolve(response);
        });
      });
    } catch (error) {
      console.warn(`WordStream Translation: Error sending message (attempt ${retries + 1}/${maxRetries + 1}):`, safeStringifyError(error));
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      retries++;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retries), 5000)));
    }
  }
  
  throw new Error('Failed to send message after maximum retries');
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
        action: 'TRANSLATE', // Changed type -> action to match background's expected format
        data: {
          text: text,
          targetLang: targetLang
        }
      };
      
      try {
        // Use our enhanced message sending function with retries
        const response = await sendMessageToBackground(message, 2);
        
        if (!response) {
          console.error('WordStream: No translation response received');
          return { 
            success: false, 
            error: 'No response from background script' 
          };
        }
        
        if (!response.success) {
          // Check for specific error cases
          if (response.error && (
              response.error.includes('not authenticated') ||
              response.error.includes('Authentication required')
          )) {
            console.error('WordStream: Translation failed - authentication required');
            return { 
              success: false, 
              error: 'Authentication required' 
            };
          }
          
          if (response.error && response.error.includes('Background service not ready')) {
            console.error('WordStream: Translation failed - background not ready');
            return { 
              success: false, 
              error: 'Background service not ready. Please wait a moment and try again.' 
            };
          }
          
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
        // First check if this is a simple messaging error
        if (sendError instanceof Error && 
            (sendError.message.includes('Extension context invalidated') ||
             sendError.message.includes('The message port closed') ||
             sendError.message.includes('Receiving end does not exist'))) {
          console.error('WordStream: Messaging error - extension context issue:', sendError.message);
          return { 
            success: false, 
            error: 'Cannot connect to translation service (extension context issue). Try reloading the page.' 
          };
        }
        
        // If it's a timeout error
        if (sendError instanceof Error && sendError.message.includes('Timeout')) {
          console.error('WordStream: Translation request timed out');
          return { 
            success: false, 
            error: 'Translation request timed out. Please try again.' 
          };
        }
        
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