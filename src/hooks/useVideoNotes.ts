import { useState, useEffect, useCallback } from 'react';
import { Note } from '@/types/video-notes';
import { getNotes, addNote, deleteNote } from '@/services/storage-service';
import { jumpToTime, formatVideoTime as formatTime } from '@/services/video-service';
import { useAuth } from '@/hooks/useAuth';

interface UseVideoNotesOptions {
  videoId: string;
  currentTime?: number;
}

/**
 * Custom hook to manage video notes functionality
 */
export function useVideoNotes({ videoId, currentTime }: UseVideoNotesOptions) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState<number | undefined>(currentTime);
  
  // Get authentication state
  const { isAuthenticated } = useAuth();
  
  // Update current time when prop changes
  useEffect(() => {
    if (currentTime !== undefined) {
      setCurrentVideoTime(currentTime);
    }
  }, [currentTime]);
  
  // Load saved notes for this video
  const loadNotes = useCallback(async () => {
    if (!videoId || !isAuthenticated) return;
    
    try {
      console.log('WordStream: Loading notes for video', videoId);
      const fetchedNotes = await getNotes(videoId);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('WordStream: Failed to load notes:', error);
    }
  }, [videoId, isAuthenticated]);
  
  // Save note to storage
  const saveNote = async () => {
    if (!currentNote.trim() || isSaving || !isAuthenticated) return;
    
    setIsSaving(true);
    console.log('WordStream: Saving new note for video', videoId);
    
    try {
      // Use currentVideoTime which could be from prop or from our internal state
      const updatedNotes = await addNote(videoId, currentNote, currentVideoTime, notes);
      setNotes(updatedNotes);
      setCurrentNote('');
    } catch (error) {
      console.error('WordStream: Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Delete note
  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!isAuthenticated) return;
    
    console.log('WordStream: Deleting note', noteId);
    
    try {
      const updatedNotes = await deleteNote(videoId, noteId, notes);
      setNotes(updatedNotes);
    } catch (error) {
      console.error('WordStream: Failed to delete note:', error);
    }
  }, [notes, videoId, isAuthenticated]);
  
  // Jump to video time when clicking on note with videoTime
  const handleJumpToTime = useCallback((time?: number) => {
    if (typeof time !== 'number') return;
    jumpToTime(time);
  }, []);
  
  // Format video time from seconds to MM:SS
  const formatVideoTime = useCallback((seconds?: number): string => {
    return formatTime(seconds);
  }, []);
  
  return {
    notes,
    currentNote,
    setCurrentNote,
    isSaving,
    currentVideoTime,
    setCurrentVideoTime,
    loadNotes,
    saveNote,
    deleteNote: handleDeleteNote,
    handleJumpToTime,
    formatVideoTime
  };
} 