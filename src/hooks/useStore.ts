/**
 * Hook לשימוש בשירות ניהול המצב המרכזי
 * 
 * מספק ממשק נוח להתחברות לאירועי Store והשגת נתונים עדכניים
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import store, { StoreEvent } from '@/core/store';
import { 
  Note as StoreNote, 
  VideoWithNotes as StoreVideoWithNotes 
} from '@/core/data-types';
import { 
  Note as FeatureNote, 
  VideoWithNotes as FeatureVideoWithNotes,
  VideoNote
} from '@/features/notes/types';
import { ChatConversation } from '@/types/chats';

/**
 * פונקציות המרה בין טיפוסי Note שונים
 */
function convertStoreNoteToFeatureNote(note: StoreNote): FeatureNote {
  return {
    id: note.id,
    content: note.content,
    timestamp: note.updatedAt || note.createdAt,
    videoTime: note.videoTime,
    lastSynced: note.updatedAt,
    videoId: note.videoId,
    formattedTime: note.videoTime ? formatTime(note.videoTime) : ''
  };
}

function convertFeatureNoteToStoreNote(note: FeatureNote): Partial<StoreNote> {
  return {
    id: note.id,
    content: note.content,
    videoId: note.videoId || '',
    videoTime: note.videoTime,
    updatedAt: note.lastSynced || note.timestamp,
    createdAt: note.timestamp
  };
}

/**
 * המרת סרטון עם הערות
 */
function convertStoreVideoToFeatureVideo(video: StoreVideoWithNotes): FeatureVideoWithNotes {
  return {
    videoId: video.videoId,
    videoTitle: video.videoTitle,
    videoURL: video.videoURL,
    lastUpdated: video.lastUpdated,
    notes: video.notes.map(note => ({
      id: note.id,
      content: note.content,
      timestamp: note.updatedAt || note.createdAt,
      videoTime: note.videoTime,
      lastSynced: note.updatedAt,
      videoId: note.videoId,
      formattedTime: note.videoTime ? formatTime(note.videoTime) : ''
    })) as VideoNote[]
  };
}

/**
 * פורמט זמן בסרטון לתצוגה (MM:SS)
 */
