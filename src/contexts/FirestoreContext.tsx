import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  where, 
  getDocs,
  doc,
  Timestamp
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import * as FirestoreService from '@/core/firebase/firestore';
import { syncAllData } from '@/services/firebase-sync';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { Note } from '@/features/notes/types';
import { Chat, VideoMetadata } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface FirestoreContextType {
  videos: VideoMetadata[];
  chats: Chat[];
  notes: Record<string, Note[]>;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  refreshData: () => Promise<void>;
  forceSyncAll: () => Promise<boolean>;
}

const FirestoreContext = createContext<FirestoreContextType | null>(null);

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirestoreProvider');
  }
  return context;
};

interface FirestoreProviderProps {
  children: ReactNode;
}

export function FirestoreProvider({ children }: FirestoreProviderProps) {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const notesListeners = React.useRef<Record<string, () => void>>({});

  // Set up background sync
  const { isSyncing, lastSyncTime, forceSync } = useBackgroundSync({
    enabled: !!currentUser,
    intervalMs: 5 * 60 * 1000, // 5 minutes
    onSyncComplete: (success) => {
      if (success) {
        setLastSyncTimestamp(new Date().toISOString());
        console.log('WordStream: Background sync completed successfully');
      } else {
        console.warn('WordStream: Background sync completed with errors');
      }
    }
  });

  // Set up real-time listeners when user is authenticated
  useEffect(() => {
    let unsubscribeVideos: (() => void) | null = null;
    let unsubscribeChats: (() => void) | null = null;
    
    const setupListeners = async () => {
      if (!currentUser) return;
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        const db = getFirestore();
        const userId = currentUser.uid;
        
        console.log(`WordStream: Setting up Firestore listeners for user: ${userId}`);
        
        // התחל סנכרון דו-כיווני של נתונים
        console.log('WordStream: Running initial data sync after login');
        try {
          await FirestoreService.syncChatsBetweenStorageAndFirestore();
          await FirestoreService.syncNotesBetweenStorageAndFirestore();
          setLastSyncTimestamp(new Date().toISOString());
        } catch (syncError) {
          console.error('WordStream: Error during initial sync:', syncError);
        }

        // Videos listener
        const videosRef = collection(db, `users/${userId}/videos`);
        unsubscribeVideos = onSnapshot(videosRef, (snapshot) => {
          const videosData: VideoMetadata[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const mappedVideo: VideoMetadata = {
              id: doc.id,
              userId: userId,
              videoId: data.videoId,
              videoTitle: data.videoTitle,
              videoURL: data.videoURL,
              lastViewed: data.lastViewed,
              lastUpdated: data.lastUpdated,
              durationInSeconds: data.durationInSeconds,
              watchedPercentage: data.watchedPercentage
            } as VideoMetadata;
            videosData.push(mappedVideo);
          });
          console.log(`WordStream: Received ${videosData.length} videos from Firestore`);
          setVideos(videosData);
          
          // Call sync functions without await and parameters
          FirestoreService.syncVideosToLocalStorage();
        }, (error) => {
          console.error('WordStream: Error listening to videos:', error);
          setHasError(true);
          setErrorMessage(`Failed to get videos: ${error.message}`);
        });
        
        // Chats are fetched per video, but we can subscribe to all user's chats
        try {
          console.log(`WordStream: Setting up ALL chats listener for user: ${userId}`);
          unsubscribeChats = FirestoreService.subscribeToAllChats((updatedChats) => {
            console.log(`WordStream: Received ${updatedChats.length} chats from Firestore listener`);
            setChats(updatedChats);
            
            // Call sync functions without await and parameters
            FirestoreService.syncChatsToLocalStorage();
          });
        } catch (chatError) {
          console.error('WordStream: Error setting up chats listener:', chatError);
        }
        
        // הקמת האזנה לכל ההערות
        await setupAllNotesListeners(userId);
        
        // Notes - get initial load
        await fetchAllNotes(userId);
        
      } catch (error) {
        console.error('WordStream: Error setting up listeners:', error);
        setHasError(true);
        setErrorMessage(`Error initializing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        toast.error('Failed to load data. Please try refreshing.');
      } finally {
        setIsLoading(false);
      }
    };
    
    setupListeners();
    
    return () => {
      if (unsubscribeVideos) unsubscribeVideos();
      if (unsubscribeChats) unsubscribeChats();
      cleanupAllNotesListeners();
    };
  }, [currentUser]);

  const fetchAllNotes = async (userId: string) => {
    if (!userId) return;
    
    try {
      console.log(`WordStream: Fetching all notes for user: ${userId}`);
      const db = getFirestore();
      const notesData: Record<string, Note[]> = {};
      
      // First get all videos
      const videosSnapshot = await getDocs(collection(db, `users/${userId}/videos`));
      
      // For each video, get its notes
      for (const videoDoc of videosSnapshot.docs) {
        const videoId = videoDoc.id;
        const notesSnapshot = await getDocs(collection(db, `users/${userId}/videos/${videoId}/notes`));
        
        if (!notesSnapshot.empty) {
          notesData[videoId] = notesSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          } as Note));
          console.log(`WordStream: Fetched ${notesData[videoId].length} notes for video ${videoId}`);
        } else {
          console.log(`WordStream: No notes found for video ${videoId}`);
        }
      }
      
      console.log(`WordStream: Fetched notes for ${Object.keys(notesData).length} videos`);
      setNotes(notesData);
      
      // Call sync functions without await and parameters
      FirestoreService.syncNotesToLocalStorage();
      
    } catch (error) {
      console.error('WordStream: Error fetching notes:', error);
      setHasError(true);
      setErrorMessage(`Failed to fetch notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const refreshData = async () => {
    if (!currentUser) {
      console.error('WordStream: Cannot refresh data - user not authenticated');
      toast.error('לא ניתן לרענן: משתמש לא מחובר');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('WordStream: Manual data refresh triggered');
      
      // סנכרון דו-כיווני של צ'טים והערות
      await FirestoreService.syncChatsBetweenStorageAndFirestore();
      await FirestoreService.syncNotesBetweenStorageAndFirestore();
      
      await fetchAllNotes(currentUser.uid);
      
      toast.success('נתונים רועננו בהצלחה');
      setLastSyncTimestamp(new Date().toISOString());
    } catch (error) {
      toast.error('נכשל בריענון הנתונים');
      console.error('WordStream: Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Force full sync of all data between localStorage and Firestore
  const forceSyncAll = async (): Promise<boolean> => {
    try {
      // Try to sync all data
      setIsLoading(true);
      
      // Use our background sync mechanism
      const success = await forceSync();
      
      if (success) {
        setLastSyncTimestamp(new Date().toISOString());
        // Refresh the data
        await refreshData();
      }
      
      // Return overall success status
      return !!success;
    } catch (error) {
      console.error('Error in forceSyncAll:', error);
      setHasError(true);
      setErrorMessage('Failed to synchronize data. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // האזנה בזמן אמת לשינויים בהערות עבור סרטון ספציפי
  const setupNotesListener = (userId: string, videoId: string) => {
    if (!userId || !videoId) return;
    
    // בדיקה אם כבר יש האזנה פעילה
    if (notesListeners.current[videoId]) {
      console.log(`WordStream: Notes listener for video ${videoId} already exists, skipping`);
      return;
    }
    
    try {
      console.log(`WordStream: Setting up real-time notes listener for video ${videoId}`);
      const db = getFirestore();
      const notesRef = collection(db, `users/${userId}/videos/${videoId}/notes`);
      
      const unsubscribe = onSnapshot(notesRef, (snapshot) => {
        const videoNotes: Note[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const note: Note = {
            id: doc.id,
            content: data.content || '',
            videoTime: data.videoTime || 0,
            timestamp: data.timestamp instanceof Timestamp 
              ? data.timestamp.toDate().toISOString() 
              : (data.timestamp || new Date().toISOString())
          };
          videoNotes.push(note);
        });
        
        console.log(`WordStream: Received ${videoNotes.length} notes for video ${videoId} from real-time listener`);
        
        // עדכון מצב ההערות במערכת
        setNotes(prevNotes => ({
          ...prevNotes,
          [videoId]: videoNotes
        }));
        
        // עדכון אחסון מקומי
        updateLocalNotesStorage(videoId, videoNotes);
      }, (error) => {
        console.error(`WordStream: Error in notes listener for video ${videoId}:`, error);
      });
      
      // שמירת מפסיק ההאזנה
      notesListeners.current[videoId] = unsubscribe;
      
    } catch (error) {
      console.error(`WordStream: Failed to set up notes listener for video ${videoId}:`, error);
    }
  };
  
  // ניקוי כל מאזיני ההערות
  const cleanupAllNotesListeners = () => {
    console.log('WordStream: Cleaning up all notes listeners');
    
    // הפעלת כל מפסיקי ההאזנה
    Object.entries(notesListeners.current).forEach(([videoId, unsubscribe]) => {
      if (typeof unsubscribe === 'function') {
        console.log(`WordStream: Removing notes listener for video ${videoId}`);
        unsubscribe();
      }
    });
    
    // איפוס המאזינים
    notesListeners.current = {};
  };
  
  // עדכון אחסון מקומי של הערות
  const updateLocalNotesStorage = (videoId: string, videoNotes: Note[]) => {
    chrome.storage.local.get(['notes_storage'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error accessing local storage for notes update:', chrome.runtime.lastError);
        return;
      }
      
      const storageObj = result.notes_storage || {};
      const videoNotesObj: Record<string, any> = {};
      
      // המרת מערך הערות לאובייקט אחסון
      videoNotes.forEach(note => {
        if (note.id) {
          videoNotesObj[note.id] = {
            ...note,
            lastSynced: new Date().toISOString()
          };
        }
      });
      
      // עדכון רק עבור הסרטון הספציפי
      const updatedStorage = {
        ...storageObj,
        [videoId]: videoNotesObj
      };
      
      // שמירה באחסון המקומי
      chrome.storage.local.set({ 'notes_storage': updatedStorage }, () => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error updating notes in local storage:', chrome.runtime.lastError);
        } else {
          console.log(`WordStream: Updated ${videoNotes.length} notes in local storage for video ${videoId}`);
        }
      });
    });
  };
  
  // האזנה בזמן אמת לכל ההערות עבור כל הסרטונים הקיימים
  const setupAllNotesListeners = async (userId: string) => {
    if (!userId) return;
    
    try {
      console.log('WordStream: Setting up notes listeners for all videos');
      const db = getFirestore();
      
      // ניקוי האזנות קיימות
      cleanupAllNotesListeners();
      
      // קבלת כל הסרטונים
      const videosSnapshot = await getDocs(collection(db, `users/${userId}/videos`));
      
      if (videosSnapshot.empty) {
        console.log('WordStream: No videos found for setting up notes listeners');
        return;
      }
      
      // הקמת האזנות לכל הסרטונים
      videosSnapshot.docs.forEach(videoDoc => {
        const videoId = videoDoc.id;
        setupNotesListener(userId, videoId);
      });
      
    } catch (error) {
      console.error('WordStream: Error setting up notes listeners for all videos:', error);
    }
  };

  const value = {
    videos,
    chats,
    notes,
    isLoading,
    hasError,
    errorMessage,
    refreshData,
    forceSyncAll
  };

  return (
    <FirestoreContext.Provider value={value}>
      {children}
    </FirestoreContext.Provider>
  );
} 