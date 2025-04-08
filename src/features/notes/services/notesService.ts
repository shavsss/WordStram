// פונקציות שירות עבור הערות וידאו
// מרכז את כל הפונקציות של אינטראקציה עם Firebase ואחסון מקומי

import { firestore } from '@/core/firebase/config';
import { getCurrentUser } from '@/core/firebase/auth';
import { collection, addDoc, deleteDoc, doc, getDocs, setDoc, getFirestore, Timestamp, getDoc, query, where, updateDoc } from 'firebase/firestore';
import { Note, NoteSyncResult } from '../types';
import { getAuth } from 'firebase/auth';

// קבועים
export const STORAGE_KEYS = {
  NOTES: (videoId: string) => `notes:${videoId}`,
  NOTES_STORAGE: 'notes_storage'
};

/**
 * קבלת כל ההערות מ-Firestore
 */
export async function getFirebaseNotes(videoId: string): Promise<Note[]> {
  const user = getCurrentUser();
  if (!user) return [];
  
  try {
    const notesRef = collection(firestore, `users/${user.uid}/videos/${videoId}/notes`);
    const querySnapshot = await getDocs(notesRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Note, 'id'>
    }));
  } catch (error) {
    console.error('Error fetching notes from Firebase:', error);
    return [];
  }
}

/**
 * קבלת הערות מאחסון מקומי
 */
export async function getLocalNotes(videoId: string): Promise<Note[]> {
  try {
    const storageKey = `wordstream_notes_${videoId}`;
    const notesJson = localStorage.getItem(storageKey);
    
    if (!notesJson) return [];
    
    const notes = JSON.parse(notesJson) as Note[];
    return Array.isArray(notes) ? notes : [];
  } catch (error) {
    console.error('Error getting notes from local storage:', error);
    return [];
  }
}

/**
 * שמירת הערה בפיירבייס
 */
