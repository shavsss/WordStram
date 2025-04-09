/**
 * Background Messaging Utilities
 * 
 * מספק פונקציות לתקשורת עם סקריפט הרקע של התוסף
 */

/**
 * שליחת הודעה לסקריפט הרקע עם promise שיתרכז כשתתקבל תשובה
 * @param message ההודעה לשליחה
 * @returns Promise שיתרכז עם התשובה
 */
export async function sendMessageToBackground(message: any): Promise<any> {
  try {
    if (!chrome.runtime?.id) {
      console.warn('WordStream: Cannot send message to background - Extension context unavailable');
      return { success: false, error: 'Extension context unavailable' };
    }
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('WordStream: Error sending message to background:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        resolve(response || { success: true });
      });
    });
  } catch (error) {
    console.error('WordStream: Error in sendMessageToBackground:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * קבלת כל ההערות לוידאו מסוים מסקריפט הרקע
 * @param videoId מזהה הוידאו
 */
export async function getNotes(videoId: string): Promise<any> {
  return sendMessageToBackground({
    action: 'GET_NOTES',
    videoId
  });
}

/**
 * שמירת הערה חדשה
 * @param note נתוני ההערה
 */
export async function saveNote(note: any): Promise<any> {
  return sendMessageToBackground({
    action: 'SAVE_NOTE',
    note
  });
}

/**
 * מחיקת הערה
 * @param noteId מזהה ההערה
 * @param videoId מזהה הוידאו (אופציונלי)
 */
export async function deleteNote(noteId: string, videoId?: string): Promise<any> {
  return sendMessageToBackground({
    action: 'DELETE_NOTE',
    noteId,
    videoId
  });
}

/**
 * רישום מאזין גלובלי להודעות מסקריפט הרקע
 * @param listener פונקציית callback שתקבל את ההודעות
 * @returns פונקציה להסרת המאזין
 */
export function addMessageListener(listener: (message: any) => void): () => void {
  const handler = (message: any, sender: chrome.runtime.MessageSender) => {
    // נקבל רק הודעות מהתוסף עצמו
    if (sender.id !== chrome.runtime.id) return;
    listener(message);
  };
  
  chrome.runtime.onMessage.addListener(handler);
  
  return () => {
    chrome.runtime.onMessage.removeListener(handler);
  };
}

/**
 * בדיקת חיבור לשרת Firebase
 */
export async function checkServerConnection(): Promise<any> {
  return sendMessageToBackground({
    action: 'CHECK_SERVER_CONNECTION'
  });
}

/**
 * קבלת כל הוידאו עם הערות
 */
export async function getAllVideosWithNotes(): Promise<any> {
  return sendMessageToBackground({
    action: 'GET_ALL_VIDEOS_WITH_NOTES'
  });
}

/**
 * שליחת בקשה לתרגום
 * @param text טקסט לתרגום
 * @param targetLang שפת היעד (ברירת מחדל: אנגלית)
 */
export async function translateText(text: string, targetLang: string = 'en'): Promise<any> {
  return sendMessageToBackground({
    action: 'TRANSLATE_TEXT',
    text,
    targetLang
  });
}

/**
 * קבלת שיחות השאלות של המשתמש
 */
export async function getChats(): Promise<any> {
  return sendMessageToBackground({
    action: 'GET_CHATS'
  });
}

/**
 * שליחת הודעה לבינה מלאכותית
 * @param message ההודעה לשליחה
 * @param history היסטוריית השיחה (אופציונלי)
 */
export async function sendAIMessage(message: string, history?: any[]): Promise<any> {
  return sendMessageToBackground({
    action: 'CHAT_WITH_AI',
    message,
    history
  });
}

/**
 * מחיקת צ'אט
 * @param chatId מזהה הצ'אט
 */
export async function deleteChat(chatId: string): Promise<any> {
  return sendMessageToBackground({
    action: 'DELETE_CHAT',
    chatId
  });
}

/**
 * אתחול סנכרון נתונים
 */
export async function initializeDataSync(): Promise<any> {
  return sendMessageToBackground({
    action: 'INITIALIZE_DATA_SYNC'
  });
}

/**
 * הגדרת מאזין לשידורים (broadcast)
 * @param callback פונקציית callback שתקבל את הנתונים
 */
export function setupBroadcastListener(callback: (data: any) => void): void {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message.type === 'BROADCAST') {
      callback(message.data);
    }
  });
}

/**
 * קבלת סטטיסטיקות משתמש
 */
export async function getUserStats(): Promise<any> {
  return sendMessageToBackground({
    action: 'GET_USER_STATS'
  });
}

/**
 * שמירת סטטיסטיקות משתמש
 * @param stats נתוני הסטטיסטיקות
 */
export async function saveUserStats(stats: any): Promise<any> {
  return sendMessageToBackground({
    action: 'SAVE_USER_STATS',
    stats
  });
}

/**
 * קבלת מצב האימות (auth state)
 */
export async function getAuthState(): Promise<any> {
  return sendMessageToBackground({
    action: 'GET_AUTH_STATE'
  });
}

/**
 * מחיקת כל ההערות עבור וידאו ספציפי
 * @param videoId מזהה הוידאו
 */
export async function deleteAllNotesForVideo(videoId: string): Promise<any> {
  return sendMessageToBackground({
    action: 'DELETE_ALL_NOTES_FOR_VIDEO',
    videoId
  });
} 