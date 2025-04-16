/**
 * Notes Service
 * Handles notes-related functionality including creating panels, saving notes, etc.
 */

import { VideoNote } from './types';
import { makeDraggable } from '../shared/DraggableUtil';
// Import Firebase services
import { getFirebaseServices } from '../../auth';
import { WordStreamState } from '../shared/global-state';
import { addDoc, collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../../config/api-config';

// Define auth state interface
interface AuthState {
  isAuthenticated: boolean;
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  };
  error?: string;
}

/**
 * Save notes to storage
 */
export async function saveNotes() {
  const notesTextarea = document.getElementById('wordstream-notes-textarea') as HTMLTextAreaElement;
  if (!notesTextarea) return;
  
  const notes = notesTextarea.value.trim();
  if (!notes) return;
  
  // Get current page information
  const currentVideoId = getCurrentVideoId();
  const currentVideoTitle = getCurrentVideoTitle();
  
  try {
    // Use our new retry-with-auth function to handle permissions errors
    await FIREBASE_CONFIG.retryWithAuth(async () => {
      // Check if user is authenticated first
      const authState = await getAuthState() as AuthState;
      if (!authState.isAuthenticated || !authState.user) {
        showAuthRequiredMessage();
        throw new Error('Authentication required');
      }
      
      // Create note data
      const noteData = {
        userId: authState.user.uid,
        videoId: currentVideoId,
        videoTitle: currentVideoTitle,
        pageUrl: window.location.href,
        content: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to Firebase Firestore
      await saveNoteToFirebase(noteData);
      
      console.log('WordStream: Note saved successfully to Firebase');
      showToast('Notes saved successfully!');
    });
  } catch (error) {
    console.error('WordStream: Error saving notes:', error);
    showToast('Error saving notes. Please make sure you are signed in.');
  }
}

/**
 * Get authentication state from background script
 */
async function getAuthState(): Promise<AuthState> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response as AuthState);
    });
  });
}

/**
 * Save a note to Firebase
 */
async function saveNoteToFirebase(noteData: any): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ 
      action: 'SAVE_NOTE', 
      data: noteData 
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (!response || !response.success) {
        reject(new Error(response?.error || 'Failed to save note'));
        return;
      }
      
      resolve();
    });
  });
}

/**
 * Show a message that authentication is required
 */
