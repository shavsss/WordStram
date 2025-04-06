/**
 * Background Messaging Service
 * 
 * שכבת תיווך מרכזית להתקשרות עם Background Script
 * מרכזת את כל הפעולות שפונות ל-Firestore ומבצעת אותן רק דרך ה-background
 */

/**
 * שליחת הודעה לרכיב הרקע וקבלת תשובה
 */
export async function sendMessageToBackground<T = any>(message: any): Promise<T> {
  try {
    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        // Handle any error from chrome.runtime
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error sending message to background:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message || 'Failed to communicate with background script'));
          return;
        }

        // Handle error response
        if (response?.error) {
          console.error('WordStream: Background operation failed:', response.error);
          reject(new Error(response.error));
          return;
        }

        // Resolve with the data
        resolve(response?.data || response);
      });
    });
  } catch (error) {
    console.error('WordStream: Error in background communication:', error);
    throw error;
  }
}

/**
 * בדיקת חיבור לפיירסטור
 */
export async function checkFirestoreConnection(): Promise<{
  connected: boolean;
  authenticated: boolean;
  userId?: string | null;
  error?: string;
}> {
  try {
    return await sendMessageToBackground({
      action: 'checkFirestoreConnection'
    });
  } catch (error) {
    console.error('WordStream: Connection check failed:', error);
    return {
      connected: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ================= פונקציות אימות =================

/**
 * קבלת מזהה המשתמש הנוכחי
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const result = await sendMessageToBackground({
      action: 'getCurrentUserId'
    });
    return result;
  } catch (error) {
    console.error('WordStream: Failed to get current user ID:', error);
    return null;
  }
}

/**
 * בדיקה אם המשתמש מאומת
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    return !!userId;
  } catch (error) {
    console.error('WordStream: Authentication check failed:', error);
    return false;
  }
}

// ================= פונקציות לטיפול במילים =================

/**
 * קבלת כל המילים של המשתמש
 */
export async function getWords(): Promise<any[]> {
  try {
    return await sendMessageToBackground({
      action: 'getWords'
    });
  } catch (error) {
    console.error('WordStream: Failed to get words:', error);
    return [];
  }
}

/**
 * שמירת מילה חדשה
 */
export async function saveWord(wordData: any): Promise<string> {
  try {
    return await sendMessageToBackground({
      action: 'saveWord',
      data: wordData
    });
  } catch (error) {
    console.error('WordStream: Failed to save word:', error);
    throw error;
  }
}

/**
 * מחיקת מילה
 */
export async function deleteWord(wordId: string): Promise<boolean> {
  try {
    return await sendMessageToBackground({
      action: 'deleteWord',
      id: wordId
    });
  } catch (error) {
    console.error('WordStream: Failed to delete word:', error);
    return false;
  }
}

// ================= פונקציות לטיפול בהערות =================

/**
 * קבלת הערות לוידאו מסוים
 */
export async function getNotes(videoId: string): Promise<any[]> {
  try {
    return await sendMessageToBackground({
      action: 'getNotes',
      videoId
    });
  } catch (error) {
    console.error(`WordStream: Failed to get notes for video ${videoId}:`, error);
    return [];
  }
}

/**
 * שמירת הערה חדשה
 */
export async function saveNote(noteData: any): Promise<string> {
  try {
    return await sendMessageToBackground({
      action: 'saveNote',
      data: noteData
    });
  } catch (error) {
    console.error('WordStream: Failed to save note:', error);
    throw error;
  }
}

/**
 * מחיקת הערה
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    return await sendMessageToBackground({
      action: 'deleteNote',
      id: noteId
    });
  } catch (error) {
    console.error('WordStream: Failed to delete note:', error);
    return false;
  }
}

/**
 * קבלת כל הסרטונים עם הערות
 */
export async function getAllVideosWithNotes(): Promise<any[]> {
  try {
    return await sendMessageToBackground({
      action: 'getAllVideosWithNotes'
    });
  } catch (error) {
    console.error('WordStream: Failed to get videos with notes:', error);
    return [];
  }
}

// ================= פונקציות לטיפול בצ'אטים =================

/**
 * קבלת כל הצ'אטים של המשתמש
 */
export async function getChats(): Promise<any[]> {
  try {
    return await sendMessageToBackground({
      action: 'getChats'
    });
  } catch (error) {
    console.error('WordStream: Failed to get chats:', error);
    return [];
  }
}

/**
 * שמירת צ'אט חדש
 */
export async function saveChat(chatData: any): Promise<string> {
  try {
    return await sendMessageToBackground({
      action: 'saveChat',
      data: chatData
    });
  } catch (error) {
    console.error('WordStream: Failed to save chat:', error);
    throw error;
  }
}

/**
 * מחיקת צ'אט
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    return await sendMessageToBackground({
      action: 'deleteChat',
      id: chatId
    });
  } catch (error) {
    console.error('WordStream: Failed to delete chat:', error);
    return false;
  }
}

// ================= פונקציות לטיפול בסטטיסטיקות המשתמש =================

/**
 * קבלת סטטיסטיקות המשתמש
 */
export async function getUserStats(): Promise<any> {
  try {
    return await sendMessageToBackground({
      action: 'getUserStats'
    });
  } catch (error) {
    console.error('WordStream: Failed to get user stats:', error);
    return null;
  }
}

/**
 * עדכון סטטיסטיקות המשתמש
 */
export async function saveUserStats(statsData: any): Promise<boolean> {
  try {
    return await sendMessageToBackground({
      action: 'saveUserStats',
      data: statsData
    });
  } catch (error) {
    console.error('WordStream: Failed to save user stats:', error);
    return false;
  }
}

// ================= פונקציות לטיפול במסמכים כלליים =================

/**
 * קבלת מסמך מאוסף כלשהו
 */
export async function getDocument(collection: string, docId: string): Promise<any> {
  try {
    return await sendMessageToBackground({
      action: 'getDocument',
      collection,
      id: docId
    });
  } catch (error) {
    console.error(`WordStream: Failed to get document ${collection}/${docId}:`, error);
    return null;
  }
}

/**
 * שמירת מסמך באוסף כלשהו
 */
export async function saveDocument(collection: string, docId: string, data: any): Promise<string> {
  try {
    return await sendMessageToBackground({
      action: 'saveDocument',
      collection,
      id: docId,
      data
    });
  } catch (error) {
    console.error(`WordStream: Failed to save document ${collection}/${docId}:`, error);
    throw error;
  }
}

// ================= פונקציות נוספות =================

/**
 * Translation function that uses Google Translate API
 * Includes retry mechanism with exponential backoff for rate limiting
 */
export async function translateText(text: string, targetLang?: string): Promise<{
  success: boolean;
  translation?: string;
  detectedSourceLanguage?: string;
  error?: string;
}> {
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 1000; // 1 second
  
  let retries = 0;
  let lastError: any = null;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`WordStream: Translation attempt ${retries + 1}/${MAX_RETRIES}`);
      
      const response = await sendMessageToBackground({
        action: 'translate',
        data: {
          text,
          targetLang
        }
      });
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`WordStream: Translation attempt ${retries + 1} failed:`, error);
      
      // Check if this is a rate limit error (HTTP 403)
      const isRateLimit = 
        error instanceof Error && 
        (error.message.includes('403') || 
         error.message.includes('Rate Limit') || 
         error.message.includes('quota'));
      
      if (isRateLimit) {
        // Exponential backoff for rate limiting
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retries);
        console.log(`WordStream: Rate limit detected, waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        // If not a rate limit error, don't retry
        break;
      }
    }
  }
  
  // All retries failed or non-retryable error
  console.error('WordStream: Translation failed after all retries:', lastError);
  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : 'Translation failed'
  };
}

/**
 * Function to use Gemini AI
 */
export async function useGeminiAI(message: string, history?: Array<{role: string, content: string}>, videoContext?: any): Promise<{
  success: boolean;
  answer?: string;
  error?: string;
}> {
  try {
    return await sendMessageToBackground({
      action: 'gemini',
      message,
      history,
      videoContext
    });
  } catch (error) {
    console.error('WordStream: Gemini AI request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI request failed'
    };
  }
}

/**
 * Initialize data synchronization
 */
export async function initializeDataSync(): Promise<() => void> {
  try {
    const result = await sendMessageToBackground<{success: boolean; cleanup?: () => void}>({
      action: 'initializeDataSync'
    });
    
    return result.cleanup || (() => {});
  } catch (error) {
    console.error('WordStream: Failed to initialize data sync:', error);
    return () => {}; // Return empty cleanup function
  }
}

/**
 * Delete all notes for a specific video
 */
export async function deleteAllNotesForVideo(videoId: string): Promise<number> {
  try {
    const result = await sendMessageToBackground<{success: boolean; deletedCount: number}>({
      action: 'deleteAllNotesForVideo',
      videoId
    });
    
    return result.deletedCount || 0;
  } catch (error) {
    console.error(`WordStream: Failed to delete notes for video ${videoId}:`, error);
    return 0;
  }
}

/**
 * Setup a broadcast listener between extension components
 */
export function setupBroadcastListener(callback: (message: any) => void): () => void {
  try {
    // Add listener for messages from browser window (between features)
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && 
         (event.data.action || event.data.type)) {
        callback(event.data);
      }
    };
    
    // Listen for changes in chrome.storage
    const handleStorageChange = (changes: {[key: string]: chrome.storage.StorageChange}, areaName: string) => {
      // Check if there are changes in data we're interested in
      if (areaName === 'local') {
        for (const key in changes) {
          if (key.startsWith('wordstream_') && changes[key].newValue) {
            try {
              callback({
                source: 'storage',
                key: key,
                data: changes[key].newValue,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error('WordStream: Error processing storage change:', error);
            }
          }
        }
      }
    };
    
    // Listen for messages from background script
    const handleRuntimeMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message && (message.action || message.type)) {
        callback(message);
        sendResponse({ received: true });
      }
      return true;
    };
    
    // Add all listeners
    window.addEventListener('message', handleWindowMessage);
    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    
    // Return function that removes all listeners
    return () => {
      window.removeEventListener('message', handleWindowMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  } catch (error) {
    console.error('WordStream: Failed to setup broadcast listener:', error);
    return () => {}; // Return empty cleanup function in case of error
  }
} 