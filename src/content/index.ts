/// <reference types="chrome"/>

// Add performance polyfill
if (typeof performance === 'undefined') {
  (window as any).performance = {
    now: () => Date.now()
  };
}

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { YouTubeCaptionDetector } from '../services/caption-detectors/youtube-detector';
import { NetflixCaptionDetector } from '../services/caption-detectors/netflix-detector';
import { CaptionDetector } from '@/types';
import { createRoot } from 'react-dom/client';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';

// Make React and ReactDOM globally available for components
declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM & { createRoot?: typeof createRoot };
    WordStream?: {
      Components?: {
        FloatingControls?: typeof FloatingControls;
      };
    };
  }
}

// Set React and ReactDOM on the window to make them available globally
window.React = React;
window.ReactDOM = { ...ReactDOM, createRoot };

// Register WordStream components on the global window object
if (!window.WordStream) {
  window.WordStream = {};
}
if (!window.WordStream.Components) {
  window.WordStream.Components = {};
}
window.WordStream.Components.FloatingControls = FloatingControls;
console.log('[WordStream] Registered FloatingControls component on global window.WordStream.Components');

// Global variables for managing captions and panels
let currentDetector: CaptionDetector | null = null;
let lastCaptionContainer: HTMLElement | null = null;
let captionCheckInterval: number | null = null;
let timestampInterval: ReturnType<typeof setInterval> | null = null;

// Initialize the appropriate detector based on the current URL
function initializeDetector(): CaptionDetector | null {
  const url = window.location.href;
  
  if (url.includes('youtube.com')) {
    return new YouTubeCaptionDetector();
  } else if (url.includes('netflix.com')) {
    return new NetflixCaptionDetector();
  }
  
  return null;
}

// Check if the caption container has changed
function hasCaptionContainerChanged(newContainer: HTMLElement | null): boolean {
  if (!lastCaptionContainer && !newContainer) return false;
  if (!lastCaptionContainer || !newContainer) return true;
  return lastCaptionContainer !== newContainer;
}

// Start monitoring captions
async function monitorCaptions() {
  if (!currentDetector) return;

  try {
    const captionElement = await currentDetector.detect();
    
    if (captionElement && hasCaptionContainerChanged(captionElement)) {
      console.log('WordStream: Caption container changed, updating...');
      
      // Stop observing old container
      if (lastCaptionContainer) {
        currentDetector.stopObserving();
      }
      
      // Start observing new container
      lastCaptionContainer = captionElement;
      currentDetector.processCaption(captionElement);
      console.log('WordStream: Now observing new caption container');
    }
  } catch (error) {
    console.error('WordStream: Error monitoring captions:', error);
  }
}

// Start the caption detection process
async function startDetection() {
  // Clean up existing detector and interval
  cleanup();
  
  // Initialize new detector
  currentDetector = initializeDetector();
  if (!currentDetector) return;

  console.log('WordStream: Starting caption detection...');
  
  try {
    // Initial caption check
    await monitorCaptions();
    
    // Set up continuous monitoring
    captionCheckInterval = window.setInterval(monitorCaptions, 1000) as unknown as number;
    
    // Also watch for player state changes
    const player = document.querySelector('.html5-video-player');
    if (player) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.target instanceof HTMLElement) {
            // Check for ad-related class changes or video player state changes
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'class' || 
                 mutation.attributeName === 'data-state')) {
              monitorCaptions();
            }
          }
        });
      });
      
      observer.observe(player, {
        attributes: true,
        attributeFilter: ['class', 'data-state']
      });
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
  }
}

// Cleanup function to remove existing observers and intervals
function cleanup() {
  if (currentDetector) {
    currentDetector.stopObserving();
    currentDetector = null;
  }
  
  if (captionCheckInterval) {
    clearInterval(captionCheckInterval);
    captionCheckInterval = null;
  }
  
  lastCaptionContainer = null;
}

// Function to add custom styles to the document
function addCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .wordstream-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 320px;
      max-width: 90vw;
      height: auto;
      max-height: 80vh;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: Arial, sans-serif;
      border: 1px solid #e0e0e0;
    }
    
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #eaeaea;
      background-color: #f9f9f9;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    
    .close-button {
      background: none;
      border: none;
      font-size: 20px;
      color: #666;
      cursor: pointer;
      padding: 0 8px;
    }
    
    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      max-height: 350px;
    }
    
    .helper-text {
      color: #666;
      font-size: 14px;
      margin: 0 0 16px 0;
      text-align: center;
    }
    
    .conversation-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .message {
      display: flex;
      flex-direction: column;
      max-width: 100%;
    }
    
    .message-sender {
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .user-message .message-sender {
      color: #3b82f6;
    }
    
    .gemini-message .message-sender {
      color: #10b981;
    }
    
    .message-content {
      padding: 8px 12px;
      border-radius: 8px;
      word-break: break-word;
    }
    
    .user-message .message-content {
      background-color: #f0f7ff;
    }
    
    .gemini-message .message-content {
      background-color: #f0fdf4;
    }
    
    .panel-footer {
      padding: 12px 16px;
      border-top: 1px solid #eaeaea;
      background-color: #f9f9f9;
    }
    
    .input-container {
      display: flex;
      gap: 8px;
    }
    
    .user-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 14px;
      resize: none;
      outline: none;
      min-height: 24px;
      max-height: 120px;
    }
    
    .send-button {
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .send-button:hover {
      background-color: #1d4ed8;
    }
    
    .send-button:disabled {
      background-color: #9ca3af;
      cursor: not-allowed;
    }
    
    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }
    
    /* עיצוב משופר לכפתורי הפיצ'רים */
    .wordstream-floating-button {
      width: 50px !important;
      height: 50px !important;
      border-radius: 50% !important;
      background-color: rgba(235, 245, 255, 0.95) !important;
      border: 2px solid rgba(59, 130, 246, 0.3) !important;
      box-shadow: 0 4px 10px rgba(0,0,0,0.12), 0 0 0 3px rgba(59, 130, 246, 0.05) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    }
    
    .wordstream-floating-button:hover {
      transform: scale(1.12) translateY(-2px) !important;
      box-shadow: 0 6px 16px rgba(0,0,0,0.15), 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
      background-color: rgba(224, 242, 254, 0.98) !important;
      border: 2px solid rgba(59, 130, 246, 0.5) !important;
    }
    
    .wordstream-floating-button:active {
      transform: scale(0.95) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
    }
    
    .wordstream-floating-button img {
      width: 26px !important;
      height: 26px !important;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(styleElement);
}