function formatTime(seconds: number | undefined): string {
  if (seconds === undefined) return '';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * אפשרויות להתחברות לחנות המרכזית
 */
interface UseStoreOptions {
  // אירועים להרשמה
  events?: StoreEvent[];
  // האם לטעון הערות של סרטון ספציפי
  videoId?: string;
}

/**
 * Hook לשימוש בחנות המרכזית
 */
export function useStore(options: UseStoreOptions = {}) {
  // נתונים עיקריים
  const [notes, setNotes] = useState<FeatureNote[]>([]);
  const [videosWithNotes, setVideosWithNotes] = useState<FeatureVideoWithNotes[]>([]);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // מצבי בקרה
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // אירועים להאזנה
  const events = options.events || [];
  const videoId = options.videoId;
  
  // רשימת מנויים פעילים לניקוי
  const subscriptions = useMemo(() => new Map<StoreEvent, string>(), []);
  
  /**
   * האזנה לאירוע הוספת הערה
   */
  const handleNoteAdded = useCallback((data: { note: StoreNote }) => {
    if (videoId && data.note.videoId === videoId) {
      // עדכון רשימת ההערות הספציפית לסרטון הנוכחי
      setNotes(prevNotes => {
        const convertedNote = convertStoreNoteToFeatureNote(data.note);
        // בדיקה אם ההערה כבר קיימת
        const noteIndex = prevNotes.findIndex(n => n.id === data.note.id);
        if (noteIndex >= 0) {
          // עדכון הערה קיימת
          const newNotes = [...prevNotes];
          newNotes[noteIndex] = convertedNote;
          return newNotes;
        } else {
          // הוספת הערה חדשה
          return [...prevNotes, convertedNote];
        }
      });
    }
    
    // עדכון רשימת הסרטונים עם הערות
    setVideosWithNotes(prev => {
      // מקבל רשימת סרטונים עדכנית מהחנות
      const allVideos = store.getAllVideosWithNotes();
      
      // ממיר את הסרטונים לטיפוס הרצוי
      return allVideos.map(video => convertStoreVideoToFeatureVideo(video));
    });
  }, [videoId]);
  
  /**
   * האזנה לאירוע מחיקת הערה
   */
  const handleNoteDeleted = useCallback((data: { noteId: string, videoId?: string }) => {
    if (videoId && data.videoId === videoId) {
      // עדכון רשימת ההערות הספציפית לסרטון הנוכחי
      setNotes(prevNotes => prevNotes.filter(note => note.id !== data.noteId));
    }
    
    // עדכון רשימת הסרטונים עם הערות
    setVideosWithNotes(prev => {
      // אם יש מזהה סרטון, מעדכן רק את הסרטון הספציפי
      const updatedVideos = prev.map(video => {
        if (data.videoId && video.videoId === data.videoId) {
          return {
            ...video,
            notes: video.notes.filter(note => note.id !== data.noteId),
            lastUpdated: new Date().toISOString()
          };
        }
        return video;
      }).filter(video => video.notes.length > 0);
      
      return updatedVideos;
    });
  }, [videoId]);
  
  /**
   * האזנה לאירוע סנכרון הערות
   */
  const handleNotesSynced = useCallback((data: any) => {
    // עדכון זמן סנכרון אחרון
    setLastSynced(data.timestamp || new Date().toISOString());
    
    // טעינת כל הסרטונים עם הערות
    const allVideosWithNotes = store.getAllVideosWithNotes();
    // המרה לטיפוס הנכון
    const convertedVideos = allVideosWithNotes.map(video => 
      convertStoreVideoToFeatureVideo(video)
    );
    setVideosWithNotes(convertedVideos);
    
    // אם יש מזהה סרטון ספציפי, טוען גם את ההערות שלו
    if (videoId) {
      const notesForVideo = store.getNotes(videoId);
      // המרה לטיפוס הנכון
      const convertedNotes = notesForVideo.map(note => 
        convertStoreNoteToFeatureNote(note)
      );
      setNotes(convertedNotes);
    }
    
    // איפוס מצב סנכרון והודעות שגיאה
    setIsSyncing(false);
    setError(null);
  }, [videoId]);
  
  /**
   * האזנה לאירוע תחילת סנכרון
   */
  const handleSyncStarted = useCallback(() => {
    setIsSyncing(true);
  }, []);
  
  /**
   * האזנה לאירוע סיום סנכרון
   */
  const handleSyncCompleted = useCallback((data: { timestamp: string }) => {
    setIsSyncing(false);
    setLastSynced(data.timestamp);
    setError(null);
  }, []);
  
  /**
   * האזנה לאירוע שגיאת סנכרון
   */
  const handleSyncFailed = useCallback((data: { error: any }) => {
    setIsSyncing(false);
    setError(data.error instanceof Error ? data.error.message : String(data.error));
  }, []);
  
  /**
   * קבלת הערות מותאמות לסרטון הספציפי
   */
  const fetchVideoNotes = useCallback(() => {
    if (!videoId) return;
    
    const notesForVideo = store.getNotes(videoId);
    // המרה לטיפוס הנכון
    const convertedNotes = notesForVideo.map(note => 
      convertStoreNoteToFeatureNote(note)
    );
    setNotes(convertedNotes);
  }, [videoId]);
  
  /**
   * סנכרון כל הנתונים
   */
  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    
    try {
      const success = await store.syncAll();
      if (!success) {
        setError('Synchronization failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIsSyncing(false);
    }
  }, []);
  
  /**
   * שמירת הערה חדשה
   */
  const saveNote = useCallback(async (note: Partial<FeatureNote>): Promise<string | null> => {
    try {
      // המרה לטיפוס הנכון של החנות
      const storeNote = convertFeatureNoteToStoreNote(note as FeatureNote);
      
      // שמירה בחנות
      const noteId = await store.saveNote(storeNote);
      
      return noteId;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, []);
  
  /**
   * מחיקת הערה
   */
  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    try {
      await store.deleteNote(noteId);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, []);
  
  /**
   * האזנה לאירועים עם החיבור לחנות
   */
  useEffect(() => {
    // הגדרת מאזינים לאירועים
    const eventHandlers = {
      'note:added': handleNoteAdded,
      'note:deleted': handleNoteDeleted,
      'notes:synced': handleNotesSynced,
      'sync:started': handleSyncStarted,
      'sync:completed': handleSyncCompleted,
      'sync:failed': handleSyncFailed
    };
    
    // רישום לכל האירועים
    const unsubscribers: (() => void)[] = [];
    
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      const subscriptionId = store.subscribe(event as StoreEvent, handler);
      unsubscribers.push(() => store.unsubscribe(event as StoreEvent, subscriptionId));
    });
    
    // טעינת נתונים ראשונית
    const allVideosWithNotes = store.getAllVideosWithNotes();
    setVideosWithNotes(allVideosWithNotes.map(v => convertStoreVideoToFeatureVideo(v)));
    
    if (videoId) {
      const notesForVideo = store.getNotes(videoId);
      setNotes(notesForVideo.map(n => convertStoreNoteToFeatureNote(n)));
    }
    
    // ניקוי בעת ניתוק
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [videoId, handleNoteAdded, handleNoteDeleted, handleNotesSynced, 
      handleSyncStarted, handleSyncCompleted, handleSyncFailed]);
  
  return {
    // נתונים
    notes,
    videosWithNotes,
    chats,
    words,
    stats,
    
    // מצבי בקרה
    isSyncing,
    isOnline: navigator.onLine,
    lastSyncTime: lastSynced,
    error,
    
    // פעולות
    syncAll,
    saveNote,
    deleteNote,
    
    // עבור סרטון ספציפי
    addNote: saveNote,
    
    // פונקציות עזר
    convertStoreNoteToFeatureNote,
    convertFeatureNoteToStoreNote,
    convertStoreVideoToFeatureVideo,
  };
} 