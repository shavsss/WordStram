/**
 * הגדרות טיפוסי נתונים בסיסיים עבור המערכת
 * קובץ זה מגדיר את מבנה הנתונים האחיד שישמש את כל חלקי המערכת
 */

/**
 * פריט בסיסי במערכת
 * התכונות המשותפות לכל סוגי הנתונים
 */
export interface BaseItem {
  /** מזהה ייחודי של הפריט */
  id: string;
  
  /** מזהה המשתמש שיצר את הפריט */
  userId: string;
  
  /** זמן יצירת הפריט */
  createdAt: string;
  
  /** זמן עדכון אחרון של הפריט */
  updatedAt: string;
}

/**
 * מידע בסיסי של משתמש
 */
export interface UserInfo {
  /** מזהה המשתמש */
  id: string;
  
  /** שם המשתמש */
  displayName: string | null;
  
  /** כתובת האימייל */
  email: string | null;
  
  /** תמונת הפרופיל */
  photoURL: string | null;
}

/**
 * נתוני משתמש מורחבים
 */
export interface UserData {
  /** סטטיסטיקה */
  stats: UserStats;
  
  /** מזהים של שיחות שנשמרו */
  savedChatIds?: string[];
  
  /** מזהים של רשימות מילים שנשמרו */
  savedWordlistIds?: string[];
  
  /** מזהים של סרטונים עם הערות */
  videoNotesMap?: { [videoId: string]: string[] };
  
  /** הגדרות משתמש */
  settings?: UserSettings;
}

/**
 * סטטיסטיקת משתמש
 */
export interface UserStats {
  /** מספר כולל של שיחות */
  totalChats: number;
  
  /** מספר כולל של הערות */
  totalNotes: number;
  
  /** מספר כולל של מילים שנשמרו */
  totalSavedWords: number;
  
  /** תאריך הצטרפות */
  joinDate: string;
  
  /** תאריך פעילות אחרונה */
  lastActiveDate: string;
}

/**
 * הגדרות משתמש
 */
export interface UserSettings {
  /** הגדרות שפה */
  language: 'he' | 'en' | 'auto';
  
  /** מצב כהה */
  darkMode: boolean | 'auto';
  
  /** גודל גופן */
  fontSize: 'small' | 'medium' | 'large';
  
  /** האם לשמור היסטוריה באופן אוטומטי */
  autoSaveHistory: boolean;
  
  /** הגדרות התראות */
  notifications: {
    enabled: boolean;
    saveReminders: boolean;
    newFeatures: boolean;
  };
}

/**
 * מבנה הערה
 */
export interface Note extends BaseItem {
  /** תוכן ההערה */
  content: string;
  
  /** מזהה הסרטון */
  videoId: string;
  
  /** כותרת הסרטון */
  videoTitle?: string;
  
  /** נקודת הזמן בסרטון (בשניות) */
  videoTime?: number;
  
  /** האם ההערה מסומנת כמועדפת */
  isFavorite?: boolean;
  
  /** תגיות */
  tags?: string[];
  
  /** צבע ההערה */
  color?: string;
}

/**
 * סרטון עם הערות
 */
export interface VideoWithNotes {
  /** מזהה הסרטון */
  videoId: string;
  
  /** כותרת הסרטון */
  videoTitle: string;
  
  /** כתובת הסרטון */
  videoURL: string;
  
  /** זמן עדכון אחרון */
  lastUpdated: string;
  
  /** רשימת ההערות */
  notes: Note[];
}

/**
 * מבנה שיחה
 */
export interface Chat extends BaseItem {
  /** כותרת השיחה */
  title: string;
  
  /** מזהה הסרטון (אם רלוונטי) */
  videoId?: string;
  
  /** כותרת הסרטון (אם רלוונטי) */
  videoTitle?: string;
  
  /** הודעות בשיחה */
  messages: ChatMessage[];
  
  /** האם השיחה נשמרה */
  isSaved: boolean;
  
