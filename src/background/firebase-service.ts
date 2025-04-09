/**
 * Firebase Service for Background Script
 * מספק גישה לכל פונקציות ה-Firebase עבור סקריפט הרקע
 */

import { getFirestoreDb } from '../core/firebase/config';
import { 
  checkFirestoreConnection as checkFirestoreConnectionFromAuth, 
  getCurrentUserId as getCurrentUserIdFromAuth
} from '../core/firebase/auth';
import { 
  addDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument as getDocumentFromService,
  getNotes as getNotesFromService,
  saveNote as saveNoteFromService,
  deleteNote as deleteNoteFromService,
  getAllVideosWithNotes as getAllVideosWithNotesFromService,
} from '../services/firebase-service';

/**
 * פורמט שגיאה ללוג
 * @param error מידע השגיאה
 * @returns שגיאה עם פורמט משופר
 */
export function formatErrorForLog(error: any): string {
  if (!error) {
    return 'Unknown error';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  return JSON.stringify(error);
}

/**
 * בדיקת חיבור ל-Firestore
 * @returns סטטוס חיבור
 */
export async function checkFirestoreConnection(): Promise<{ connected: boolean; userId?: string | null; error?: string }> {
  return await checkFirestoreConnectionFromAuth();
}

/**
 * קבלת מזהה המשתמש הנוכחי
 * @returns מזהה המשתמש או null
 */
export async function getCurrentUserId(): Promise<string | null> {
  return await getCurrentUserIdFromAuth();
}

/**
 * קבלת מסמך מ-Firestore
 * @param path נתיב המסמך
 * @returns מידע המסמך
 */
export async function getDocument(path: string): Promise<any> {
  return await getDocumentFromService(path);
}

/**
 * שמירת מסמך ב-Firestore
 * @param path נתיב המסמך
 * @param data נתוני המסמך
 * @returns תוצאת השמירה
 */
export async function saveDocument(path: string, data: any): Promise<any> {
  const parts = path.split('/');
  const id = parts[parts.length - 1];
  const collectionPath = parts.slice(0, parts.length - 1).join('/');
  
  if (id && id.length > 0) {
    return await updateDocument(path, data);
  } else {
    return await addDocument(collectionPath, data);
  }
}

/**
 * קבלת הערות לוידאו מסוים
 * @param videoId מזהה הוידאו
 * @returns מערך הערות
 */
export async function getNotes(videoId: string): Promise<any> {
  return await getNotesFromService(videoId);
}

/**
 * שמירת הערה
 * @param note נתוני ההערה
 * @returns מזהה ההערה
 */
export async function saveNote(note: any): Promise<any> {
  return await saveNoteFromService(note);
}

/**
 * מחיקת הערה
 * @param noteId מזהה ההערה
 * @param videoId מזהה הוידאו (אופציונלי)
 * @returns האם המחיקה הצליחה
 */
export async function deleteNote(noteId: string, videoId?: string): Promise<any> {
  return await deleteNoteFromService(noteId, videoId);
}

/**
 * קבלת כל הוידאו עם הערות
 * @returns רשימת וידאו והערות
 */
export async function getAllVideosWithNotes(): Promise<any> {
  return await getAllVideosWithNotesFromService();
}

/**
 * מחיקת כל ההערות לוידאו מסוים
 * @param videoId מזהה הוידאו
 * @returns האם המחיקה הצליחה
 */
export async function deleteAllNotesForVideo(videoId: string): Promise<any> {
  // קבלת כל ההערות של הוידאו
  const { success, notes } = await getNotesFromService(videoId);
  
  if (!success || !notes || notes.length === 0) {
    return { success: true, deletedCount: 0 };
  }
  
  // מחיקת כל הערה
  let deletedCount = 0;
  for (const note of notes) {
    const deleteResult = await deleteNoteFromService(note.id, videoId);
    if (deleteResult.success) {
      deletedCount++;
    }
  }
  
  return { success: true, deletedCount };
}

// Stub functions for features that will be implemented later
export async function getWords(filter: any = {}): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function saveWord(word: any): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function deleteWord(wordId: string): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function getChats(filter: any = {}): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function saveChat(chat: any): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function deleteChat(chatId: string): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function getUserStats(): Promise<any> {
  return { success: false, error: 'Not implemented' };
}

export async function saveUserStats(stats: any): Promise<any> {
  return { success: false, error: 'Not implemented' };
} 