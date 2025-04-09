/**
 * טיפוסים עבור מודול הערות
 */

/**
 * ממשק למבנה הערה
 */
export interface Note {
  id: string;
  videoId: string;
  videoTitle?: string;
  videoURL?: string;
  videoTime: number;
  content: string;
  timestamp?: string;
  updatedAt?: any;
  createdAt?: any;
  userId?: string;
}

/**
 * ממשק למבנה וידאו עם הערות
 */
export interface VideoWithNotes {
  videoId: string;
  videoTitle: string;
  videoURL: string;
  lastUpdated: string;
  notes: Note[];
} 