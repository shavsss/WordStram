/**
 * Service for handling storage operations (Firebase or local storage)
 * Abstracts the storage mechanism from the components
 */

import { Note } from '@/features/notes/types';
import { getCurrentUser } from '@/core/firebase/auth';
import * as BackgroundMessaging from '@/utils/background-messaging';
import AuthManager from '@/core/auth-manager';

/**
 * Check if user is authenticated from multiple sources
 * @returns Promise resolving to boolean indicating if user is authenticated
 */
async function requireAuth(): Promise<boolean> {
  try {
    // Check with AuthManager
    if (AuthManager.isAuthenticated()) {
      return true;
    }
    
    // Check via background messaging
    return await BackgroundMessaging.isAuthenticated();
  } catch (error) {
    console.warn('WordStream: Auth check error:', error);
    return false;
  }
}

/**
 * Get notes for a specific video
 * @param videoId The ID of the video
 * @returns Promise resolving to an array of notes
 */
export async function getNotes(videoId: string): Promise<Note[]> {
  try {
    // Strict authentication check before loading notes
    const isAuth = await requireAuth();
    if (!isAuth) {
      console.warn('WordStream: Cannot load notes - no authenticated user');
      return [];
    }
    
    return await BackgroundMessaging.getNotes(videoId);
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
  try {
    // Authentication check before saving notes
    const isAuth = await requireAuth();
    if (!isAuth) {
      console.warn('WordStream: Cannot save notes - no authenticated user');
      return false;
    }
    
    return true; // This function is not used with Firebase as we save notes individually
  } catch (error) {
    console.error('WordStream: Failed to save notes:', error);
    return false;
  }
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
  // Strict authentication check before deleting a note
  try {
    const isAuth = await requireAuth();
    if (!isAuth) {
      console.warn('WordStream: Cannot delete note - no authenticated user');
      return currentNotes;
    }
    
    const success = await BackgroundMessaging.deleteNote(noteId);
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
  // Strict authentication check before adding a new note
  try {
    const isAuth = await requireAuth();
    if (!isAuth) {
      console.warn('WordStream: Cannot add note - no authenticated user');
      return currentNotes;
    }
    
    const timestamp = new Date().toISOString();
    
    const newNoteData = {
      content: content.trim(),
      timestamp,
      videoTime: currentTime,
      videoId
    };
    
    const savedNote = await BackgroundMessaging.saveNote(newNoteData);
    
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

/**
 * Get notes for a specific video
 * @param videoId The ID of the video
 * @returns Promise resolving to an array of notes
 */
export async function getVideoNotes(videoId: string): Promise<Note[]> {
  try {
    // Try to get notes from the server via background messaging
    return await BackgroundMessaging.getNotes(videoId);
  } catch (error) {
    console.error(`WordStream: Error getting notes for video ${videoId}:`, error);
    return [];
  }
}

// Definition of NoteData type
export interface NoteData {
  id?: string;
  videoId: string;
  content: string;
  timestamp: string;
  videoTime?: number;
  title?: string;
  tags?: string[];
  userId?: string;
}

/**
 * Save a new note
 * @param noteData Note data to save
 * @returns Promise resolving to the new note ID or null on error
 */
export async function saveNote(noteData: NoteData): Promise<string | null> {
  try {
    // Save the note via background messaging
    const savedNote = await BackgroundMessaging.saveNote(noteData);
    
    // Original code for local storage backup remains unchanged
    
    return savedNote;
  } catch (error) {
    console.error('WordStream: Error saving note:', error);
    return null;
  }
} 