export async function saveNoteToFirebase(videoId: string, note: Note): Promise<Note | null> {
  const user = getCurrentUser();
  if (!user) return null;
  
  try {
    // וודא שיש מסמך וידאו
    await ensureVideoMetadata(user.uid, videoId);
    
    // שמור את ההערה
    const notesRef = collection(firestore, `users/${user.uid}/videos/${videoId}/notes`);
    const { id, ...noteData } = note;
    
    const docRef = await addDoc(notesRef, {
      ...noteData,
      lastSynced: new Date().toISOString()
    });
    
    return {
      ...note,
      id: docRef.id,
      lastSynced: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error saving note to Firebase:', error);
    return null;
  }
}

/**
 * שמירת הערה לאחסון מקומי
 */
export async function saveNoteToLocalStorage(videoId: string, note: Note): Promise<void> {
  try {
    const storageKey = `wordstream_notes_${videoId}`;
    const existingNotesJson = localStorage.getItem(storageKey);
    const existingNotes = existingNotesJson ? JSON.parse(existingNotesJson) as Note[] : [];
    
    // בדוק אם ההערה כבר קיימת ועדכן אותה, אחרת הוסף חדשה
    const noteIndex = existingNotes.findIndex(n => n.id === note.id);
    
    if (noteIndex >= 0) {
      existingNotes[noteIndex] = note;
    } else {
      existingNotes.push(note);
    }
    
    localStorage.setItem(storageKey, JSON.stringify(existingNotes));
  } catch (error) {
    console.error('Error saving note to local storage:', error);
    throw new Error('Failed to save note locally');
  }
}

/**
 * עדכון מזהה הערה מקומית למזהה מהשרת
 */
export async function updateNoteIdInLocalStorage(videoId: string, oldId: string, newId: string): Promise<boolean> {
  try {
    const storageKey = `wordstream_notes_${videoId}`;
    const notesJson = localStorage.getItem(storageKey);
    
    if (!notesJson) return false;
    
    const notes = JSON.parse(notesJson) as Note[];
    const noteIndex = notes.findIndex(note => note.id === oldId);
    
    if (noteIndex === -1) return false;
    
    notes[noteIndex].id = newId;
    localStorage.setItem(storageKey, JSON.stringify(notes));
    
    return true;
  } catch (error) {
    console.error('Error updating note ID in local storage:', error);
    return false;
  }
}

/**
 * מחיקת הערה מפיירבייס
 */
export async function deleteNoteFromFirebase(noteId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  
  try {
    // חיפוש ההערה בכל הוידאו של המשתמש
    const videosRef = collection(firestore, `users/${user.uid}/videos`);
    const videosSnapshot = await getDocs(videosRef);
    
    for (const videoDoc of videosSnapshot.docs) {
      const notesRef = collection(firestore, `users/${user.uid}/videos/${videoDoc.id}/notes`);
      const noteDoc = doc(notesRef, noteId);
      
      try {
        const noteSnapshot = await getDoc(noteDoc);
        if (noteSnapshot.exists()) {
          await deleteDoc(noteDoc);
          return true;
        }
      } catch (error) {
        // הערה לא נמצאה בוידאו זה, המשך לחפש
      }
    }
    
    console.warn('Note not found in any video:', noteId);
    return false;
  } catch (error) {
    console.error('Error deleting note from Firebase:', error);
    return false;
  }
}

/**
 * מחיקת הערה מאחסון מקומי
 */
export async function deleteNoteFromLocalStorage(videoId: string, noteId: string): Promise<void> {
  try {
    const storageKey = `wordstream_notes_${videoId}`;
    const notesJson = localStorage.getItem(storageKey);
    
    if (!notesJson) return;
    
    const notes = JSON.parse(notesJson) as Note[];
    const updatedNotes = notes.filter(note => note.id !== noteId);
    
    localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
  } catch (error) {
    console.error('Error deleting note from local storage:', error);
    throw new Error('Failed to delete note locally');
  }
}

/**
 * עדכון האחסון המקומי עם הערות חדשות
 */
export async function updateLocalStorage(videoId: string, notes: Note[]): Promise<boolean> {
  try {
    const storageKey = `wordstream_notes_${videoId}`;
    localStorage.setItem(storageKey, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error('Error updating local storage:', error);
    return false;
  }
}

/**
 * מיזוג הערות מקומיות והערות מהשרת
 */
export async function mergeNotes(localNotes: Note[], firebaseNotes: Note[]): Promise<Note[]> {
  const mergedMap = new Map<string, Note>();
  
  // הוסף הערות מקומיות למפה
  for (const note of localNotes) {
    mergedMap.set(note.id, note);
  }
  
  // עדכן או הוסף הערות מ-Firebase
  for (const note of firebaseNotes) {
    const localNote = mergedMap.get(note.id);
    
    if (localNote) {
      // בחר את ההערה החדשה יותר לפי חותמת זמן
      const localDate = new Date(localNote.lastSynced || localNote.timestamp);
      const firebaseDate = new Date(note.lastSynced || note.timestamp);
      
      if (firebaseDate > localDate) {
        mergedMap.set(note.id, note);
      }
    } else {
      mergedMap.set(note.id, note);
    }
  }
  
  return Array.from(mergedMap.values());
}

/**
 * סנכרון הערות לפיירבייס
 */
export async function syncNotesToFirebase(videoId: string, notes: Note[]): Promise<NoteSyncResult> {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }
  
  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection' };
  }
  
  try {
    // וודא שיש מסמך וידאו
    await ensureVideoMetadata(user.uid, videoId);
    
    const notesRef = collection(firestore, `users/${user.uid}/videos/${videoId}/notes`);
    const updatedNotes: Note[] = [];
    
    // סנכרן כל הערה
    for (const note of notes) {
      const noteWithSync = {
        ...note,
        lastSynced: new Date().toISOString()
      };
      
      try {
        if (note.id.startsWith('note_')) {
          // הערה חדשה שנוצרה מקומית
          const { id, ...noteData } = noteWithSync;
          const docRef = await addDoc(notesRef, noteData);
          updatedNotes.push({ ...noteWithSync, id: docRef.id });
        } else {
          // הערה קיימת - עדכון
          const noteDoc = doc(notesRef, note.id);
          const { id, ...noteData } = noteWithSync;
          await updateDoc(noteDoc, noteData);
          updatedNotes.push(noteWithSync);
        }
      } catch (error) {
        console.error(`Error syncing note ${note.id}:`, error);
        updatedNotes.push(note); // השאר את ההערה המקורית
      }
    }
    
    return { success: true, notes: updatedNotes };
  } catch (error) {
    console.error('Error syncing notes to Firebase:', error);
    return { success: false, error: 'Failed to sync notes to server' };
  }
}

/**
 * וודא שמסמך המטא-דאטה של הוידאו קיים
 * @param userId מזהה המשתמש
 * @param videoId מזהה הוידאו
 */
async function ensureVideoMetadata(userId: string, videoId: string): Promise<void> {
  try {
    const videoQuery = query(
      collection(firestore, `users/${userId}/videos`), 
      where('videoId', '==', videoId)
    );
    
    const videoDoc = await getDocs(videoQuery);
    
    if (videoDoc.empty) {
      // יצירת מסמך מטא-דאטה לוידאו אם לא קיים
      await addDoc(collection(firestore, `users/${userId}/videos`), {
        videoId,
        videoTitle: typeof document !== 'undefined' ? document.title : 'Untitled Video',
        videoURL: typeof window !== 'undefined' ? window.location.href : '',
        lastViewed: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        platform: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
      });
    }
  } catch (error) {
    console.error('Error ensuring video metadata:', error);
    // המשך בכל זאת - זה לא אמור למנוע שמירת הערות
  }
} 