// Direct implementation of floating controls
function addDirectFloatingControls() {
  try {
    addCustomStyles();
    
    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.top = '50%';
    controlsContainer.style.left = '20px';
    controlsContainer.style.transform = 'translateY(-50%)';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.flexDirection = 'column';
    controlsContainer.style.gap = '20px';
    controlsContainer.style.zIndex = '9999';
    controlsContainer.id = 'wordstream-controls-container';
    
    // Create panel container
    const panelContainer = document.createElement('div');
    panelContainer.id = 'wordstream-panel-container';
    panelContainer.style.position = 'fixed';
    panelContainer.style.display = 'none';
    panelContainer.style.zIndex = '9998';
    
    document.body.appendChild(panelContainer);
    
    // Create Gemini button
    let geminiClickCount = 0;
    const geminiButton = document.createElement('button');
    geminiButton.id = 'wordstream-gemini-button';
    geminiButton.className = 'wordstream-floating-button';
    geminiButton.style.width = '80px';
    geminiButton.style.height = '80px';
    geminiButton.style.borderRadius = '16px';
    geminiButton.style.backgroundColor = 'transparent';
    geminiButton.style.border = 'none';
    geminiButton.style.boxShadow = 'none';
    geminiButton.style.cursor = 'pointer';
    geminiButton.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    geminiButton.style.position = 'relative';
    geminiButton.style.transform = 'perspective(800px) rotateY(0deg)';
    geminiButton.setAttribute('title', 'AI Assistant - Get help with video content');
    geminiButton.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 16px; background: #1e293b; transform: translateZ(-5px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.8); transition: all 0.3s ease;"></div>
      <div style="position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border-radius: 12px; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%); transform: translateZ(0); transition: all 0.3s ease; overflow: hidden;">
        <div style="position: absolute; inset: 0; background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%); background-size: 150% 150%;"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);"></div>
      </div>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; transform: translateZ(10px);">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)); margin-top: -2px;">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <div style="font-size: 10px; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">AI CHAT</div>
      </div>
    `;
    
    // Create Notes button
    let notesClickCount = 0;
    const notesButton = document.createElement('button');
    notesButton.id = 'wordstream-notes-button';
    notesButton.className = 'wordstream-floating-button';
    notesButton.style.width = '80px';
    notesButton.style.height = '80px';
    notesButton.style.borderRadius = '16px';
    notesButton.style.backgroundColor = 'transparent';
    notesButton.style.border = 'none';
    notesButton.style.boxShadow = 'none';
    notesButton.style.cursor = 'pointer';
    notesButton.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    notesButton.style.position = 'relative';
    notesButton.style.transform = 'perspective(800px) rotateY(0deg)';
    notesButton.setAttribute('title', 'Video Notes - Take notes while watching');
    notesButton.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 16px; background: #1e293b; transform: translateZ(-5px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.8); transition: all 0.3s ease;"></div>
      <div style="position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border-radius: 12px; background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%); transform: translateZ(0); transition: all 0.3s ease; overflow: hidden;">
        <div style="position: absolute; inset: 0; background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%); background-size: 150% 150%;"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);"></div>
      </div>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; transform: translateZ(10px);">
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <div style="font-size: 11px; font-weight: 700; margin-top: 5px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">NOTES</div>
      </div>
    `;
    
    // Add hover effects
    geminiButton.addEventListener('mouseover', () => {
      geminiButton.style.transform = 'perspective(800px) rotateY(15deg) translateY(-5px)';
      const shadowDiv = geminiButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = geminiButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 15px 40px rgba(15, 23, 42, 0.8)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(1.2)';
      }
    });
    
    geminiButton.addEventListener('mouseout', () => {
      geminiButton.style.transform = 'perspective(800px) rotateY(0deg) translateY(0)';
      const shadowDiv = geminiButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = geminiButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.8)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(1)';
      }
    });
    
    geminiButton.addEventListener('mousedown', () => {
      geminiButton.style.transform = 'perspective(800px) rotateY(5deg) translateY(-2px)';
      const shadowDiv = geminiButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = geminiButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 5px 15px rgba(15, 23, 42, 0.7)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(0.9)';
      }
    });
    
    notesButton.addEventListener('mouseover', () => {
      notesButton.style.transform = 'perspective(800px) rotateY(15deg) translateY(-5px)';
      const shadowDiv = notesButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = notesButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 15px 40px rgba(15, 23, 42, 0.8)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(1.2)';
      }
    });
    
    notesButton.addEventListener('mouseout', () => {
      notesButton.style.transform = 'perspective(800px) rotateY(0deg) translateY(0)';
      const shadowDiv = notesButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = notesButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.8)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(1)';
      }
    });
    
    notesButton.addEventListener('mousedown', () => {
      notesButton.style.transform = 'perspective(800px) rotateY(5deg) translateY(-2px)';
      const shadowDiv = notesButton.querySelector('div:first-child') as HTMLElement;
      const gradientDiv = notesButton.querySelector('div:nth-child(2)') as HTMLElement;
      
      if (shadowDiv) {
        shadowDiv.style.boxShadow = '0 5px 15px rgba(15, 23, 42, 0.7)';
      }
      
      if (gradientDiv) {
        gradientDiv.style.filter = 'brightness(0.9)';
      }
    });
    
    // Add buttons to container
    controlsContainer.appendChild(geminiButton);
    controlsContainer.appendChild(notesButton);
    
    // Add container to body
    document.body.appendChild(controlsContainer);
    
    // Create panels
    const geminiPanel = createGeminiPanel();
    const notesPanel = createNotesPanel();
    
    // Variables for timestamp updating
    let timestampInterval: ReturnType<typeof setInterval> | null = null;
    
    // Function to update the current timestamp in the notes panel
    function updateCurrentTimestamp() {
      const timestampElement = document.getElementById('current-timestamp');
      if (timestampElement) {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          const currentTime = Math.floor(videoElement.currentTime);
          timestampElement.textContent = `Current position: ${formatVideoTime(currentTime)}`;
        }
      }
    }
    
    // Function to load saved notes from storage
    function loadSavedNotes() {
      const videoId = getVideoId();
      if (!videoId) return;
      
      try {
        // Use chrome.storage if available, otherwise fall back to localStorage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['videoNotes'], (result) => {
            const allNotes = result.videoNotes || {};
            displayNotes(allNotes[videoId] || []);
          });
        } else {
          const notesJson = localStorage.getItem('wordstream_notes');
          const allNotes = notesJson ? JSON.parse(notesJson) : {};
          displayNotes(allNotes[videoId] || []);
        }
      } catch (error) {
        console.error('[WordStream] Error loading notes:', error);
      }
    }
    
    // Get video ID from the URL
    function getVideoId(): string {
      const url = window.location.href;
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v') || 'unknown';
      } else if (url.includes('netflix.com/watch')) {
        const matches = url.match(/watch\/(\d+)/);
        return matches ? matches[1] : 'unknown';
      }
      return 'unknown';
    }
    
    // Function to format video time (seconds) to MM:SS format
    function formatVideoTime(seconds: number): string {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    // Function to display notes in the panel
    function displayNotes(notes: any[]) {
      const notesContainer = document.getElementById('notes-container');
      if (!notesContainer) return;
      
      if (notes.length === 0) {
        notesContainer.innerHTML = '<div class="no-notes">No saved notes for this video</div>';
      return;
    }

      notesContainer.innerHTML = '';
      notes.forEach((note, index) => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-item';
        noteElement.innerHTML = `
          <div class="note-timestamp">${note.timestamp || 'Unknown time'} - ${note.date || 'Unknown date'}</div>
          <div class="note-content">${note.text}</div>
          <button class="note-delete" data-index="${index}">&times;</button>
        `;
        
        notesContainer.appendChild(noteElement);
        
        // Add delete functionality
        const deleteButton = noteElement.querySelector('.note-delete');
        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            deleteNote(index);
          });
        }
      });
    }
    
    // Function to delete a note
    function deleteNote(index: number): void {
      const videoId = getVideoId();
      if (!videoId) return;
      
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['videoNotes'], (result) => {
            const allNotes = result.videoNotes || {};
            const videoNotes = allNotes[videoId] || [];
            
            if (index >= 0 && index < videoNotes.length) {
              videoNotes.splice(index, 1);
              allNotes[videoId] = videoNotes;
              
              chrome.storage.local.set({ videoNotes: allNotes }, () => {
                displayNotes(videoNotes);
              });
            }
          });
        } else {
          const notesJson = localStorage.getItem('wordstream_notes');
          const allNotes = notesJson ? JSON.parse(notesJson) : {};
          const videoNotes = allNotes[videoId] || [];
          
          if (index >= 0 && index < videoNotes.length) {
            videoNotes.splice(index, 1);
            allNotes[videoId] = videoNotes;
            
            localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
            displayNotes(videoNotes);
          }
        }
      } catch (error) {
        console.error('[WordStream] Error deleting note:', error);
      }
    }
    
    // Add panels to container
    panelContainer.appendChild(geminiPanel);
    panelContainer.appendChild(notesPanel);
    
    // פונקציה להסתרת הכפתורים כאשר הפאנל פתוח
    const updateButtonsVisibility = () => {
      if (geminiPanel.style.display === 'block' || notesPanel.style.display === 'block') {
        controlsContainer.style.display = 'none';
      } else {
        controlsContainer.style.display = 'flex';
      }
    };
    
    // קוד עבור Gemini
    geminiButton.addEventListener('click', () => {
      geminiClickCount++;
      console.log('[WordStream] Gemini button clicked');
      
      if (geminiClickCount % 2 === 1) {
        // פתיחת פאנל Gemini
        panelContainer.appendChild(geminiPanel);
        geminiPanel.style.display = 'block';
        notesPanel.style.display = 'none';
        panelContainer.style.display = 'block'; // חשוב להציג את המיכל
        
        // הסתרת הכפתורים
        updateButtonsVisibility();
      } else {
        // סגירת פאנל
        geminiPanel.style.display = 'none';
        panelContainer.style.display = 'none'; // הסתרת המיכל
        
        // הצגת הכפתורים שוב
        updateButtonsVisibility();
      }
    });
    
    // קוד עבור Notes
    notesButton.addEventListener('click', () => {
      notesClickCount++;
      console.log('[WordStream] Notes button clicked');
      
      if (notesClickCount % 2 === 1) {
        // פתיחת פאנל Notes
        panelContainer.appendChild(notesPanel);
        notesPanel.style.display = 'block';
        geminiPanel.style.display = 'none';
        panelContainer.style.display = 'block'; // חשוב להציג את המיכל
        
        // Start timestamp update interval
        updateCurrentTimestamp();
        if (!timestampInterval) {
          timestampInterval = setInterval(updateCurrentTimestamp, 1000);
        }
        
        // Load saved notes
        loadSavedNotes();
        
        // הסתרת הכפתורים
        updateButtonsVisibility();
      } else {
        // סגירת פאנל
        notesPanel.style.display = 'none';
        panelContainer.style.display = 'none'; // הסתרת המיכל
        
        // הצגת הכפתורים שוב
        updateButtonsVisibility();
      }
    });
    
    // עידכון הכפתורים כאשר סוגרים את הפאנל
    const updateButtonsOnPanelClose = (panel: HTMLElement, clickCountRef: number) => {
      const closeButton = panel.querySelector('.close-button') as HTMLElement;
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          console.log('[WordStream] Panel close button clicked');
          panel.style.display = 'none';
          panelContainer.style.display = 'none';
          
          // עידכון משתנה הספירה כדי שהפעם הבאה שנלחץ על הכפתור זה יפתח את הפאנל
          if (clickCountRef % 2 === 1) {
            if (panel === geminiPanel) {
              geminiClickCount++;
            } else if (panel === notesPanel) {
              notesClickCount++;
            }
          }
          
          // הצגת הכפתורים שוב
          controlsContainer.style.display = 'flex';
        });
      }
    };
    
    // חיבור מאזיני אירועים לכפתורי הסגירה
    setTimeout(() => {
      updateButtonsOnPanelClose(geminiPanel, geminiClickCount);
      updateButtonsOnPanelClose(notesPanel, notesClickCount);
    }, 500); // קצת השהייה כדי לוודא שהכפתורים נטענו
    
    console.log('[WordStream] Direct floating controls added successfully');
  } catch (error) {
    console.error('[WordStream] Error adding direct floating controls:', error);
  }
}

// Function to safely remove all kinds of floating controls
function removeAllFloatingControls() {
  console.log('[WordStream] Removing ALL floating controls');
  
  // Also remove our ultra simple controls container
  try {
    const allControlsContainer = document.getElementById('wordstream-all-controls');
    if (allControlsContainer) {
      console.log('[WordStream] Removing wordstream-all-controls container');
      document.body.removeChild(allControlsContainer);
    }
  } catch (e) {
    console.error('[WordStream] Error removing all-controls container:', e);
  }
  
  // List of all possible control IDs
  const controlIds = [
    'wordstream-floating-controls-container',
    'wordstream-direct-controls',
    'wordstream-buttons-container',
    'wordstream-react-container',
    'wordstream-buttons-wrapper',
    'wordstream-direct-buttons-wrapper'
  ];
  
  // Safely remove each element
  controlIds.forEach(id => {
    try {
      const element = document.getElementById(id);
      if (element) {
        // Try multiple safe removal methods
        try {
          // Method 1: Use parent.removeChild
          if (element.parentNode) {
            element.parentNode.removeChild(element);
            console.log(`[WordStream] Removed ${id} with parentNode.removeChild`);
        return;
          }
        } catch (e) {
          console.warn(`[WordStream] Error removing ${id} with method 1:`, e);
        }
        
        try {
          // Method 2: Use remove()
          element.remove();
          console.log(`[WordStream] Removed ${id} with element.remove()`);
        return;
        } catch (e) {
          console.warn(`[WordStream] Error removing ${id} with method 2:`, e);
        }
        
        try {
          // Method 3: Replace with empty element
          const placeholder = document.createElement('div');
          placeholder.style.display = 'none';
          if (element.parentNode) {
            element.parentNode.replaceChild(placeholder, element);
            console.log(`[WordStream] Replaced ${id} with placeholder`);
            return;
          }
        } catch (e) {
          console.warn(`[WordStream] Error removing ${id} with method 3:`, e);
        }
        
        // Last resort: hide it
        try {
          element.style.display = 'none';
          console.log(`[WordStream] Hidden ${id} as last resort`);
        } catch (e) {
          console.warn(`[WordStream] Couldn't even hide ${id}:`, e);
        }
      }
    } catch (error) {
      console.warn(`[WordStream] Error handling ${id}:`, error);
    }
  });
  
  // Remove any remaining floating buttons from YouTube detector
  try {
    const youtubeButtons = document.querySelectorAll('#wordstream-floating-controls-container, .wordstream-floating-button');
    youtubeButtons.forEach(button => {
      if (button.parentNode) {
        button.parentNode.removeChild(button);
      }
    });
  } catch (e) {
    console.warn('[WordStream] Error removing YouTube floating buttons:', e);
  }

  // Remove the cyan buttons on the right if they exist
  try {
    const rightSideControls = document.querySelectorAll('[style*="right: 20px"][style*="position: fixed"][style*="background-color: rgba(59, 130, 246"]');
    rightSideControls.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
        console.log('[WordStream] Removed cyan button on the right side');
      }
    });
  } catch (e) {
    console.warn('[WordStream] Error removing right side cyan buttons:', e);
  }
}

// בדיקה אם ה-Chrome API זמין
function isChromeAPIAvailable(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome !== null && 
         typeof chrome.runtime !== 'undefined' && 
         chrome.runtime !== null && 
         typeof chrome.runtime.sendMessage === 'function';
}

