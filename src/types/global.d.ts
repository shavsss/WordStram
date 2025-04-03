// Global type definitions

import { Note } from '@/features/notes/types';

export interface WordStreamGlobal {
  // User and authentication
  currentUser?: any;
  isAuthenticated?: boolean;
  
  // Video related
  videoId?: string;
  videoTitle?: string;
  videoDuration?: number;
  
  // Video control functions
  jumpToTime?: (time: number) => void;
  getCurrentTime?: () => number;
  
  // UI components and state
  Components?: {
    FloatingControls?: (props: FloatingControlsProps) => Element;
    NotesPanel?: React.ComponentType<any>;
    [key: string]: React.ComponentType<any> | undefined;
  };
  
  // Local storage - טיפוסים מפורשים
  local?: {
    notes?: {
      [videoId: string]: Note[];
    };
    settings?: {
      darkMode?: boolean;
      autoTranslate?: boolean;
      targetLanguage?: string;
      notificationEnabled?: boolean;
      [key: string]: any;
    };
    isAuthenticated?: boolean;
    firebaseInitialized?: boolean;
  };
  
  // Additional properties
  [key: string]: any;
}

declare global {
  interface Window {
    WordStream?: WordStreamGlobal;
  }
}

export {}; 