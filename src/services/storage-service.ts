/**
 * Service for handling storage operations (Firebase or local storage)
 * Abstracts the storage mechanism from the components
 */

import { Note } from '@/features/notes/types';
import { getCurrentUser } from '@/core/firebase/auth';
import * as FirestoreService from '@/core/firebase/firestore';

/**
 * Check if user is authenticated from multiple sources
 * @throws Error if user is not authenticated
 */
async function requireAuth(): Promise<void> {
  // בדיקת האימות מ-Firebase
  const user = getCurrentUser();
  if (user) {
    // אם המשתמש מאומת, עדכן את המידע בחלון
    if (typeof window !== 'undefined') {
      // שמור מידע אימות בחלון
      if (!window.WordStream) {
        window.WordStream = {};
      }
      window.WordStream.isAuthenticated = true;
      window.WordStream.currentUser = user;
      
      // שמור גם ב-localStorage למקרה של רענון
      try {
        localStorage.setItem('wordstream_auth_state', 'authenticated');
        // שמור מידע מינימלי על המשתמש (לא את כל האובייקט)
        localStorage.setItem('wordstream_user_info', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        }));
      } catch (storageErr) {
        console.warn('WordStream Storage: Error saving auth to localStorage:', storageErr);
      }
    }
    
    // שמור גם באחסון מקומי של התוסף
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({
          'isAuthenticated': true,
          'userInfo': {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          },
          'lastAuthCheck': new Date().toISOString()
        });
        console.log('WordStream Storage: Saved auth state to chrome.storage.local');
      } catch (chromeErr) {
        console.warn('WordStream Storage: Error saving auth to chrome storage:', chromeErr);
      }
    }
    
    return; // המשתמש מאומת!
  }
  
  // בדיקת האימות מ-window object (עובד בתסריט תוכן)
  if (typeof window !== 'undefined' && window.WordStream?.isAuthenticated === true) {
    console.log('WordStream Storage: Found authenticated status in window object');
    return;
  }
  
  // בדיקת האימות מאחסון מקומי
  let isAuthenticatedInStorage = false;
  
  // בדיקה ב-localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const authState = localStorage.getItem('wordstream_auth_state');
      if (authState === 'authenticated') {
        console.log('WordStream Storage: Found authenticated status in localStorage');
        isAuthenticatedInStorage = true;
      }
    } catch (localErr) {
      console.warn('WordStream Storage: Error checking localStorage auth:', localErr);
    }
  }
  
  // בדיקה ב-chrome.storage.local
  if (!isAuthenticatedInStorage && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await new Promise<{isAuthenticated?: boolean}>((resolve) => {
        chrome.storage.local.get('isAuthenticated', (data) => {
          resolve(data);
        });
      });
      
      if (result.isAuthenticated === true) {
        console.log('WordStream Storage: Found authenticated status in chrome.storage.local');
        isAuthenticatedInStorage = true;
      }
    } catch (chromeErr) {
      console.warn('WordStream Storage: Error checking chrome storage auth:', chromeErr);
    }
  }
  
  if (isAuthenticatedInStorage) {
    return; // מצאנו מצב אימות חיובי באחסון כלשהו
  }
  
  // אם הגענו לכאן, המשתמש לא מאומת בשום מקור
  throw new Error('Authentication required');
}

/**
 * Get notes for a specific video
 * @param videoId The ID of the video
 * @returns Promise resolving to an array of notes
 */
export async function getNotes(videoId: string): Promise<Note[]> {
  try {
    // בדיקת אימות מחמירה לפני טעינת הערות
    await requireAuth();
    
    return await FirestoreService.getNotes(videoId);
  } catch (error) {
    console.error('WordStream: Failed to load notes:', error);
    return [];
  }
}

/**
 * Save notes for a specific video
 * @param videoId The ID of the video
 * @param notes The notes to save
 * @returns Promise resolving to boolean indicating success
 */
export async function saveNotes(videoId: string, notes: Note[]): Promise<boolean> {
  // This function is not used with Firebase as we save notes individually
  // But we still require authentication for consistency
  await requireAuth();
  return true;
}

/**
 * Delete a specific note
 * @param videoId The ID of the video
 * @param noteId The ID of the note to delete
 * @param currentNotes The current notes array
 * @returns Promise resolving to the updated notes array
 */
export async function deleteNote(
  videoId: string, 
  noteId: string, 
  currentNotes: Note[]
): Promise<Note[]> {
  // בדיקת אימות מחמירה לפני מחיקת הערה
  try {
    await requireAuth();
    
    const success = await FirestoreService.deleteNote(noteId, videoId);
    if (success) {
      // Filter locally to avoid another network request
      return currentNotes.filter(note => note.id !== noteId);
    }
    return currentNotes;
  } catch (error) {
    console.error('WordStream: Failed to delete note:', error);
    return currentNotes;
  }
}

/**
 * Add a new note
 * @param videoId The ID of the video
 * @param content The note content
 * @param currentTime Optional current video time
 * @param currentNotes The current notes array
 * @returns Promise resolving to the updated notes array
 */
export async function addNote(
  videoId: string,
  content: string,
  currentTime: number | undefined,
  currentNotes: Note[]
): Promise<Note[]> {
  // בדיקת אימות מחמירה לפני הוספת הערה חדשה
  try {
    await requireAuth();
    
    const timestamp = new Date().toISOString();
    
    const newNoteData = {
      content: content.trim(),
      timestamp,
      videoTime: currentTime
    };
    
    const savedNote = await FirestoreService.saveNote(newNoteData, videoId);
    if (savedNote) {
      // If savedNote is a string (ID), then return the note with the ID assigned
      const noteWithId = typeof savedNote === 'string' 
        ? { ...newNoteData, id: savedNote } 
        : savedNote;
      
      return [...currentNotes, noteWithId as Note];
    }
    return currentNotes;
  } catch (error) {
    console.error('WordStream: Failed to save note:', error);
    return currentNotes;
  }
} 