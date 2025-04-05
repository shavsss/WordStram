/**
 * שירות ניהול מצב מרכזי
 * 
 * שירות זה מספק נקודת גישה אחידה וריכוזית לכל הנתונים במערכת.
 * הוא אחראי על סנכרון נתונים בין:
 * 1. אחסון מקומי (localStorage)
 * 2. Firestore
 * 3. רכיבי הממשק השונים
 * 
 * תכונות מרכזיות:
 * - מקור אמת אחד לכל הנתונים
 * - מנגנון הרשמה/פרסום לעדכונים (subscribe/publish)
 * - תמיכה באחסון מקומי עבור פעולות לא מקוונות
 * - סנכרון נתונים אוטומטי בין חלונות שונים
 */

import { FirebaseApp } from 'firebase/app';
import {
  Firestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, getDocs, onSnapshot,
  DocumentData, DocumentReference, DocumentSnapshot,
  CollectionReference, QueryDocumentSnapshot, QuerySnapshot,
  Timestamp, serverTimestamp, writeBatch, deleteField
} from 'firebase/firestore';
import { 
  Auth, User, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from 'firebase/auth';
import { generateUniqueId } from '@/utils/helpers';
import { 
  BaseItem, UserInfo, UserData, UserStats, UserSettings,
  Note, VideoWithNotes, Chat, SavedWord, Wordlist, FirestorePaths
} from './data-types';

/**
 * סוגי הנתונים שהחנות מנהלת
 */
export type StoreDataType = 'note' | 'chat' | 'word' | 'wordlist' | 'video' | 'user' | 'settings';

/**
 * סוגי אירועים שניתן להירשם אליהם
 */
export type StoreEvent = 
  // אירועי אחסון
  | 'store:initialized' 
  | 'store:error'
  | 'store:connectionChanged'
  
  // אירועי משתמש
  | 'user:login'
  | 'user:logout'
  | 'user:updated'
  
  // אירועי הערות
  | 'note:added'
  | 'note:deleted'
  | 'note:updated'
  | 'notes:synced'
  
  // אירועי שיחות
  | 'chat:added'
  | 'chat:deleted'
  | 'chat:updated'
  | 'chats:synced'
  
  // אירועי מילים
  | 'word:added'
  | 'word:deleted'
  | 'word:updated'
  | 'words:synced'
  
  // אירועי רשימות מילים
  | 'wordlist:added'
  | 'wordlist:deleted'
  | 'wordlist:updated'
  | 'wordlists:synced'
  
  // אירועי סנכרון
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed'
  | 'sync:progress';

/**
 * מבנה הנתונים של אירוע
 */
interface StoreEventData {
  type: StoreEvent;
  data: any;
  timestamp: string;
}

/**
 * פונקציית האזנה לאירועים
 */
type EventListener = (data: any) => void;

/**
 * מידע על סנכרון
 */
interface SyncInfo {
  lastSynced: string | null;
  isSyncing: boolean;
  error: string | null;
}

/**
 * מצב הסנכרון לפי סוג נתונים
 */
interface SyncState {
  notes: SyncInfo;
  chats: SyncInfo;
  words: SyncInfo;
  wordlists: SyncInfo;
  user: SyncInfo;
  settings: SyncInfo;
  global: SyncInfo;
}

/**
 * אפשרויות לאיתחול החנות
 */
interface StoreOptions {
  firestore?: Firestore;
  auth?: Auth;
  enableLocalStorage?: boolean;
  enableBroadcastChannel?: boolean;
  debug?: boolean;
}

// קבועים
const LOCAL_STORAGE_PREFIX = 'wordStram:';
const BROADCAST_CHANNEL_NAME = 'wordStram-sync-channel';
const DEFAULT_BATCH_SIZE = 20;

/**
 * שירות ניהול המצב המרכזי
 */
class StoreService {
  private firestore: Firestore | null = null;
  private auth: Auth | null = null;
  private user: User | null = null;
  private userData: UserData | null = null;
  
  private isInitialized = false;
  private isOnline = navigator.onLine;
  private enableLocalStorage = true;
  private enableBroadcastChannel = true;
  private debug = false;
  
  // מנגנון הרשמה/פרסום
  private eventListeners: Map<StoreEvent, Map<string, EventListener>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  
  // אוספי הנתונים
  private notes: Map<string, Note> = new Map();
  private videosWithNotes: Map<string, VideoWithNotes> = new Map();
  private chats: Map<string, Chat> = new Map();
  private savedWords: Map<string, SavedWord> = new Map();
  private wordlists: Map<string, Wordlist> = new Map();
  
  // מנויים פעילים לעדכונים מ-Firestore
  private activeSubscriptions: Map<string, () => void> = new Map();
  
  // מצב הסנכרון
  private syncState: SyncState = {
    notes: { lastSynced: null, isSyncing: false, error: null },
    chats: { lastSynced: null, isSyncing: false, error: null },
    words: { lastSynced: null, isSyncing: false, error: null },
    wordlists: { lastSynced: null, isSyncing: false, error: null },
    user: { lastSynced: null, isSyncing: false, error: null },
    settings: { lastSynced: null, isSyncing: false, error: null },
    global: { lastSynced: null, isSyncing: false, error: null }
  };
  
  /**
   * חיבור לשירותי Firebase
   */
  initialize(options: StoreOptions): void {
    this.firestore = options.firestore || null;
    this.auth = options.auth || null;
    this.enableLocalStorage = options.enableLocalStorage ?? true;
    this.enableBroadcastChannel = options.enableBroadcastChannel ?? true;
    this.debug = options.debug ?? false;
    
    // חיבור למאזיני אירועים
    this.setupListeners();
    
    // סימון כמאותחל
    this.isInitialized = true;
    
    // שידור אירוע אתחול
    this.emit('store:initialized', { timestamp: new Date().toISOString() });
    
    this.logDebug('Store initialized');
  }
  
  /**
   * הגדרת מאזינים לאירועים מערכתיים
   */
  private setupListeners(): void {
    // האזנה למצב חיבור לרשת
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('store:connectionChanged', { isOnline: true });
      this.syncAll(); // סנכרון עם שרת כשהחיבור חוזר
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('store:connectionChanged', { isOnline: false });
    });
    
    // הגדרת ערוץ שידור בין חלונות אם פעיל
    if (this.enableBroadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => this.handleBroadcastMessage(event.data);
      } catch (error) {
        this.logDebug('BroadcastChannel not supported', error);
        this.enableBroadcastChannel = false;
      }
    }
    
    // האזנה למצב המשתמש אם יש אובייקט Auth
    if (this.auth) {
      onAuthStateChanged(this.auth, (user) => {
        // משתמש התחבר או התנתק
        const wasLoggedIn = !!this.user;
        const isLoggedIn = !!user;
        this.user = user;
        
        if (!wasLoggedIn && isLoggedIn) {
          // התחברות חדשה
          this.emit('user:login', this.getUserInfo());
          this.fetchUserData();
        } else if (wasLoggedIn && !isLoggedIn) {
          // התנתקות
          this.emit('user:logout', { timestamp: new Date().toISOString() });
          this.clearUserData();
        }
      });
    }
  }
  
  /**
   * הדפסת הודעות ניפוי שגיאות אם מצב דיבוג מופעל
   */
  private logDebug(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[Store] ${message}`, ...args);
    }
  }
  
  /**
   * קבלת מידע בסיסי על המשתמש המחובר
   */
  private getUserInfo(): UserInfo | null {
    if (!this.user) return null;
    
    return {
      id: this.user.uid,
      displayName: this.user.displayName,
      email: this.user.email,
      photoURL: this.user.photoURL
    };
  }
  
  /**
   * ניקוי נתוני משתמש מהמטמון
   */
  private clearUserData(): void {
    this.userData = null;
    this.notes.clear();
    this.videosWithNotes.clear();
    this.chats.clear();
    this.savedWords.clear();
    this.wordlists.clear();
    
    // ביטול כל ההאזנות לפיירסטור
    this.activeSubscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    this.activeSubscriptions.clear();
  }
  
  /**
   * טיפול בהודעות מחלונות אחרים
   */
  private handleBroadcastMessage(message: StoreEventData): void {
    if (!message || !message.type) return;
    
    this.logDebug('Received broadcast message', message);
    
    // טיפול באירועים ספציפיים שדורשים סנכרון
    switch (message.type) {
      case 'note:added':
      case 'note:updated':
        if (message.data?.note) {
          const note = message.data.note as Note;
          this.updateNoteLocally(note);
        }
        break;
        
      case 'note:deleted':
        if (message.data?.noteId) {
          this.removeNoteLocally(message.data.noteId, message.data.videoId);
        }
        break;
        
      case 'notes:synced':
        this.fetchNotes();
        break;
        
      case 'chat:added':
      case 'chat:updated':
        if (message.data?.chat) {
          const chat = message.data.chat as Chat;
          this.updateChatLocally(chat);
        }
        break;
        
      case 'chat:deleted':
        if (message.data?.chatId) {
          this.removeChatLocally(message.data.chatId);
        }
        break;
        
      case 'chats:synced':
        this.fetchChats();
        break;
        
      case 'sync:started':
      case 'sync:completed':
      case 'sync:failed':
        // עדכון מצב סנכרון גלובלי
        this.syncState.global = {
          lastSynced: message.timestamp,
          isSyncing: message.type === 'sync:started',
          error: message.type === 'sync:failed' ? message.data?.error || 'Unknown error' : null
        };
        break;
        
      // ניתן להוסיף טיפול באירועים נוספים
    }
    
    // שידור האירוע למאזינים מקומיים
    this.emit(message.type, message.data);
  }
  
  /**
   * שידור אירוע למאזינים מקומיים ולחלונות אחרים
   */
  private emit(type: StoreEvent, data: any): void {
    const timestamp = new Date().toISOString();
    const eventData = { type, data, timestamp };
    
    this.logDebug(`Emitting event: ${type}`, data);
    
    // שידור לכל המאזינים המקומיים
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in listener for ${type}:`, error);
        }
      });
    }
    
    // שידור לחלונות אחרים אם פעיל
    if (this.enableBroadcastChannel && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(eventData);
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    }
  }
  
  /**
   * רישום לאירוע
   * @param event סוג האירוע 
   * @param listener פונקציית המאזין
   * @returns מזהה המנוי לשימוש בביטול הרשמה
   */
  subscribe(event: StoreEvent, listener: EventListener): string {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Map());
    }
    
    const listeners = this.eventListeners.get(event)!;
    const id = generateUniqueId('listener');
    listeners.set(id, listener);
    
    return id;
  }
  
  /**
   * ביטול הרשמה לאירוע
   * @param event סוג האירוע
   * @param id מזהה המנוי
   */
  unsubscribe(event: StoreEvent, id: string): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(id);
    }
  }
  
  /**
   * קבלת נתוני המשתמש
   */
  async fetchUserData(): Promise<UserData | null> {
    if (!this.user || !this.firestore) return null;
    
    try {
      this.syncState.user.isSyncing = true;
      
      const userId = this.user.uid;
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDocSnapshot = await getDoc(userDocRef);
      
      if (userDocSnapshot.exists() && userDocSnapshot.data().userData) {
        this.userData = userDocSnapshot.data().userData as UserData;
      } else {
        // יצירת נתוני משתמש ראשוניים אם לא קיימים
        this.userData = {
          stats: {
            totalChats: 0,
            totalNotes: 0,
            totalSavedWords: 0,
            joinDate: new Date().toISOString(),
            lastActiveDate: new Date().toISOString()
          }
        };
        
        // שמירה בפיירסטור - update userData as a field in the user document
        await updateDoc(userDocRef, {
          userData: this.userData,
          updatedAt: new Date().toISOString()
        });
      }
      
      // עדכון מצב סנכרון
      this.syncState.user = {
        lastSynced: new Date().toISOString(),
        isSyncing: false,
        error: null
      };
      
      // טעינת הערות, שיחות, מילים ורשימות מילים
      this.fetchNotes();
      this.fetchChats();
      this.fetchSavedWords();
      this.fetchWordlists();
      
      return this.userData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching user data:', error);
      
      this.syncState.user = {
        lastSynced: this.syncState.user.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
      
      return null;
    }
  }
  
  /**
   * עדכון הערה במטמון המקומי
   */
  private updateNoteLocally(note: Note): void {
    if (!note || !note.id) return;
    
    // עדכון במפת ההערות
    this.notes.set(note.id, note);
    
    // עדכון במפת הסרטונים עם הערות
    if (note.videoId) {
      let videoWithNotes = this.videosWithNotes.get(note.videoId);
      
      if (!videoWithNotes) {
        // יצירת רשומת וידאו חדשה אם לא קיימת
        videoWithNotes = {
          videoId: note.videoId,
          videoTitle: note.videoTitle || 'Unknown Video',
          videoURL: `https://www.youtube.com/watch?v=${note.videoId}`,
          lastUpdated: new Date().toISOString(),
          notes: []
        };
        this.videosWithNotes.set(note.videoId, videoWithNotes);
      }
      
      // בדיקה אם ההערה כבר קיימת ברשימה
      const noteIndex = videoWithNotes.notes.findIndex(n => n.id === note.id);
      
      if (noteIndex >= 0) {
        // עדכון הערה קיימת
        videoWithNotes.notes[noteIndex] = note;
      } else {
        // הוספת הערה חדשה
        videoWithNotes.notes.push(note);
      }
      
      // עדכון זמן העדכון האחרון
      videoWithNotes.lastUpdated = new Date().toISOString();
    }
  }
  
  /**
   * הסרת הערה מהמטמון המקומי
   */
  private removeNoteLocally(noteId: string, videoId?: string): void {
    // הסרה ממפת ההערות
    this.notes.delete(noteId);
    
    // אם יש מזהה וידאו ידוע
    if (videoId) {
      const videoWithNotes = this.videosWithNotes.get(videoId);
      
      if (videoWithNotes) {
        // הסרת ההערה מרשימת ההערות של הסרטון
        videoWithNotes.notes = videoWithNotes.notes.filter(n => n.id !== noteId);
        
        // עדכון זמן השינוי האחרון
        videoWithNotes.lastUpdated = new Date().toISOString();
        
        // אם אין עוד הערות לסרטון, מסיר אותו מהמפה
        if (videoWithNotes.notes.length === 0) {
          this.videosWithNotes.delete(videoId);
        }
      }
    } else {
      // חיפוש בכל הסרטונים אם אין מזהה וידאו ידוע
      for (const [vid, videoWithNotes] of this.videosWithNotes.entries()) {
        const hasNote = videoWithNotes.notes.some(n => n.id === noteId);
        
        if (hasNote) {
          // הסרת ההערה מרשימת ההערות של הסרטון
          videoWithNotes.notes = videoWithNotes.notes.filter(n => n.id !== noteId);
          
          // עדכון זמן השינוי האחרון
          videoWithNotes.lastUpdated = new Date().toISOString();
          
          // אם אין עוד הערות לסרטון, מסיר אותו מהמפה
          if (videoWithNotes.notes.length === 0) {
            this.videosWithNotes.delete(vid);
          }
          
          break;
        }
      }
    }
  }
  
  /**
   * עדכון שיחה במטמון המקומי
   */
  private updateChatLocally(chat: Chat): void {
    if (!chat || !chat.id) return;
    
    // עדכון במפת השיחות
    this.chats.set(chat.id, chat);
  }
  
  /**
   * הסרת שיחה מהמטמון המקומי
   */
  private removeChatLocally(chatId: string): void {
    // הסרה ממפת השיחות
    this.chats.delete(chatId);
  }
  
  /**
   * טעינת כל ההערות מפיירסטור
   */
  async fetchNotes(): Promise<void> {
    if (!this.user || !this.firestore) return;
    
    try {
      this.syncState.notes.isSyncing = true;
      
      const userId = this.user.uid;
      const notesRef = collection(this.firestore, 'users', userId, 'notes');
      
      // שליפת כל ההערות
      const notesSnapshot = await getDocs(notesRef);
      
      // איפוס המטמון הנוכחי
      this.notes.clear();
      this.videosWithNotes.clear();
      
      // עיבוד ההערות
      notesSnapshot.forEach(doc => {
        const noteData = doc.data() as Note;
        
        // וידוא תקינות הנתונים
        if (noteData && noteData.id) {
          // עדכון במפת ההערות
          this.notes.set(noteData.id, noteData);
          
          // ארגון לפי סרטונים
          if (noteData.videoId) {
            let videoWithNotes = this.videosWithNotes.get(noteData.videoId);
            
            if (!videoWithNotes) {
              // יצירת רשומת וידאו חדשה אם לא קיימת
              videoWithNotes = {
                videoId: noteData.videoId,
                videoTitle: noteData.videoTitle || 'Unknown Video',
                videoURL: `https://www.youtube.com/watch?v=${noteData.videoId}`,
                lastUpdated: new Date().toISOString(),
                notes: []
              };
              this.videosWithNotes.set(noteData.videoId, videoWithNotes);
            }
            
            // הוספת ההערה לרשימת ההערות של הסרטון
            videoWithNotes.notes.push(noteData);
            
            // עדכון זמן העדכון האחרון אם נדרש
            const noteTimestamp = noteData.updatedAt || noteData.createdAt;
            if (noteTimestamp && noteTimestamp > videoWithNotes.lastUpdated) {
              videoWithNotes.lastUpdated = noteTimestamp;
            }
          }
        }
      });
      
      // עדכון מצב הסנכרון
      this.syncState.notes = {
        lastSynced: new Date().toISOString(),
        isSyncing: false,
        error: null
      };
      
      // שידור אירוע סנכרון הערות
      this.emit('notes:synced', {
        count: this.notes.size,
        videosCount: this.videosWithNotes.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching notes:', error);
      
      this.syncState.notes = {
        lastSynced: this.syncState.notes.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * סנכרון כל הנתונים מפיירסטור
   */
  async syncAll(): Promise<boolean> {
    if (!this.user || !this.firestore || !this.isOnline) {
      return false;
    }

    try {
      // עדכון מצב סנכרון גלובלי
      this.syncState.global.isSyncing = true;
      
      // שידור אירוע התחלת סנכרון
      this.emit('sync:started', { timestamp: new Date().toISOString() });
      
      // סנכרון של כל סוגי הנתונים
      await Promise.all([
        this.fetchUserData(),
        this.fetchNotes(),
        this.fetchChats(),
        this.fetchSavedWords(),
        this.fetchWordlists()
      ]);
      
      // עדכון זמן סנכרון אחרון
      const timestamp = new Date().toISOString();
      this.syncState.global = {
        lastSynced: timestamp,
        isSyncing: false,
        error: null
      };
      
      // שידור אירוע סיום סנכרון
      this.emit('sync:completed', { timestamp });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error syncing all data:', error);
      
      // עדכון מצב סנכרון גלובלי
      this.syncState.global = {
        lastSynced: this.syncState.global.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
      
      // שידור אירוע שגיאת סנכרון
      this.emit('sync:failed', { error: errorMessage, timestamp: new Date().toISOString() });
      
      return false;
    }
  }
  
  /**
   * טעינת כל השיחות מפיירסטור
   */
  async fetchChats(): Promise<void> {
    if (!this.user || !this.firestore) return;
    
    try {
      this.syncState.chats.isSyncing = true;
      
      const userId = this.user.uid;
      const chatsRef = collection(this.firestore, 'users', userId, 'chats');
      
      // שליפת כל השיחות
      const chatsSnapshot = await getDocs(chatsRef);
      
      // איפוס המטמון הנוכחי
      this.chats.clear();
      
      // עיבוד השיחות
      chatsSnapshot.forEach(doc => {
        const chatData = doc.data() as Chat;
        
        // וידוא תקינות הנתונים
        if (chatData && chatData.id) {
          // עדכון במפת השיחות
          this.chats.set(chatData.id, chatData);
        }
      });
      
      // עדכון מצב הסנכרון
      this.syncState.chats = {
        lastSynced: new Date().toISOString(),
        isSyncing: false,
        error: null
      };
      
      // שידור אירוע סנכרון שיחות
      this.emit('chats:synced', {
        count: this.chats.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching chats:', error);
      
      this.syncState.chats = {
        lastSynced: this.syncState.chats.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * טעינת כל המילים השמורות מפיירסטור
   */
  async fetchSavedWords(): Promise<void> {
    if (!this.user || !this.firestore) return;
    
    try {
      this.syncState.words.isSyncing = true;
      
      const userId = this.user.uid;
      const savedWordsRef = collection(this.firestore, 'users', userId, 'savedWords');
      
      // שליפת כל המילים
      const savedWordsSnapshot = await getDocs(savedWordsRef);
      
      // איפוס המטמון הנוכחי
      this.savedWords.clear();
      
      // עיבוד המילים
      savedWordsSnapshot.forEach(doc => {
        const wordData = doc.data() as SavedWord;
        
        // וידוא תקינות הנתונים
        if (wordData && wordData.id) {
          // עדכון במפת המילים
          this.savedWords.set(wordData.id, wordData);
        }
      });
      
      // עדכון מצב הסנכרון
      this.syncState.words = {
        lastSynced: new Date().toISOString(),
        isSyncing: false,
        error: null
      };
      
      // שידור אירוע סנכרון מילים
      this.emit('words:synced', {
        count: this.savedWords.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching saved words:', error);
      
      this.syncState.words = {
        lastSynced: this.syncState.words.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * טעינת כל רשימות המילים מפיירסטור
   */
  async fetchWordlists(): Promise<void> {
    if (!this.user || !this.firestore) return;
    
    try {
      this.syncState.wordlists.isSyncing = true;
      
      const userId = this.user.uid;
      const wordlistsRef = collection(this.firestore, 'users', userId, 'wordlists');
      
      // שליפת כל רשימות המילים
      const wordlistsSnapshot = await getDocs(wordlistsRef);
      
      // איפוס המטמון הנוכחי
      this.wordlists.clear();
      
      // עיבוד רשימות המילים
      wordlistsSnapshot.forEach(doc => {
        const wordlistData = doc.data() as Wordlist;
        
        // וידוא תקינות הנתונים
        if (wordlistData && wordlistData.id) {
          // עדכון במפת רשימות המילים
          this.wordlists.set(wordlistData.id, wordlistData);
        }
      });
      
      // עדכון מצב הסנכרון
      this.syncState.wordlists = {
        lastSynced: new Date().toISOString(),
        isSyncing: false,
        error: null
      };
      
      // שידור אירוע סנכרון רשימות מילים
      this.emit('wordlists:synced', {
        count: this.wordlists.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching wordlists:', error);
      
      this.syncState.wordlists = {
        lastSynced: this.syncState.wordlists.lastSynced,
        isSyncing: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * קבלת כל ההערות לסרטון ספציפי
   */
  getNotes(videoId: string): Note[] {
    if (!videoId) return [];
    
    const videoWithNotes = this.videosWithNotes.get(videoId);
    
    if (!videoWithNotes) return [];
    
    // מיון ההערות לפי זמן הוידאו אם קיים, אחרת לפי זמן יצירה
    return [...videoWithNotes.notes].sort((a, b) => {
      if (a.videoTime !== undefined && b.videoTime !== undefined) {
        return a.videoTime - b.videoTime;
      }
      
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      return aTime.localeCompare(bTime);
    });
  }
  
  /**
   * קבלת כל הסרטונים עם הערות
   */
  getAllVideosWithNotes(): VideoWithNotes[] {
    return Array.from(this.videosWithNotes.values())
      .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
  }
  
  /**
   * קבלת כל השיחות
   */
  getAllChats(): Chat[] {
    return Array.from(this.chats.values())
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  
  /**
   * קבלת כל המילים השמורות
   */
  getAllSavedWords(): SavedWord[] {
    return Array.from(this.savedWords.values())
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  
  /**
   * קבלת כל רשימות המילים
   */
  getAllWordlists(): Wordlist[] {
    return Array.from(this.wordlists.values())
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  
  /**
   * שמירת הערה
   * @param noteData נתוני ההערה
   */
  async saveNote(noteData: Partial<Note>): Promise<string | null> {
    if (!this.user || !this.firestore) return null;
    
    try {
      const userId = this.user.uid;
      const noteId = noteData.id || generateUniqueId();
      
      // הכנת נתוני ההערה עם שדות תאריך ומזהה
      const note: Note = {
        ...noteData as Note,
        id: noteId,
        userId,
        createdAt: noteData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // שמירה בפיירסטור - use the proper document reference path (even segments)
      const noteRef = doc(this.firestore, 'users', userId, 'notes', noteId);
      await setDoc(noteRef, note);
      
      // עדכון במטמון המקומי
      this.notes.set(noteId, note);
      
      // אם קיים מזהה וידאו, נעדכן גם את רשימת ההערות של הוידאו
      if (note.videoId) {
        // בדיקה אם הסרטון קיים כבר במטמון
        let videoWithNotes = this.videosWithNotes.get(note.videoId);
        
        if (!videoWithNotes) {
          // יצירת רשומת וידאו חדשה
          videoWithNotes = {
            videoId: note.videoId,
            videoTitle: note.videoTitle || 'Unknown Video',
            videoURL: `https://www.youtube.com/watch?v=${note.videoId}`,
            lastUpdated: new Date().toISOString(),
            notes: []
          };
          this.videosWithNotes.set(note.videoId, videoWithNotes);
        }
        
        // הוספת/עדכון ההערה ברשימה
        const noteIndex = videoWithNotes.notes.findIndex(n => n.id === noteId);
        if (noteIndex >= 0) {
          videoWithNotes.notes[noteIndex] = note;
        } else {
          videoWithNotes.notes.push(note);
        }
        
        // עדכון זמן העדכון האחרון של הסרטון
        videoWithNotes.lastUpdated = new Date().toISOString();
        
        // עדכון מסמך הסרטון בפיירסטור
        try {
          const videoRef = doc(this.firestore, 'users', userId, 'videos', note.videoId);
          await setDoc(videoRef, {
            videoId: note.videoId,
            videoTitle: note.videoTitle || 'Unknown Video',
            videoURL: videoWithNotes.videoURL,
            lastUpdated: new Date().toISOString(),
            noteIds: { [noteId]: true }
          }, { merge: true });
        } catch (error) {
          console.warn('Error updating video document:', error);
          // המשך בכל מקרה כי ההערה נשמרה
        }
      }
      
      // שידור אירוע
      this.emit('note:added', note);
      
      return noteId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving note:', error);
      return null;
    }
  }
  
  /**
   * מחיקת הערה
   * @param noteId מזהה ההערה
   */
  async deleteNote(noteId: string): Promise<boolean> {
    if (!this.user || !this.firestore) return false;
    
    try {
      const userId = this.user.uid;
      
      // קבלת ההערה מהמטמון לפני מחיקתה
      const note = this.notes.get(noteId);
      
      // מחיקה מפיירסטור - use the proper document reference path (even segments)
      const noteRef = doc(this.firestore, 'users', userId, 'notes', noteId);
      await deleteDoc(noteRef);
      
      // מחיקה מהמטמון המקומי
      this.notes.delete(noteId);
      
      // אם יש מזהה וידאו, נעדכן גם את רשימת ההערות של הוידאו
      if (note?.videoId) {
        const videoWithNotes = this.videosWithNotes.get(note.videoId);
        
        if (videoWithNotes) {
          // מחיקת ההערה מרשימת ההערות של הסרטון
          videoWithNotes.notes = videoWithNotes.notes.filter(n => n.id !== noteId);
          
          // עדכון זמן העדכון האחרון של הסרטון
          videoWithNotes.lastUpdated = new Date().toISOString();
          
          // עדכון מסמך הסרטון בפיירסטור
          try {
            const videoRef = doc(this.firestore, 'users', userId, 'videos', note.videoId);
            await updateDoc(videoRef, {
              lastUpdated: new Date().toISOString(),
              [`noteIds.${noteId}`]: deleteField()
            });
          } catch (error) {
            console.warn('Error updating video document:', error);
            // המשך בכל מקרה כי ההערה נמחקה
          }
          
          // אם אין עוד הערות לסרטון, ניתן למחוק אותו מהמטמון
          if (videoWithNotes.notes.length === 0) {
            this.videosWithNotes.delete(note.videoId);
          }
        }
      }
      
      // שידור אירוע
      this.emit('note:deleted', { id: noteId, videoId: note?.videoId });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting note:', error);
      return false;
    }
  }
  
  /**
   * שמירת שיחה חדשה או עדכון שיחה קיימת
   */
  async saveChat(chatData: Partial<Chat>): Promise<string | null> {
    if (!this.user || !this.firestore) {
      console.error('Cannot save chat: No user or Firestore connection');
      return null;
    }
    
    try {
      const userId = this.user.uid;
      const timestamp = new Date().toISOString();
      
      // יצירת מזהה חדש אם צריך
      const chatId = chatData.id || generateUniqueId('chat');
      
      // בניית אובייקט שיחה שלם
      const chat: Chat = {
        id: chatId,
        userId,
        title: chatData.title || 'שיחה חדשה',
        messages: chatData.messages || [],
        isSaved: chatData.isSaved ?? true,
        createdAt: chatData.createdAt || timestamp,
        updatedAt: timestamp,
        // העתקת שאר השדות אם קיימים
        ...(chatData.videoId && { videoId: chatData.videoId }),
        ...(chatData.videoTitle && { videoTitle: chatData.videoTitle }),
        ...(chatData.tags && { tags: chatData.tags })
      };
      
      // שמירה בפיירסטור
      const chatRef = doc(this.firestore, 'users', userId, 'chats', chatId);
      
      await setDoc(chatRef, chat);
      
      // עדכון הנתונים באוסף המשתמש
      if (this.userData) {
        // יוצר או מעדכן את רשימת השיחות השמורות
        if (!this.userData.savedChatIds) {
          this.userData.savedChatIds = [];
        }
        
        // וידוא שמזהה השיחה קיים ברשימה
        if (chat.isSaved && !this.userData.savedChatIds.includes(chatId)) {
          this.userData.savedChatIds.push(chatId);
          
          // עדכון מסמך נתוני המשתמש
          const userRef = doc(this.firestore, 'users', userId);
          
          await updateDoc(userRef, {
            savedChatIds: this.userData.savedChatIds,
            'stats.lastActiveDate': timestamp
          });
          
          // עדכון סטטיסטיקות אם זו שיחה חדשה
          if (!chatData.id) {
            if (!this.userData.stats) {
              this.userData.stats = {
                totalChats: 0,
                totalNotes: 0,
                totalSavedWords: 0,
                joinDate: timestamp,
                lastActiveDate: timestamp
              };
            }
            
            this.userData.stats.totalChats++;
            
            await updateDoc(userRef, {
              'stats.totalChats': this.userData.stats.totalChats
            });
          }
        }
      }
      
      // עדכון במטמון המקומי
      this.updateChatLocally(chat);
      
      // שידור אירוע עדכון שיחה
      const eventType = chatData.id ? 'chat:updated' : 'chat:added';
      this.emit(eventType, { chat });
      
      return chatId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving chat:', error);
      return null;
    }
  }
  
  /**
   * מחיקת שיחה
   */
  async deleteChat(chatId: string): Promise<boolean> {
    if (!this.user || !this.firestore) {
      console.error('Cannot delete chat: No user or Firestore connection');
      return false;
    }
    
    try {
      const userId = this.user.uid;
      
      // מחיקה מפיירסטור
      const chatRef = doc(this.firestore, 'users', userId, 'chats', chatId);
      
      await deleteDoc(chatRef);
      
      // עדכון הנתונים באוסף המשתמש
      if (this.userData && this.userData.savedChatIds) {
        // הסרת מזהה השיחה מהרשימה
        this.userData.savedChatIds = this.userData.savedChatIds.filter(id => id !== chatId);
        
        // עדכון מסמך נתוני המשתמש
        const timestamp = new Date().toISOString();
        const userRef = doc(this.firestore, 'users', userId);
        
        await updateDoc(userRef, {
          savedChatIds: this.userData.savedChatIds,
          'stats.lastActiveDate': timestamp
        });
        
        // עדכון סטטיסטיקות
        if (this.userData.stats && this.userData.stats.totalChats > 0) {
          this.userData.stats.totalChats--;
          
          await updateDoc(userRef, {
            'stats.totalChats': this.userData.stats.totalChats
          });
        }
      }
      
      // עדכון במטמון המקומי
      this.removeChatLocally(chatId);
      
      // שידור אירוע מחיקת שיחה
      this.emit('chat:deleted', { chatId });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting chat:', error);
      return false;
    }
  }
  
  /**
   * בדיקת חיבור לפיירסטור
   */
  isConnected(): boolean {
    return !!this.firestore && this.isOnline;
  }
  
  /**
   * סטטוס רישום להאזנה לשינויים
   */
  isListening(): boolean {
    return this.activeSubscriptions.size > 0;
  }
  
  /**
   * קבלת מצב סנכרון נוכחי
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }
  
  /**
   * גישה לאחסון מקומי
   */
  private getLocalStorageKey(key: string): string {
    return `${LOCAL_STORAGE_PREFIX}${key}`;
  }
  
  /**
   * שמירה באחסון מקומי
   */
  private saveToLocalStorage<T>(key: string, data: T): void {
    if (!this.enableLocalStorage) return;
    
    try {
      const storageKey = this.getLocalStorageKey(key);
      const serializedData = JSON.stringify(data);
      localStorage.setItem(storageKey, serializedData);
    } catch (error) {
      console.error(`Error saving to localStorage [${key}]:`, error);
    }
  }
  
  /**
   * קריאה מאחסון מקומי
   */
  private getFromLocalStorage<T>(key: string, defaultValue: T): T {
    if (!this.enableLocalStorage) return defaultValue;
    
    try {
      const storageKey = this.getLocalStorageKey(key);
      const serializedData = localStorage.getItem(storageKey);
      
      if (serializedData === null) {
        return defaultValue;
      }
      
      return JSON.parse(serializedData) as T;
    } catch (error) {
      console.error(`Error reading from localStorage [${key}]:`, error);
      return defaultValue;
    }
  }
  
  /**
   * מחיקה מאחסון מקומי
   */
  private removeFromLocalStorage(key: string): void {
    if (!this.enableLocalStorage) return;
    
    try {
      const storageKey = this.getLocalStorageKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Error removing from localStorage [${key}]:`, error);
    }
  }
  
  /**
   * שמירת כל הנתונים באחסון מקומי
   */
  saveStateToLocalStorage(): void {
    if (!this.enableLocalStorage) return;
    
    this.logDebug('Saving state to localStorage');
    
    // שמירת הערות לפי סרטונים
    this.saveToLocalStorage('videosWithNotes', Array.from(this.videosWithNotes.values()));
    
    // שמירת שיחות
    this.saveToLocalStorage('chats', Array.from(this.chats.values()));
    
    // שמירת מילים
    this.saveToLocalStorage('savedWords', Array.from(this.savedWords.values()));
    
    // שמירת רשימות מילים
    this.saveToLocalStorage('wordlists', Array.from(this.wordlists.values()));
    
    // שמירת מצב סנכרון
    this.saveToLocalStorage('syncState', this.syncState);
  }
  
  /**
   * טעינת נתונים מאחסון מקומי
   */
  loadStateFromLocalStorage(): void {
    if (!this.enableLocalStorage) return;
    
    this.logDebug('Loading state from localStorage');
    
    // טעינת הערות לפי סרטונים
    const videosWithNotes = this.getFromLocalStorage<VideoWithNotes[]>('videosWithNotes', []);
    this.videosWithNotes.clear();
    videosWithNotes.forEach(video => {
      this.videosWithNotes.set(video.videoId, video);
      
      // עדכון גם את מפת ההערות הבודדות
      video.notes.forEach(note => {
        this.notes.set(note.id, note);
      });
    });
    
    // טעינת שיחות
    const chats = this.getFromLocalStorage<Chat[]>('chats', []);
    this.chats.clear();
    chats.forEach(chat => {
      this.chats.set(chat.id, chat);
    });
    
    // טעינת מילים שמורות
    const savedWords = this.getFromLocalStorage<SavedWord[]>('savedWords', []);
    this.savedWords.clear();
    savedWords.forEach(word => {
      this.savedWords.set(word.id, word);
    });
    
    // טעינת רשימות מילים
    const wordlists = this.getFromLocalStorage<Wordlist[]>('wordlists', []);
    this.wordlists.clear();
    wordlists.forEach(wordlist => {
      this.wordlists.set(wordlist.id, wordlist);
    });
    
    // טעינת מצב סנכרון
    const syncState = this.getFromLocalStorage<SyncState>('syncState', this.syncState);
    this.syncState = syncState;
  }
}

/**
 * ייבוא מודול Firebase
 */
import { app, firestore, auth } from '@/core/firebase/config';

// יצירת מופע של שירות ניהול המצב
const store = new StoreService();

// אתחול השירות עם התצורה הנכונה
store.initialize({
  firestore,
  auth,
  enableLocalStorage: true,
  enableBroadcastChannel: true,
  debug: process.env.NODE_ENV !== 'production'
});

// ייצוא יחיד של שירות ניהול המצב
export default store; 