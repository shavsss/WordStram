import firebaseService from '../firebase';

// בדיקת סביבת Service Worker
const isServiceWorkerEnvironment = typeof window === 'undefined' || typeof document === 'undefined';

/**
 * Interface for common types of data that can be synchronized
 */
interface SyncData {
  words?: any[];
  notes?: { [videoId: string]: any[] };
  statistics?: any;
  settings?: any;
}

/**
 * SyncService provides a unified interface for data storage
 * that transparently syncs between local storage and Firebase
 */
const SyncService = {
  /**
   * Initialize the sync service
   */
  init(): void {
    // רק אם אנחנו לא בסביבת Service Worker, נוסיף מאזין לשינויי התחברות
    if (!isServiceWorkerEnvironment) {
      try {
        // Add event listener for authentication state changes
        document.addEventListener('wordstream-auth-changed', async (e: Event) => {
          const event = e as CustomEvent;
          const isAuthenticated = event.detail?.isAuthenticated;
          
          if (isAuthenticated) {
            // User just signed in, sync local data to Firebase
            await this.syncLocalToCloud();
          }
        });
        
        console.log('[WordStream] Sync service initialized with event listener');
      } catch (error) {
        console.error('[WordStream] Error initializing sync service event listeners:', error);
      }
    } else {
      console.log('[WordStream] Sync service initialized in Service Worker environment (no event listeners)');
    }
  },
  
  /**
   * Check if the user is authenticated with Firebase
   */
  isAuthenticated(): boolean {
    return !!firebaseService.getCurrentUser();
  },
  
  /**
   * Check if we're in offline mode
   */
  isInOfflineMode(): boolean {
    return firebaseService.isInOfflineMode ? firebaseService.isInOfflineMode() : false;
  },
  
  /**
   * Check connectivity to Firebase services
   */
  async checkConnectivity(): Promise<boolean> {
    if (firebaseService.checkConnectivity) {
      return await firebaseService.checkConnectivity();
    }
    return false;
  },
  
  /**
   * Sign in with Google
   */
  async signIn(): Promise<boolean> {
    // נוודא שאנחנו לא בסביבת Service Worker לפני שמנסים להתחבר
    if (isServiceWorkerEnvironment) {
      console.error('[WordStream] Cannot sign in from Service Worker environment');
      return false;
    }
    
    try {
      const user = await firebaseService.signInWithGoogle();
      return !!user;
    } catch (error) {
      console.error('[WordStream] Error during sign-in:', error);
      return false;
    }
  },
  
  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    // נוודא שאנחנו לא בסביבת Service Worker לפני שמנסים להתנתק
    if (isServiceWorkerEnvironment) {
      console.error('[WordStream] Cannot sign out from Service Worker environment');
      return;
    }
    
    try {
      await firebaseService.signOut();
    } catch (error) {
      console.error('[WordStream] Error during sign-out:', error);
      throw error;
    }
  },
  
  /**
   * Save words to storage
   * Saves to both local storage and Firebase if authenticated
   */
  async saveWords(words: any[]): Promise<void> {
    // First save to local storage
    if (!isServiceWorkerEnvironment) {
      try {
        localStorage.setItem('wordstream_words', JSON.stringify(words));
      } catch (error) {
        console.error('[WordStream] Error saving words to local storage:', error);
      }
    }
    
    // Then try to save to Firebase if authenticated
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      try {
        await firebaseService.saveWords(words);
      } catch (error) {
        console.error('[WordStream] Error syncing words to Firebase:', error);
      }
    }
  },
  
  /**
   * Get words from storage
   * First tries Firebase if authenticated, falls back to local storage
   */
  async getWords(): Promise<any[]> {
    // Try to get from Firebase if authenticated
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      try {
        const cloudWords = await firebaseService.getWords();
        if (cloudWords && cloudWords.length > 0) {
          // Update local storage with cloud data if not in Service Worker
          if (!isServiceWorkerEnvironment) {
            try {
              localStorage.setItem('wordstream_words', JSON.stringify(cloudWords));
            } catch (error) {
              console.error('[WordStream] Error updating local storage with cloud words:', error);
            }
          }
          return cloudWords;
        }
      } catch (error) {
        console.error('[WordStream] Error getting words from Firebase:', error);
      }
    }
    
    // Fall back to local storage (only if not in Service Worker)
    if (!isServiceWorkerEnvironment) {
      try {
        const wordsJson = localStorage.getItem('wordstream_words') || '[]';
        return JSON.parse(wordsJson);
      } catch (error) {
        console.error('[WordStream] Error getting words from local storage:', error);
      }
    }
    
    return [];
  },
  
  /**
   * Save notes for a video
   */
  async saveNotes(videoId: string, notes: any[]): Promise<void> {
    // First save to local storage (if not in Service Worker)
    if (!isServiceWorkerEnvironment) {
      try {
        const notesJson = localStorage.getItem('wordstream_notes');
        const allNotes = notesJson ? JSON.parse(notesJson) : {};
        allNotes[videoId] = notes;
        localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
      } catch (error) {
        console.error('[WordStream] Error saving notes to local storage:', error);
      }
    }
    
    // Then try to save to Firebase if authenticated
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      try {
        await firebaseService.saveNotes(videoId, notes);
      } catch (error) {
        console.error('[WordStream] Error syncing notes to Firebase:', error);
      }
    }
  },
  
  /**
   * Get notes for a video
   */
  async getNotes(videoId: string): Promise<any[]> {
    // Try to get from Firebase if authenticated
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      try {
        const cloudNotes = await firebaseService.getNotes(videoId);
        if (cloudNotes && cloudNotes.length > 0) {
          // Update local storage with cloud data (if not in Service Worker)
          if (!isServiceWorkerEnvironment) {
            try {
              const notesJson = localStorage.getItem('wordstream_notes');
              const allNotes = notesJson ? JSON.parse(notesJson) : {};
              allNotes[videoId] = cloudNotes;
              localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
            } catch (error) {
              console.error('[WordStream] Error updating local storage with cloud notes:', error);
            }
          }
          return cloudNotes;
        }
      } catch (error) {
        console.error('[WordStream] Error getting notes from Firebase:', error);
      }
    }
    
    // Fall back to local storage (if not in Service Worker)
    if (!isServiceWorkerEnvironment) {
      try {
        const notesJson = localStorage.getItem('wordstream_notes');
        const allNotes = notesJson ? JSON.parse(notesJson) : {};
        return allNotes[videoId] || [];
      } catch (error) {
        console.error('[WordStream] Error getting notes from local storage:', error);
      }
    }
    
    return [];
  },
  
  /**
   * Subscribe to words changes
   */
  subscribeToWords(callback: (words: any[]) => void): () => void {
    // First get from local storage (if not in Service Worker)
    if (!isServiceWorkerEnvironment) {
      try {
        const wordsJson = localStorage.getItem('wordstream_words') || '[]';
        callback(JSON.parse(wordsJson));
      } catch (error) {
        console.error('[WordStream] Error reading words from local storage:', error);
      }
    }
    
    // If authenticated, subscribe to Firebase changes
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      return firebaseService.subscribeToWords((cloudWords) => {
        // Update local storage when cloud data changes (if not in Service Worker)
        if (cloudWords && cloudWords.length > 0 && !isServiceWorkerEnvironment) {
          try {
            localStorage.setItem('wordstream_words', JSON.stringify(cloudWords));
          } catch (error) {
            console.error('[WordStream] Error updating local storage:', error);
          }
        }
        
        callback(cloudWords);
      });
    }
    
    // If not authenticated, return empty unsubscribe function
    return () => {};
  },
  
  /**
   * Subscribe to notes changes for a video
   */
  subscribeToNotes(videoId: string, callback: (notes: any[]) => void): () => void {
    // First get from local storage (if not in Service Worker)
    if (!isServiceWorkerEnvironment) {
      try {
        const notesJson = localStorage.getItem('wordstream_notes');
        const allNotes = notesJson ? JSON.parse(notesJson) : {};
        callback(allNotes[videoId] || []);
      } catch (error) {
        console.error('[WordStream] Error reading notes from local storage:', error);
      }
    }
    
    // If authenticated, subscribe to Firebase changes
    if (this.isAuthenticated() && !this.isInOfflineMode()) {
      return firebaseService.subscribeToNotes(videoId, (cloudNotes) => {
        // Update local storage when cloud data changes (if not in Service Worker)
        if (cloudNotes && cloudNotes.length > 0 && !isServiceWorkerEnvironment) {
          try {
            const notesJson = localStorage.getItem('wordstream_notes');
            const allNotes = notesJson ? JSON.parse(notesJson) : {};
            allNotes[videoId] = cloudNotes;
            localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
          } catch (error) {
            console.error('[WordStream] Error updating local storage:', error);
          }
        }
        
        callback(cloudNotes);
      });
    }
    
    // If not authenticated, return empty unsubscribe function
    return () => {};
  },
  
  /**
   * Share a word list with others
   */
  async shareWordList(listName: string, words: any[], isPublic: boolean = true): Promise<string | null> {
    // נוודא שאנחנו לא בסביבת Service Worker לפני שמנסים לשתף רשימה
    if (isServiceWorkerEnvironment || this.isInOfflineMode()) {
      console.error('[WordStream] Cannot share word list from Service Worker environment or in offline mode');
      return null;
    }
    
    if (!this.isAuthenticated()) {
      throw new Error('You must be signed in to share word lists');
    }
    
    try {
      return await firebaseService.shareWordList(listName, words, isPublic);
    } catch (error) {
      console.error('[WordStream] Error sharing word list:', error);
      throw error;
    }
  },
  
  /**
   * Get public shared word lists
   */
  async getPublicWordLists(language?: string): Promise<any[]> {
    if (this.isInOfflineMode()) {
      console.error('[WordStream] Cannot get shared lists in offline mode');
      return [];
    }
    
    try {
      return await firebaseService.getPublicWordLists(language);
    } catch (error) {
      console.error('[WordStream] Error getting public word lists:', error);
      return [];
    }
  },
  
  /**
   * Sync local data to cloud storage
   * Used when user signs in to push local data to Firebase
   */
  async syncLocalToCloud(): Promise<void> {
    if (!this.isAuthenticated() || isServiceWorkerEnvironment || this.isInOfflineMode()) return;
    
    try {
      // Sync words
      const localWordsJson = localStorage.getItem('wordstream_words');
      if (localWordsJson) {
        const localWords = JSON.parse(localWordsJson);
        if (localWords && localWords.length > 0) {
          await firebaseService.saveWords(localWords);
        }
      }
      
      // Sync notes
      const localNotesJson = localStorage.getItem('wordstream_notes');
      if (localNotesJson) {
        const localNotes = JSON.parse(localNotesJson);
        for (const videoId in localNotes) {
          if (localNotes[videoId] && localNotes[videoId].length > 0) {
            await firebaseService.saveNotes(videoId, localNotes[videoId]);
          }
        }
      }
      
      console.log('[WordStream] Local data synchronized to cloud');
    } catch (error) {
      console.error('[WordStream] Error syncing local data to cloud:', error);
    }
  }
};

export default SyncService; 