// פונקציה בטוחה להמרת שגיאות למחרוזת, כולל טיפול במקרים שונים של שגיאות
function safeStringifyError(error: any): string {
  try {
    if (!error) return 'Unknown error (no error object)';
    
    // טיפול ב-Chrome runtime errors
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
      return `Chrome error: ${chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError)}`;
    }
    
    // אם השגיאה היא אובייקט Error רגיל
    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`;
    }
    
    // אם השגיאה היא מחרוזת
    if (typeof error === 'string') {
      return error;
    }
    
    // אם השגיאה היא אובייקט רגיל - ננסה להפוך אותו למחרוזת JSON
    if (typeof error === 'object') {
      const errorObj = error as Record<string, any>;
      
      // בדיקה אם יש שדה הודעה או שגיאה
      if (errorObj.message) {
        return errorObj.message;
      }
      if (errorObj.error) {
        return typeof errorObj.error === 'string' ? errorObj.error : safeStringifyError(errorObj.error);
      }
      
      // אחרת ננסה להפוך את האובייקט כולו למחרוזת
      try {
        return JSON.stringify(error, null, 2);
      } catch (jsonError) {
        return 'Error object could not be serialized to string';
      }
    }
    
    // לכל מקרה אחר
    return `Unknown error of type ${typeof error}`;
  } catch (stringifyError) {
    console.error('Error while stringifying error:', stringifyError);
    return 'Error occurred while formatting error message';
  }
}

// פונקציה משופרת לשליחת הודעות לרקע
async function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!isChromeAPIAvailable()) {
      console.error('WordStream: Chrome API not available for message:', message.type);
      reject(new Error('Chrome API not available'));
            return;
          }

    try {
      // אם זו בקשה לGemini, הוסף מידע מורחב על הסרטון
      if (message.action === 'gemini') {
        // הוסף מידע מורחב על הסרטון אם יש
        const isYouTube = window.location.hostname.includes('youtube.com');
        const isNetflix = window.location.hostname.includes('netflix.com');
        
        // אסוף מידע נוסף על הסרטון
        if (isYouTube) {
          try {
            // נסה לקבל מידע נוסף על הסרטון מהעמוד
            const videoDescription = document.querySelector('#description-inline-expander, #description')?.textContent?.trim() || '';
            const channelName = document.querySelector('#channel-name a, #owner-name a')?.textContent?.trim() || '';
            
            message.videoContext = {
              description: videoDescription.substring(0, 500), // מגביל את האורך
              channelName: channelName,
              url: window.location.href
            };
          } catch (e) {
            console.warn("WordStream: Error getting extended video information", e);
          }
        } else if (isNetflix) {
          try {
            // נסה לקבל מידע על התוכן בנטפליקס
            const episodeTitle = document.querySelector('.video-title h4')?.textContent?.trim() || '';
            const episodeSynopsis = document.querySelector('.episode-synopsis')?.textContent?.trim() || '';
            
            message.videoContext = {
              episodeTitle,
              synopsis: episodeSynopsis.substring(0, 500),
              url: window.location.href
            };
          } catch (e) {
            console.warn("WordStream: Error getting Netflix content information", e);
          }
        }
      }
      
      console.log('WordStream: Sending message to background:', message.type || message.action);
      
      chrome.runtime.sendMessage(message, (response) => {
        // בדיקה אם יש שגיאת ריצה
        if (chrome.runtime && chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'Runtime error';
          console.error(`WordStream: Chrome runtime error: ${errorMessage}`, chrome.runtime.lastError);
          reject(new Error(`Runtime error: ${safeStringifyError(chrome.runtime.lastError)}`));
            return;
          }

        // בדיקה אם התגובה מכילה שגיאה
        if (response && response.error) {
          console.error(`WordStream: Error in response: ${response.error}`);
          reject(new Error(`Error sending message: ${safeStringifyError(response.error)}`));
          return;
        }
        
        // תגובה תקינה
        resolve(response);
      });
    } catch (error) {
      console.error('WordStream: Exception sending message to background:', error);
      reject(new Error(`Error communicating with background script: ${safeStringifyError(error)}`));
    }
  });
}

// פונקציה להצגת שגיאה בממשק המשתמש עם פרטים ברורים יותר
function showError(error: any): void {
  console.error('[WordStream] Showing error to user:', error);
  
  const errorText = safeStringifyError(error);
  const errorContainer = document.getElementById('gemini-error');
  
  if (errorContainer) {
    errorContainer.textContent = `[WordStream] ${errorText}`;
    errorContainer.style.display = 'block';
    
    // הסתרה אוטומטית אחרי 10 שניות
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 10000);
  } else {
    // אם אין מיכל שגיאה קיים, ניצור אותו
    const newErrorContainer = document.createElement('div');
    newErrorContainer.id = 'gemini-error';
    newErrorContainer.className = 'error-message';
    newErrorContainer.textContent = `[WordStream] ${errorText}`;
    
    const conversationArea = document.getElementById('gemini-conversation-area');
    if (conversationArea) {
      conversationArea.appendChild(newErrorContainer);
      
      // הסתרה אוטומטית אחרי 10 שניות
      setTimeout(() => {
        if (newErrorContainer.parentNode) {
          newErrorContainer.parentNode.removeChild(newErrorContainer);
        }
      }, 10000);
    }
  }
}

function createGeminiPanel() {
  const panel = document.createElement('div');
  panel.className = 'wordstream-panel gemini-panel';
  panel.id = 'wordstream-gemini-panel';
  
  // הגדרת מיקום וגודל התחלתי מפורש
  panel.style.position = 'fixed';
  panel.style.top = '20px';
  panel.style.right = '20px';
  panel.style.width = '380px';
  panel.style.height = '600px';
  panel.style.resize = 'both';
  panel.style.overflow = 'hidden';
  panel.style.minWidth = '300px';
  panel.style.minHeight = '400px';
  panel.style.maxWidth = '800px';
  panel.style.maxHeight = '900px';
  panel.style.zIndex = '9999';
  
  // הוספת מחוון שינוי גודל חזותי
  // נוסיף אלמנט נפרד שישמש כידית שינוי גודל ויסייע למשתמש להבין שאפשר לשנות גודל
  const resizeIndicator = document.createElement('div');
  resizeIndicator.className = 'resize-indicator';
  resizeIndicator.title = 'Drag to resize';
  resizeIndicator.style.position = 'absolute';
  resizeIndicator.style.bottom = '0';
  resizeIndicator.style.right = '0';
  resizeIndicator.style.width = '30px';
  resizeIndicator.style.height = '30px';
  resizeIndicator.style.cursor = 'nwse-resize';
  resizeIndicator.style.backgroundColor = 'transparent';
  resizeIndicator.style.zIndex = '10000';
  resizeIndicator.style.pointerEvents = 'none'; // כדי שהלחיצות עדיין יעברו לפאנל עצמו
  
  // יצירת האלמנטים הגרפיים של המחוון בצורת משולש/זווית
  const createResizeLines = () => {
    const lineContainer = document.createElement('div');
    lineContainer.style.position = 'absolute';
    lineContainer.style.right = '2px';
    lineContainer.style.bottom = '2px';
    lineContainer.style.overflow = 'hidden';
    lineContainer.style.width = '26px';
    lineContainer.style.height = '26px';
    lineContainer.style.pointerEvents = 'none';
    
    // יצירת שלושה קווים לסימון הפינה - מעוצבים בצורת דיאגונל
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.right = '0';
      line.style.bottom = `${(i * 7) + 2}px`;
      line.style.height = '3px';
      line.style.width = `${19 - (i * 4)}px`;
      line.style.backgroundColor = 'rgba(138, 180, 248, 0.9)';
      line.style.borderRadius = '1.5px';
      line.style.transform = 'rotate(-45deg)';
      line.style.transformOrigin = 'right bottom';
      line.style.transition = 'all 0.2s ease';
      lineContainer.appendChild(line);
    }
    
    return lineContainer;
  };
  
  resizeIndicator.appendChild(createResizeLines());
  
  // מוסיף את המחוון שינוי גודל לפאנל
  panel.appendChild(resizeIndicator);
  
  // שיפור הרספונסיביות באמצעות הגדלת קצה תיבת השינוי
  // זה יעבוד טוב יותר עם המחוון החדש
  const style = document.createElement('style');
  style.innerHTML = `
    /* עיצוב בסיסי לפאנל */
    #${panel.id} {
      resize: both;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 320px;
      min-height: 400px;
    }
    
    /* תפריט שינוי גודל */
    #${panel.id} .size-menu {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 10005;
      background-color: rgba(32, 33, 36, 0.9);
      border-radius: 4px;
      padding: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      min-width: 120px;
    }
    
    /* כפתור גודל נוכחי */
    #${panel.id} .current-size-button {
      background: none;
      border: none;
      padding: 2px 8px;
      color: #8ab4f8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      border-radius: 4px;
      height: 24px;
    }
    
    #${panel.id} .current-size-button:hover {
      background-color: rgba(138, 180, 248, 0.1);
    }
    
    /* אפשרויות גודל בתפריט */
    #${panel.id} .size-option {
      background: none;
      border: none;
      width: 100%;
      padding: 6px 8px;
      text-align: left;
      color: #e8eaed;
      cursor: pointer;
      display: flex;
      align-items: center;
      border-radius: 3px;
      transition: all 0.15s ease;
    }
    
    #${panel.id} .size-option:hover {
      background-color: rgba(138, 180, 248, 0.1);
    }
    
    /* מבנה פנימי בסיסי */
    #${panel.id} .panel-header {
      flex: 0 0 auto;
      padding: 12px 16px;
      display: flex;
      align-items: center;
    }
    
    #${panel.id} .panel-title {
      flex: 0 0 auto;
    }
    
    #${panel.id} .fixed-size-bar {
      display: flex;
      align-items: center;
      margin-left: 15px;
      margin-right: auto;
    }
    
    /* אזור התוכן - הכי חשוב */
    #${panel.id} .panel-content {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    /* אזור השיחה - חלוקה נכונה */
    #${panel.id} .conversation-area {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    /* הודעות בשיחה */
    #${panel.id} .assistant-message {
      align-self: flex-start;
      max-width: 85%;
    }
    
    #${panel.id} .user-message {
      align-self: flex-end;
      max-width: 85%;
    }
    
    /* תיבת קלט תמיד בתחתית */
    #${panel.id} .input-container {
      flex: 0 0 auto;
      border-top: 1px solid #3d3d3d;
      padding: 12px 16px;
      background-color: #1f1f1f;
    }
    
    /* תצוגות גודל מוגדרות מראש */
    #${panel.id}.portrait-mode {
      width: 320px !important;
      height: 90vh !important;
      position: fixed !important;
      right: 0 !important;
      top: 0 !important;
      border-radius: 0 0 0 8px !important;
    }
    
    #${panel.id}.small-mode {
      width: 320px !important;
      height: 400px !important;
    }
    
    #${panel.id}.medium-mode {
      width: 450px !important;
      height: 550px !important;
    }
    
    #${panel.id}.large-mode {
      width: 650px !important;
      height: 700px !important;
    }
    
    #${panel.id}.wide-mode {
      width: 85vw !important;
      height: 550px !important;
    }
    
    #${panel.id}.full-mode {
      width: 80vw !important;
      height: 80vh !important;
    }
    
    /* התאמות למצב בהיר */
    #${panel.id}.light .input-container {
      background-color: #ffffff;
      border-top: 1px solid #dadce0;
    }
    
    #${panel.id}.light .current-size-button {
      color: #1a73e8;
    }
    
    #${panel.id}.light .current-size-button:hover {
      background-color: rgba(26, 115, 232, 0.1);
    }
    
    #${panel.id}.light .size-menu {
      background-color: rgba(255, 255, 255, 0.95);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    #${panel.id}.light .size-option {
      color: #202124;
    }
    
    #${panel.id}.light .size-option:hover {
      background-color: rgba(26, 115, 232, 0.05);
    }
    
    /* מחוון שינוי גודל בולט בפינה */
    #${panel.id}::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background-color: transparent;
      border-right: 10px solid rgba(138, 180, 248, 0.5);
      border-bottom: 10px solid rgba(138, 180, 248, 0.5);
      border-top: 10px solid transparent;
      border-left: 10px solid transparent;
    }
    
    #${panel.id}.light::after {
      border-right: 10px solid rgba(26, 115, 232, 0.5);
      border-bottom: 10px solid rgba(26, 115, 232, 0.5);
    }
  `;
  document.head.appendChild(style);
  
  // הוספת טולטיפ המופיע כאשר העכבר מרחף מעל אזור שינוי הגודל
  const resizeTooltip = document.createElement('div');
  resizeTooltip.className = 'resize-tooltip';
  resizeTooltip.textContent = 'Drag to resize';
  panel.appendChild(resizeTooltip);
  
  // יצירת אירוע מעבר עכבר על אזור שינוי הגודל להצגת הטולטיפ
  const cornerArea = document.createElement('div');
  cornerArea.style.position = 'absolute';
  cornerArea.style.bottom = '0';
  cornerArea.style.right = '0';
  cornerArea.style.width = '30px';
  cornerArea.style.height = '30px';
  cornerArea.style.zIndex = '9998';
  cornerArea.style.backgroundColor = 'transparent';
  cornerArea.style.cursor = 'nwse-resize';
  
  cornerArea.addEventListener('mouseenter', () => {
    resizeTooltip.style.opacity = '1';
    resizeTooltip.style.transform = 'translateX(0)';
  });
  
  cornerArea.addEventListener('mouseleave', () => {
    resizeTooltip.style.opacity = '0';
    resizeTooltip.style.transform = 'translateX(10px)';
  });
  
  panel.appendChild(cornerArea);
  
  // הוספת סרגל כפתורים עם תבניות גודל מוגדרות מראש
  const presetSizesBar = document.createElement('div');
  presetSizesBar.className = 'preset-sizes-bar';
  presetSizesBar.style.position = 'absolute';
  presetSizesBar.style.bottom = '45px';
  presetSizesBar.style.right = '20px';
  presetSizesBar.style.display = 'flex';
  presetSizesBar.style.flexDirection = 'row';
  presetSizesBar.style.gap = '6px';
  presetSizesBar.style.zIndex = '10002';
  presetSizesBar.style.opacity = '0';
  presetSizesBar.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  presetSizesBar.style.padding = '6px 8px';
  presetSizesBar.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  presetSizesBar.style.borderRadius = '6px';
  presetSizesBar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  presetSizesBar.style.transform = 'translateY(10px)';
  
  // הוספת כותרת קטנה
  const presetLabel = document.createElement('div');
  presetLabel.textContent = 'Size:';
  presetLabel.style.fontSize = '11px';
  presetLabel.style.color = '#5f6368';
  presetLabel.style.marginRight = '8px';
  presetLabel.style.display = 'flex';
  presetLabel.style.alignItems = 'center';
  presetSizesBar.appendChild(presetLabel);
  
  // הגדרת התצוגות המוגדרות מראש עם מידות מעודכנות
  const presets = [
    { name: 'Small', width: '320px', height: '400px' },
    { name: 'Medium', width: '450px', height: '550px' },
    { name: 'Tall', width: '380px', height: '85vh' },
    { name: 'Wide', width: '85vw', height: '600px' },
    { name: 'Large', width: '80vw', height: '80vh' }
  ];
  
  // יצירת הכפתורים עבור כל תצוגה מוגדרת מראש
  presets.forEach((preset, index) => {
    const button = document.createElement('button');
    button.className = 'preset-size-button';
    button.title = preset.name;
    button.style.width = '28px';
    button.style.height = '28px';
    button.style.padding = '0';
    button.style.border = '1px solid rgba(138, 180, 248, 0.3)';
    button.style.backgroundColor = 'rgba(241, 243, 244, 0.8)';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.position = 'relative';
    button.style.boxShadow = 'none';
    button.style.transition = 'all 0.2s ease';
    button.style.margin = '0';
    
    // הוספת אייקון ייחודי לכל כפתור
    const createIcon = () => {
      const iconElement = document.createElement('div');
      
      if (index === 0) { // Small
        iconElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="8" height="8" stroke="#1a73e8" stroke-width="2" fill="none"/>
          </svg>
        `;
      } 
      else if (index === 1) { // Medium
        iconElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="10" height="10" stroke="#1a73e8" stroke-width="2" fill="none"/>
          </svg>
        `;
      }
      else if (index === 2) { // Tall
        iconElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="1" width="6" height="14" stroke="#1a73e8" stroke-width="2" fill="none"/>
          </svg>
        `;
      }
      else if (index === 3) { // Wide
        iconElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="5" width="14" height="6" stroke="#1a73e8" stroke-width="2" fill="none"/>
          </svg>
        `;
      }
      else if (index === 4) { // Large
        iconElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="14" height="14" stroke="#1a73e8" stroke-width="2" fill="none"/>
          </svg>
        `;
      }
      return iconElement;
    };
    
    button.appendChild(createIcon());
    
    // הוספת אירוע לחיצה שמשנה את גודל הפאנל
    button.addEventListener('click', () => {
      panel.style.width = preset.width;
      panel.style.height = preset.height;
      
      // מציין את הכפתור הנבחר
      document.querySelectorAll('.preset-size-button').forEach(btn => {
        btn.classList.remove('selected');
      });
      button.classList.add('selected');
    });
    
    // הוספת אירועי hover
    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('selected')) {
        button.style.backgroundColor = 'rgba(232, 240, 254, 0.8)';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('selected')) {
        button.style.backgroundColor = 'rgba(241, 243, 244, 0.8)';
      }
    });
    
    presetSizesBar.appendChild(button);
  });
  
  panel.appendChild(presetSizesBar);
  
  // הפעלת הכפתור השני (Medium) כברירת מחדל
  setTimeout(() => {
    const defaultButton = presetSizesBar.querySelectorAll('.preset-size-button')[1] as HTMLElement;
    if (defaultButton) {
      defaultButton.click();
    }
  }, 100);
  
  // סידור מחדש של הפאנל והוספת סרגל הגדלים כחלק קבוע בתחתית הפאנל
  const createFixedSizeBar = () => {
    // הסרת סרגל הגדלים הקודם
    if (panel.contains(presetSizesBar)) {
      panel.removeChild(presetSizesBar);
    }
    
    // הגדרת התצוגות עם דגש על מראה ויזואלי
    const sizes = [
      { name: 'portrait', width: '320px', height: '90vh', icon: 'portrait', position: 'right: 0; top: 0;' },
      { name: 'small', width: '320px', height: '400px', icon: 'small', position: '' },
      { name: 'medium', width: '450px', height: '550px', icon: 'medium', position: '' }
    ];
    
    // יצירת האייקונים החזותיים לכל גודל
    const getIcon = (type: string) => {
      const icon = document.createElement('div');
      icon.style.width = '16px';
      icon.style.height = '16px';
      icon.style.display = 'flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      
      let svgContent = '';
      
      switch (type) {
        case 'portrait':
          // אייקון תצוגה לאורך
          svgContent = `
            <svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="7" y="3" width="10" height="18" rx="1"></rect>
            </svg>
          `;
          break;
        case 'small':
          // אייקון תצוגה קטנה
          svgContent = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="8" y="8" width="8" height="8" rx="1"></rect>
            </svg>
          `;
          break;
        case 'medium':
          // אייקון תצוגה בינונית
          svgContent = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="6" width="12" height="12" rx="1"></rect>
            </svg>
          `;
          break;
        case 'large':
          // אייקון תצוגה גדולה
          svgContent = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="1"></rect>
            </svg>
          `;
          break;
        case 'wide':
          // אייקון תצוגה רחבה
          svgContent = `
            <svg width="14" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="10" rx="1"></rect>
            </svg>
          `;
          break;
        case 'full':
          // אייקון תצוגה מלאה
          svgContent = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="1"></rect>
              <line x1="7" y1="2" x2="7" y2="22" stroke="currentColor" stroke-width="1"></line>
              <line x1="17" y1="2" x2="17" y2="22" stroke="currentColor" stroke-width="1"></line>
              <line x1="2" y1="7" x2="22" y2="7" stroke="currentColor" stroke-width="1"></line>
              <line x1="2" y1="17" x2="22" y2="17" stroke="currentColor" stroke-width="1"></line>
            </svg>
          `;
          break;
      }
      
      icon.innerHTML = svgContent;
      return icon;
    };
    
    // כפתור גודל קבוע בשורת הכותרת
    const fixedSizeBar = document.createElement('div');
    fixedSizeBar.className = 'fixed-size-bar';
    fixedSizeBar.style.position = 'relative';
    fixedSizeBar.style.display = 'flex';
    fixedSizeBar.style.alignItems = 'center';
    fixedSizeBar.style.justifyContent = 'center';
    fixedSizeBar.style.zIndex = '10002';
    
    // יצירת כפתור יחיד להצגת הגודל הנוכחי
    const currentSizeBtn = document.createElement('button');
    currentSizeBtn.className = 'current-size-button';
    currentSizeBtn.style.background = 'none';
    currentSizeBtn.style.border = 'none';
    currentSizeBtn.style.color = '#8ab4f8';
    currentSizeBtn.style.display = 'flex';
    currentSizeBtn.style.alignItems = 'center';
    currentSizeBtn.style.justifyContent = 'center';
    currentSizeBtn.style.cursor = 'pointer';
    currentSizeBtn.style.padding = '4px';
    
    // יצירת תפריט נפתח (מוסתר תחילה)
    const sizeMenu = document.createElement('div');
    sizeMenu.className = 'size-menu';
    sizeMenu.style.position = 'absolute';
    sizeMenu.style.top = '100%';
    sizeMenu.style.left = '0';
    sizeMenu.style.backgroundColor = 'rgba(32, 33, 36, 0.9)';
    sizeMenu.style.borderRadius = '4px';
    sizeMenu.style.padding = '4px';
    sizeMenu.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    sizeMenu.style.display = 'none';
    sizeMenu.style.flexDirection = 'column';
    sizeMenu.style.zIndex = '10003';
    sizeMenu.style.gap = '2px';
    
    // פונקציה לעדכון הכפתור הנוכחי
    const updateCurrentButton = (selectedSize: { name: string, icon: string }) => {
      currentSizeBtn.innerHTML = '';
      currentSizeBtn.title = `${selectedSize.name} view (click to change)`;
      
      const iconElement = getIcon(selectedSize.icon);
      currentSizeBtn.appendChild(iconElement);
      
      // הוספת אייקון חץ קטן לידיעה שיש תפריט
      const arrowIcon = document.createElement('div');
      arrowIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      `;
      arrowIcon.style.marginLeft = '2px';
      currentSizeBtn.appendChild(arrowIcon);
    };
    
    // אירוע לחיצה על הכפתור - פתיחת התפריט
    currentSizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // החלפת מצב התצוגה של התפריט
      if (sizeMenu.style.display === 'none') {
        sizeMenu.style.display = 'flex';
        // סגירת התפריט בלחיצה מחוץ לאזור
        const closeMenu = (event: MouseEvent) => {
          if (!sizeMenu.contains(event.target as Node) && !currentSizeBtn.contains(event.target as Node)) {
            sizeMenu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
          }
        };
        // התחשבות בעובדה שהלחיצה הנוכחית לא תסגור את התפריט
        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 0);
      } else {
        sizeMenu.style.display = 'none';
      }
    });
    
    // הוספת כל אפשרויות הגודל לתפריט
    sizes.forEach((size, index) => {
      const sizeOption = document.createElement('button');
      sizeOption.className = 'size-option';
      sizeOption.title = `${size.name} view`;
      sizeOption.style.background = 'none';
      sizeOption.style.border = 'none';
      sizeOption.style.width = 'auto';
      sizeOption.style.height = '28px';
      sizeOption.style.padding = '4px 8px';
      sizeOption.style.color = '#9aa0a6';
      sizeOption.style.cursor = 'pointer';
      sizeOption.style.display = 'flex';
      sizeOption.style.alignItems = 'center';
      sizeOption.style.borderRadius = '3px';
      sizeOption.style.whiteSpace = 'nowrap';
      
      // הוספת האייקון והטקסט
      const iconElement = getIcon(size.icon);
      sizeOption.appendChild(iconElement);
      
      // הוספת טקסט השם
      const nameElement = document.createElement('span');
      nameElement.textContent = size.name;
      nameElement.style.marginLeft = '8px';
      nameElement.style.fontSize = '12px';
      sizeOption.appendChild(nameElement);
      
      // לחיצה על אפשרות בתפריט
      sizeOption.addEventListener('click', () => {
        // שינוי גודל הפאנל
        panel.style.width = size.width;
        panel.style.height = size.height;
        
        // Reset position for all sizes except portrait
        if (size.name !== 'portrait') {
          // Maintain current position if already set
          if (!panel.style.left || !panel.style.top) {
            // Center the panel initially if no position is set
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelWidth = parseInt(size.width, 10) || 320;
            const panelHeight = parseInt(size.height, 10) || 400;
            
            panel.style.left = `${Math.max(0, (viewportWidth - panelWidth) / 2)}px`;
            panel.style.top = `${Math.max(0, (viewportHeight - panelHeight) / 2)}px`;
          }
          // Ensure we use left/top positioning
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        } else {
          // For portrait mode, set position at right edge
          panel.style.right = '0';
          panel.style.top = '0';
          panel.style.left = 'auto';
          panel.style.bottom = 'auto';
        }
        
        // Update conversation container height
        const conversationContainer = panel.querySelector('.conversation-container') as HTMLElement;
        if (conversationContainer) {
          const headerHeight = panel.querySelector('.panel-header')?.clientHeight || 50;
          const inputAreaHeight = panel.querySelector('.input-area')?.clientHeight || 130;
          const newConversationHeight = parseInt(size.height.replace('px', '').replace('vh', '') || '400', 10) * (size.height.includes('vh') ? window.innerHeight / 100 : 1) - headerHeight - inputAreaHeight;
          conversationContainer.style.height = `${Math.max(100, newConversationHeight)}px`;
        }
        
        // הסרת כל מחלקות גודל קודמות
        panel.classList.remove('portrait-mode', 'small-mode', 'medium-mode', 'large-mode', 'wide-mode', 'full-mode');
        
        // הוספת מחלקה ספציפית לגודל הנוכחי
        panel.classList.add(`${size.name}-mode`);
        
        // עדכון הכפתור הנוכחי
        updateCurrentButton(size);
        
        // Make sure panel stays within viewport boundaries
        ensurePanelInViewport();
        
        // סגירת התפריט
        sizeMenu.style.display = 'none';
      });
      
      // אירועי hover
      sizeOption.addEventListener('mouseenter', () => {
        sizeOption.style.backgroundColor = 'rgba(138, 180, 248, 0.1)';
        sizeOption.style.color = '#e8eaed';
      });
      
      sizeOption.addEventListener('mouseleave', () => {
        sizeOption.style.backgroundColor = 'transparent';
        sizeOption.style.color = '#9aa0a6';
      });
      
      sizeMenu.appendChild(sizeOption);
      
      // הגדרת ברירת המחדל לאפשרות השלישית (medium)
      if (index === 2) {
        setTimeout(() => {
          sizeOption.click();
        }, 50);
      }
    });
    
    // הוספת הכפתור והתפריט
    fixedSizeBar.appendChild(currentSizeBtn);
    fixedSizeBar.appendChild(sizeMenu);
    
    return fixedSizeBar;
  };
  
  // הוספת סרגל הגדלים הקבוע לפאנל
  const fixedSizeBar = createFixedSizeBar();
  
  // לאחר יצירת ה-HTML
  setTimeout(() => {
    // זיהוי אזור הכותרת והכפתור הקיים
    const panelHeader = panel.querySelector('.panel-header');
    const controlsContainer = panel.querySelector('.panel-controls');
    
    if (panelHeader && controlsContainer) {
      // הוספת סרגל שינוי הגודל לפני אזור הבקרה
      panelHeader.insertBefore(fixedSizeBar, controlsContainer);
      
      // התאמת סגנון הכפתורים לשורת הכותרת
      fixedSizeBar.style.position = 'relative';
      fixedSizeBar.style.top = 'auto';
      fixedSizeBar.style.right = 'auto';
      fixedSizeBar.style.height = '24px';
      fixedSizeBar.style.margin = '0 auto 0 20px';
      
      // התאמות נוספות למראה בשורת הכותרת
      const buttons = fixedSizeBar.querySelectorAll('button');
      buttons.forEach(button => {
        (button as HTMLElement).style.height = '24px';
      });
    } else {
      // גיבוי במקרה שהמבנה שונה
      panel.appendChild(fixedSizeBar);
    }
    
    // הפעלת הגודל הבינוני כברירת מחדל
    const mediumButton = fixedSizeBar.querySelectorAll('.size-option')[2] as HTMLElement;
    if (mediumButton) {
      mediumButton.click();
    }

    // הוספת האזנה לשינויי גודל החלון
    window.addEventListener('resize', () => {
      // אם הפאנל במצב אורך, עדכן את הגובה שלו
      if (panel.classList.contains('portrait-mode')) {
        panel.style.height = '90vh';
      }
    });
    
    // האזנה לשינויי גודל באמצעות ResizeObserver
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        // אפשר להשאיר ריק - הפריסה הגמישה שלנו תטפל בהכל
      });
      resizeObserver.observe(panel);
    }
  }, 200);
  
  // הצגת סרגל הכפתורים כאשר העכבר מרחף מעל הפינה של הפאנל
  cornerArea.addEventListener('mouseenter', () => {
    presetSizesBar.style.opacity = '1';
    presetSizesBar.style.transform = 'translateY(0)';
  });
  
  panel.addEventListener('mouseleave', () => {
    presetSizesBar.style.opacity = '0';
    presetSizesBar.style.transform = 'translateY(10px)';
    resizeTooltip.style.opacity = '0';
  });
  
  // יצירת היסטוריית שיחה
  const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
  
  // הוספת מחלקת כהה/בהיר לפי הגדרות המערכת
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  panel.classList.add(isDarkMode ? 'dark' : 'light');
  
  // האזנה לשינויים במצב כהה/בהיר
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    panel.classList.remove('dark', 'light');
    panel.classList.add(e.matches ? 'dark' : 'light');
  });
  
  // HTML מעודכן לדמיון ל-Gemini של גוגל
  panel.innerHTML = `
    <div class="panel-header draggable" title="Drag to move">
      <h3 class="panel-title">WordStream Assistant</h3>
      <div class="panel-controls">
        <button class="theme-toggle-button" title="Toggle light/dark mode">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>
        <button class="close-button" title="Close">&times;</button>
      </div>
    </div>
    <div class="panel-content">
      <div id="gemini-conversation-area" class="conversation-area">
        <div class="gemini-message assistant-message welcome-message">
          Hi there! I'm your friendly WordStream assistant, here to help you learn and discover new things in a fun way. Ask me anything about this video or any general questions you have.
        </div>
      </div>
      <div class="input-container">
        <textarea id="gemini-input" placeholder="Ask me anything..." rows="1"></textarea>
        <button id="gemini-send-button" class="send-button" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M2.5 12L4.25 10.25L9.5 15.5L19.75 5.25L21.5 7L9.5 19L2.5 12Z" fill="currentColor"></path>
          </svg>
        </button>
      </div>
      <div id="gemini-error" class="error-message" style="display: none;"></div>
    </div>
  `;
  
  // הוספת event listener לכפתור הסגירה
  panel.querySelector('.close-button')?.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // הוספת event listener למעבר בין לייט מוד לדארק מוד
  panel.querySelector('.theme-toggle-button')?.addEventListener('click', () => {
    // הסרת השינוי הגלובלי
    panel.classList.toggle('light-mode');
    
    // שינוי ישיר של צבע הכותרת
    const titleElement = panel.querySelector('h3');
    if (titleElement) {
      if (panel.classList.contains('light-mode')) {
        titleElement.style.color = '#202124';
      } else {
        titleElement.style.color = '';
      }
    }
  });
  
  // הוספת אפשרות הזזת החלון (גרירה)
  const draggableHeader = panel.querySelector('.panel-header.draggable');
  if (draggableHeader) {
    draggableHeader.addEventListener('mousedown', (e) => {
      // אם הקליקו על אחד הכפתורים - לא נפעיל גרירה
      if ((e.target as HTMLElement).closest('button')) return;
      
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      
      // Debug
      console.log('Starting drag from header');
      
      // מיקום התחלתי
      const startX = mouseEvent.clientX;
      const startY = mouseEvent.clientY;
      
      // נשמור את המיקום הנוכחי - משתמשים ב-getComputedStyle לקבלת המיקום האמיתי
      const computedStyle = window.getComputedStyle(panel);
      
      let startLeft = parseInt(panel.style.left || '0', 10);
      if (startLeft === 0 && computedStyle.left !== 'auto') {
        startLeft = parseInt(computedStyle.left, 10);
      }
      
      let startTop = parseInt(panel.style.top || '0', 10);
      if (startTop === 0 && computedStyle.top !== 'auto') {
        startTop = parseInt(computedStyle.top, 10);
      }
      
      // Debug
      console.log(`Initial position: left=${startLeft}, top=${startTop}`);
      console.log(`Initial mouse: x=${startX}, y=${startY}`);
      
      // עדכון מיקום בזמן גרירה
      const handleDrag = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        
        // Ensure panel stays within screen boundaries
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        
        // Prevent panel from going off-screen
        newLeft = Math.max(0, Math.min(newLeft, viewportWidth - panelWidth));
        newTop = Math.max(0, Math.min(newTop, viewportHeight - panelHeight));
        
        // Always use left/top for positioning during drag
        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        
        // Reset any size-based positioning classes to allow free movement
        if (panel.classList.contains('portrait-mode')) {
          panel.classList.remove('portrait-mode');
          panel.classList.add('free-position-mode');
        }
        
        // Debug info
        console.log(`Dragging: newLeft=${newLeft}, newTop=${newTop}`);
      };
      
      // סיום גרירה
      const stopDrag = () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        
        // Debug
        console.log('Drag ended');
      };
      
      // הוספת מאזינים לאירועי עכבר גלובליים
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    });
  }
  
  // אפשרות שינוי גודל (משופר)
  const resizeHandles = document.querySelectorAll('.resize-handle');
  resizeHandles.forEach((handle) => {
    const htmlHandle = handle as HTMLElement;
    htmlHandle.addEventListener('mousedown', (e) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      
      // Debug
      console.log('Resize handle clicked', htmlHandle.className);
      
      // Add vibrant style to the handle to make it more noticeable
      htmlHandle.style.backgroundColor = 'rgba(30, 144, 255, 0.3)';
      
      const direction = htmlHandle.getAttribute('data-direction') || '';
      console.log('Resize direction:', direction);
      
      // Get current dimensions and position - use offsetWidth/Height for reliable size info
      const startWidth = panel.offsetWidth;
      const startHeight = panel.offsetHeight;
      
      // Get current position - try to get computed position if not set directly
      const computedStyle = window.getComputedStyle(panel);
      let startLeft = parseInt(panel.style.left || '0', 10);
      if (startLeft === 0 && computedStyle.left !== 'auto') {
        startLeft = parseInt(computedStyle.left, 10);
      }
      
      let startTop = parseInt(panel.style.top || '0', 10);
      if (startTop === 0 && computedStyle.top !== 'auto') {
        startTop = parseInt(computedStyle.top, 10);
      }
      
      console.log(`Start resize: width=${startWidth}, height=${startHeight}, left=${startLeft}, top=${startTop}`);
      
      // Initial mouse position
      const startX = mouseEvent.clientX;
      const startY = mouseEvent.clientY;
      
      // Handle resize
      const handleResize = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = parseInt(panel.style.left || '0', 10);
        let newTop = parseInt(panel.style.top || '0', 10);
        
        // Ensure min dimensions
        const minWidth = 300;
        const minHeight = 400;
        
        // Ensure panel stays within screen boundaries
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Handle different resize directions
        if (direction.includes('e')) {
          newWidth = Math.max(minWidth, startWidth + dx);
          // Limit width to viewport
          newWidth = Math.min(newWidth, viewportWidth - newLeft);
        }
        
        if (direction.includes('w')) {
          const widthChange = Math.min(dx, startWidth - minWidth);
          newWidth = Math.max(minWidth, startWidth - widthChange);
          newLeft = startLeft + widthChange;
          
          // Don't allow moving left edge beyond left edge of viewport
          if (newLeft < 0) {
            newLeft = 0;
            newWidth = startWidth + startLeft;
          }
        }
        
        if (direction.includes('s')) {
          newHeight = Math.max(minHeight, startHeight + dy);
          // Limit height to viewport
          newHeight = Math.min(newHeight, viewportHeight - newTop);
        }
        
        if (direction.includes('n')) {
          const heightChange = Math.min(dy, startHeight - minHeight);
          newHeight = Math.max(minHeight, startHeight - heightChange);
          newTop = startTop + heightChange;
          
          // Don't allow moving top edge beyond top edge of viewport
          if (newTop < 0) {
            newTop = 0;
            newHeight = startHeight + startTop;
          }
        }
        
        // Apply new dimensions and position
        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
        
        // Update conversation container height
        const conversationContainer = panel.querySelector('.conversation-container') as HTMLElement;
        if (conversationContainer) {
          conversationContainer.style.height = `${newHeight - 180}px`;
        }
        
        // Debug info
        console.log(`Resizing: newWidth=${newWidth}, newHeight=${newHeight}, newLeft=${newLeft}, newTop=${newTop}`);
      };
      
      // End resize
      const stopResize = () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        panel.classList.remove('resizing');
        
        // Reset handle style
        htmlHandle.style.backgroundColor = '';
        
        // Debug
        console.log('Resize ended');
      };
      
      // Add class while resizing
      panel.classList.add('resizing');
      
      // Add event listeners
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    });
  });
  
  document.body.appendChild(panel);
  
  // התאמת גובה שדה הטקסט באופן דינמי
  function adjustTextareaHeight(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
  
  // הפעלת/ביטול כפתור השליחה בהתבסס על תוכן הקלט
  function toggleSendButton() {
    const inputElement = document.getElementById('gemini-input') as HTMLTextAreaElement;
    const sendButton = document.getElementById('gemini-send-button') as HTMLButtonElement;
    
    if (inputElement && sendButton) {
      sendButton.disabled = inputElement.value.trim() === '';
    }
  }
  
  // פונקציה לעטיפה בטוחה של הצגת שגיאות
  function safeStringifyError(error: any): string {
    if (!error) return 'Unknown error occurred';
    
    try {
      if (typeof error === 'string') return error;
      
      if (error instanceof Error) {
        return error.message || error.toString();
      }
      
      if (typeof error === 'object') {
        // מנסה להוציא מידע שימושי מאובייקט השגיאה
        const message = error.message || error.error || error.description;
        return typeof message === 'string' ? message : 'Error: ' + JSON.stringify(error, null, 2);
      }
      
      return String(error);
    } catch (e) {
      return 'Error occurred (cannot display details)';
    }
  }
  
  // פונקציה להצגת הודעת שגיאה בפאנל
  function showError(error: any) {
    const errorElement = document.getElementById('gemini-error');
    if (errorElement) {
      const errorMessage = safeStringifyError(error);
      errorElement.textContent = `Error: ${errorMessage}`;
      errorElement.style.display = 'block';
      
      // הסתרת השגיאה אחרי 8 שניות
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 8000);
    }
  }
  
  // פונקציה לשליחת הודעה - עם תמיכה בשמירת היסטוריה
  const sendMessage = async () => {
    const inputElement = document.getElementById('gemini-input') as HTMLTextAreaElement;
    const conversationArea = document.getElementById('gemini-conversation-area');
    
    if (!inputElement || !conversationArea) {
      showError('UI elements not found. Please reload the page.');
                return;
              }

    const userMessage = inputElement.value.trim();
    if (!userMessage) return;
    
    // שמירת הטקסט המקורי לפני ניקוי של שדה הקלט
    const originalMessage = userMessage;
    
    // ניקוי שדה הקלט אך לא מיד - רק אחרי שההודעה נשלחה בהצלחה
    // כך שאם יש שגיאה, המשתמש לא יאבד את מה שכתב
    
    // הסתרת הודעת שגיאה קודמת אם קיימת
    const errorElement = document.getElementById('gemini-error');
    if (errorElement) {
      errorElement.style.display = 'none';
    }
    
    // הוספת הודעת המשתמש לאזור השיחה
    const userMessageElement = document.createElement('div');
    userMessageElement.className = 'gemini-message user-message';
    userMessageElement.textContent = userMessage;
    conversationArea.appendChild(userMessageElement);
    
    // הוספה להיסטוריית השיחה
    conversationHistory.push({ role: 'user', content: userMessage });
    
    // שמירת ההיסטוריה מיד אחרי הוספת הודעת המשתמש
    const videoId = getVideoId();
    const videoTitle = document.title || 'YouTube Video';
    saveConversationToStorage(videoId, videoTitle);
    
    // הצגת אינדיקטור "חושב..."
    const thinkingElement = document.createElement('div');
    thinkingElement.className = 'gemini-message assistant-message thinking';
    thinkingElement.innerHTML = '<div class="spinner"></div> Thinking...';
    conversationArea.appendChild(thinkingElement);
    
    // גלילה אוטומטית לחלק התחתון
    conversationArea.scrollTop = conversationArea.scrollHeight;
    
    try {
      let response;
      
      if (isChromeAPIAvailable()) {
        try {
          const videoId = getVideoId();
          const videoTitle = document.title || 'YouTube Video';
          
          console.log('[WordStream] Sending message to Gemini:', {
            action: 'gemini',
            message: userMessage,
            history: conversationHistory.slice(-30), // שליחת עד 30 הודעות אחרונות להקשר משופר
            videoId,
            videoTitle
          });
          
          // שימוש בפונקציית שליחת ההודעות המשופרת
          response = await sendMessageToBackground({
            action: 'gemini',
            message: userMessage,
            history: conversationHistory.slice(-30), // שליחת עד 30 הודעות אחרונות להקשר משופר
            videoId,
            videoTitle
          });
          
          // עכשיו כשהשליחה הצליחה, ניתן לנקות את שדה הקלט
          inputElement.value = '';
          adjustTextareaHeight(inputElement);
          toggleSendButton();
          
          if (response && response.answer) {
            // עדכון הודעת החשיבה בתשובה
            thinkingElement.innerHTML = response.answer;
            thinkingElement.className = 'gemini-message assistant-message';
            
            // הוספה להיסטוריית השיחה
            conversationHistory.push({ role: 'assistant', content: response.answer });
            
            // שמירה למאגר הצ'אטים 
            saveConversationToStorage(videoId, videoTitle);
          } else {
            console.warn('[WordStream] Invalid Gemini response:', response);
            // שימוש בסימולציה כגיבוי
            const simulatedResponse = getSimulatedResponse(userMessage);
            thinkingElement.innerHTML = simulatedResponse;
            thinkingElement.className = 'gemini-message assistant-message';
            
            // הוספה להיסטוריית השיחה
            conversationHistory.push({ role: 'assistant', content: simulatedResponse });
            
            // שמירה למאגר הצ'אטים
            saveConversationToStorage(videoId, videoTitle);
          }
        } catch (error) {
          console.error('[WordStream] Error sending message to Gemini:', error);
          
          // הצגת השגיאה בממשק המשתמש
          showError(error);
          
          // עדיין מספק תשובה מדומה כדי שהשיחה תוכל להמשיך
          const simulatedResponse = getSimulatedResponse(userMessage);
          thinkingElement.innerHTML = simulatedResponse;
          thinkingElement.className = 'gemini-message assistant-message';
          
          // ניקוי שדה הקלט
          inputElement.value = '';
          adjustTextareaHeight(inputElement);
          toggleSendButton();
          
          // הוספה להיסטוריית השיחה
          conversationHistory.push({ role: 'assistant', content: simulatedResponse });
          
          // שמירה למאגר הצ'אטים
          saveConversationToStorage(videoId, videoTitle);
        }
      } else {
        console.warn('[WordStream] Chrome API not available for Gemini, using simulation');
        
        // ניקוי שדה הקלט
        inputElement.value = '';
        adjustTextareaHeight(inputElement);
        toggleSendButton();
        
        // שימוש בסימולציה כשה-API אינו זמין
        const simulatedResponse = getSimulatedResponse(userMessage);
        thinkingElement.innerHTML = simulatedResponse;
        thinkingElement.className = 'gemini-message assistant-message';
        
        // הוספה להיסטוריית השיחה
        conversationHistory.push({ role: 'assistant', content: simulatedResponse });
        
        // שמירה למאגר הצ'אטים
        saveConversationToStorage(videoId, videoTitle);
      }
    } catch (error) {
      console.error('[WordStream] Error in Gemini panel:', error);
      
      // הצגת השגיאה בפאנל
      showError(error);
      
      // עדכון הודעת החשיבה בהודעת שגיאה ידידותית
      thinkingElement.innerHTML = "Sorry, there was an error processing your request. Please try again.";
    }
  };

  // פונקציה לשמירת היסטוריית השיחה לאחסון של כרום
  function saveConversationToStorage(videoId: string, videoTitle: string) {
    // וודא שיש לנו את ה-API ואת המזהה של הסרטון וגם שיש הודעות לשמור
    if (!isChromeAPIAvailable() || !videoId || conversationHistory.length === 0) {
      console.warn('[WordStream] Cannot save conversation: Missing API, videoId or no messages');
      return;
    }

    // לא לשמור שיחות עם הודעה אחת בלבד - זה לרוב שיחות חלקיות
    // שמירה רק אם יש 3 הודעות לפחות (שאלה, תשובה, שאלה) כדי לשמור שיחות משמעותיות
    if (conversationHistory.length < 3) {
      console.log('[WordStream] Not saving conversation with less than 3 messages:', conversationHistory.length);
      return;
    }

    console.log('[WordStream] Saving conversation to chats_storage:', {
      videoId,
      messageCount: conversationHistory.length
    });

    // יצירת אובייקט השיחה בפורמט המתאים ל-ChatConversation
    const conversation = {
      videoId,
      videoTitle,
      videoURL: window.location.href,
      lastUpdated: new Date().toISOString(),
      messages: conversationHistory
    };

    // שמירה ב-chats_storage
    chrome.storage.local.get(['chats_storage'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[WordStream] Error getting chats_storage:', chrome.runtime.lastError);
        return;
      }

      const chatsStorage = result.chats_storage || {};
      
      // עדכון או הוספת השיחה לסרטון זה
      chatsStorage[videoId] = conversation;
      
      // שמירה חזרה לאחסון
      chrome.storage.local.set({ chats_storage: chatsStorage }, () => {
        if (chrome.runtime.lastError) {
          console.error('[WordStream] Error saving to chats_storage:', chrome.runtime.lastError);
          return;
        }
        console.log('[WordStream] Conversation saved successfully to chats_storage');
      });
    });
  }

  // פונקציה לטעינת היסטוריית השיחה מהאחסון
  function loadConversationFromStorage(videoId: string) {
    if (!isChromeAPIAvailable() || !videoId) {
      console.warn('[WordStream] Cannot load conversation: Missing API or videoId');
      return;
    }

    console.log('[WordStream] Loading conversation from chats_storage for video:', videoId);

    chrome.storage.local.get(['chats_storage'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[WordStream] Error getting chats_storage:', chrome.runtime.lastError);
        return;
      }

      const chatsStorage = result.chats_storage || {};
      const conversation = chatsStorage[videoId];

      if (conversation && conversation.messages && conversation.messages.length > 0) {
        console.log('[WordStream] Found saved conversation with', conversation.messages.length, 'messages');
        
        // עדכון היסטוריית השיחה
        conversationHistory.length = 0; // ניקוי ההיסטוריה הנוכחית
        conversationHistory.push(...conversation.messages);
        
        // הצגת ההודעות בממשק המשתמש
        const conversationArea = document.getElementById('gemini-conversation-area');
        if (conversationArea) {
          // ניקוי אזור השיחה
          conversationArea.innerHTML = '';
          
          // הוספת כל הודעה לאזור השיחה
          conversation.messages.forEach((message: {role: 'user' | 'assistant', content: string}) => {
            const messageElement = document.createElement('div');
            messageElement.className = `gemini-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`;
            messageElement.textContent = message.content;
            conversationArea.appendChild(messageElement);
          });
          
          // גלילה לחלק התחתון
          conversationArea.scrollTop = conversationArea.scrollHeight;

          // כיוון שטענו שיחה, אנחנו רוצים להסתיר את הודעת הפתיחה אם קיימת
          const welcomeMessage = document.querySelector('.gemini-welcome-message') as HTMLElement;
          if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
          }
        }
      } else {
        console.log('[WordStream] No saved conversation found for this video');
      }
    });
  }

  // טעינת היסטוריית השיחה בעת אתחול הפאנל
  const videoId = getVideoId();
  if (videoId) {
    setTimeout(() => {
      // קריאה מושהית מעט כדי לוודא שהממשק כבר מוכן
      loadConversationFromStorage(videoId);
    }, 500);
  }

  // מחלץ את מזהה הסרטון מה-URL
  function getVideoId(): string {
    const url = window.location.href;
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v') || 'unknown';
    } else if (url.includes('netflix.com/watch')) {
      const matches = url.match(/watch\/(\d+)/);
      return matches ? matches[1] : 'unknown';
    }
    return 'unknown';
  }

  // התאמת סגנון של ממשק Gemini דומה יותר לגרסה של גוגל
  function applyGeminiStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* עיצוב חלון העוזר */
      .gemini-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        height: 500px;
        width: 380px;
        background-color: #202124;
        border-color: #5f6368;
        color: #e8eaed;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: box-shadow 0.3s ease;
      }
      
      /* כשמשנים גודל */
      .gemini-panel.resizing {
        box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.5), 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      /* Light mode - מצב בהיר מלא*/
      .gemini-panel.light-mode {
        background-color: #ffffff;
        border-color: #dadce0;
        color: #202124;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      /* כותרת הפאנל עם תמיכה בגרירה */
      .panel-header.draggable {
        cursor: move;
        user-select: none;
      }
      
      /* כותרת הפאנל */
      .panel-title {
        color: #e8eaed;
        font-size: 16px;
        font-weight: 500;
        margin: 0;
      }
      
      .light-mode .panel-title {
        color: #202124 !important;
      }
      
      /* תיקון לכותרת הכחולה */
      .light-mode .panel-header h3,
      .light-mode h3.panel-title {
        color: #202124 !important;
      }
      
      /* כותרת כחולה במידה וקיימת */
      .light-mode [style*="color: rgb(25, 103, 210)"],
      .light-mode [style*="color:#1967d2"],
      .light-mode [style*="color: #1967d2"],
      .light-mode .wordstream-panel h3,
      .light-mode h3,
      .gemini-panel.light-mode h3 {
        color: #202124 !important;
      }
      
      .gemini-panel .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background-color: #303134;
        border-color: #5f6368;
        color: #e8eaed;
        z-index: 1;
      }
      
      .gemini-panel.light-mode .panel-header {
        background-color: #f1f3f4;
        border-color: #dadce0;
        color: #202124;
      }
      
      /* ידיות שינוי גודל - סגנונות משופרים */
      .resize-handle {
        position: absolute;
        z-index: 10005;
        background-color: rgba(138, 180, 248, 0.05);
        transition: background-color 0.2s;
        box-sizing: border-box;
        /* Add subtle border to make handles more noticeable */
        border: 1px solid transparent;
      }
      
      /* Make resize handles more prominent on hover */
      .resize-handle:hover {
        background-color: rgba(138, 180, 248, 0.5) !important;
        border-color: rgba(138, 180, 248, 0.8);
      }
      
      /* Active state for resize handles */
      .gemini-panel.resizing .resize-handle {
        background-color: rgba(138, 180, 248, 0.3);
      }
      
      /* ידיות בפינות */
      .resize-handle.resize-se {
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
      }
      
      .resize-handle.resize-sw {
        bottom: 0;
        left: 0;
        width: 20px;
        height: 20px;
        cursor: nesw-resize;
      }
      
      .resize-handle.resize-ne {
        top: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nesw-resize;
      }
      
      .resize-handle.resize-nw {
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
      }
      
      /* ידיות בצדדים */
      .resize-handle.resize-n {
        top: 0;
        left: 20px;
        right: 20px;
        height: 10px;
        cursor: ns-resize;
      }
      
      .resize-handle.resize-s {
        bottom: 0;
        left: 20px;
        right: 20px;
        height: 10px;
        cursor: ns-resize;
      }
      
      .resize-handle.resize-e {
        right: 0;
        top: 20px;
        bottom: 20px;
        width: 10px;
        cursor: ew-resize;
      }
      
      .resize-handle.resize-w {
        left: 0;
        top: 20px;
        bottom: 20px;
        width: 10px;
        cursor: ew-resize;
      }
      
      /* Add visual cue for bottom-right corner resize handle */
      .resize-handle.resize-se::after {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 12px;
        height: 12px;
        border-right: 3px solid rgba(255, 255, 255, 0.6);
        border-bottom: 3px solid rgba(255, 255, 255, 0.6);
        transition: all 0.2s ease;
      }
      
      .light-mode .resize-handle.resize-se::after {
        border-right: 3px solid rgba(0, 0, 0, 0.3);
        border-bottom: 3px solid rgba(0, 0, 0, 0.3);
      }
      
      /* Enhance visual cue on hover */
      .resize-handle.resize-se:hover::after {
        border-right-width: 4px;
        border-bottom-width: 4px;
        border-right-color: rgba(138, 180, 248, 0.9);
        border-bottom-color: rgba(138, 180, 248, 0.9);
      }
      
      /* אזור בקרה */
      .panel-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* כפתור החלפת ערכת נושא */
      .theme-toggle-button {
        background: none;
        border: none;
        color: #e8eaed;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .light-mode .theme-toggle-button {
        color: #202124;
      }

      .theme-toggle-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }

      .light-mode .theme-toggle-button:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      /* כפתור סגירה */
      .close-button {
        background: none;
        border: none;
        color: #e8eaed;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
      }
      
      .light-mode .close-button {
        color: #202124;
      }
      
      /* אזור תוכן */
      .gemini-panel .panel-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: #202124;
        overflow: hidden;
      }
      
      .gemini-panel.light-mode .panel-content {
        background-color: #ffffff;
      }
      
      /* אזור שיחה */
      .conversation-area {
        padding: 16px;
        gap: 16px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        height: calc(100% - 90px);
        flex: 1;
        background-color: #202124;
      }
      
      .light-mode .conversation-area {
        background-color: #ffffff;
      }
      
      /* אזור קלט */
      .input-container {
        padding: 12px 16px;
        background-color: #303134;
        border-top: 1px solid #5f6368;
        display: flex;
        align-items: center;
      }
      
      .light-mode .input-container {
        background-color: #f1f3f4;
        border-top: 1px solid #dadce0;
      }
      
      /* שדה קלט */
      #gemini-input {
        min-height: 24px;
        max-height: 120px;
        border-radius: 20px;
        background-color: #3c4043;
        border: 1px solid #5f6368;
        color: #e8eaed;
        padding: 10px 16px;
        font-size: 14px;
        font-family: 'Roboto', Arial, sans-serif;
        resize: none;
        width: calc(100% - 50px);
        overflow-y: auto;
      }
      
      .light-mode #gemini-input {
        background-color: #ffffff;
        border: 1px solid #dadce0;
        color: #202124;
      }
      
      #gemini-input:focus {
        outline: none;
        border-color: #8ab4f8;
      }
      
      /* כפתור שליחה */
      .send-button {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #8ab4f8;
        color: #202124;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 8px;
        border: none;
        cursor: pointer;
      }
      
      .send-button:disabled {
        background-color: #3c4043;
        color: #9aa0a6;
        cursor: not-allowed;
      }
      
      .light-mode .send-button:disabled {
        background-color: #e8eaed;
        color: #9aa0a6;
      }
      
      .send-button:not(:disabled):hover {
        background-color: #aecbfa;
      }
      
      /* הודעות */
      .welcome-message {
        color: #e8eaed;
        background-color: #303134;
        border-radius: 12px;
        padding: 12px 16px;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .light-mode .welcome-message {
        color: #202124;
        background-color: #f1f3f4;
      }
      
      .gemini-message {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.5;
        font-family: 'Roboto', Arial, sans-serif;
        margin-bottom: 10px;
      }
      
      .user-message {
        background-color: #8ab4f8;
        color: #202124;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }
      
      .assistant-message {
        background-color: #303134;
        color: #e8eaed;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      
      .light-mode .assistant-message {
        background-color: #f1f3f4;
        color: #202124;
      }
      
      .assistant-message.thinking {
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0.8;
      }
      
      .assistant-message.simulated {
        border-left: 2px solid #aecbfa;
      }
      
      /* הודעות שגיאה */
      .error-message {
        background-color: rgba(234, 67, 53, 0.1);
        border: 1px solid rgba(234, 67, 53, 0.3);
        color: #ea4335;
        margin: 8px 16px;
        padding: 8px;
        border-radius: 4px;
        font-size: 14px;
      }
      
      /* אנימציה */
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(232, 234, 237, 0.3);
        border-top-color: #e8eaed;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      .light-mode .spinner {
        border: 2px solid rgba(32, 33, 36, 0.1);
        border-top-color: #202124;
      }
      
      /* אנימציות */
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  // קבלת הודעות מדומות בסגנון של Gemini
  function getSimulatedResponse(userMessage: string): string {
    // תבניות תשובה מבוססות על שאילתות נפוצות
    const lowercaseQuery = userMessage.toLowerCase();
    
    // בדיקה אם נשאלה שאלה בעברית
    const isHebrew = /[\u0590-\u05FF]/.test(userMessage);
    
    // תגובות כלליות לברכות
    if (lowercaseQuery.includes('hello') || lowercaseQuery.includes('hi') || lowercaseQuery.includes('hey') ||
        lowercaseQuery.includes('שלום') || lowercaseQuery.includes('היי')) {
      return isHebrew ? 
        'שלום! אני כאן כדי לעזור לך. במה אוכל לסייע היום?' : 
        'Hello! I\'m here to help. How can I assist you today?';
    }
    
    if (lowercaseQuery.includes('how are you') || lowercaseQuery.includes('מה שלומך') || 
        lowercaseQuery.includes('מה נשמע')) {
      return isHebrew ? 
        "אני מצוין, תודה ששאלת! במה אוכל לעזור לך?" : 
        "I'm doing well, thanks for asking! How can I help you?";
    }
    
    if (lowercaseQuery.includes('thank') || lowercaseQuery.includes('thanks') || 
        lowercaseQuery.includes('תודה')) {
      return isHebrew ? 
        "בשמחה! אשמח לעזור לך בכל דבר נוסף." : 
        "You're welcome! Let me know if you need anything else.";
    }
    
    // שאלות על הסרטון
    if (lowercaseQuery.includes('this video') || lowercaseQuery.includes('הסרטון') || 
        lowercaseQuery.includes('הוידאו')) {
      const videoTitle = document.title.split(' - YouTube')[0] || 'Untitled';
      return isHebrew ? 
        `הסרטון "${videoTitle}" נראה מעניין. במה אוכל לעזור לך בהקשר לתוכן זה?` : 
        `The video "${videoTitle}" looks interesting. How can I help you with this content?`;
    }
    
    if (lowercaseQuery.includes('מה קורה') || lowercaseQuery.includes('איך אתה מרגיש')) {
      return isHebrew ?
        "אני פה בשבילך! אשמח לעזור בכל מה שתצטרך בקשר לסרטון או בכל נושא אחר." :
        "I'm here for you! How can I help with the video or any other topic?";
    }
    
    // שאלות מזג אוויר
    if (lowercaseQuery.includes('weather') || lowercaseQuery.includes('מזג אוויר') || 
        lowercaseQuery.includes('temperature') || lowercaseQuery.includes('טמפרטורה')) {
      return isHebrew ?
        "אני לא יכול לגשת למידע עדכני על מזג האוויר ללא חיבור לאינטרנט. אם היה לי חיבור, הייתי יכול לספק לך תחזית מדויקת." :
        "I don't have access to real-time weather information without an internet connection. With connectivity, I could provide you with an accurate forecast.";
    }
    
    // שאלות חדשות
    if (lowercaseQuery.includes('news') || lowercaseQuery.includes('current events') || 
        lowercaseQuery.includes('חדשות') || lowercaseQuery.includes('אירועים')) {
      return isHebrew ?
        "אין לי גישה לחדשות עדכניות ללא חיבור לאינטרנט. עם חיבור, אוכל לספק לך עדכונים על אירועים נוכחיים ממקורות אמינים." :
        "I don't have access to the latest news without an internet connection. With connectivity, I could provide updates on current events from reliable sources.";
    }
    
    // אם אין התאמה ספציפית, החזר תשובה כללית לפי השפה
    return isHebrew ?
      "אני מבין שאתה שואל על \"" + userMessage + "\". אשמח לעזור לך בנושא זה. מה בדיוק מעניין אותך לדעת?" :
      "I understand you're asking about \"" + userMessage + "\". I'd be happy to help with this topic. What specifically would you like to know?";
  }
  
  // מיישם את הסגנונות המותאמים של Gemini
  applyGeminiStyles();

  // הגדרת אירועים לשדה הקלט
  const inputField = document.getElementById('gemini-input') as HTMLTextAreaElement;
  if (inputField) {
    // אירוע להתאמת גובה שדה הטקסט והפעלת/ביטול כפתור השליחה
    inputField.addEventListener('input', () => {
      adjustTextareaHeight(inputField);
      toggleSendButton();
    });
    
    // אירוע להתמודדות עם מקש Enter
    inputField.addEventListener('keydown', (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      // שליחה רק אם לוחצים על Enter ללא Shift
      if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault(); // מניעת שורה חדשה
        // שולח הודעה רק אם יש טקסט וכפתור השליחה מופעל
        const sendButton = document.getElementById('gemini-send-button') as HTMLButtonElement;
        if (inputField.value.trim() && !sendButton?.disabled) {
          sendMessage();
        }
      }
    });
    
    // מקד בשדה הטקסט כשהפאנל נפתח
    setTimeout(() => inputField.focus(), 100);
  }
  
  // הוספת אירוע לחיצה לכפתור השליחה
  const sendButton = document.getElementById('gemini-send-button') as HTMLButtonElement;
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }
  
  // Add fix for initial positioning to ensure panel is in viewport
  function ensurePanelInViewport() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    
    let panelLeft = parseInt(panel.style.left || '0', 10);
    let panelTop = parseInt(panel.style.top || '0', 10);
    
    // Adjust if panel extends beyond right edge
    if (panelLeft + panelWidth > viewportWidth) {
      panelLeft = Math.max(0, viewportWidth - panelWidth);
    }
    
    // Adjust if panel extends beyond bottom edge
    if (panelTop + panelHeight > viewportHeight) {
      panelTop = Math.max(0, viewportHeight - panelHeight);
    }
    
    // Adjust if panel extends beyond left edge
    if (panelLeft < 0) {
      panelLeft = 0;
    }
    
    // Adjust if panel extends beyond top edge
    if (panelTop < 0) {
      panelTop = 0;
    }
    
    panel.style.left = `${panelLeft}px`;
    panel.style.top = `${panelTop}px`;
  }
  
  // Call this when panel is first created
  ensurePanelInViewport();
  
  // Also ensure panel stays in viewport when window is resized
  window.addEventListener('resize', () => {
    ensurePanelInViewport();
  });
  
  return panel;
}

function createNotesPanel() {
  const panel = document.createElement('div');
  panel.className = 'wordstream-panel notes-panel';
  panel.id = 'wordstream-notes-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <h3>Video Notes</h3>
      <button class="close-button">&times;</button>
    </div>
    <div class="panel-content">
      <p class="helper-text">Take notes while watching this video. Notes are saved automatically.</p>
      <div class="notes-container" id="notes-container">
        <div class="no-notes">No saved notes for this video</div>
      </div>
    </div>
    <div class="panel-footer">
      <div class="current-timestamp" id="current-timestamp"></div>
      <textarea id="note-input" placeholder="Enter your note here..."></textarea>
      <button id="save-note-button">Save Note</button>
    </div>
  `;

  // Add event listener for the close button
  panel.querySelector('.close-button')?.addEventListener('click', () => {
    panel.style.display = 'none';
    if (timestampInterval) {
      clearInterval(timestampInterval);
      timestampInterval = null;
    }
  });

  // Get current page/video information
  const videoTitle = document.title || "YouTube Video";
  const url = window.location.href;
  let videoId = '';
  
  if (url.includes('youtube.com')) {
    const urlParams = new URLSearchParams(new URL(url).search);
    videoId = urlParams.get('v') || '';
  } else if (url.includes('netflix.com')) {
    // Extract Netflix ID - this is more complex but can be approximated
    const pathParts = new URL(url).pathname.split('/');
    videoId = pathParts[pathParts.length - 1] || 'unknown';
  }
  
  // Function to display notes in the panel
  function displayNotes(notes: any[]) {
    const notesContainer = document.getElementById('notes-container');
    if (!notesContainer) return;
    
    if (!notes || notes.length === 0) {
      notesContainer.innerHTML = '<div class="no-notes">No saved notes for this video</div>';
                return;
              }

    notesContainer.innerHTML = '';
    notes.forEach((note, index) => {
      const noteElement = document.createElement('div');
      noteElement.className = 'note-item';
      
      const formattedDate = note.timestamp ? new Date(note.timestamp).toLocaleString() : 'Unknown date';
      const videoTimeFormatted = note.videoTime ? formatVideoTime(note.videoTime) : '';
      
      noteElement.innerHTML = `
        <div class="note-timestamp">
          ${formattedDate}
          ${videoTimeFormatted ? ` - ${videoTimeFormatted}` : ''}
        </div>
        <div class="note-content">${note.content}</div>
        <button class="note-delete" data-index="${index}">&times;</button>
      `;
      
      notesContainer.appendChild(noteElement);
      
      // Add delete functionality
      const deleteButton = noteElement.querySelector('.note-delete');
      if (deleteButton) {
        deleteButton.addEventListener('click', () => {
          deleteNote(index);
        });
      }
    });
  }
  
  // Load saved notes when the panel is opened
  function loadSavedNotes() {
    if (!videoId) return;
    
    try {
      if (isChromeAPIAvailable()) {
        chrome.storage.local.get(['videoNotes'], (result) => {
              if (chrome.runtime.lastError) {
            console.warn('[WordStream] Error loading notes:', chrome.runtime.lastError);
            displayNotes([]);
        return;
      }
      
          const allNotes = result.videoNotes || {};
          displayNotes(allNotes[videoId] || []);
        });
              } else {
        console.warn('[WordStream] Chrome storage API not available, using local fallback');
        // Try to use localStorage as fallback
        try {
          const notesJson = localStorage.getItem('wordstream_notes');
          const allNotes = notesJson ? JSON.parse(notesJson) : {};
          displayNotes(allNotes[videoId] || []);
        } catch (error) {
          console.error('[WordStream] Error accessing localStorage:', error);
          displayNotes([]);
        }
      }
    } catch (error) {
      console.error('[WordStream] Error loading notes:', error);
      displayNotes([]);
    }
  }
  
  // Format video time (seconds) to MM:SS format
  function formatVideoTime(seconds: number): string {
    if (!seconds && seconds !== 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Delete a note by index
  function deleteNote(index: number): void {
    if (!videoId) return;
    
    try {
      if (isChromeAPIAvailable() && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['videoNotes'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[WordStream] Error retrieving notes for deletion:', chrome.runtime.lastError);
            return;
          }

          const allNotes = result.videoNotes || {};
          const videoNotes = allNotes[videoId] || [];
          
          if (index >= 0 && index < videoNotes.length) {
            videoNotes.splice(index, 1);
            allNotes[videoId] = videoNotes;
            
            chrome.storage.local.set({ videoNotes: allNotes }, () => {
          if (chrome.runtime.lastError) {
                console.warn('[WordStream] Error saving notes after deletion:', chrome.runtime.lastError);
            return;
          }

              console.log('[WordStream] Note deleted successfully');
              loadSavedNotes();
            });
          }
        });
      } else {
        // Try localStorage fallback
        try {
          const notesJson = localStorage.getItem('wordstream_notes');
          const allNotes = notesJson ? JSON.parse(notesJson) : {};
          const videoNotes = allNotes[videoId] || [];
          
          if (index >= 0 && index < videoNotes.length) {
            videoNotes.splice(index, 1);
            allNotes[videoId] = videoNotes;
            
            localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
            loadSavedNotes();
          }
        } catch (error) {
          console.error('[WordStream] Error using localStorage for note deletion:', error);
        }
      }
    } catch (error) {
      console.error('[WordStream] Error deleting note:', error);
    }
  }
  
  // Update the timestamp every second while the notes panel is open
  let timestampInterval: ReturnType<typeof setInterval> | null = null;
  
  function updateCurrentTimestamp() {
    const timestampElement = document.getElementById('current-timestamp');
    if (!timestampElement) return;
    
    let currentTime = 0;
    
    // Try to get the video player
    const videoElement = document.querySelector('video');
    if (videoElement) {
      currentTime = videoElement.currentTime;
    }
    
    timestampElement.textContent = currentTime ? `Current Video Time: ${formatVideoTime(currentTime)}` : '';
  }
  
  // Start updating timestamp
  updateCurrentTimestamp();
  
  // Add Note functionality
  setTimeout(() => {
    const saveButton = document.getElementById('save-note-button');
    const noteInput = document.getElementById('note-input') as HTMLTextAreaElement;
    
    if (saveButton && noteInput) {
      console.log('[WordStream] Save note button found and event listener attached');
      
      saveButton.addEventListener('click', function() {
        const noteContent = noteInput.value.trim();
        if (!noteContent) return;
        
        let currentTime = 0;
        const videoElement = document.querySelector('video');
        if (videoElement) {
          currentTime = videoElement.currentTime;
        }
        
        const note = {
          content: noteContent,
          timestamp: new Date().toISOString(),
          videoTime: currentTime || null
        };
        
        console.log('[WordStream] Saving note:', note);
        
        // Save note to storage with safer API checks
        try {
          if (isChromeAPIAvailable() && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['videoNotes'], (result) => {
              if (chrome.runtime.lastError) {
                console.warn('[WordStream] Error retrieving notes for saving:', chrome.runtime.lastError);
                // Fall back to localStorage
                saveToLocalStorage();
                return;
              }

              const allNotes = result.videoNotes || {};
              const videoNotes = allNotes[videoId] || [];
              
              videoNotes.push(note);
              allNotes[videoId] = videoNotes;
              
              chrome.storage.local.set({ videoNotes: allNotes }, () => {
              if (chrome.runtime.lastError) {
                  console.warn('[WordStream] Error saving note:', chrome.runtime.lastError);
                  saveToLocalStorage();
                  return;
                }
                
                console.log('[WordStream] Note saved successfully to Chrome storage');
                noteInput.value = ''; // Clear input
                loadSavedNotes(); // Refresh notes list
              });
            });
              } else {
            saveToLocalStorage();
          }
  } catch (error) {
          console.error('[WordStream] Error in note saving process:', error);
          saveToLocalStorage();
        }
        
        // Fallback to localStorage
        function saveToLocalStorage() {
          try {
            const notesJson = localStorage.getItem('wordstream_notes');
            const allNotes = notesJson ? JSON.parse(notesJson) : {};
            const videoNotes = allNotes[videoId] || [];
            
            videoNotes.push(note);
            allNotes[videoId] = videoNotes;
            
            localStorage.setItem('wordstream_notes', JSON.stringify(allNotes));
            console.log('[WordStream] Note saved successfully to localStorage');
            noteInput.value = ''; // Clear input
            loadSavedNotes(); // Refresh notes list
          } catch (localError) {
            console.error('[WordStream] Failed to save to localStorage:', localError);
            alert('Failed to save note. Please try again.');
          }
        }
      });
      
      // Also allow pressing Enter in the textarea to save
      noteInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          saveButton.click();
        }
      });
      
      // Load any existing notes
      loadSavedNotes();
    } else {
      console.error('[WordStream] Could not find save button or note input');
    }
  }, 100);
  
  return panel;
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('[WordStream] DOM loaded, initializing extension');
  
  // Start the caption detection
  startDetection();
  
  // שימוש בפונקציה הישירה במקום React
  setTimeout(addDirectFloatingControls, 1000);
  
  // Watch for URL changes (for SPA navigation)
  const currentUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== currentUrl) {
      console.log('[WordStream] URL changed, initializing for new page');
      // Restart caption detection
      startDetection();
      // שימוש בפונקציה הישירה במקום React
      setTimeout(addDirectFloatingControls, 1000);
    }
  }).observe(document, {subtree: true, childList: true});
});

