/**
 * Background Messaging Service
 * 
 * שכבת תיווך מרכזית להתקשרות עם Background Script
 * מרכזת את כל הפעולות שפונות ל-Firestore ומבצעת אותן רק דרך ה-background
 */

/**
 * פונקציה לבדיקת אימות מאולצת שמבצעת רענון וממתינה שה-storage יתעדכן
 */
async function forceAuthRefresh(): Promise<void> {
  // בקשת רענון טוקן מהרקע
  const refreshResult = await chrome.runtime.sendMessage({
    action: 'REFRESH_TOKEN',
    requiresAuth: false
  });
  
  if (!refreshResult || !refreshResult.success) {
    throw new Error('User authentication session expired');
  }
  
  // חכה שה-storage יתעדכן
  await new Promise<void>(resolve => {
    function handler(changes: {[key: string]: chrome.storage.StorageChange}, area: string) {
      if (area === 'local' && changes.wordstream_auth_state) {
        chrome.storage.onChanged.removeListener(handler);
        resolve();
      }
    }
    
    // הגדר timeout למקרה שה-storage לא יתעדכן
    const timeout = setTimeout(() => {
      chrome.storage.onChanged.removeListener(handler);
      resolve();
    }, 3000);
    
    chrome.storage.onChanged.addListener(handler);
  });
  
  // בדיקה סופית של מצב האימות
  const { wordstream_auth_state } = await chrome.storage.local.get('wordstream_auth_state');
  if (wordstream_auth_state !== 'authenticated') {
    throw new Error('User authentication session expired');
  }
}

/**
 * שליחת הודעה לרכיב הרקע וקבלת תשובה עם מנגנון ניסיון חוזר משופר
 * Enhanced message sending with retry mechanism for auth errors
 */
export const sendMessageToBackground = async <T = any>(message: any): Promise<T> => {
  try {
    // בדוק אם ההודעה לא דורשת אימות
    if (message.requiresAuth === false || 
        message.action === 'CHECK_AUTH' || 
        message.action === 'REFRESH_TOKEN') {
      
      // שליחה ישירה ללא בדיקות אימות
      if (!chrome.runtime) {
        throw new Error('Chrome runtime not available');
      }
      
      return await chrome.runtime.sendMessage(message) as T;
    }
    
    // בדוק את מצב האימות הנוכחי
    const { wordstream_auth_state } = await chrome.storage.local.get('wordstream_auth_state');
    
    // אם המשתמש לא מחובר, ננסה לרענן את האימות
    if (wordstream_auth_state !== 'authenticated') {
      console.log('WordStream: Auth state not authenticated, attempting refresh');
      
      try {
        // ניסיון אוטומטי לרענון ולהמתנה לעדכון ה-storage
        await forceAuthRefresh();
        console.log('WordStream: Auth refresh successful, continuing with message');
      } catch (refreshError) {
        console.error('WordStream: Auth refresh failed:', refreshError);
        throw new Error('User authentication session expired');
      }
    }
    
    // בדיקה שוב אם chrome.runtime זמין
    if (!chrome.runtime) {
      throw new Error('Chrome runtime not available');
    }
    
    // שלח את ההודעה ל-background
    const response = await chrome.runtime.sendMessage(message);
    
    // טפל בשגיאת אימות
    if (response && response.error === 'User authentication session expired') {
      console.error('WordStream: Authentication error from background');
      
      // ניסיון נוסף לרענון האימות לפני כישלון סופי
      try {
        await forceAuthRefresh();
        
        // שלח את ההודעה המקורית שוב
        const retryResponse = await chrome.runtime.sendMessage(message);
        
        // אם עדיין יש שגיאת אימות, אין ברירה אלא לזרוק שגיאה
        if (retryResponse && retryResponse.error === 'User authentication session expired') {
          // עדכן את מצב האימות ב-storage
          await chrome.storage.local.set({ 'wordstream_auth_state': 'unauthenticated' });
          
          // הודע לחלקים אחרים על שינוי מצב האימות
          await notifyLocalAuthStateChanged(false);
          
          throw new Error('User authentication session expired');
        }
        
        return retryResponse as T;
      } catch (lastRefreshError) {
        // עדכן את מצב האימות ב-storage
        await chrome.storage.local.set({ 'wordstream_auth_state': 'unauthenticated' });
        
        // הודע לחלקים אחרים על שינוי מצב האימות
        await notifyLocalAuthStateChanged(false);
        
        throw new Error('User authentication session expired');
      }
    }
    
    return response as T;
  } catch (error) {
    console.error('WordStream: Error sending message to background:', error);
    
    // בדוק אם זו שגיאת אימות
    if (error instanceof Error && 
       (error.message.includes('authentication') || 
        error.message.includes('session expired'))) {
      
      // עדכן את מצב האימות ב-storage
      await chrome.storage.local.set({ 'wordstream_auth_state': 'unauthenticated' });
      
      // הודע לחלקים אחרים על שינוי מצב האימות
      await notifyLocalAuthStateChanged(false);
    }
    
    throw error;
  }
};

