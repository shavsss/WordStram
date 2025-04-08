/**
 * Notes Service
 * Handles all note-related operations with Firestore
 */

import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp, 
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { firestore } from '../../config';
import { checkFirestoreConnection } from '../../auth/auth-service';
import { createNotePath, createNotesPath, createStatsPath, createVideoPath } from '../../utils/path-utils';
import { broadcastMessage } from '../../sync/broadcast';
import { queueOperation } from '../../sync/offline-queue';
import { formatVideoTime } from '../../utils/timestamp-utils';
import { Note, VideoWithNotes } from '../../types/notes';

/**
 * Save a note to Firestore
 * @param note Note data to save
 * @returns The note ID
 */
export async function saveNote(note: Partial<Note>): Promise<string> {
  try {
    // Check connection
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot save note - ${connectionStatus.error}`);
      saveNoteToLocalStorage(note);
      queueOperation('saveNote', note);
      return note.id || '';
    }
    
    const userId = connectionStatus.userId as string;
    
    // Make sure there's always a timestamp
    if (!note.timestamp) {
      note.timestamp = new Date().toISOString();
    }
    
    let noteId = note.id;
    
    if (noteId) {
      // Update existing note
      const notePath = createNotePath(userId, noteId);
      const noteRef = doc(firestore, notePath);
      
      await updateDoc(noteRef, {
        ...note,
        updatedAt: serverTimestamp()
      });
      
      console.log(`WordStream: Updated existing note ${noteId}`);
    } else {
      // Create new note
      const newNote = {
        ...note,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const notesPath = createNotesPath(userId);
      const notesCollection = collection(firestore, notesPath);
      
      const newNoteRef = await addDoc(notesCollection, newNote);
      noteId = newNoteRef.id;
      
      console.log(`WordStream: Created new note ${noteId}`);
    }
    
    // If this is a note for a video, update the video reference too
    if (note.videoId) {
      await updateVideoNotesReference(userId, note.videoId, noteId);
    }
    
    // Update local storage
    saveNoteToLocalStorage({ ...note, id: noteId });
    
    // Broadcast note addition
    broadcastMessage({
      action: 'NOTE_ADDED',
      noteId,
      videoId: note.videoId,
      timestamp: new Date().toISOString()
    });
    
    return noteId;
  } catch (error) {
    console.error('WordStream: Error saving note:', error);
    
    // Save to local storage as fallback
    saveNoteToLocalStorage(note);
    
    return note.id || '';
  }
}

/**
 * Save a note to local storage
 * @param note Note to save
 */
function saveNoteToLocalStorage(note: Partial<Note>): void {
  // Ensure we have an ID
  const noteId = note.id || `local_${Date.now()}`;
  const noteWithId = { ...note, id: noteId };
  
  // Get video ID
  const videoId = note.videoId || 'general';
  
  // First try to get existing notes for this video
  chrome.storage.sync.get(['notes'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
      return;
    }
    
    let allNotes = result.notes || {};
    if (typeof allNotes !== 'object') {
      allNotes = {};
    }
    
    // Initialize notes array for this video if needed
    const videoNotes = allNotes[videoId] || [];
    
    // Find existing note index
    const existingIndex = videoNotes.findIndex((n: any) => n.id === noteId);
    
    if (existingIndex >= 0) {
      // Update existing note
      videoNotes[existingIndex] = { ...videoNotes[existingIndex], ...noteWithId };
    } else {
      // Add new note
      videoNotes.push(noteWithId);
    }
    
    // Sort notes by video time if available
    if (videoNotes.every((n: any) => n.videoTime !== undefined)) {
      videoNotes.sort((a: any, b: any) => (a.videoTime || 0) - (b.videoTime || 0));
    }
    
    // Update notes for this video
    allNotes[videoId] = videoNotes;
    
    // Save back to storage
    chrome.storage.sync.set({ notes: allNotes }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving notes to local storage:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Update the video document to reference this note
 * @param userId User ID
 * @param videoId Video ID
 * @param noteId Note ID
 */
async function updateVideoNotesReference(userId: string, videoId: string, noteId: string): Promise<void> {
  try {
    // Create path to video document
    const videoPath = createVideoPath(userId, videoId);
    const videoRef = doc(firestore, videoPath);
    
    // Check if video document exists
    const videoDoc = await getDoc(videoRef);
    
    if (videoDoc.exists()) {
      // Update existing video document
      await updateDoc(videoRef, {
        [`noteIds.${noteId}`]: true,
        noteCount: videoDoc.data().noteCount ? videoDoc.data().noteCount + 1 : 1,
        lastUpdated: serverTimestamp()
      });
    } else {
      // Create new video document
      await setDoc(videoRef, {
        videoId,
        userId,
        noteIds: { [noteId]: true },
        noteCount: 1,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('WordStream: Error updating video notes reference:', error);
  }
}

/**
 * Get notes for a specific video
 * @param videoId Video ID
 * @returns Array of notes
 */
export async function getNotes(videoId: string): Promise<Note[]> {
  try {
    // Check connection
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot get notes from Firestore - ${connectionStatus.error}`);
      return getNotesFromLocalStorage(videoId);
    }
    
    const userId = connectionStatus.userId as string;
    
    // Create path to notes collection
    const notesPath = createNotesPath(userId);
    const notesCollection = collection(firestore, notesPath);
    
    // Query for notes matching this video ID
    const notesQuery = query(
      notesCollection,
      where('videoId', '==', videoId),
      orderBy('videoTime', 'asc')
    );
    
    const querySnapshot = await getDocs(notesQuery);
    
    const notes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Note));
    
    // Update local storage
    updateLocalNotes(videoId, notes);
    
    console.log(`WordStream: Retrieved ${notes.length} notes for video ${videoId}`);
    return notes;
  } catch (error) {
    console.error(`WordStream: Error getting notes for video ${videoId}:`, error);
    // Fall back to local storage
    return getNotesFromLocalStorage(videoId);
  }
}

