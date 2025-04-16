/**
 * Global State Types
 * Defines the global state interface shared across modules
 */

// State interface used across all modules
export interface WordStreamState {
  isTranslationEnabled: boolean;
  selectedLanguage: string;
  currentVideoId: string;
  currentVideoTitle: string;
  isChatPanelOpen: boolean;
  isNotesPanelOpen: boolean;
  chatHistory: any[];
  isProcessingChatRequest: boolean;
  isFeatureActive: boolean;
  captionsAvailable: boolean;
  videoSpeed: number;
  speedControllerVisible: boolean;
  [key: string]: any;
}

// Add global state type definition to Window interface
declare global {
  interface Window {
    wordstreamState: WordStreamState;
  }
} 