  /** תגיות */
  tags?: string[];
}

/**
 * הודעה בשיחה
 */
export interface ChatMessage {
  /** מזהה ההודעה */
  id: string;
  
  /** תוכן ההודעה */
  content: string;
  
  /** שולח ההודעה ('user' או 'assistant') */
  sender: 'user' | 'assistant';
  
  /** זמן שליחת ההודעה */
  timestamp: string;
  
  /** תכונות נוספות (לדוגמה, סגנון טקסט) */
  properties?: Record<string, any>;
}

/**
 * מילה שנשמרה
 */
export interface SavedWord extends BaseItem {
  /** המילה שנשמרה */
  word: string;
  
  /** שפת המילה */
  language: string;
  
  /** הגדרה או פירוש */
  definition?: string;
  
  /** תרגום */
  translation?: string;
  
  /** דוגמאות לשימוש */
  examples?: string[];
  
  /** קטגוריה */
  category?: string;
  
  /** תגיות */
  tags?: string[];
  
  /** מזהה הסרטון או השיחה ממנה נשמרה המילה */
  sourceId?: string;
  
  /** סוג המקור ('video' או 'chat') */
  sourceType?: 'video' | 'chat';
}

/**
 * רשימת מילים
 */
export interface Wordlist extends BaseItem {
  /** שם הרשימה */
  name: string;
  
  /** תיאור הרשימה */
  description?: string;
  
  /** שפת המילים ברשימה */
  language: string;
  
  /** מילים ברשימה */
  words: SavedWord[];
  
  /** האם הרשימה מועדפת */
  isFavorite?: boolean;
  
  /** תגיות */
  tags?: string[];
}

/**
 * מיפוי נתיבים ב-Firestore
 * מגדיר את המבנה של מסד הנתונים
 */
export const FirestorePaths = {
  // נתיבים ראשיים
  USERS: 'users',
  VIDEOS: 'videos',
  SHARED: 'shared',
  
  // תתי-אוספים של משתמשים
  USER_DATA: 'userData',
  CHATS: 'chats',
  NOTES: 'notes',
  WORDLISTS: 'wordlists',
  SAVED_WORDS: 'savedWords',
  SETTINGS: 'settings',
  
  // מסמכים מיוחדים
  STATS: 'stats',
  
  // פונקציות עזר לקבלת נתיבים מלאים
  getUserPath: (userId: string) => `${FirestorePaths.USERS}/${userId}`,
  
  // Fix: Make userData a subcollection instead of a document
  getUserDataDoc: (userId: string, docId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.USER_DATA}/${docId}`,
  
  // Collections have an odd number of segments
  getUserDataCollection: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.USER_DATA}`,
  
  // Fix: Make subcollections use items format with even segments for documents
  getUserChatsCollection: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.CHATS}`,
  getUserChatDoc: (userId: string, chatId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.CHATS}/${chatId}`,
  
  getUserNotesCollection: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.NOTES}`,
  getUserNoteDoc: (userId: string, noteId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.NOTES}/${noteId}`,
  
  getUserWordlistsCollection: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.WORDLISTS}`,
  getUserWordlistDoc: (userId: string, wordlistId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.WORDLISTS}/${wordlistId}`,
  
  getUserSavedWordsCollection: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.SAVED_WORDS}`,
  getUserSavedWordDoc: (userId: string, wordId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.SAVED_WORDS}/${wordId}`,
  
  getUserSettingsDoc: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.SETTINGS}`,
  
  getUserStatsDoc: (userId: string) => 
    `${FirestorePaths.USERS}/${userId}/${FirestorePaths.STATS}`,
  
  getVideoPath: (videoId: string) => `${FirestorePaths.VIDEOS}/${videoId}`,
  getVideoNotesPath: (videoId: string) => `${FirestorePaths.VIDEOS}/${videoId}/${FirestorePaths.NOTES}`,
}; 