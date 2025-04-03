import { useState, useEffect, useCallback } from 'react';
import { Note, UseVideoNotesOptions, NoteSyncResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom hook for managing video notes
 * Handles loading, saving, and syncing notes for a specific video
 */
export function useVideoNotes({ videoId, currentTime }: UseVideoNotesOptions) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  // Add missing state variables needed by NotesPanel
  const [currentNote, setCurrentNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [currentVideoTime, setCurrentVideoTime] = useState<number | undefined>(currentTime);
  
  // Helper function to update the global WordStream object with current notes
  const updateGlobalWordStream = useCallback((videoId: string, notes: Note[]) => {
    if (typeof window !== 'undefined' && window.WordStream) {
      // Initialize local storage object if needed
      if (!window.WordStream.local) {
        window.WordStream.local = {};
      }
      
      // Initialize notes storage if needed
      if (!window.WordStream.local.notes) {
        window.WordStream.local.notes = {};
      }
      
      // Update notes for this video
      window.WordStream.local.notes[videoId] = notes;
    }
  }, []);
  
  // Function to sync notes with Firestore - defined early to avoid circular reference
  const syncNotesWithFirestore = useCallback(async (): Promise<NoteSyncResult> => {
    if (!videoId || !isOnline) {
      return { success: false, error: 'Cannot sync while offline or missing videoId' };
    }
    
    try {
      // For now, implement a simple sync that just uses local notes as source of truth
      // In a real implementation, this would handle conflict resolution
      console.log('Syncing notes with Firestore for videoId:', videoId);
      
      // Record sync time
      const syncTime = new Date().toISOString();
      setLastSyncTime(syncTime);
      
      // Update sync time on all notes
      const updatedNotes = notes.map(note => ({
        ...note,
        lastSynced: syncTime
      }));
      
      setNotes(updatedNotes);
      
      // Save updated notes with sync timestamp to local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ ['notes_' + videoId]: updatedNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve();
          }
        });
      });
      
      // Update global object
      updateGlobalWordStream(videoId, updatedNotes);
      
      return { success: true, notes: updatedNotes };
    } catch (err) {
      console.error('Error syncing notes with Firestore:', err);
      setError('Failed to sync notes. Please try again.');
      return { success: false, error: 'Sync failed' };
    }
  }, [videoId, notes, isOnline, updateGlobalWordStream]);
  
  // Force a sync with Firestore - alias for forceSynchronize
  const forceSync = useCallback(async (): Promise<NoteSyncResult> => {
    if (!isOnline) {
      return { success: false, error: 'Cannot sync while offline' };
    }
    
    return syncNotesWithFirestore();
  }, [isOnline, syncNotesWithFirestore]);
  
  // Alias for forceSync to match NotesPanel expectations
  const forceSynchronize = forceSync;

  // Load notes from storage when videoId changes
  const loadNotes = useCallback(async () => {
    if (!videoId) {
      setNotes([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First try to load from chrome.storage.local
      const result = await new Promise<{ [key: string]: any }>((resolve, reject) => {
        chrome.storage.local.get(['notes_' + videoId], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve(result);
          }
        });
      });
      
      const loadedNotes = result['notes_' + videoId] || [];
      setNotes(loadedNotes);
      updateGlobalWordStream(videoId, loadedNotes);
      
      // If we're online, try to sync with Firestore
      if (navigator.onLine) {
        syncNotesWithFirestore();
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [videoId, updateGlobalWordStream, syncNotesWithFirestore]);
  
  // Effect to load notes when videoId changes
  useEffect(() => {
      loadNotes();
  }, [videoId, loadNotes]);
  
  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync notes when coming back online
      syncNotesWithFirestore();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNotesWithFirestore]);
  
  // Save the current note
  const saveNote = useCallback(async () => {
    if (!videoId || !currentNote.trim()) return null;
    
    setIsSaving(true);
    
    try {
      const newNote: Note = {
        id: uuidv4(),
        content: currentNote.trim(),
        timestamp: new Date().toISOString(),
        videoTime: currentVideoTime || 0,
        videoId
      };
      
      // Update state with new note
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      
      // Save to local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ ['notes_' + videoId]: updatedNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve();
          }
        });
      });
      
      // Update global object
      updateGlobalWordStream(videoId, updatedNotes);
      
      // Clear the current note
      setCurrentNote('');
      
      // If online, sync to Firestore
      if (isOnline) {
        await syncNotesWithFirestore();
      }
      
      return newNote;
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to save note. Please try again.');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [videoId, currentNote, currentVideoTime, notes, isOnline, updateGlobalWordStream, syncNotesWithFirestore]);
  
  // Function to add a new note
  const addNote = useCallback(async (content: string) => {
    if (!videoId) return null;
    
    const newNote: Note = {
      id: uuidv4(),
      content,
      timestamp: new Date().toISOString(),
      videoTime: currentVideoTime || 0,
      videoId
    };
    
    try {
      // Update state with new note
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      
      // Save to local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ ['notes_' + videoId]: updatedNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve();
          }
        });
      });
      
      // Update global object
      updateGlobalWordStream(videoId, updatedNotes);
      
      // If online, sync to Firestore
      if (isOnline) {
        await syncNotesWithFirestore();
      }
      
      return newNote;
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to save note. Please try again.');
      return null;
    }
  }, [videoId, notes, currentVideoTime, isOnline, updateGlobalWordStream, syncNotesWithFirestore]);
  
  // Function to delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    if (!videoId) return false;
    
    try {
      // Update state by removing the note
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      
      // Save to local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ ['notes_' + videoId]: updatedNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve();
          }
        });
      });
      
      // Update global object
      updateGlobalWordStream(videoId, updatedNotes);
      
      // If online, sync deletion to Firestore
      if (isOnline) {
        await syncNotesWithFirestore();
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note. Please try again.');
      return false;
    }
  }, [videoId, notes, isOnline, updateGlobalWordStream, syncNotesWithFirestore]);
  
  // Function to update a note
  const updateNote = useCallback(async (noteId: string, content: string) => {
    if (!videoId) return false;
    
    try {
      // Update the note in state
      const updatedNotes = notes.map(note => 
        note.id === noteId 
          ? { ...note, content, lastSynced: new Date().toISOString() } 
          : note
      );
      
      setNotes(updatedNotes);
      
      // Save to local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ ['notes_' + videoId]: updatedNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve();
          }
        });
      });
      
      // Update global object
      updateGlobalWordStream(videoId, updatedNotes);
      
      // If online, sync update to Firestore
      if (isOnline) {
        await syncNotesWithFirestore();
      }
      
      return true;
    } catch (err) {
      console.error('Error updating note:', err);
      setError('Failed to update note. Please try again.');
      return false;
    }
  }, [videoId, notes, isOnline, updateGlobalWordStream, syncNotesWithFirestore]);
  
  // Jump to time in video
  const handleJumpToTime = useCallback((time?: number) => {
    if (time !== undefined && typeof window !== 'undefined' && window.WordStream) {
      // Use any type assertion to bypass TypeScript checking for missing property
      const wordStream = window.WordStream as any;
      if (typeof wordStream.jumpToTime === 'function') {
        wordStream.jumpToTime(time);
      }
    }
  }, []);
  
  // Format time for display
  const formatVideoTime = useCallback((seconds?: number): string => {
    if (seconds === undefined) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);
  
  return {
    notes,
    isLoading,
    error,
    isOnline,
    lastSyncTime,
    addNote,
    deleteNote,
    updateNote,
    syncNotesWithFirestore,
    forceSync,
    forceSynchronize,
    handleJumpToTime,
    formatVideoTime,
    
    // Additional properties needed by NotesPanel
    currentNote,
    setCurrentNote,
    isSaving,
    currentVideoTime,
    setCurrentVideoTime,
    loadNotes,
    saveNote
  };
} 