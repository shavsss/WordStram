/**
 * Notes Service
 * Handles notes-related functionality including creating panels, saving notes, etc.
 */

import { VideoNote } from './types';
import { makeDraggable } from '../shared/DraggableUtil';
import { getFirebaseServices } from '../../auth';
import { WordStreamState } from '../shared/global-state';

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
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      console.error('WordStream: Firebase services not available');
      return;
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    if (!user) {
      console.error('WordStream: User not signed in');
      alert('Please sign in to save notes');
      return;
    }
    
    // Save note to Firestore
    const noteData = {
      userId: user.uid,
      videoId: currentVideoId,
      videoTitle: currentVideoTitle,
      pageUrl: window.location.href,
      content: notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Send message to background script to save the note
    chrome.runtime.sendMessage({
      action: 'SAVE_NOTE',
      data: noteData
    }, (response) => {
      if (response && response.success) {
        console.log('WordStream: Note saved successfully');
        alert('Notes saved successfully!');
      } else {
        console.error('WordStream: Failed to save note', response?.error);
        alert('Error saving notes, please try again later');
      }
    });
  } catch (error) {
    console.error('WordStream: Error saving notes:', error);
    alert('Error saving notes, please try again later');
  }
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