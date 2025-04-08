/**
 * useNotes hook
 * Manages notes for a specific video
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getNotes, 
  saveNote, 
  deleteNote, 
  getAllVideosWithNotes
} from '../core/firebase';
import { Note, VideoWithNotes } from '../core/firebase/types/notes';
import { useBroadcastListener } from '../core/firebase/sync/broadcast';

interface UseNotesOptions {
  videoId?: string;
}

interface UseNotesResult {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  saveNote: (note: Partial<Note>) => Promise<string>;
  deleteNote: (noteId: string) => Promise<boolean>;
  getAllVideosWithNotes: () => Promise<VideoWithNotes[]>;
}

/**
 * Hook for working with notes
 * @param options Options for the hook
 */
export function useNotes(options: UseNotesOptions = {}): UseNotesResult {
  const { videoId } = options;
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load notes when videoId changes
  useEffect(() => {
    if (!videoId) {
      setNotes([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    getNotes(videoId)
      .then(fetchedNotes => {
        setNotes(fetchedNotes);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading notes:', err);
        setError('Failed to load notes');
        setIsLoading(false);
      });
  }, [videoId]);
  
  // Handle broadcast messages for note updates
  useBroadcastListener(message => {
    if (!videoId) return;
    
    if (message.action === 'NOTE_ADDED' && message.videoId === videoId) {
      // Refresh notes when a new note is added
      getNotes(videoId)
        .then(fetchedNotes => {
          setNotes(fetchedNotes);
        })
        .catch(err => {
          console.error('Error refreshing notes after add:', err);
        });
    } else if (message.action === 'NOTE_DELETED' && message.videoId === videoId) {
      // Remove the deleted note
      setNotes(currentNotes => 
        currentNotes.filter(note => note.id !== message.noteId)
      );
    } else if (message.action === 'NOTES_UPDATED') {
      // Full refresh of notes data
      getNotes(videoId)
        .then(fetchedNotes => {
          setNotes(fetchedNotes);
        })
        .catch(err => {
          console.error('Error refreshing notes after update:', err);
        });
    }
  });
  
  // Save a note
  const saveNoteCallback = useCallback(async (note: Partial<Note>): Promise<string> => {
    if (videoId && !note.videoId) {
      note.videoId = videoId;
    }
    
    try {
      const noteId = await saveNote(note);
      
      // Refresh notes list
      if (videoId) {
        const refreshedNotes = await getNotes(videoId);
        setNotes(refreshedNotes);
      }
      
      return noteId;
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save note');
      throw err;
    }
  }, [videoId]);
  
  // Delete a note
  const deleteNoteCallback = useCallback(async (noteId: string): Promise<boolean> => {
    try {
      const success = await deleteNote(noteId, videoId);
      
      if (success) {
        // Remove from local state
        setNotes(currentNotes => 
          currentNotes.filter(note => note.id !== noteId)
        );
      }
      
      return success;
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note');
      return false;
    }
  }, [videoId]);
  
  // Get all videos with notes
  const getAllVideosCallback = useCallback(async (): Promise<VideoWithNotes[]> => {
    try {
      return await getAllVideosWithNotes();
    } catch (err) {
      console.error('Error getting videos with notes:', err);
      setError('Failed to get videos with notes');
      return [];
    }
  }, []);
  
  return {
    notes,
    isLoading,
    error,
    saveNote: saveNoteCallback,
    deleteNote: deleteNoteCallback,
    getAllVideosWithNotes: getAllVideosCallback
  };
} 