function showAuthRequiredMessage() {
  // Create or get auth message container
  let authMessage = document.getElementById('wordstream-auth-required-message');
  if (!authMessage) {
    authMessage = document.createElement('div');
    authMessage.id = 'wordstream-auth-required-message';
    authMessage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      text-align: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Authentication Required';
    title.style.margin = '0 0 16px 0';
    
    const message = document.createElement('p');
    message.textContent = 'You need to be signed in to save notes. Please sign in to continue.';
    message.style.marginBottom = '20px';
    
    const signInButton = document.createElement('button');
    signInButton.textContent = 'Sign In';
    signInButton.style.cssText = `
      background-color: #f59e0b;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 10px 20px;
      font-weight: 500;
      cursor: pointer;
      margin-right: 10px;
    `;
    signInButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_AUTH_POPUP' });
      if (authMessage && authMessage.parentNode) {
        authMessage.parentNode.removeChild(authMessage);
      }
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background-color: #e5e7eb;
      color: #374151;
      border: none;
      border-radius: 4px;
      padding: 10px 20px;
      font-weight: 500;
      cursor: pointer;
    `;
    closeButton.addEventListener('click', () => {
      if (authMessage && authMessage.parentNode) {
        authMessage.parentNode.removeChild(authMessage);
      }
    });
    
    const buttonContainer = document.createElement('div');
    buttonContainer.appendChild(signInButton);
    buttonContainer.appendChild(closeButton);
    
    authMessage.appendChild(title);
    authMessage.appendChild(message);
    authMessage.appendChild(buttonContainer);
    
    document.body.appendChild(authMessage);
  } else {
    authMessage.style.display = 'block';
  }
}

/**
 * Show a toast notification
 */
function showToast(message: string, duration: number = 3000) {
  // Create or get toast container
  let toast = document.getElementById('wordstream-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wordstream-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #374151;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
    }
  }, duration);
}

/**
 * Generate a unique ID for a note
 */
function generateNoteId(): string {
  return 'note_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Save a note to localStorage
 */
function saveNoteToLocalStorage(noteData: any): void {
  // Get existing notes
  const existingNotesJSON = localStorage.getItem('wordstream-notes');
  const existingNotes = existingNotesJSON ? JSON.parse(existingNotesJSON) : [];
  
  // Check if we already have a note for this video
  const existingNoteIndex = existingNotes.findIndex((note: any) => note.videoId === noteData.videoId);
  
  if (existingNoteIndex >= 0) {
    // Update existing note
    existingNotes[existingNoteIndex] = {
      ...existingNotes[existingNoteIndex],
      content: noteData.content,
      updatedAt: noteData.updatedAt
    };
  } else {
    // Add new note
    existingNotes.push(noteData);
  }
  
  // Save back to localStorage
  localStorage.setItem('wordstream-notes', JSON.stringify(existingNotes));
}

/**
 * Get current video ID or generate one from the URL
 */
function getCurrentVideoId(): string {
  // Try to get YouTube video ID
  if (window.location.hostname.includes('youtube.com')) {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (videoId) return videoId;
  }
  
  // Fallback to hashed URL
  return btoa(window.location.pathname).substring(0, 20);
}

/**
 * Get current video or page title
 */
function getCurrentVideoTitle(): string {
  // Try to get YouTube video title
  if (window.location.hostname.includes('youtube.com')) {
    const titleElement = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
    if (titleElement && titleElement.textContent) {
      return titleElement.textContent.trim();
    }
  }
  
  // Fallback to document title
  return document.title || 'Untitled Page';
}

/**
 * Create a window for notes
 */
export function createNotesPanel() {
  // Check if the window already exists
  let notesPanel = document.getElementById('wordstream-notes-panel');
  if (notesPanel) {
    notesPanel.style.display = 'block';
    return notesPanel;
  }
  
  // Create the window
  notesPanel = document.createElement('div');
  notesPanel.id = 'wordstream-notes-panel';
  notesPanel.style.cssText = `
    position: fixed;
    top: 570px;
    left: 20px;
    width: 350px;
    height: 400px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 9998;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Add title with close options
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f59e0b;
    color: white;
    cursor: move;
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Notes';
  title.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  `;
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  const minimizeButton = document.createElement('button');
  minimizeButton.innerHTML = '&#8722;'; // Unicode minus sign
  minimizeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  `;
  minimizeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    notesPanel.style.display = 'none';
    window.wordstreamState.isNotesPanelOpen = false;
  });
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&#10005;'; // Unicode X
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  `;
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    notesPanel.style.display = 'none';
    window.wordstreamState.isNotesPanelOpen = false;
  });
  
  buttonsContainer.appendChild(minimizeButton);
  buttonsContainer.appendChild(closeButton);
  header.appendChild(title);
  header.appendChild(buttonsContainer);
  
  // Create notes area
  const noteContent = document.createElement('div');
  noteContent.style.cssText = `
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
  `;
  
  const textarea = document.createElement('textarea');
  textarea.id = 'wordstream-notes-textarea';
  textarea.placeholder = 'Write notes about this video or page...';
  textarea.style.cssText = `
    flex-grow: 1;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    margin-bottom: 16px;
    font-family: inherit;
  `;
  
  // Save button
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save Notes';
  saveButton.style.cssText = `
    background-color: #f59e0b;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  `;
  saveButton.onmouseover = () => {
    saveButton.style.backgroundColor = '#d97706';
  };
  saveButton.onmouseout = () => {
    saveButton.style.backgroundColor = '#f59e0b';
  };
  saveButton.addEventListener('click', saveNotes);
  
  // Assemble the window
  noteContent.appendChild(textarea);
  noteContent.appendChild(saveButton);
  
  notesPanel.appendChild(header);
  notesPanel.appendChild(noteContent);
  
  // Add to document
  document.body.appendChild(notesPanel);
  
  // Make the window draggable
  makeDraggable(notesPanel, header);
  
  // Try to load saved position from localStorage
  const savedPosition = localStorage.getItem('wordstream-notes-panel-position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      notesPanel.style.top = position.top;
      notesPanel.style.right = position.right;
      notesPanel.style.bottom = position.bottom;
      notesPanel.style.left = position.left;
    } catch (error) {
      console.error('WordStream: Error loading saved position', error);
    }
  }
  
  return notesPanel;
}

/**
 * Toggle the visibility of the notes panel
 */
export function toggleNotesPanel() {
  if (window.wordstreamState.isNotesPanelOpen) {
    const notesPanel = document.getElementById('wordstream-notes-panel');
    if (notesPanel) {
      notesPanel.style.display = 'none';
      window.wordstreamState.isNotesPanelOpen = false;
    }
  } else {
    createNotesPanel();
    window.wordstreamState.isNotesPanelOpen = true;
  }
} 