/**
 * הודע לחלקים אחרים באותו טאב על שינוי במצב האימות
 */
async function notifyLocalAuthStateChanged(isAuthenticated: boolean) {
  try {
    // בדיקה אם אנחנו בסביבה עם window (לא Service Worker)
    if (typeof window === 'undefined') {
      // אנחנו כנראה ב-Service Worker, לא לנסות להשתמש ב-window
      console.log('WordStream: Skip window.postMessage in Service Worker environment');
      return;
    }
    
    // שימוש ב-window.postMessage לתקשורת בתוך הטאב
    window.postMessage({
      source: 'wordstream-extension',
      action: 'AUTH_STATE_CHANGED',
      isAuthenticated
    }, '*');
  } catch (error) {
    console.error('WordStream: Error in local auth state notification:', error);
  }
}

/**
 * בדוק אם קיים חיבור תקין ל-Firestore
 */
export const isFirestoreConnected = async (): Promise<boolean> => {
  try {
    const result = await sendMessageToBackground({
      action: 'CHECK_FIRESTORE_CONNECTION',
      requiresAuth: false
    });
    
    return result && result.connected === true;
  } catch (error) {
    console.error('WordStream: Error checking Firestore connection:', error);
    return false;
  }
};

/**
 * בדוק את מצב האימות הנוכחי
 */
export const checkAuthStatus = async (): Promise<{ isAuthenticated: boolean, userInfo?: any }> => {
  try {
    const result = await sendMessageToBackground({
      action: 'CHECK_AUTH',
      requiresAuth: false
    });
    
    return {
      isAuthenticated: result && result.isAuthenticated === true,
      userInfo: result?.userInfo || null
    };
  } catch (error) {
    console.error('WordStream: Error checking auth status:', error);
    return { isAuthenticated: false };
  }
};

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
 * קבלת מידע על מצב האימות של המשתמש
 * פונקציה פשוטה שרק מחזירה את המצב הנוכחי מ-background
 */
export async function getAuthState(): Promise<{
  isAuthenticated: boolean;
  userInfo?: { 
    uid?: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  } | null;
  timestamp?: number;
}> {
  try {
    // שלח בקשה למצב האימות מה-background script
    const response = await sendMessageToBackground({
      action: 'GET_AUTH_STATE'
    });
    
    // שמירת התשובה ב-localStorage לשימוש במקרי חירום (רק אם אנחנו בסביבת דפדפן)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('wordstream_last_auth_check', JSON.stringify({
          data: response,
          timestamp: Date.now()
        }));
      } catch (storageError) {
        console.warn('WordStream: Failed to cache auth state in localStorage', storageError);
      }
    }
    
    return response || { isAuthenticated: false, timestamp: Date.now() };
  } catch (error) {
    console.warn('WordStream: Failed to get auth state from background:', error);
    
    // נסיון לקרוא מידע מקומי במקרה שאין תקשורת עם ה-background (רק בסביבת דפדפן)
    if (typeof localStorage !== 'undefined') {
      try {
        const cachedData = localStorage.getItem('wordstream_last_auth_check');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          if (parsedData?.data) {
            console.log('WordStream: Using cached auth state from:', new Date(parsedData.timestamp).toLocaleString());
            return parsedData.data;
          }
        }
      } catch (storageError) {
        console.warn('WordStream: Failed to read cached auth state', storageError);
      }
    }
    
    // ברירת מחדל - לא מחובר
    return { isAuthenticated: false, timestamp: Date.now() };
  }
}