// Also add controls when the window finishes loading
window.addEventListener('load', () => {
  console.log('[WordStream] Window loaded, initializing extension');
  // Ensure detection is running
  startDetection();
  // שימוש בפונקציה הישירה במקום React
  setTimeout(addDirectFloatingControls, 2000);
});

// הגדרה אחת של renderReactControls במקום הנכון
function renderReactControls() {
  try {
    console.log('[WordStream] Rendering React floating controls');
    
    // וודא שאין כבר אלמנט כזה
    removeAllFloatingControls();
    
    // יצירת מיכל עבור רכיבי React
    const reactContainer = document.createElement('div');
    reactContainer.id = 'wordstream-react-container';
    document.body.appendChild(reactContainer);
    
    // קבלת זיהוי וכותרת הוידאו
    let videoId = '';
    if (window.location.hostname.includes('youtube.com')) {
      const url = new URL(window.location.href);
      videoId = url.searchParams.get('v') || '';
    }
    
    const videoTitle = document.title;
    
    if (!videoId) {
      console.error('[WordStream] Could not get video ID for React components');
      return;
    }
    
    // רינדור רכיב FloatingControls באמצעות React
    const root = createRoot(reactContainer);
    root.render(
      React.createElement(FloatingControls, {
        videoId,
        videoTitle
      })
    );
    
    console.log('[WordStream] React floating controls rendered successfully');
  } catch (error) {
    console.error('[WordStream] Error rendering React floating controls:', error);
  }
}

