/**
 * Notes Service Feature Layer
 * 
 * שירות פתקים ברמת הפיצ'ר
 */

import { notesService as coreNotesService } from '@/core/services/notes-service';
import { Note, VideoNote, VideoWithNotes } from '../types';
import { NOTE_ACTIONS } from '../constants';
import { DocumentData } from 'firebase/firestore';
// To fix linter error, make sure to install this package: npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

/**
 * Notes service extended for feature-level functionality
 */
class NotesFeatureService {
  private listeners: Array<(action: string, data: any) => void> = [];
  
  // Initialize Supabase client
  private supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  private supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  private supabase = createClient(this.supabaseUrl, this.supabaseKey);
  
  /**
   * Add a new note (Firebase compatibility layer)
   */
  async addNote(noteData: {
    content: string;
    videoId?: string;
    videoTitle?: string;
    videoURL?: string;
    videoTimestamp?: number;
    tags?: string[];
    userId: string;
  }): Promise<string> {
    // Use Supabase implementation
    const note = await this.createNote({
      content: noteData.content,
      timestamp: Date.now(),
      userId: noteData.userId,
      videoId: noteData.videoId,
      videoTitle: noteData.videoTitle,
      videoURL: noteData.videoURL,
      videoTimestamp: noteData.videoTimestamp,
      tags: noteData.tags || [],
    });
    
    // Notify listeners
    this.notifyListeners(NOTE_ACTIONS.ADD, note);
    
    return note.id;
  }
  
  /**
   * Update an existing note (Firebase compatibility layer)
   */
  async updateNote(noteId: string, noteData: Partial<{
    content: string;
    videoId?: string;
    videoTitle?: string;
    videoURL?: string;
    videoTimestamp?: number;
    tags?: string[];
  }>): Promise<void> {
    // Convert videoTimestamp to timestamp if needed
    const note = await this._updateNote(noteId, noteData);
    
    // Notify listeners
    this.notifyListeners(NOTE_ACTIONS.UPDATE, note);
  }
  
  /**
   * Delete a note (Firebase compatibility layer)
   */
  async deleteNote(noteId: string): Promise<void> {
    await this._deleteNote(noteId);
    
    // Notify listeners
    this.notifyListeners(NOTE_ACTIONS.DELETE, { id: noteId });
  }
  
  /**
   * Get all notes (Firebase compatibility layer)
   */
  async getAllNotes(userId: string): Promise<Note[]> {
    return this.fetchNotes(userId);
  }
  
  /**
   * Get recent notes (Firebase compatibility layer)
   */
  async getRecentNotes(userId: string, count: number = 10): Promise<Note[]> {
    const notes = await this.fetchNotes(userId);
    return notes.slice(0, count);
  }
  
  /**
   * Get notes for a specific video (Firebase compatibility layer)
   */
  async getVideoNotes(userId: string, videoId: string): Promise<VideoNote[]> {
    const notes = await this.fetchNotesByVideoId(userId, videoId);
    return notes as VideoNote[];
  }
  
  /**
   * Get all videos with notes (Firebase compatibility layer)
   */
  async getAllVideosWithNotes(userId: string): Promise<VideoWithNotes[]> {
    const allNotes = await this.fetchNotes(userId);
    return this.organizeNotesByVideo(allNotes);
  }
  
  /**
   * Add listener for note changes
   */
  addListener(callback: (action: string, data: any) => void): void {
    this.listeners.push(callback);
  }
  
  /**
   * Remove listener
   */
  removeListener(callback: (action: string, data: any) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
  
  /**
   * Notify all listeners of a change
   */
  private notifyListeners(action: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(action, data);
      } catch (error) {
        console.error('Error in notes listener:', error);
      }
    });
  }
  
  /**
   * Map Firestore documents to Note objects (Legacy support)
   */
  private mapDocumentsToNotes(documents: DocumentData[]): Note[] {
    return documents.map(doc => ({
      id: doc.id,
      content: doc.content,
      timestamp: typeof doc.timestamp === 'string' 
        ? new Date(doc.timestamp).getTime() 
        : doc.timestamp || Date.now(),
      videoId: doc.videoId,
      videoTitle: doc.videoTitle,
      videoURL: doc.videoURL,
      videoTimestamp: doc.videoTimestamp,
      formattedTime: doc.formattedTime,
      tags: doc.tags || [],
      userId: doc.userId
    }));
  }
  
  /**
   * Organize notes by video
   */
  private organizeNotesByVideo(notes: Note[]): VideoWithNotes[] {
    const videoMap = new Map<string, VideoWithNotes>();
    
    // Group notes by videoId
    notes.forEach(note => {
      if (note.videoId) {
        if (videoMap.has(note.videoId)) {
          const video = videoMap.get(note.videoId)!;
          video.notes.push(note as VideoNote);
          
          // Update lastUpdated if this note is newer
          const noteTimestamp = new Date(note.timestamp).toISOString();
          if (new Date(noteTimestamp) > new Date(video.lastUpdated)) {
            video.lastUpdated = noteTimestamp;
          }
        } else {
          videoMap.set(note.videoId, {
            videoId: note.videoId,
            videoTitle: note.videoTitle || 'Unknown Video',
            videoURL: note.videoURL || `https://www.youtube.com/watch?v=${note.videoId}`,
            lastUpdated: new Date(note.timestamp).toISOString(),
            notes: [note as VideoNote]
          });
        }
      }
    });
    
    // Convert map to array and sort
    const videos = Array.from(videoMap.values());
    
    // Sort videos by lastUpdated (newest first)
    videos.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    
    // Sort notes within each video
    videos.forEach(video => {
      video.notes.sort((a, b) => b.timestamp - a.timestamp);
    });
    
    return videos;
  }

  /**
   * Fetch all notes for a user from Supabase
   */
  async fetchNotes(userId: string): Promise<Note[]> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as Note[];
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }
  }

  /**
   * Fetch notes for a specific video from Supabase
   */
  async fetchNotesByVideoId(userId: string, videoId: string): Promise<Note[]> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('userId', userId)
        .eq('videoId', videoId)
        .order('timestamp', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Note[];
    } catch (error) {
      console.error('Error fetching notes by video ID:', error);
      throw error;
    }
  }

  /**
   * Create a new note in Supabase
   */
  async createNote(note: Omit<Note, 'id'>): Promise<Note> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .insert([note])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Note;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  /**
   * Update a note in Supabase (private implementation)
   */
  private async _updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Note;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete a note from Supabase (private implementation)
   */
  private async _deleteNote(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Search notes by content
   */
  async searchNotes(userId: string, searchTerm: string): Promise<Note[]> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('userId', userId)
        .ilike('content', `%${searchTerm}%`)
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as Note[];
    } catch (error) {
      console.error('Error searching notes:', error);
      throw error;
    }
  }

  /**
   * Get notes for a specific tag
   */
  async getNotesByTag(userId: string, tag: string): Promise<Note[]> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('userId', userId)
        .containedBy('tags', [tag])
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as Note[];
    } catch (error) {
      console.error('Error fetching notes by tag:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notesService = new NotesFeatureService(); 