/**
 * קבלת מזהה המשתמש הנוכחי
 */
export async function getCurrentUserId(): Promise<string | null> {
  const authState = await getAuthState();
  return authState.isAuthenticated && authState.userInfo?.uid ? authState.userInfo.uid : null;
}

/**
 * בדיקה אם המשתמש מאומת
 */
export async function isAuthenticated(): Promise<boolean> {
  const authState = await getAuthState();
  return authState.isAuthenticated;
}

/**
 * אימות המשתמש ובדיקת הרשאות
 * מאפשר גם בדיקה האם המשתמש מורשה לבצע פעולה מסוימת 
 */
export async function verifyAuth(operation?: string, resourceId?: string): Promise<{
  isAuthenticated: boolean;
  hasPermission?: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // השג מצב אימות עדכני
    const authState = await getAuthState();
    
    // אם המשתמש לא מאומת, החזר שגיאה
    if (!authState.isAuthenticated || !authState.userInfo?.uid) {
      return {
        isAuthenticated: false,
        error: 'User not authenticated'
      };
    }
    
    // אם נדרשת בדיקת הרשאות ספציפית
    if (operation && resourceId) {
      try {
        // בדיקת הרשאות ספציפית
        const permissionCheck = await sendMessageToBackground({
          action: 'VERIFY_AUTH',
          operation,
          resourceId
        });
        
        // החזר את תוצאות הבדיקה
        return {
          isAuthenticated: true,
          hasPermission: permissionCheck.hasPermission !== false,
          userId: authState.userInfo?.uid,
          error: permissionCheck.error
        };
      } catch (permissionError) {
        // טיפול בשגיאות בבדיקת הרשאות
        console.error(`WordStream: Permission check failed for ${operation}/${resourceId}:`, permissionError);
        
        return {
          isAuthenticated: true,
          hasPermission: false,
          userId: authState.userInfo?.uid,
          error: permissionError instanceof Error ? 
            permissionError.message : 
            'Failed to verify permissions'
        };
      }
    }
    
    // מקרה בסיסי - המשתמש מאומת, אין צורך בבדיקת הרשאות
    return {
      isAuthenticated: true,
      userId: authState.userInfo?.uid
    };
  } catch (error) {
    // טיפול בשגיאות כלליות
    console.error('WordStream: Auth verification failed:', error);
    
    // נסיון לקרוא מידע מקומי (רק אם אנחנו בסביבת דפדפן)
    if (typeof localStorage !== 'undefined') {
      try {
        const cachedData = localStorage.getItem('wordstream_last_auth_check');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          if (parsedData?.data?.isAuthenticated) {
            console.log('WordStream: Using cached auth state in verifyAuth due to error');
            return {
              isAuthenticated: true,
              userId: parsedData.data.userInfo?.uid,
              error: 'Using cached authentication data due to connection issues'
            };
          }
        }
      } catch (storageError) {
        console.warn('WordStream: Failed to read cached auth state', storageError);
      }
    }
    
    // ברירת מחדל - לא מאומת
    return {
      isAuthenticated: false,
      error: error instanceof Error ? 
        error.message : 
        'Unknown error verifying authentication'
    };
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
    
    // Check if the error is an authentication error
    const isAuthError = error instanceof Error && (
      error.message.includes('authentication') || 
      error.message.includes('auth') ||
      error.message.includes('expired') ||
      error.message.includes('session')
    );

    if (isAuthError) {
      console.log('WordStream: Authentication error detected, checking local storage for cached notes');
      
      // Try to get data from local storage as fallback
      try {
        const cachedData = await new Promise<any[]>((resolve) => {
          chrome.storage.local.get(['videosWithNotesCache'], (result) => {
            if (result.videosWithNotesCache && Array.isArray(result.videosWithNotesCache)) {
              console.log('WordStream: Found cached videos with notes:', result.videosWithNotesCache.length);
              resolve(result.videosWithNotesCache);
            } else {
              console.log('WordStream: No cached videos with notes found');
              resolve([]);
            }
          });
        });
        
        return cachedData;
      } catch (storageError) {
        console.error('WordStream: Failed to get cached videos with notes:', storageError);
      }
    }
    
    return [];
  }
}

