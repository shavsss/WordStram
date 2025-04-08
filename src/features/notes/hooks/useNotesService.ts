'use client';

import { useState, useEffect, useCallback } from 'react';
import { Note, VideoNote, VideoWithNotes } from '../types';
import { STORAGE_KEYS, NOTE_ACTIONS, SYNC_INTERVALS } from '../constants';
import { notesService } from '@/core/services/notes-service';
import * as BackgroundMessaging from '@/utils/background-messaging';

export interface NotesServiceState {
  notes: Note[];
  videosWithNotes: VideoWithNotes[];
  isLoading: boolean;
  error: string | null;
  lastSynced: Date | null;
}

/**
 * Hook for interacting with notes service
 * 
 * מאפשר גישה לשירות הפתקים ופעולות סנכרון עליו
 */
export function useNotesService() {
  const [state, setState] = useState<NotesServiceState>({
    notes: [],
    videosWithNotes: [],
    isLoading: false,
    error: null,
    lastSynced: null
  });

  const [syncTimerId, setSyncTimerId] = useState<number | null>(null);

  // Load notes on mount
  useEffect(() => {
    loadAllNotes();

    // Set up auto-sync timer
    const timerId = window.setInterval(() => {
      syncWithFirestore();
    }, SYNC_INTERVALS.AUTO);

    setSyncTimerId(timerId);

    // Cleanup timer on unmount
    return () => {
      if (syncTimerId) {
        window.clearInterval(syncTimerId);
      }
    };
  }, []);

  // Load all notes
  const loadAllNotes = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Get authentication status
      const authState = await BackgroundMessaging.getAuthState();
      
      // First try to get from local storage for quick load
      const storedNotesString = localStorage.getItem(STORAGE_KEYS.NOTES);
      let localNotes: Note[] = [];
      
      if (storedNotesString) {
        try {
          localNotes = JSON.parse(storedNotesString);
        } catch (err) {
          console.error('Error parsing local notes:', err);
        }
      }
      
      // If authenticated, try to get from Firestore
      if (authState.isAuthenticated) {
        try {
          // This would normally talk to remote service
          const firestoreNotes = await notesService.getAllNotes();
          
          // Process and organize notes by video
          const notesMap = new Map<string, Note>();
          const videosMap = new Map<string, VideoWithNotes>();
          
          // First add local notes to map
          localNotes.forEach(note => {
            notesMap.set(note.id, note);
          });
          
          // Then add or update with Firestore notes (they take precedence)
          firestoreNotes.forEach(docData => {
            const note: Note = {
              id: docData.id,
              content: docData.content,
              timestamp: typeof docData.timestamp === 'string' ? Date.parse(docData.timestamp) : docData.timestamp || Date.now(),
              videoId: docData.videoId,
              videoTitle: docData.videoTitle,
              videoURL: docData.videoURL,
              videoTimestamp: docData.videoTimestamp,
              formattedTime: docData.formattedTime,
              tags: docData.tags || [],
              userId: docData.userId
            };
            
            notesMap.set(note.id, note);
            
            // Organize by video if applicable
            if (note.videoId) {
              const videoId = note.videoId;
              const videoData = videosMap.get(videoId) || {
                videoId,
                videoTitle: note.videoTitle || 'Unknown Video',
                videoURL: note.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
                lastUpdated: typeof note.timestamp === 'string' ? Date.parse(note.timestamp) : note.timestamp,
                notes: []
              };
              
              // Add note to video's notes
              videoData.notes.push(note as VideoNote);
              
              // Update lastUpdated if this note is newer
              const noteTimestamp = typeof note.timestamp === 'string' ? Date.parse(note.timestamp) : note.timestamp;
              if (noteTimestamp > videoData.lastUpdated) {
                videoData.lastUpdated = noteTimestamp;
              }
              
              videosMap.set(videoId, videoData);
            }
          });
          
          // Convert maps to arrays
          const allNotes = Array.from(notesMap.values()).sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          const allVideosWithNotes = Array.from(videosMap.values()).map(video => ({
            ...video,
            notes: video.notes.sort((a, b) => {
              const timeA = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : a.timestamp;
              const timeB = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : b.timestamp;
              return timeB - timeA;
            })
          }));
          
          // Update local storage
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(allNotes));
          localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
          
          setState({
            notes: allNotes,
            videosWithNotes: allVideosWithNotes,
            isLoading: false,
            error: null,
            lastSynced: new Date()
          });
        } catch (firestoreError) {
          console.error('Error fetching from Firestore:', firestoreError);
          
          // If Firestore fails, at least return local notes
          setState({
            notes: localNotes,
            videosWithNotes: processNotesIntoVideos(localNotes),
            isLoading: false,
            error: 'Failed to sync with cloud. Showing local notes only.',
            lastSynced: null
          });
        }
      } else {
        // Not authenticated, just use local notes
        setState({
          notes: localNotes,
          videosWithNotes: processNotesIntoVideos(localNotes),
          isLoading: false,
          error: null,
          lastSynced: null
        });
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to load notes. Please try again later.' 
      }));
    }
  }, []);

  // Process an array of notes into video-organized structure
  const processNotesIntoVideos = (notes: Note[]): VideoWithNotes[] => {
    const videoMap = new Map<string, { 
      videoId: string; 
      videoTitle: string; 
      videoURL: string; 
      lastUpdated: number; 
      notes: VideoNote[] 
    }>();

    // Filter notes with videoId and group by videoId
    notes.filter(note => note.videoId).forEach(note => {
      if (!note.videoId || !note.videoTitle || !note.videoURL) return;

      if (!videoMap.has(note.videoId)) {
        videoMap.set(note.videoId, {
          videoId: note.videoId,
          videoTitle: note.videoTitle || 'Unknown Video',
          videoURL: note.videoURL,
          lastUpdated: typeof note.timestamp === 'string' ? Date.parse(note.timestamp) : note.timestamp,
          notes: []
        });
      }

      const videoNote: VideoNote = {
        ...note,
        videoId: note.videoId,
        videoTitle: note.videoTitle,
        videoURL: note.videoURL,
        videoTimestamp: note.videoTimestamp || 0
      };

      const video = videoMap.get(note.videoId);
      if (video) {
        video.notes.push(videoNote);
        video.lastUpdated = Math.max(video.lastUpdated, typeof note.timestamp === 'string' ? Date.parse(note.timestamp) : note.timestamp);
      }
    });

    return Array.from(videoMap.values());
  };

  // Sync with Firestore
  const syncWithFirestore = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Check authentication status
      const authState = await BackgroundMessaging.getAuthState();
      
      if (!authState.isAuthenticated) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'You need to be signed in to sync notes with the cloud.'
        }));
        return;
      }
      
      // Sync using notesService
      await loadAllNotes();
      
      // This is where more complex sync logic would go
      // For example, detecting conflicts, pushing local changes, etc.
      
    } catch (err) {
      console.error('Error syncing with Firestore:', err);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to sync with the cloud. Please try again later.'
      }));
    }
  }, [loadAllNotes]);

  // Add a new note
  const addNote = useCallback(async (noteData: { content: string, videoId?: string, videoTitle?: string, videoURL?: string, videoTimestamp?: number }) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Try to get auth state first
      const authState = await BackgroundMessaging.getAuthState();
      
      // Create local note object
      const now = Date.now();
      const newNote: Note = {
        id: `local-${now}`, // Temporary ID
        content: noteData.content.trim(),
        timestamp: now,
        userId: authState.userInfo?.uid || 'anonymous',
        ...(noteData.videoId && { videoId: noteData.videoId }),
        ...(noteData.videoTitle && { videoTitle: noteData.videoTitle }),
        ...(noteData.videoURL && { videoURL: noteData.videoURL }),
        ...(noteData.videoTimestamp && { videoTimestamp: noteData.videoTimestamp }),
        tags: extractTags(noteData.content)
      };
      
      // Update local state first for immediate feedback
      setState(prev => {
        const updatedNotes = [newNote, ...prev.notes];
        return {
          ...prev,
          notes: updatedNotes,
          videosWithNotes: processNotesIntoVideos(updatedNotes),
          isLoading: false
        };
      });
      
      // Save to local storage
      const updatedNotes = [newNote, ...state.notes];
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
      
      // Try to save to Firestore if authenticated
      if (authState.isAuthenticated) {
        // Create note in Firestore
        const noteId = await notesService.addNote({
          content: noteData.content,
          videoId: noteData.videoId,
          videoTitle: noteData.videoTitle,
          videoURL: noteData.videoURL,
          videoTimestamp: noteData.videoTimestamp,
          tags: newNote.tags
        });
        
        // Update local note with server ID
        setState(prev => {
          const updatedNotes = prev.notes.map(note => 
            note.id === newNote.id ? { ...note, id: noteId } : note
          );
          
          // Update local storage with new ID
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
          
          return {
            ...prev,
            notes: updatedNotes,
            videosWithNotes: processNotesIntoVideos(updatedNotes),
            lastSynced: new Date()
          };
        });
      }
      
      return newNote;
    } catch (err) {
      console.error('Error adding note:', err);
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to add note.' }));
      throw err;
    }
  }, [state.notes]);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Update local state first for immediate feedback
      setState(prev => {
        const updatedNotes = prev.notes.filter(note => note.id !== noteId);
        return {
          ...prev,
          notes: updatedNotes,
          videosWithNotes: processNotesIntoVideos(updatedNotes),
          isLoading: false
        };
      });
      
      // Update local storage
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(
        state.notes.filter(note => note.id !== noteId)
      ));
      
      // Try to delete from Firestore if authenticated
      const authState = await BackgroundMessaging.getAuthState();
      
      if (authState.isAuthenticated) {
        // Delete from Firestore
        await notesService.deleteNote(noteId);
        
        setState(prev => ({
          ...prev,
          lastSynced: new Date()
        }));
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting note:', err);
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to delete note.' }));
      
      // Reload notes to restore state
      loadAllNotes();
      
      return false;
    }
  }, [state.notes, loadAllNotes]);

  // Extract hashtags from content
  const extractTags = (content: string): string[] => {
    const tags = content.match(/#[\w-]+/g) || [];
    return [...new Set(tags.map(tag => tag.slice(1)))]; // Remove # and deduplicate
  };

  return {
    state,
    loadAllNotes,
    syncWithFirestore,
    addNote,
    deleteNote
  };
} 