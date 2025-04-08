/**
 * Notes Service
 * 
 * שירות לניהול הערות המשתמש
 */

import { FirestoreService } from '../firebase/firestore';
import { DocumentData } from 'firebase/firestore';

export interface NoteData {
  content: string;
  videoId?: string;
  videoTitle?: string;
  videoURL?: string;
  videoTimestamp?: number;
  tags?: string[];
}

/**
 * Service for managing user notes
 */
export class NotesService extends FirestoreService {
  constructor() {
    super('notes');
  }
  
  /**
   * Add a new note
   */
  async addNote(note: NoteData): Promise<string> {
    // Generate a unique ID
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    await this.setDocument(id, note);
    return id;
  }
  
  /**
   * Update an existing note
   */
  async updateNote(id: string, note: Partial<NoteData>): Promise<void> {
    await this.updateDocument(id, note);
  }
  
  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    await this.deleteDocument(id);
  }
  
  /**
   * Get all notes for current user
   */
  async getAllNotes(): Promise<DocumentData[]> {
    return this.getUserDocuments();
  }
  
  /**
   * Get recent notes for current user
   */
  async getRecentNotes(count: number = 10): Promise<DocumentData[]> {
    return this.getRecentUserDocuments(count);
  }
  
  /**
   * Get notes for a specific video
   */
  async getVideoNotes(videoId: string): Promise<DocumentData[]> {
    const allNotes = await this.getUserDocuments();
    return allNotes.filter(note => note.videoId === videoId);
  }
}

// Export singleton instance
export const notesService = new NotesService(); 