// ================= פונקציות לטיפול בצ'אטים =================

/**
 * קבלת כל הצ'אטים של המשתמש
 */
export async function getChats(): Promise<any[]> {
  try {
    const response = await sendMessageToBackground({ action: 'getChats' });
    return response || [];
  } catch (error) {
    console.error('WordStream: Failed to get chats:', error);
    
    // Check if the error is an authentication error
    const isAuthError = error instanceof Error && (
      error.message.includes('authentication') || 
      error.message.includes('auth') ||
      error.message.includes('expired') ||
      error.message.includes('session')
    );

    if (isAuthError) {
      console.log('WordStream: Authentication error detected, checking local storage for cached chats');
      
      // Try to get data from local storage as fallback
      try {
        const cachedData = await new Promise<any[]>((resolve) => {
          chrome.storage.local.get(['chatsCache'], (result) => {
            if (result.chatsCache && Array.isArray(result.chatsCache)) {
              console.log('WordStream: Found cached chats:', result.chatsCache.length);
              resolve(result.chatsCache);
            } else {
              console.log('WordStream: No cached chats found');
              resolve([]);
            }
          });
        });
        
        return cachedData;
      } catch (storageError) {
        console.error('WordStream: Failed to get cached chats:', storageError);
      }
    }
    
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
    const isWorkerEnvironment = typeof window === 'undefined';
    let messageListenerRemover: () => void = () => {};
    
    // Only add window message listener if we're in a browser context
    if (!isWorkerEnvironment) {
      // Add listener for messages from browser window (between features)
      const handleWindowMessage = (event: MessageEvent) => {
        if (event.data && typeof event.data === 'object' && 
           (event.data.action || event.data.type)) {
          callback(event.data);
        }
      };
      
      window.addEventListener('message', handleWindowMessage);
      messageListenerRemover = () => window.removeEventListener('message', handleWindowMessage);
    }
    
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
    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    
    // Return function that removes all listeners
    return () => {
      messageListenerRemover(); // Will either remove window listener or do nothing
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  } catch (error) {
    console.error('WordStream: Failed to setup broadcast listener:', error);
    return () => {}; // Return empty cleanup function in case of error
  }
}

/**
 * מטפל בשגיאות אימות מרכזיות של התוסף
 * פונקציה מורחבת ומשודרגת לטיפול מקיף בשגיאות אימות
 * 
 * @param error שגיאת אימות שהתקבלה מהרקע
 * @param retryCallback פונקציה שיש להפעיל לאחר התחברות מחדש (אופציונלי)
 * @returns true אם זו שגיאת אימות והיא טופלה, אחרת false
 */
export async function handleAuthError(error: any, retryCallback?: () => Promise<any>): Promise<boolean> {
  // בדיקה אם זו שגיאת אימות
  if (!error || typeof error !== 'object') return false;
  
  // בדיקה טובה יותר של שגיאות אימות נפוצות
  const isAuthError = 
    (error.error === "User authentication session expired" || 
     error.error === "User not authenticated" ||
     error.error === "Session expired" ||
     error.error === "Not authenticated" ||
     error.error === "No user" ||
     error.errorCode === "auth/session-expired" ||
     error.errorCode === "auth/user-not-authenticated" ||
     error.errorCode === "auth/requires-recent-login" ||
     error.errorCode === "auth/no-current-user" ||
     error.errorCode === "auth/user-token-expired" ||
     error.errorCode === "auth/invalid-user-token" ||
     (typeof error.error === 'string' && error.error.includes('authentication')) ||
     (typeof error.message === 'string' && error.message.includes('authentication')) ||
     (typeof error.message === 'string' && error.message.includes('auth')) ||
     (typeof error.message === 'string' && error.message.includes('session expired')));
  
  if (!isAuthError) return false;
  
  // זו שגיאת אימות, טיפול בה
  console.log("WordStream: Auth error detected", error);
  
  // ניסיון ראשון - ניקוי מטמונים מקומיים שעלולים לגרום לבעיה
  try {
    console.log("WordStream: Clearing auth caches to attempt automatic recovery");
    
    // מנקה מטמונים הקשורים לאימות מהסטורג' המקומי
    const keysToRemove = [
      'wordstream_auth_state_timestamp',
      'wordstream_user_id_timestamp'
    ];
    
    await chrome.storage.local.remove(keysToRemove);
  } catch (storageError) {
    console.error("WordStream: Failed to clear caches", storageError);
  }
  
  // שמירת הפעולה שיש לבצע אחרי התחברות מחדש
  if (retryCallback) {
    try {
      // לשמור את הפעולה לביצוע אחרי התחברות מחדש
      await chrome.storage.local.set({ 
        'wordstream_retry_after_auth': { 
          timestamp: Date.now(),
          action: error.action || 'unknown_action'
        }
      });
      console.log("WordStream: Saved retry action for after re-authentication");
    } catch (storageError) {
      console.error("WordStream: Failed to save retry action", storageError);
    }
  }
  
  // בסביבת דפדפן - שולח אירוע למשתמש (אם יש חלון פתוח כלשהו)
  if (typeof window !== 'undefined') {
    try {
      // שליחת אירוע שגיאת אימות לממשק המשתמש
      window.dispatchEvent(new CustomEvent('wordstream-auth-error', { 
        detail: {
          message: error.message || "Your session has expired. Please sign in again.",
          code: error.errorCode || "auth/session-expired"
        }
      }));
      console.log("WordStream: Dispatched auth error event to UI");
    } catch (eventError) {
      console.error("WordStream: Failed to dispatch event", eventError);
    }
  }
  
  // שולח הודעה לפתיחת חלון התחברות מחדש - פועל גם בסביבת Service Worker
  try {
    // פתיחת popup עם טופס התחברות
    await chrome.runtime.sendMessage({ 
      action: 'OPEN_AUTH_DIALOG',
      reason: 'session_expired',
      message: error.message || "Your session has expired. Please sign in again.",
      code: error.errorCode || "auth/session-expired"
    });
    console.log("WordStream: Sent message to open auth dialog");
    
    // אם נשלחה הודעה בהצלחה, מחכה לדיאלוג שייפתח
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ניסיון להציג הודעה למשתמש דרך תיבת קופצת
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'WordStream - התחברות נדרשת',
        message: 'נדרשת התחברות מחדש כדי להמשיך להשתמש בתוסף',
        priority: 2
      });
    } catch (notificationError) {
      console.error("WordStream: Failed to create notification", notificationError);
    }
    
  } catch (msgError) {
    console.error("WordStream: Failed to request auth dialog", msgError);
    
    // אם נכשל לשלוח הודעה, ננסה לפתוח את דף ההגדרות של התוסף
    try {
      await chrome.runtime.openOptionsPage();
      console.log("WordStream: Opened options page as fallback");
    } catch (optionsError) {
      console.error("WordStream: Failed to open options page", optionsError);
    }
  }
  
  return true;
}

/**
 * שולח הודעה לרקע ומטפל בשגיאות אימות באופן אוטומטי
 */
export async function sendMessageToBackgroundWithAuth<T = any>(message: any): Promise<T> {
  try {
    const response = await sendMessageToBackground(message);
    
    // אם התקבלה שגיאת אימות, טיפול בה
    if (response && response.error) {
      const isHandled = await handleAuthError(response, () => sendMessageToBackgroundWithAuth(message));
      if (isHandled) {
        // אם השגיאה טופלה, החזרת שגיאה מתאימה
        throw new Error(response.error);
      }
    }
    
    return response;
  } catch (error) {
    console.error(`WordStream: Error in ${message.action || 'unknown action'}:`, error);
    throw error;
  }
} 