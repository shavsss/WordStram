/**
 * Window Manager
 * Manages all floating windows in the application
 */

/// <reference types="chrome"/>

import { createGeminiChat } from '../gemini/GeminiChat';
import { isGeminiConfigured } from '../gemini/gemini-service';
import { User } from 'firebase/auth';

// Export the WindowType type
export type WindowType = 'gemini' | 'notes';

// Keep track of which windows are visible
const windowState: Record<WindowType, boolean> = {
  gemini: false,
  notes: false
};

// References to window controllers
let geminiController: ReturnType<typeof createGeminiChat> | null = null;
let notesController: any = null; // We'll define the type once we implement the notes controller

/**
 * Verify extension context and attempt recovery if needed
 * @returns Promise resolving to true if context is valid, false otherwise
 */
export async function ensureExtensionContext(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.warn('Extension context invalidated, attempting recovery');
    
    // Try to save essential data in localStorage
    try {
      localStorage.setItem('wordstream_recovery_needed', 'true');
      
      // If in content page, try to send a message to the page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wordstream:context_lost'));
      }
      
      return false;
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      return false;
    }
  }
  
  return true;
}

/**
 * Get user authentication from Chrome storage
 * @returns The user object if authenticated, null otherwise
 */
export async function getUserAuthentication() {
  // First ensure extension context is valid
  if (!await ensureExtensionContext()) {
    console.warn('Cannot get user authentication - extension context invalid');
    
    // Try to get from localStorage as fallback if available
    try {
      const localUserData = localStorage.getItem('wordstream_user_backup');
      if (localUserData) {
        return JSON.parse(localUserData);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    return null;
  }

  return new Promise<any>((resolve) => {
    chrome.storage.local.get(['wordstream_user_info'], (result) => {
      if (result && result.wordstream_user_info) {
        // Also save to localStorage as backup
        try {
          localStorage.setItem('wordstream_user_backup', JSON.stringify(result.wordstream_user_info));
        } catch (e) {
          // Ignore localStorage errors
        }
        
        resolve(result.wordstream_user_info);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Check if a notes panel render function exists
 * This is a temporary function until we implement the notes panel
 */
function renderNotesPanel() {
  console.warn('[WindowManager] Notes panel not yet implemented');
  return {
    show: () => console.log('[WindowManager] Show notes panel (not implemented)'),
    hide: () => console.log('[WindowManager] Hide notes panel (not implemented)'),
    isVisible: () => false
  };
}

/**
 * Initialize window manager
 * @returns An object with methods to control the windows
 */
export async function initializeWindowManager() {
  // Check authentication
  const user = await getUserAuthentication();
  const isAuthenticated = !!user;
  
  // Check if Gemini is configured
  const isGeminiAvailable = await isGeminiConfigured();

  return {
    /**
     * Toggle the Gemini chat window
     */
    toggleGemini: async () => {
      if (!isAuthenticated) {
        console.warn('[WindowManager] User not authenticated, cannot open Gemini chat');
        return false;
      }

      if (!isGeminiAvailable) {
        console.warn('[WindowManager] Gemini not configured');
        return false;
      }

      if (!geminiController) {
        geminiController = createGeminiChat();
      }

      if (windowState.gemini) {
        geminiController.hide();
      } else {
        geminiController.show();
      }
      
      windowState.gemini = !windowState.gemini;
      return windowState.gemini;
    },

    /**
     * Toggle the Notes window
     */
    toggleNotes: async () => {
      if (!isAuthenticated) {
        console.warn('[WindowManager] User not authenticated, cannot open Notes');
        return false;
      }

      if (!notesController) {
        notesController = renderNotesPanel();
      }

      if (windowState.notes) {
        notesController.hide();
      } else {
        notesController.show();
      }
      
      windowState.notes = !windowState.notes;
      return windowState.notes;
    },

    /**
     * Close all open windows
     */
    closeAllWindows: () => {
      if (geminiController && windowState.gemini) {
        geminiController.hide();
        windowState.gemini = false;
      }

      if (notesController && windowState.notes) {
        notesController.hide();
        windowState.notes = false;
      }
    },

    /**
     * Check if a window is currently visible
     */
    isWindowVisible: (windowType: WindowType): boolean => {
      return windowState[windowType] || false;
    },

    /**
     * Check if the user is authenticated
     */
    isUserAuthenticated: () => isAuthenticated,

    /**
     * Check if Gemini is available
     */
    isGeminiAvailable: () => isGeminiAvailable
  };
}

// Singleton instance
let windowManagerInstance: Awaited<ReturnType<typeof initializeWindowManager>> | null = null;

/**
 * Get the window manager instance
 * @returns The window manager instance
 */
export async function getWindowManager() {
  if (!windowManagerInstance) {
    windowManagerInstance = await initializeWindowManager();
  }
  return windowManagerInstance;
} 