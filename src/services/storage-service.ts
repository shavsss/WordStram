/**
 * Service for handling storage operations (Firebase or local storage)
 * Abstracts the storage mechanism from the components
 */

import { Note } from '@/types/video-notes';
import { getCurrentUser } from '@/firebase/auth';
import * as FirestoreService from '@/firebase/firestore';

/**
 * Check if user is authenticated and throw error if not
 * @throws Error if user is not authenticated
 */
function requireAuth(): void {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
}

/**
 * Get notes for a specific video
 * @param videoId The ID of the video
 * @returns Promise resolving to an array of notes
 */
export async function getNotes(videoId: string): Promise<Note[]> {
  const user = getCurrentUser();
  
  // Require authentication
  if (!user) {
    console.log('WordStream: Authentication required to get notes');
    return [];
  }
  
  try {
    return await FirestoreService.getNotes(videoId);
  } catch (error) {
    console.error('WordStream: Failed to load notes from Firebase:', error);
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
  requireAuth();
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
  // Require authentication
  requireAuth();
  
  try {
    const success = await FirestoreService.deleteNote(noteId);
    if (success) {
      // Filter locally to avoid another network request
      return currentNotes.filter(note => note.id !== noteId);
    }
    return currentNotes;
  } catch (error) {
    console.error('WordStream: Failed to delete note from Firebase:', error);
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
  // Require authentication
  requireAuth();
  
  const timestamp = new Date().toISOString();
  
  try {
    const newNoteData = {
      content: content.trim(),
      timestamp,
      videoTime: currentTime
    };
    
    const savedNote = await FirestoreService.saveNote(newNoteData, videoId);
    if (savedNote) {
      return [...currentNotes, savedNote];
    }
    return currentNotes;
  } catch (error) {
    console.error('WordStream: Failed to save note to Firebase:', error);
    return currentNotes;
  }
} 