/**
 * Get notes from local storage
 * @param videoId Video ID
 * @returns Array of notes
 */
function getNotesFromLocalStorage(videoId: string): Promise<Note[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['notes'], result => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      const allNotes = result.notes || {};
      if (typeof allNotes !== 'object') {
        resolve([]);
        return;
      }
      
      const videoNotes = allNotes[videoId] || [];
      resolve(videoNotes as Note[]);
    });
  });
}

/**
 * Update local storage with notes from Firestore
 * @param videoId Video ID
 * @param notes Array of notes
 */
function updateLocalNotes(videoId: string, notes: Note[]): void {
  chrome.storage.sync.get(['notes'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
      return;
    }
    
    let allNotes = result.notes || {};
    if (typeof allNotes !== 'object') {
      allNotes = {};
    }
    
    // Update notes for this video
    allNotes[videoId] = notes;
    
    // Save back to storage
    chrome.storage.sync.set({ notes: allNotes }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving notes to local storage:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Delete a note
 * @param noteId The ID of the note to delete
 * @param videoId The video ID (optional)
 * @returns Whether the deletion was successful
 */
export async function deleteNote(noteId: string, videoId?: string): Promise<boolean> {
  try {
    console.log(`WordStream: Starting deletion of note ${noteId}`);
    
    // Check connection first
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot delete note - ${connectionStatus.error}`);
      
      // Delete from local storage only
      deleteNoteFromLocalStorage(noteId, videoId);
      
      return false;
    }
    
    const userId = connectionStatus.userId as string;
    
    // Validate noteId
    if (!noteId) {
      console.error('WordStream: Cannot delete note - missing noteId');
      return false;
    }
    
    // If videoId not provided, need to look it up
    if (!videoId) {
      const notePath = createNotePath(userId, noteId);
      const noteRef = doc(firestore, notePath);
      const noteDoc = await getDoc(noteRef);
      
      if (noteDoc.exists()) {
        videoId = noteDoc.data().videoId;
      }
    }
    
    // Delete the note document
    const notePath = createNotePath(userId, noteId);
    const noteRef = doc(firestore, notePath);
    await deleteDoc(noteRef);
    
    // Update the video reference if we have a videoId
    if (videoId) {
      const videoPath = createVideoPath(userId, videoId);
      const videoRef = doc(firestore, videoPath);
      const videoDoc = await getDoc(videoRef);
      
      if (videoDoc.exists()) {
        const videoData = videoDoc.data();
        // Remove note reference
        const noteIds = videoData.noteIds || {};
        if (noteIds[noteId]) {
          delete noteIds[noteId];
        }
        
        // Update note count
        const noteCount = Math.max(0, (videoData.noteCount || 1) - 1);
        
        await updateDoc(videoRef, {
          noteIds,
          noteCount,
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    // Delete from local storage
    deleteNoteFromLocalStorage(noteId, videoId);
    
    // Broadcast deletion
    broadcastMessage({
      action: 'NOTE_DELETED',
      noteId,
      videoId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`WordStream: Successfully deleted note ${noteId}`);
    return true;
  } catch (error) {
    console.error(`WordStream: Error deleting note ${noteId}:`, error);
    return false;
  }
}

/**
 * Delete a note from local storage
 * @param noteId The ID of the note to delete
 * @param videoId The video ID (optional)
 */
function deleteNoteFromLocalStorage(noteId: string, videoId?: string): void {
  chrome.storage.sync.get(['notes'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
      return;
    }
    
    let allNotes = result.notes || {};
    if (typeof allNotes !== 'object') {
      return;
    }
    
    // If videoId is provided, only remove from that video
    if (videoId && allNotes[videoId]) {
      allNotes[videoId] = allNotes[videoId].filter((note: any) => note.id !== noteId);
    } else {
      // Otherwise check all videos
      Object.keys(allNotes).forEach(vid => {
        if (Array.isArray(allNotes[vid])) {
          allNotes[vid] = allNotes[vid].filter((note: any) => note.id !== noteId);
        }
      });
    }
    
    // Save back to storage
    chrome.storage.sync.set({ notes: allNotes }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving notes to local storage:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Get all videos with notes
 * @returns Array of videos with their notes
 */
export async function getAllVideosWithNotes(): Promise<VideoWithNotes[]> {
  try {
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot get videos with notes - ${connectionStatus.error}`);
      return getVideosWithNotesFromLocalStorage();
    }
    
    const userId = connectionStatus.userId as string;
    
    // Get all notes
    const notesPath = createNotesPath(userId);
    const notesCollection = collection(firestore, notesPath);
    const notesSnapshot = await getDocs(notesCollection);
    
    // Group notes by video
    const videoMap = new Map<string, VideoWithNotes>();
    
    notesSnapshot.docs.forEach(doc => {
      const note = {
        id: doc.id,
        ...doc.data()
      } as Note;
      
      if (!note.videoId) return;
      
      if (!videoMap.has(note.videoId)) {
        videoMap.set(note.videoId, {
          videoId: note.videoId,
          videoTitle: note.videoTitle || 'Unknown Video',
          videoURL: `https://www.youtube.com/watch?v=${note.videoId}`,
          lastUpdated: note.updatedAt?.toString() || new Date().toISOString(),
          notes: []
        });
      }
      
      const video = videoMap.get(note.videoId)!;
      video.notes.push(note);
      
      // Update video with the most recent note data
      if (note.videoTitle && !video.videoTitle) {
        video.videoTitle = note.videoTitle;
      }
      
      // Sort notes by video time
      video.notes.sort((a, b) => (a.videoTime || 0) - (b.videoTime || 0));
    });
    
    const videos = Array.from(videoMap.values());
    
    // Sort videos by last updated
    videos.sort((a, b) => {
      const dateA = new Date(a.lastUpdated || 0);
      const dateB = new Date(b.lastUpdated || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return videos;
  } catch (error) {
    console.error('WordStream: Error getting videos with notes:', error);
    return getVideosWithNotesFromLocalStorage();
  }
}

/**
 * Get videos with notes from local storage
 * @returns Array of videos with their notes
 */
function getVideosWithNotesFromLocalStorage(): Promise<VideoWithNotes[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['notes'], result => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error getting notes from local storage:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      const allNotes = result.notes || {};
      if (typeof allNotes !== 'object') {
        resolve([]);
        return;
      }
      
      const videos: VideoWithNotes[] = [];
      
      Object.keys(allNotes).forEach(videoId => {
        if (videoId === 'general') return; // Skip general notes
        
        const notes = allNotes[videoId] || [];
        if (!Array.isArray(notes) || notes.length === 0) return;
        
        // Find most recent note
        const lastNote = notes.reduce((latest, current) => {
          const latestDate = new Date(latest.timestamp || 0);
          const currentDate = new Date(current.timestamp || 0);
          return currentDate > latestDate ? current : latest;
        }, notes[0]);
        
        videos.push({
          videoId,
          videoTitle: lastNote.videoTitle || 'Unknown Video',
          videoURL: `https://www.youtube.com/watch?v=${videoId}`,
          lastUpdated: lastNote.timestamp || new Date().toISOString(),
          notes: notes.sort((a, b) => (a.videoTime || 0) - (b.videoTime || 0))
        });
      });
      
      // Sort videos by last updated
      videos.sort((a, b) => {
        const dateA = new Date(a.lastUpdated || 0);
        const dateB = new Date(b.lastUpdated || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      resolve(videos);
    });
  });
} 