// Handle word clicks (called externally from detectors)
export function handleWordClick(event: MouseEvent) {
  console.log('WordStream: Word clicked!', event);
  
  if (currentDetector) {
    currentDetector.handleWordClick(event);
  }
}

// פונקציה לטעינת כל המילים בפורמט החדש
async function loadAllWords() {
  try {
    // קבלת המטא-דאטה על קבוצות המילים
    const metadata = await new Promise<any>((resolve, reject) => {
      chrome.storage.sync.get(['words_metadata', 'words_groups'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result);
      });
    });
    
    // אם אין מטא-דאטה, כנראה שאין לנו מילים בפורמט החדש
    // ננסה לטעון מילים בפורמט הישן
    if (!metadata.words_metadata) {
      const oldWords = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['words'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(result.words || []);
        });
      });
      
      console.log('WordStream: Loaded words in old format:', oldWords?.length || 0);
      return oldWords || [];
    }
    
    // אם יש לנו מטא-דאטה אבל אין רשימת קבוצות, נחזיר מערך ריק
    if (!metadata.words_groups || !Array.isArray(metadata.words_groups)) {
      console.log('WordStream: No word groups found');
      return [];
    }
    
    // טעינת כל קבוצות המילים
    const wordGroups = await new Promise<any>((resolve, reject) => {
      chrome.storage.sync.get(metadata.words_groups, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result);
      });
    });
    
    // איחוד כל הקבוצות למערך אחד
    const allWords = [];
    for (const groupKey of metadata.words_groups) {
      if (wordGroups[groupKey] && Array.isArray(wordGroups[groupKey])) {
        allWords.push(...wordGroups[groupKey]);
      }
    }
    
    console.log('WordStream: Loaded words in new format:', allWords.length);
    return allWords;
  } catch (error) {
    console.error('WordStream: Error loading words:', error);
    return [];
  }
} 