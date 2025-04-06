/// <reference types="chrome"/>

// Add performance polyfill
if (typeof performance === 'undefined') {
  (window as any).performance = {
    now: () => Date.now()
  };
}

// Initialize the WordStream global object
if (typeof window.WordStream === 'undefined') {
  window.WordStream = {
    Components: {},
    local: {}  // Add local property to prevent "undefined" errors
  };
}

// Authentication state tracking
if (window.WordStream && typeof window.WordStream === 'object') {
  if (!window.WordStream.local) {
    window.WordStream.local = {};
  }
  window.WordStream.local.isAuthenticated = false;
}

// Firebase CORS override for Chrome extensions in content scripts
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  console.log('WordStream Content: Applying Firebase CORS overrides');
  
  // Add extension origin to trusted origins
  const trustedOrigins = [];
  if (chrome.runtime?.id) {
    const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
    trustedOrigins.push(extensionOrigin);
  }
  
  // Monitor for any Firebase scripts that might be loaded
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName: string, options?: ElementCreationOptions) {
    const element = originalCreateElement.call(document, tagName, options);
    
    // If a script element is created that loads Firebase
    if (tagName.toLowerCase() === 'script') {
      const scriptElement = element as HTMLScriptElement;
      scriptElement.addEventListener('beforeload', function(event) {
        const src = scriptElement.src || '';
        if (
          src.includes('firebaseio.com') ||
          src.includes('firebaseapp.com') ||
          src.includes('googleapis.com')
        ) {
          console.log('WordStream Content: Detected Firebase script load, applying CORS headers');
          // Add CORS attributes
          scriptElement.setAttribute('crossorigin', 'anonymous');
        }
      });
    }
    
    return element;
  };
}

// בדיקה אם אנחנו בתוסף כרום
const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;

// מידע גלובלי על האימות בתסריט התוכן
let isAuthenticated = false;

// חלון פתוח למידע לוקאלי ולפונקציות שיתוף
if (typeof window !== 'undefined') {
  // מתייחס למידע המצורף ל-window כדי לחלוק אותו בין קבצים
  window.WordStream = window.WordStream || {};
  
  // הוספת מידע אימות גלובלי כדי שקבצים אחרים יוכלו לגשת אליו
  window.WordStream.local = window.WordStream.local || {};
  window.WordStream.local.isAuthenticated = false;
}

// פונקציה לעדכון ה-UI בהתאם למצב האימות
function updateUIForAuthState() {
  console.log('WordStream: Updating UI for auth state:', isAuthenticated);
  
  if (isAuthenticated) {
    // משתמש מחובר - להפעיל את כל הפיצ'רים
    console.log('WordStream: User authenticated, enabling features...');
    startDetection(); // מאפשר זיהוי כיתוביות והכנסת כפתורים צפים
  } else {
    // משתמש לא מחובר - להשבית את כל הפיצ'רים
    console.log('WordStream: User not authenticated, disabling features...');
    cleanup(); // מנקה ומסיר את כל הפיצ'רים
  }
  
  // עדכון הסטטוס הגלובלי כך שקבצים אחרים יוכלו לבדוק אותו בקלות
  if (typeof window !== 'undefined' && window.WordStream?.local) {
    window.WordStream.local.isAuthenticated = isAuthenticated;
  }
}

// בדיקת מצב האימות הנוכחי מה-background script
async function checkInitialAuthState() {
  try {
    // בודק אם local storage כבר מכיל את מצב האימות
    const storageData = await chrome.storage.local.get('isAuthenticated');
    if (storageData.hasOwnProperty('isAuthenticated')) {
      isAuthenticated = !!storageData.isAuthenticated;
    }
    
    // שואל את ה-background script אם המשתמש מחובר
    if (isExtension && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ action: 'GET_CURRENT_AUTH_STATE' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error checking auth state:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.hasOwnProperty('isAuthenticated')) {
          isAuthenticated = !!response.isAuthenticated;
          console.log('WordStream: Initial auth state received:', isAuthenticated);
          updateUIForAuthState();
        }
      });
    }
    
    // עדכון ה-UI על בסיס המידע שיש ברגע זה
    updateUIForAuthState();
    
  } catch (error) {
    console.error('WordStream: Error checking initial auth state:', error);
  }
}

// Listen for auth state changes from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AUTH_STATE_CHANGED') {
    console.log('WordStream: Auth state message received:', message.isAuthenticated);
    
    // עדכון מצב האימות המקומי
    isAuthenticated = !!message.isAuthenticated;
    
    // עדכון הממשק בהתאם למצב האימות החדש
    updateUIForAuthState();
    
    // מודיע למשמע שקיבלנו את ההודעה
    sendResponse({ received: true });
  }
  return true;
});

// Initialize Firebase dynamically when needed
async function initializeFirebase() {
  try {
    // Safely check if Firebase is already initialized
    if (window.WordStream && 
        typeof window.WordStream === 'object') {
      
      // Ensure local object exists
      if (!window.WordStream.local) {
        window.WordStream.local = {};
      }
      
      if (!window.WordStream.local.firebaseInitialized) {
        console.log('WordStream Content: Initializing Firebase');
        // Import Firebase modules dynamically
        const { auth } = await import('@/core/firebase/config');
        
        // Set flag to avoid re-initialization
        window.WordStream.local.firebaseInitialized = true;
        return true;
      }
    }
    return true;
  } catch (error) {
    console.error('WordStream Content: Failed to initialize Firebase -', error);
    return false;
  }
}

// Function to try initializing detector with auth check
function tryInitializeDetector() {
  // Only proceed if authenticated
  if (window.WordStream && 
      typeof window.WordStream === 'object') {
    
    // Ensure local object exists  
    if (!window.WordStream.local) {
      window.WordStream.local = {};
    }
    
    if (!window.WordStream.local.isAuthenticated) {
      console.log('WordStream Content: Not authenticated, skipping detector initialization');
      return;
    }
  }
  
  // Initialize detector
  initializeDetector();
}

// Check auth state when content script loads
checkInitialAuthState();

import React from 'react';
import ReactDOM from 'react-dom';
import { YouTubeCaptionDetector } from '../services/caption-detectors/youtube-detector';
import { NetflixCaptionDetector } from '../services/caption-detectors/netflix-detector';
import { CaptionDetector } from '@/types';
import { createRoot } from 'react-dom/client';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';
// Import WordStreamGlobal type
import { WordStreamGlobal } from '@/types/global';
// הוסף ייבוא ל-BackgroundMessaging
import * as BackgroundMessaging from '@/utils/background-messaging';

// Set React and ReactDOM on the window to make them available globally
window.React = React;
window.ReactDOM = { ...ReactDOM, createRoot };

// Make React and ReactDOM globally available for components
declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM & { createRoot?: typeof createRoot };
    // Remove WordStream definition - it's already defined in global.d.ts
  }
}

// Register WordStream components on the global window object
if (!window.WordStream) {
  window.WordStream = { local: {} }; // Initialize with local property
}
if (!window.WordStream.Components) {
  window.WordStream.Components = {};
}
if (!window.WordStream.local) {
  window.WordStream.local = {}; // Ensure local exists
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
    // בדיקת אימות לפני יצירת כפתורים צפים
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      console.log('WordStream: User not authenticated, not adding floating controls');
      return; // צא מהפונקציה אם המשתמש לא מחובר
    }
    
    // אפשר להשאיר את הלוגים למטרות דיבוג
    console.log('WordStream: Adding floating controls for authenticated user');
    
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
    const geminiPanel = createGeminiPanel2();
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
  // Predefined sizes
  const SIZES = {
    small: { width: 350, height: 500 },
    medium: { width: 480, height: 550 },
    large: { width: 640, height: 600 }
  };
  
  // Current size and theme state
  let currentSize = 'medium';
  let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Create main panel container
  const panel = document.createElement('div');
  panel.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
  panel.id = 'wordstream-gemini-panel';
  
  // Apply initial size
  panel.style.width = `${SIZES[currentSize as keyof typeof SIZES].width}px`;
  panel.style.height = `${SIZES[currentSize as keyof typeof SIZES].height}px`;
  
  // Set panel base styles
  panel.style.position = 'fixed';
  panel.style.top = '80px';
  panel.style.right = '20px';
  panel.style.zIndex = '9999999';
  panel.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
  panel.style.borderRadius = '12px';
  panel.style.overflow = 'hidden';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
  panel.style.border = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
  panel.style.fontFamily = "'Inter', 'Arial', sans-serif";
  
  // Create panel HTML structure
  panel.innerHTML = `
    <div class="panel-header">
      <h3>AI Assistant</h3>
      <div class="header-controls">
        <div class="size-controls">
          <button class="size-button size-small" title="Small size">S</button>
          <button class="size-button size-medium active" title="Medium size">M</button>
          <button class="size-button size-large" title="Large size">L</button>
        </div>
        <button class="toggle-theme" title="Toggle dark/light mode">
          ${isDarkMode ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>' : 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>'
          }
        </button>
        <button class="close-button" title="Close">&times;</button>
      </div>
    </div>
    <div class="panel-content">
      <div class="messages-container" id="messages-container">
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3>Ask about the video content</h3>
          <p>Example: "What does this expression mean?" or "Explain the historical context"</p>
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <textarea id="user-input" placeholder="Type your question..."></textarea>
      <button id="send-button" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Apply styles to panel components
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid ${isDarkMode ? '#333333' : '#E0E0E0'};
      background-color: ${isDarkMode ? '#1E1E1E' : '#F0F2F5'};
      cursor: move;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${isDarkMode ? '#FFFFFF' : '#050505'};
    }
    
    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .size-controls {
      display: flex;
      border: 1px solid ${isDarkMode ? '#444' : '#ddd'};
      border-radius: 4px;
      overflow: hidden;
    }
    
    .size-button {
      background: ${isDarkMode ? '#333' : '#eee'};
      border: none;
      color: ${isDarkMode ? '#ccc' : '#666'};
      width: 24px;
      height: 24px;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
    }
    
    .size-button.active {
      background: ${isDarkMode ? '#6366F1' : '#6366F1'};
      color: white;
    }
    
    .toggle-theme, .close-button {
      background: transparent;
      border: none;
      color: ${isDarkMode ? '#FFFFFF' : '#050505'};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }
    
    .close-button {
      font-size: 20px;
      font-weight: bold;
    }
    
    .panel-content {
      flex-grow: 1;
      overflow-y: auto;
      padding: 16px;
      background-color: ${isDarkMode ? '#121212' : '#FFFFFF'};
      color: ${isDarkMode ? '#FFFFFF' : '#050505'};
      padding-bottom: 120px; /* גובה מספק לחשיפת ההודעה האחרונה במלואה */
    }
    
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 30px; /* מרווח נוסף בתחתית */
    }
    
    .welcome-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px 16px;
      color: ${isDarkMode ? '#CCCCCC' : '#666666'};
    }
    
    .welcome-icon {
      margin-bottom: 16px;
      color: ${isDarkMode ? '#AAAAAA' : '#888888'};
    }
    
    .welcome-message h3 {
      margin: 0 0 8px 0;
      color: ${isDarkMode ? '#FFFFFF' : '#050505'};
    }
    
    .welcome-message p {
      margin: 0;
      font-size: 14px;
    }
    
    .message {
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 85%;
    }
    
    .message.user {
      align-self: flex-end;
      background-color: #6366F1;
      color: white;
    }
    
    .message.ai {
      align-self: flex-start;
      background-color: ${isDarkMode ? '#1E1E1E' : '#F0F2F5'};
      color: ${isDarkMode ? '#FFFFFF' : '#050505'};
    }
    
    .panel-footer {
      padding: 12px 16px;
      border-top: 1px solid #eaeaea;
      background-color: #f9f9f9;
    }
    
    #user-input {
      flex-grow: 1;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 14px;
      resize: none;
      outline: none;
      min-height: 24px;
      max-height: 120px;
    }
    
    #user-input:focus {
      outline: none;
      border-color: #6366F1;
    }
    
    #send-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: none;
      background-color: #6366F1;
      color: white;
      cursor: pointer;
    }
    
    #send-button:disabled {
      background-color: ${isDarkMode ? '#444' : '#ddd'};
      color: ${isDarkMode ? '#888' : '#aaa'};
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
  panel.appendChild(styleSheet);
  
  // Set event handlers
  
  // 1. Make the panel draggable
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  const header = panel.querySelector('.panel-header') as HTMLElement;
  
  if (header) {
    header.addEventListener('mousedown', (e) => {
      // Only initiate drag if not clicking on a control
      if (!(e.target as HTMLElement).closest('button')) {
        isDragging = true;
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
      }
    });
  }
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top = (e.clientY - offsetY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    ensurePanelInViewport();
  });
  
  // 2. Theme toggling
  const themeToggle = panel.querySelector('.toggle-theme');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      panel.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
      updateThemeStyles();
    });
  }
  
  // 3. Size controls
  const sizeButtons = panel.querySelectorAll('.size-button');
  sizeButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('size-small')) {
        updateSize('small');
      } else if (button.classList.contains('size-medium')) {
        updateSize('medium');
      } else if (button.classList.contains('size-large')) {
        updateSize('large');
      }
      
      // Update active state for buttons
      sizeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
  
  // 4. Close button handler
  const closeButton = panel.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      panel.style.display = 'none';
      const event = new CustomEvent('geminiPanelClosed');
      document.dispatchEvent(event);
    });
  }
  
  // 5. Text input handling
  const textInput = panel.querySelector('#user-input') as HTMLTextAreaElement;
  const sendButton = panel.querySelector('#send-button') as HTMLButtonElement;
  
  if (textInput && sendButton) {
    // Enable/disable send button based on input
    textInput.addEventListener('input', () => {
      sendButton.disabled = textInput.value.trim() === '';
      adjustTextareaHeight(textInput);
    });
    
    // Auto-adjust height of textarea
    function adjustTextareaHeight(textarea: HTMLTextAreaElement) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    // Handle sending message
    sendButton.addEventListener('click', sendMessage);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Function to handle sending messages
  async function sendMessage() {
    if (!textInput || textInput.value.trim() === '') return;
    
    // בדיקת אימות לפני שליחת הודעה לג'מיני
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      console.log('WordStream Gemini: Chat blocked - user not authenticated');
      addMessage('Authentication required to use WordStream Gemini Chat. Please sign in to continue.', 'ai');
      return;
    }
    
    const userMessage = textInput.value.trim();
    textInput.value = '';
    textInput.style.height = 'auto';
    sendButton.disabled = true;
    
    // Add user message to UI
    addMessage(userMessage, 'user');
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="spinner"></div>
      <div>Processing...</div>
    `;
    const messagesContainer = panel.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.appendChild(loadingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    try {
      // Get video information
      const videoId = getVideoId();
      const videoTitle = document.title;
      
      // Call to Gemini API via background script
      const response = await chrome.runtime.sendMessage({
        action: 'gemini',
        message: userMessage,
        videoId,
        videoTitle
      });
      
      // Remove loading indicator
      if (messagesContainer && loadingIndicator.parentNode === messagesContainer) {
        messagesContainer.removeChild(loadingIndicator);
      }
      
      if (response && response.success) {
        addMessage(response.answer, 'ai');
      } else {
        throw new Error(response?.error || 'Failed to get response');
      }
  } catch (error) {
      console.error('Error sending message to Gemini:', error);
      
      // Remove loading indicator
      if (messagesContainer && loadingIndicator.parentNode === messagesContainer) {
        messagesContainer.removeChild(loadingIndicator);
      }
      
      // Show error message
      addMessage('Sorry, there was an error processing your request. Please try again.', 'ai');
    }
  }
  
  // Function to add a message to the UI
  function addMessage(content: string, type: 'user' | 'ai') {
    // Create message element
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = content;
    
    // Add to container
    const welcomeMessage = panel.querySelector('.welcome-message');
    const messagesContainer = panel.querySelector('.messages-container');
    
    if (messagesContainer) {
      // Remove welcome message if this is the first message
      if (welcomeMessage && welcomeMessage.parentNode === messagesContainer) {
        messagesContainer.removeChild(welcomeMessage);
      }
      
      messagesContainer.appendChild(message);
      
      // Use the dedicated scroll function with enhanced features
      const extraOffset = 50;
      
      // הוספת השהייה ראשונית קצרה לאפשר לתוכן להתרנדר
      setTimeout(() => {
        // גלילה למטה עם אופסט נוסף
        messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
        
        const panelContent = panel.querySelector('.panel-content');
        if (panelContent) {
          panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
        }
        
        // בדיקה שנייה עם השהייה ארוכה יותר
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
          
          if (panelContent) {
            panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
          }
          
          // בדיקה שלישית עם השהייה ארוכה מאוד
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
            
            if (panelContent) {
              panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
            }
            
            // בדיקה רביעית (סופית) עם השהייה ארוכה במיוחד
            setTimeout(() => {
              messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
              
              if (panelContent) {
                panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
              }
            }, 300);
          }, 300);
        }, 200);
      }, 50);
    }
  }
  
  // Function to update the size of the panel
  function updateSize(size: 'small' | 'medium' | 'large') {
    currentSize = size;
    panel.style.width = `${SIZES[size].width}px`;
    panel.style.height = `${SIZES[size].height}px`;
    ensurePanelInViewport();
  }
  
  // Function to update theme-related styles
  function updateThemeStyles() {
    // This would be better with CSS variables, but for simplicity we'll update the inline styles
    const header = panel.querySelector('.panel-header') as HTMLElement;
    const content = panel.querySelector('.panel-content') as HTMLElement;
    const footer = panel.querySelector('.panel-footer') as HTMLElement;
    const input = panel.querySelector('#user-input') as HTMLTextAreaElement;
    
    if (header && content && footer && input) {
      // Update base panel styles
      panel.style.backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
      panel.style.border = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      
      // Update header styles
      header.style.borderBottom = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      header.style.backgroundColor = isDarkMode ? '#1E1E1E' : '#F0F2F5';
      
      // Update header title
      const title = header.querySelector('h3');
      if (title) {
        title.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      }
      
      // Update content area
      content.style.backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
      content.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      
      // Update footer
      footer.style.borderTop = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      footer.style.backgroundColor = isDarkMode ? '#1E1E1E' : '#F0F2F5';
      
      // Update input
      input.style.borderColor = isDarkMode ? '#444' : '#ddd';
      input.style.backgroundColor = isDarkMode ? '#2D2D2D' : '#FFFFFF';
      input.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      
      // Update all AI messages - improved background for better contrast
      const aiMessages = panel.querySelectorAll('.message.ai');
      aiMessages.forEach(msg => {
        (msg as HTMLElement).style.backgroundColor = isDarkMode ? '#2a2a30' : '#eff1f5';
        (msg as HTMLElement).style.color = isDarkMode ? '#e8e8e8' : '#333333';
        (msg as HTMLElement).style.border = `1px solid ${isDarkMode ? '#444444' : '#e0e0e0'}`;
      });
      
      // Update all user messages - use stronger blue for better contrast
      const userMessages = panel.querySelectorAll('.message.user');
      userMessages.forEach(msg => {
        (msg as HTMLElement).style.backgroundColor = isDarkMode ? '#4c6ef5' : '#4b8df8';
        (msg as HTMLElement).style.color = '#FFFFFF';
        (msg as HTMLElement).style.border = 'none';
      });
      
      // Update size buttons for better contrast in light mode
      const sizeButtons = panel.querySelectorAll('.size-button:not(.active)');
      sizeButtons.forEach(btn => {
        (btn as HTMLElement).style.backgroundColor = isDarkMode ? '#333' : '#e8e8e8';
        (btn as HTMLElement).style.color = isDarkMode ? '#ccc' : '#555';
      });
      
      // Update theme toggle icon
      const themeToggle = panel.querySelector('.toggle-theme');
      if (themeToggle) {
        // ראשית נעצב את כפתור ה-toggle עצמו
        (themeToggle as HTMLElement).style.background = isDarkMode ? '#f5f5f5' : '#333333';
        (themeToggle as HTMLElement).style.border = `1px solid ${isDarkMode ? '#777777' : '#222222'}`;
        (themeToggle as HTMLElement).style.borderRadius = '8px';
        (themeToggle as HTMLElement).style.padding = '6px 10px';
        (themeToggle as HTMLElement).style.color = isDarkMode ? '#333333' : '#ffffff';
        (themeToggle as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        (themeToggle as HTMLElement).style.display = 'flex';
        (themeToggle as HTMLElement).style.alignItems = 'center';
        (themeToggle as HTMLElement).style.gap = '6px';
        (themeToggle as HTMLElement).style.fontWeight = '500';
        (themeToggle as HTMLElement).style.fontSize = '12px';
        (themeToggle as HTMLElement).title = isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
        
        // עכשיו נעדכן את האייקון עם טקסט
        themeToggle.innerHTML = isDarkMode ? 
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg><span>Light</span>' : 
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg><span>Dark</span>';
      }
    }
  }
  
  // Function to help get video ID
  function getVideoId(): string {
    const url = window.location.href;
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v') || '';
  }
  
  // Function to make sure panel stays within viewport
  function ensurePanelInViewport() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelRect = panel.getBoundingClientRect();
    
    // Check right edge
    if (panelRect.right > viewportWidth) {
      panel.style.left = (viewportWidth - panelRect.width) + 'px';
    }
    
    // Check bottom edge
    if (panelRect.bottom > viewportHeight) {
      panel.style.top = (viewportHeight - panelRect.height) + 'px';
    }
    
    // Check left edge
    if (panelRect.left < 0) {
      panel.style.left = '0px';
    }
    
    // Check top edge
    if (panelRect.top < 0) {
      panel.style.top = '0px';
    }
  }
  
  // Add window resize handler to keep panel in viewport
  window.addEventListener('resize', ensurePanelInViewport);
  
  return panel;
}

// Nueva implementación del panel Gemini con diseño estilo Grok
function createGeminiPanel2() {
  // Predefined sizes
  const SIZES = {
    small: { width: 350, height: 500 },
    medium: { width: 480, height: 550 },
    large: { width: 640, height: 600 }
  };
  
  // Current size and theme state
  let currentSize = 'medium';
  let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Create main panel container
  const panel = document.createElement('div');
  panel.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
  panel.id = 'wordstream-gemini-panel';
  
  // Apply initial size
  panel.style.width = `${SIZES[currentSize as keyof typeof SIZES].width}px`;
  panel.style.height = `${SIZES[currentSize as keyof typeof SIZES].height}px`;
  
  // Set panel base styles
  panel.style.position = 'fixed';
  panel.style.top = '80px';
  panel.style.right = '20px';
  panel.style.zIndex = '9999999';
  panel.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
  panel.style.borderRadius = '12px';
  panel.style.overflow = 'hidden';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.backgroundColor = isDarkMode ? '#121212' : '#F7F9FC';
  panel.style.border = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
  panel.style.fontFamily = 'Inter, Roboto, "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif';
  panel.style.fontSize = currentSize === 'small' ? '13px' : (currentSize === 'medium' ? '14px' : '16px');
  panel.style.fontWeight = '400';
  panel.style.transition = 'all 0.3s ease-in-out';
  
  // Create panel HTML structure
  panel.innerHTML = `
    <div class="panel-header">
      <h3>AI Assistant</h3>
      <div class="header-controls">
        <div class="size-controls">
          <button class="size-button size-small" title="Small size">S</button>
          <button class="size-button size-medium active" title="Medium size">M</button>
          <button class="size-button size-large" title="Large size">L</button>
        </div>
        <button class="toggle-theme" title="Toggle dark/light mode">
          ${isDarkMode ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>' : 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>'
          }
        </button>
        <button class="close-button" title="Close">&times;</button>
      </div>
    </div>
    <div class="panel-content">
      <div class="messages-container" id="messages-container">
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3>Ask about the video content</h3>
          <p>Example: "What does this expression mean?" or "Explain the historical context"</p>
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <textarea id="user-input" placeholder="Type your question..."></textarea>
      <button id="send-button" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Apply styles to panel components
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid ${isDarkMode ? '#333333' : '#E0E0E0'};
      background-color: ${isDarkMode ? '#121212' : '#F7F9FC'};
      cursor: move;
      transition: all 0.3s ease;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
    }
    
    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .size-controls {
      display: flex;
      border: 1px solid ${isDarkMode ? '#444' : '#ddd'};
      border-radius: 4px;
      overflow: hidden;
    }
    
    .size-button {
      background: ${isDarkMode ? '#333' : '#eee'};
      border: none;
      color: ${isDarkMode ? '#B0B0B0' : '#555555'};
      width: 24px;
      height: 24px;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s ease;
    }
    
    .size-button.active {
      background: ${isDarkMode ? '#3B82F6' : '#2563EB'};
      color: white;
    }
    
    .size-button:hover:not(.active) {
      background: ${isDarkMode ? '#444' : '#ddd'};
    }
    
    .toggle-theme, .close-button {
      background: transparent;
      border: none;
      color: ${isDarkMode ? '#B0B0B0' : '#555555'};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      transition: all 0.2s ease;
    }
    
    .toggle-theme:hover, .close-button:hover {
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      transform: scale(1.1);
    }
    
    .close-button {
      font-size: 20px;
      font-weight: bold;
    }
    
    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      position: relative;
      padding-bottom: 120px; /* גובה מספק לחשיפת ההודעה האחרונה במלואה */
      background-color: var(--bg-color-dark);
      display: flex;
      flex-direction: column;
    }
    
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 30px; /* מרווח נוסף בתחתית */
    }
    
    .welcome-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px 16px;
      color: ${isDarkMode ? '#CCCCCC' : '#555555'};
    }
    
    .welcome-icon {
      margin-bottom: 16px;
      color: ${isDarkMode ? '#B0B0B0' : '#555555'};
    }
    
    .welcome-message h3 {
      margin: 0 0 8px 0;
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      font-weight: 500;
    }
    
    .welcome-message p {
      margin: 0;
      font-size: 14px;
    }
    
    .message {
      padding: 8px 12px;
      border-radius: 12px;
      max-width: 80%;
      line-height: 1.5;
      white-space: pre-line;
    }
    
    .message.user {
      align-self: flex-end;
      background-color: ${isDarkMode ? '#3B82F6' : '#E0F2FE'};
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      margin-left: auto;
    }
    
    .message.ai {
      align-self: flex-start;
      background-color: ${isDarkMode ? '#1E1E1E' : '#FFFFFF'};
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      margin-right: auto;
    }
    
    .panel-footer {
      padding: 10px 12px;
      border-top: 1px solid ${isDarkMode ? '#333333' : '#E0E0E0'};
      display: flex;
      align-items: center;
      gap: 8px;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: ${isDarkMode ? '#1E1E1E' : '#F7F9FC'};
      z-index: 2;
      box-sizing: border-box;
      transition: all 0.3s ease;
      height: auto; /* Ensure height is calculated based on content */
      min-height: 60px; /* Minimum height for the footer */
    }
    
    #user-input {
      flex-grow: 1;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid ${isDarkMode ? '#444' : '#ddd'};
      background-color: ${isDarkMode ? '#2C2C2C' : '#FFFFFF'};
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      resize: none;
      font-family: inherit;
      font-size: 14px;
      min-height: 20px;
      max-height: 120px;
      transition: all 0.2s ease;
    }
    
    #user-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
      border-color: ${isDarkMode ? '#3B82F6' : '#2563EB'};
    }
    
    #user-input::placeholder {
      color: ${isDarkMode ? '#888888' : '#999999'};
    }
    
    #send-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: none;
      background-color: ${isDarkMode ? '#3B82F6' : '#2563EB'};
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    #send-button:hover:not(:disabled) {
      transform: scale(1.05);
      background-color: ${isDarkMode ? '#2563EB' : '#1D4ED8'};
    }
    
    #send-button:disabled {
      background-color: ${isDarkMode ? '#444' : '#ddd'};
      color: ${isDarkMode ? '#888' : '#aaa'};
      cursor: not-allowed;
    }
    
    .loading-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background-color: ${isDarkMode ? '#1E1E1E' : '#FFFFFF'};
      color: ${isDarkMode ? '#FFFFFF' : '#222222'};
      align-self: flex-start;
      max-width: 80%;
    }
    
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(${isDarkMode ? '255,255,255,0.1' : '0,0,0,0.1'});
      border-top-color: ${isDarkMode ? '#3B82F6' : '#2563EB'};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  panel.appendChild(styleSheet);
  
  // Set event handlers
  
  // 1. Make the panel draggable
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  const header = panel.querySelector('.panel-header') as HTMLElement;
  
  if (header) {
    header.addEventListener('mousedown', (e) => {
      // Only initiate drag if not clicking on a control
      if (!(e.target as HTMLElement).closest('button')) {
        isDragging = true;
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
      }
    });
  }
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top = (e.clientY - offsetY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    ensurePanelInViewport();
  });
  
  // 2. Theme toggling
  const themeToggle = panel.querySelector('.toggle-theme');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      panel.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
      updateThemeStyles();
    });
  }
  
  // 3. Size controls
  const sizeButtons = panel.querySelectorAll('.size-button');
  sizeButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('size-small')) {
        updateSize('small');
      } else if (button.classList.contains('size-medium')) {
        updateSize('medium');
      } else if (button.classList.contains('size-large')) {
        updateSize('large');
      }
      
      // Update active state for buttons
      sizeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
  
  // 4. Close button handler
  const closeButton = panel.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      panel.style.display = 'none';
      const event = new CustomEvent('geminiPanelClosed');
      document.dispatchEvent(event);
    });
  }
  
  // 5. Text input handling
  const textInput = panel.querySelector('#user-input') as HTMLTextAreaElement;
  const sendButton = panel.querySelector('#send-button') as HTMLButtonElement;
  
  if (textInput && sendButton) {
    // Enable/disable send button based on input
    textInput.addEventListener('input', () => {
      sendButton.disabled = textInput.value.trim() === '';
      adjustTextareaHeight(textInput);
    });
    
    // Auto-adjust height of textarea
    function adjustTextareaHeight(textarea: HTMLTextAreaElement) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    // Handle sending message
    sendButton.addEventListener('click', sendMessage);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Function to handle sending messages
  async function sendMessage() {
    if (!textInput || textInput.value.trim() === '') return;
    
    // בדיקת אימות לפני שליחת הודעה לג'מיני
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      console.log('WordStream Gemini: Chat blocked - user not authenticated');
      addMessage('Authentication required to use WordStream Gemini Chat. Please sign in to continue.', 'ai');
      return;
    }
    
    const userMessage = textInput.value.trim();
    textInput.value = '';
    textInput.style.height = 'auto';
    sendButton.disabled = true;
    
    // Add user message to UI
    addMessage(userMessage, 'user');
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="spinner"></div>
      <div>Processing...</div>
    `;
    const messagesContainer = panel.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.appendChild(loadingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    try {
      // Get video information
      const videoId = getVideoId();
      const videoTitle = document.title;
      
      // Call to Gemini API via background script
      const response = await chrome.runtime.sendMessage({
        action: 'gemini',
        message: userMessage,
        videoId,
        videoTitle
      });
      
      // Remove loading indicator
      if (messagesContainer && loadingIndicator.parentNode === messagesContainer) {
        messagesContainer.removeChild(loadingIndicator);
      }
      
      if (response && response.success) {
        addMessage(response.answer, 'ai');
      } else {
        throw new Error(response?.error || 'Failed to get response');
      }
  } catch (error) {
      console.error('Error sending message to Gemini:', error);
      
      // Remove loading indicator
      if (messagesContainer && loadingIndicator.parentNode === messagesContainer) {
        messagesContainer.removeChild(loadingIndicator);
      }
      
      // Show error message
      addMessage('Sorry, there was an error processing your request. Please try again.', 'ai');
    }
  }
  
  // Helper function to save chats in the unified format for SavedChats
  function saveChatForUnifiedStorage(userMessage: string, aiResponse: string, videoId: string, videoTitle: string) {
    try {
      console.log('WordStream: Saving chat conversation to unified storage');
      
      // Create chat data
      const chatData = {
        conversationId: `${videoId}-${Date.now()}`,
        videoId: videoId,
        videoTitle: videoTitle,
        videoURL: window.location.href,
        lastUpdated: new Date().toISOString(),
        messages: [
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
          },
          {
            id: `ai-${Date.now() + 1}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      // במקום לייבא דינמית את FirestoreService, השתמש ב-BackgroundMessaging
      BackgroundMessaging.saveChat(chatData)
        .then(chatId => {
          console.log('WordStream: Chat saved to Firestore with ID:', chatId);
        })
        .catch(error => {
          console.error('WordStream: Error saving chat to Firestore:', error);
        });
      
      // Also save locally as a backup
      try {
        chrome.storage.local.get(['chats_history'], result => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Error accessing local chat history:', chrome.runtime.lastError);
            return;
          }
          
          const chatsHistory = result.chats_history || [];
          chatsHistory.unshift(chatData); // Add new chat to the beginning
          
          // Only keep the 100 most recent chats
          const limitedHistory = chatsHistory.slice(0, 100);
          
          chrome.storage.local.set({ chats_history: limitedHistory }, () => {
            if (chrome.runtime.lastError) {
              console.error('WordStream: Error saving chat to local history:', chrome.runtime.lastError);
            } else {
              console.log('WordStream: Chat saved to local history');
            }
          });
        });
      } catch (localStorageError) {
        console.error('WordStream: Error saving chat to local storage:', localStorageError);
      }
    } catch (error) {
      console.error('WordStream: Error in saveChatForUnifiedStorage:', error);
    }
  }
  
  // Function to add a message to the UI
  function addMessage(content: string, type: 'user' | 'ai') {
    // Create message element
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = content;
    
    // Add to container
    const welcomeMessage = panel.querySelector('.welcome-message');
    const messagesContainer = panel.querySelector('.messages-container');
    
    if (messagesContainer) {
      // Remove welcome message if this is the first message
      if (welcomeMessage && welcomeMessage.parentNode === messagesContainer) {
        messagesContainer.removeChild(welcomeMessage);
      }
      
      messagesContainer.appendChild(message);
      
      // Use the dedicated scroll function with enhanced features
      const extraOffset = 50;
      
      // הוספת השהייה ראשונית קצרה לאפשר לתוכן להתרנדר
      setTimeout(() => {
        // גלילה למטה עם אופסט נוסף
        messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
        
        const panelContent = panel.querySelector('.panel-content');
        if (panelContent) {
          panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
        }
        
        // בדיקה שנייה עם השהייה ארוכה יותר
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
          
          if (panelContent) {
            panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
          }
          
          // בדיקה שלישית עם השהייה ארוכה מאוד
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
            
            if (panelContent) {
              panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
            }
            
            // בדיקה רביעית (סופית) עם השהייה ארוכה במיוחד
            setTimeout(() => {
              messagesContainer.scrollTop = messagesContainer.scrollHeight + extraOffset;
              
              if (panelContent) {
                panelContent.scrollTop = panelContent.scrollHeight + extraOffset;
              }
            }, 300);
          }, 300);
        }, 200);
      }, 50);
    }
  }
  
  // Helper function to scroll to the latest message
  function scrollToLatestMessage() {
    const messagesContainer = panel.querySelector('.messages-container');
    const panelContent = panel.querySelector('.panel-content');
    
    if (messagesContainer) {
      // גלילה מיידית
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      if (panelContent) {
        panelContent.scrollTop = panelContent.scrollHeight;
      }
      
      // גלילה שנייה לאחר השהייה קצרה לתת לתוכן להתרנדר
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (panelContent) {
          panelContent.scrollTop = panelContent.scrollHeight;
        }
      }, 100);
    }
  }
  
  // Function to update the size of the panel
  function updateSize(size: 'small' | 'medium' | 'large') {
    currentSize = size;
    panel.style.width = `${SIZES[size].width}px`;
    panel.style.height = `${SIZES[size].height}px`;
    ensurePanelInViewport();
  }
  
  // Function to update theme-related styles
  function updateThemeStyles() {
    // This would be better with CSS variables, but for simplicity we'll update the inline styles
    const header = panel.querySelector('.panel-header') as HTMLElement;
    const content = panel.querySelector('.panel-content') as HTMLElement;
    const footer = panel.querySelector('.panel-footer') as HTMLElement;
    const input = panel.querySelector('#user-input') as HTMLTextAreaElement;
    
    if (header && content && footer && input) {
      // Update base panel styles
      panel.style.backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
      panel.style.border = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      
      // Update header styles
      header.style.borderBottom = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      header.style.backgroundColor = isDarkMode ? '#1E1E1E' : '#F0F2F5';
      
      // Update header title
      const title = header.querySelector('h3');
      if (title) {
        title.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      }
      
      // Update content area
      content.style.backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
      content.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      
      // Update footer
      footer.style.borderTop = `1px solid ${isDarkMode ? '#333333' : '#E0E0E0'}`;
      footer.style.backgroundColor = isDarkMode ? '#1E1E1E' : '#F0F2F5';
      
      // Update input
      input.style.borderColor = isDarkMode ? '#444' : '#ddd';
      input.style.backgroundColor = isDarkMode ? '#2D2D2D' : '#FFFFFF';
      input.style.color = isDarkMode ? '#FFFFFF' : '#050505';
      
      // Update all AI messages - improved background for better contrast
      const aiMessages = panel.querySelectorAll('.message.ai');
      aiMessages.forEach(msg => {
        (msg as HTMLElement).style.backgroundColor = isDarkMode ? '#2a2a30' : '#eff1f5';
        (msg as HTMLElement).style.color = isDarkMode ? '#e8e8e8' : '#333333';
        (msg as HTMLElement).style.border = `1px solid ${isDarkMode ? '#444444' : '#e0e0e0'}`;
      });
      
      // Update all user messages - use stronger blue for better contrast
      const userMessages = panel.querySelectorAll('.message.user');
      userMessages.forEach(msg => {
        (msg as HTMLElement).style.backgroundColor = isDarkMode ? '#4c6ef5' : '#4b8df8';
        (msg as HTMLElement).style.color = '#FFFFFF';
        (msg as HTMLElement).style.border = 'none';
      });
      
      // Update size buttons for better contrast in light mode
      const sizeButtons = panel.querySelectorAll('.size-button:not(.active)');
      sizeButtons.forEach(btn => {
        (btn as HTMLElement).style.backgroundColor = isDarkMode ? '#333' : '#e8e8e8';
        (btn as HTMLElement).style.color = isDarkMode ? '#ccc' : '#555';
      });
      
      // Update theme toggle icon
      const themeToggle = panel.querySelector('.toggle-theme');
      if (themeToggle) {
        // עיצוב מינימליסטי ברור לכפתור החלפת התאורה
        (themeToggle as HTMLElement).style.background = 'transparent';
        (themeToggle as HTMLElement).style.border = 'none';
        (themeToggle as HTMLElement).style.borderRadius = '50%';
        (themeToggle as HTMLElement).style.padding = '6px';
        (themeToggle as HTMLElement).style.color = isDarkMode ? '#ffd700' : '#7c3aed';
        (themeToggle as HTMLElement).style.boxShadow = 'none';
        (themeToggle as HTMLElement).style.display = 'flex';
        (themeToggle as HTMLElement).style.alignItems = 'center';
        (themeToggle as HTMLElement).style.justifyContent = 'center';
        (themeToggle as HTMLElement).style.gap = '0';
        (themeToggle as HTMLElement).style.width = '32px';
        (themeToggle as HTMLElement).style.height = '32px';
        (themeToggle as HTMLElement).title = isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
        
        // רק אייקון גדול וברור, ללא טקסט
        themeToggle.innerHTML = isDarkMode ? 
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>' : 
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
      }
    }
  }
  
  // Function to help get video ID
  function getVideoId(): string {
    const url = window.location.href;
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v') || '';
  }
  
  // Function to make sure panel stays within viewport
  function ensurePanelInViewport() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelRect = panel.getBoundingClientRect();
    
    // Check right edge
    if (panelRect.right > viewportWidth) {
      panel.style.left = (viewportWidth - panelRect.width) + 'px';
    }
    
    // Check bottom edge
    if (panelRect.bottom > viewportHeight) {
      panel.style.top = (viewportHeight - panelRect.height) + 'px';
    }
    
    // Check left edge
    if (panelRect.left < 0) {
      panel.style.left = '0px';
    }
    
    // Check top edge
    if (panelRect.top < 0) {
      panel.style.top = '0px';
    }
  }
  
  // Add window resize handler to keep panel in viewport
  window.addEventListener('resize', ensurePanelInViewport);
  
  return panel;
}

function createNotesPanel() {
  // Create main panel element
  const panel = document.createElement('div');
  panel.className = 'wordstream-panel notes-panel medium';
  panel.id = 'wordstream-notes-panel';
  
  // Panel sizes
  const PANEL_SIZES = {
    small: { width: '350px', height: '500px' },
    medium: { width: '480px', height: '400px' },
    large: { width: '640px', height: '600px' }
  };
  
  // Dark mode detection
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    panel.classList.add('dark-mode');
  } else {
    panel.classList.add('light-mode');
  }
  
  // Set initial position and size
  panel.style.position = 'fixed';
  panel.style.width = '480px';
  panel.style.height = '550px';
  panel.style.top = '80px';
  panel.style.left = '20px';
  panel.style.zIndex = '9999999';
  panel.style.backgroundColor = isDarkMode ? '#121212' : '#F7F8FA';
  panel.style.color = isDarkMode ? '#ffffff' : '#333333';
  panel.style.border = `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`;
  panel.style.borderRadius = '12px';
  panel.style.overflow = 'hidden';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  panel.style.fontFamily = 'Inter, Roboto, Arial, sans-serif';
  panel.style.transition = 'width 0.3s, height 0.3s';
  panel.style.resize = 'both'; // Allow resizing
  panel.style.maxWidth = '90vw';
  panel.style.maxHeight = '90vh';
  panel.style.minWidth = '250px';
  panel.style.minHeight = '200px';
  
  // חלק חדש: פיתרון ישיר לבעיית הפס השחור
  // קוד זה מבטיח שה-panel-footer יקבל את הצבע הנכון גם במצב בהיר
  const applyFooterStyle = () => {
    setTimeout(() => {
      const footer = panel.querySelector('.panel-footer');
      if (footer && !isDarkMode) {
        (footer as HTMLElement).style.backgroundColor = '#F0F2F7';
      }
    }, 100);
  };
  
  // HTML structure
  panel.innerHTML = `
    <style>
      :root {
        --bg-color-light: #F7F8FA;
        --text-color-light: #222222;
        --border-color-light: #D9D9D9;
        --header-bg-light: #F0F2F7;
        --footer-bg-light: #F0F2F7;
        --button-primary-light: #2563eb;
        --button-hover-light: #1d4ed8;
        --button-text-light: #ffffff;
        --input-border-light: #D9D9D9;
        --secondary-bg-light: #F0F2F7;
        --note-bg-light: #FFFFFF;
        --text-dark-light: #222222;
        --text-muted-light: #444444;
        --font-family: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        --font-size-normal: 15px;
        --font-weight-normal: 400;
        
        --bg-color-dark: #121212;
        --text-color-dark: #ffffff;
        --border-color-dark: #333333;
        --header-bg-dark: #1e1e1e;
        --footer-bg-dark: #1e1e1e;
        --button-primary-dark: #3b82f6;
        --button-hover-dark: #2563eb;
        --button-text-dark: #ffffff;
        --input-border-dark: #444;
        --secondary-bg-dark: #1e1e1e;
      }
      
      .notes-panel.dark-mode {
        background-color: var(--bg-color-dark);
        color: var(--text-color-dark);
        border-color: var(--border-color-dark);
      }
      
      .notes-panel.light-mode {
        background-color: var(--bg-color-light);
        color: var(--text-color-light);
        border-color: var(--border-color-light);
      }
      
      .notes-panel * {
        font-family: var(--font-family);
        font-size: var(--font-size-normal);
        font-weight: var(--font-weight-normal);
      }
      
      .panel-header {
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border-color-light);
        cursor: move;
        user-select: none;
        font-weight: 600;
        font-size: 16px;
      }
      
      .dark-mode .panel-header {
        background-color: var(--header-bg-dark);
        border-bottom-color: var(--border-color-dark);
        color: var(--text-color-dark);
      }
      
      .light-mode .panel-header {
        background-color: var(--header-bg-light);
        border-bottom-color: var(--border-color-light);
        color: var(--text-dark-light);
      }
      
      .size-controls {
        display: flex;
        border: 1px solid var(--input-border-light);
        border-radius: 4px;
        overflow: hidden;
      }
      
      .dark-mode .size-controls {
        border-color: var(--input-border-dark);
      }
      
      .size-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        font-size: 12px;
        border: none;
        background-color: transparent;
        cursor: pointer;
      }
      
      .size-button.active {
        background-color: var(--button-primary-light);
        color: var(--button-text-light);
        font-weight: bold;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
      }
      
      .dark-mode .size-button {
        color: #ccc;
        background-color: #333;
      }
      
      .dark-mode .size-button.active {
        background-color: var(--button-primary-dark);
        color: var(--button-text-dark);
      }
      
      .light-mode .size-button {
        color: #666;
        background-color: #f0f0f0;
      }
      
      .light-mode .size-button.active {
        background-color: var(--button-primary-light);
        color: var(--button-text-light);
      }
      
      .close-button {
        background: transparent;
        border: none;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: inherit;
      }
      
      .header-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .theme-button {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        transition: all 0.2s ease;
      }
      
      .panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        position: relative;
        padding-bottom: 120px; /* גובה מספק לחשיפת ההודעה האחרונה במלואה */
        background-color: var(--bg-color-dark);
        display: flex;
        flex-direction: column;
      }
      
      .light-mode .panel-content {
        background-color: var(--bg-color-light);
      }
      
      .panel-content::-webkit-scrollbar {
        width: 6px;
      }
      
      .panel-content::-webkit-scrollbar-thumb {
        background-color: rgba(128, 128, 128, 0.5);
        border-radius: 4px;
      }
      
      .dark-mode .panel-content::-webkit-scrollbar-thumb {
        background-color: rgba(200, 200, 200, 0.3);
      }
      
      .panel-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border-color-dark);
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: var(--footer-bg-dark);
        z-index: 10; /* Ensure it's above content */
        height: auto; /* Ensure height is calculated based on content */
        min-height: 70px; /* Minimum height for the footer */
      }
      
      .light-mode .panel-footer {
        background-color: var(--footer-bg-light);
        border-top-color: var(--border-color-light);
      }
      
      .current-timestamp {
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .dark-mode .current-timestamp {
        color: #aaaaaa;
      }
      
      .light-mode .current-timestamp {
        color: #666666;
      }
      
      #note-input {
        resize: none;
        height: 60px;
        padding: 12px 16px;
        width: 100%;
        box-sizing: border-box;
        border-radius: 12px;
        border: 1px solid var(--input-border-dark);
        font-family: inherit;
        font-size: 14px;
        transition: border-color 0.2s;
      }
      
      #note-input:focus {
        outline: none;
        border-color: var(--button-primary-dark);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      .dark-mode #note-input:focus {
        border-color: var(--button-primary-dark);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      .dark-mode #note-input {
        background-color: #2d2d2d;
        color: #ffffff;
        border-color: var(--input-border-dark);
      }
      
      .light-mode #note-input {
        background-color: #ffffff;
        color: #333333;
        border-color: var(--input-border-light);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      
      #add-timestamp-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 12px;
        margin-left: auto;
        transition: background-color 0.2s, transform 0.1s;
      }
      
      .dark-mode #add-timestamp-button {
        background-color: #2d2d2d;
        color: #aaaaaa;
      }
      
      .light-mode #add-timestamp-button {
        background-color: #f0f0f0;
        color: #666666;
      }
      
      #add-timestamp-button:hover {
        background-color: var(--button-primary-light);
        color: white;
        transform: translateY(-1px);
      }
      
      .dark-mode #add-timestamp-button:hover {
        background-color: var(--button-primary-dark);
      }
      
      #save-note-button {
        padding: 8px 16px;
        background-color: var(--button-primary-dark);
        color: var(--button-text-dark);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        align-self: flex-end;
        transition: background-color 0.2s, transform 0.1s;
      }
      
      #save-note-button:hover {
        background-color: var(--button-hover-dark);
        transform: translateY(-1px);
      }
      
      .dark-mode #save-note-button {
        background-color: var(--button-primary-dark);
      }
      
      .light-mode #save-note-button {
        background-color: var(--button-primary-light);
        color: var(--button-text-light);
      }
      
      .dark-mode #save-note-button:hover {
        background-color: var(--button-hover-dark);
      }
      
      .light-mode #save-note-button:hover {
        background-color: var(--button-hover-light);
      }
      
      /* גלילה אוטומטית להודעה האחרונה */
      .notes-container {
        overflow-y: auto;
        max-height: calc(100% - 120px);
        padding-bottom: 120px; /* מונע שהודעות ייחתכו ע"י אזור הקלט */
      }
      
      /* תצוגה של הודעות ארוכות */
      .note-item {
        padding: 10px;
        overflow-wrap: break-word; 
        white-space: pre-wrap;
        word-wrap: break-word; 
      }
      
      .note-item .note-content {
        white-space: normal;
        word-break: break-word;
        overflow-wrap: break-word;
        max-width: 100%;
      }
      
      /* Adjusted container heights for different sizes */
      .notes-panel.small .notes-container {
        max-height: calc(100% - 150px); /* Adjust based on header/footer heights */
      }
      
      .notes-panel.medium .notes-container {
        max-height: calc(100% - 150px);
      }
      
      .notes-panel.large .notes-container {
        max-height: calc(100% - 150px);
      }
      
      .light-mode .notes-container {
        color: var(--text-dark-light);
        background-color: transparent; /* Explicitly transparent to adopt parent bg */
      }

      .dark-mode .notes-container {
        background-color: transparent;
      }
      
      .no-notes {
        text-align: center;
        padding: 40px 0;
        color: #888;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .dark-mode .no-notes {
        color: #aaa;
      }
      
      .light-mode .no-notes {
        color: #888;
      }
      
      .note-item {
        border: 1px solid var(--border-color-dark);
        border-radius: 8px;
        overflow: hidden;
      }
      
      .dark-mode .note-item {
        border-color: var(--border-color-dark);
        background-color: var(--bg-color-dark);
      }
      
      .light-mode .note-item {
        border-color: var(--border-color-light);
        background-color: var(--note-bg-light);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        color: var(--text-dark-light);
      }
      
      .note-header {
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--header-bg-dark);
        border-bottom: 1px solid var(--border-color-dark);
        font-size: 12px;
      }
      
      .dark-mode .note-header {
        background-color: var(--header-bg-dark);
        border-bottom-color: var(--border-color-dark);
      }
      
      .light-mode .note-header {
        background-color: var(--secondary-bg-light);
        border-bottom-color: var(--border-color-light);
        color: var(--text-dark-light);
      }
      
      .timestamp {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .dark-mode .timestamp {
        color: #aaaaaa;
      }
      
      .light-mode .timestamp {
        color: var(--text-muted-light);
      }
      
      .timestamp-icon {
        width: 14px;
        height: 14px;
      }
      
      .note-actions {
        display: flex;
        gap: 8px;
      }
      
      .jump-button, .delete-button {
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 4px;
        font-size: 12px;
        transition: color 0.2s, transform 0.1s;
      }
      
      .dark-mode .jump-button {
        color: #aaaaaa;
      }
      
      .light-mode .jump-button {
        color: var(--text-muted-light);
      }
      
      .jump-button:hover {
        transform: translateY(-1px);
      }
      
      .dark-mode .jump-button:hover {
        color: #ffffff;
      }
      
      .light-mode .jump-button:hover {
        color: var(--button-primary-light);
      }
      
      .delete-button {
        color: #ef4444;
      }
      
      .note-content {
        padding: 12px;
        white-space: pre-line;
      }
      
      .dark-mode .note-content {
        background-color: var(--bg-color-dark);
      }
      
      .light-mode .note-content {
        background-color: var(--note-bg-light);
        color: var(--text-dark-light);
      }
      
      .empty-notes-icon {
        margin-bottom: 16px;
      }
      
      .dark-mode .empty-notes-icon svg {
        stroke: #aaaaaa;
      }
      
      .light-mode .empty-notes-icon svg {
        stroke: #888888;
      }
      
      /* מדיה קוורי לגודל SMALL */
      .notes-panel.small .panel-header {
        padding: 8px 12px;
        font-size: 14px;
      }
      
      .notes-panel.small .panel-content {
        padding: 10px;
        padding-bottom: 110px;
      }
      
      .notes-panel.small .panel-footer {
        padding: 8px 12px;
      }
      
      .notes-panel.small #note-input {
        padding: 8px 12px;
        height: 50px;
        font-size: 13px;
      }
      
      .notes-panel.small .size-button {
        width: 20px;
        height: 20px;
      }
      
      .notes-panel.small .note-item {
        font-size: 13px;
      }
      
      .notes-panel.small .note-content {
        padding: 8px;
      }
      
      .notes-panel.small .note-header {
        padding: 6px 10px;
        font-size: 11px;
      }
      
      .notes-panel.small #save-note-button {
        padding: 6px 12px;
        font-size: 13px;
      }

      /* גדלים נוספים */
      .notes-panel.medium .panel-content {
        padding-bottom: 130px;
      }
      
      .notes-panel.large .panel-content {
        padding-bottom: 140px;
      }
      
      .notes-panel.large .panel-header {
        padding: 14px 20px;
        font-size: 18px;
      }
      
      .notes-panel.large #note-input {
        padding: 14px 20px;
        height: 70px;
        font-size: 15px;
      }
      
      /* Ensure smooth transition between dark and light */
      .notes-panel * {
        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
      }
      
      /* Additional explicit background colors for all internal containers */
      .light-mode .timestamp, 
      .light-mode .note-actions,
      .light-mode .jump-button {
        background-color: transparent;
      }
      
      .light-mode .note-header {
        background-color: var(--secondary-bg-light);
      }
      
      .light-mode .current-timestamp,
      .light-mode #add-timestamp-button {
        background-color: transparent;
      }

      /* אלמנטים נוספים שייתכן שצריכים תיקון במצב בהיר */
      .light-mode .no-notes,
      .light-mode .empty-notes-icon,
      .light-mode #notes-container {
        background-color: var(--bg-color-light);
      }

      /* כדי לוודא שאין פס שחור בכל מצב, נוסיף כלל גורף למצב בהיר */
      .light-mode.notes-panel *:not(.size-button, .size-button.active, #save-note-button, button.theme-button, .panel-header, .panel-footer, .note-header) {
        background-color: var(--bg-color-light);
      }

      /* תיקון שורשי של בעיית הפס השחור - מחיקת panel-footer מרשימת החריגים */
      .light-mode.notes-panel *:not(.size-button, .size-button.active, #save-note-button, button.theme-button, .panel-header, .note-header) {
        background-color: var(--bg-color-light);
      }
      
      /* כלל מפורש מאוד לפאנל פוטר ולכל התוכן שלו */
      .light-mode.notes-panel .panel-footer {
        background-color: var(--footer-bg-light) !important;
        border-top-color: var(--border-color-light) !important;
        color: var(--text-dark-light) !important;
      }
      
      /* נוודא שגם ב-HTML ישיר של panel-footer יש צבע רקע מפורש */
      .light-mode.notes-panel div.panel-footer {
        background-color: var(--footer-bg-light) !important;
      }
      
      /* פותר את הבעיה של כפתור התזמון ושל הערכים */
      .light-mode.notes-panel .panel-footer .current-timestamp {
        background-color: transparent !important;
        color: var(--text-muted-light) !important;
      }
      
      /* וידוא שאזור הטקסט מקבל רקע נכון */
      .light-mode.notes-panel .panel-footer #note-input {
        background-color: #FFFFFF !important;
        color: var(--text-dark-light) !important;
        border: 1px solid var(--border-color-light) !important;
      }
    </style>
    
    <div class="panel-header">
      <div>Notes & Summary</div>
      <div class="header-controls">
        <div class="size-controls">
          <button class="size-button" data-size="small">S</button>
          <button class="size-button active" data-size="medium">M</button>
          <button class="size-button" data-size="large">L</button>
        </div>
        <button class="theme-button">
          ${isDarkMode ? 
            `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>` : 
            `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>`
          }
        </button>
        <button class="close-button">✕</button>
      </div>
    </div>
    
    <div class="panel-content">
      <div class="notes-container" id="notes-container">
        <div class="no-notes">
          <div class="empty-notes-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3 style="margin-bottom: 8px; color: ${isDarkMode ? '#ffffff' : '#222222'}; font-family: var(--font-family); font-size: 16px; font-weight: 500;">Take notes while watching</h3>
          <p style="max-width: 280px; margin-bottom: 24px; font-size: 15px; color: ${isDarkMode ? '#aaaaaa' : '#555555'}; font-family: var(--font-family);">
            Add your notes below to capture important moments
          </p>
        </div>
      </div>
    </div>
    
    <div class="panel-footer">
      <div class="current-timestamp" id="current-timestamp">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Current time: <span id="timestamp-value">--:--</span>
        <button id="add-timestamp-button" style="
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 4px;
          border: none;
          background-color: ${isDarkMode ? '#2d2d2d' : '#F0F2F7'};
          color: ${isDarkMode ? '#aaaaaa' : '#444444'};
          cursor: pointer;
          font-size: 12px;
          margin-left: auto;
          transition: background-color 0.2s, color 0.2s, transform 0.1s;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v10l5 5"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
          Add timestamp
        </button>
      </div>
      
      <textarea id="note-input" placeholder="Write your note about this video..."></textarea>
      <button id="save-note-button">Save Note</button>
    </div>
  `;

  // Add to document
  document.body.appendChild(panel);
  
  // קריאה לפונקציה שפותרת את בעיית הפס השחור
  applyFooterStyle();
  
  // Create variables for dragging functionality
  let isDragging = false;
  let initialX: number = 0;
  let initialY: number = 0;
  let initialTop: number = 0;
  let initialLeft: number = 0;
  
  // פונקציה לעדכון כפתורי הגודל בהתאם למצב הנוכחי של הפאנל
  const updateSizeButtons = () => {
    const sizeButtons = panel.querySelectorAll('.size-button');
    const isDark = panel.classList.contains('dark-mode');
    
    sizeButtons.forEach(button => {
      if ((button as HTMLElement).classList.contains('active')) {
        (button as HTMLElement).style.backgroundColor = isDark ? '#3b82f6' : '#3b82f6';
        (button as HTMLElement).style.color = 'white';
      } else {
        (button as HTMLElement).style.backgroundColor = isDark ? '#333' : '#f0f0f0';
        (button as HTMLElement).style.color = isDark ? '#ccc' : '#666';
      }
    });
  };
  
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
  
  // Display functionality for notes
  function displayNotes(notes: any[]) {
    const notesContainer = panel.querySelector('#notes-container') as HTMLElement;
    if (!notesContainer) return;
    
    const wasEmpty = notesContainer.querySelector('.no-notes') !== null;
    
    if (notes.length === 0) {
      notesContainer.innerHTML = `
        <div class="no-notes">
          <div class="empty-notes-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3 style="margin-bottom: 8px; color: ${isDarkMode ? '#ffffff' : '#222222'}; font-family: var(--font-family); font-size: 16px; font-weight: 500;">Take notes while watching</h3>
          <p style="max-width: 280px; margin-bottom: 24px; font-size: 15px; color: ${isDarkMode ? '#aaaaaa' : '#555555'}; font-family: var(--font-family);">
            Add your notes below to capture important moments
          </p>
        </div>
      `;
      return;
    }
    
    // Display notes
    let notesHtml = '';
    notes.forEach((note, index) => {
      notesHtml += `
        <div class="note-item">
          <div class="note-header">
            <div class="timestamp">
              <svg class="timestamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${note.videoTime ? formatVideoTime(note.videoTime) : 'No timestamp'}</span>
            </div>
            <div class="note-actions">
              ${note.videoTime ? `
                <button class="jump-button" data-time="${note.videoTime}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Jump
                </button>
              ` : ''}
              <button class="delete-button" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="note-content">${note.content}</div>
        </div>
      `;
    });
    
    notesContainer.innerHTML = notesHtml;
    
    // Add event listeners for jump buttons
    const jumpButtons = notesContainer.querySelectorAll('.jump-button');
    jumpButtons.forEach(button => {
      button.addEventListener('click', function(this: HTMLElement) {
        const time = parseFloat(this.getAttribute('data-time') || '0');
        handleJumpToTime(time);
      });
    });
    
    // Add event listeners for delete buttons
    const deleteButtons = notesContainer.querySelectorAll('.delete-button');
    deleteButtons.forEach(button => {
      button.addEventListener('click', function(this: HTMLElement) {
        const index = parseInt(this.getAttribute('data-index') || '0');
        deleteNote(index);
      });
    });
    
    // Always scroll to bottom after adding notes - ensure with a short delay
    setTimeout(() => {
      notesContainer.scrollTop = notesContainer.scrollHeight;
    }, 50);
  }
  
  // Load saved notes
  function loadSavedNotes() {
    chrome.storage.local.get([`notes-${videoId}`], (result) => {
      const notes = result[`notes-${videoId}`] || [];
      displayNotes(notes);
      
      // גלילה אוטומטית להודעה האחרונה
      const notesContainer = panel.querySelector('#notes-container') as HTMLElement;
      if (notesContainer) {
        notesContainer.scrollTop = notesContainer.scrollHeight;
      }
      
      // Check if we need to migrate these notes to the new format
      if (notes.length > 0) {
        migrateNotesToNewFormat(notes);
      }
    });
  }
  
  // Function to migrate notes to the new format if needed
  function migrateNotesToNewFormat(notes: any[]) {
    chrome.storage.local.get(['notes_storage'], (result) => {
      const notesStorage = result.notes_storage || {};
      
      // Check if we already have this video in the new format
      if (!notesStorage[videoId] || !notesStorage[videoId].notes) {
        // Get video information
        const videoTitle = document.title.replace(' - YouTube', '').trim();
        const videoURL = window.location.href;
        
        // Create new entry for this video
        notesStorage[videoId] = {
          videoId,
          videoTitle,
          videoURL,
          lastUpdated: new Date().toISOString(),
          notes: notes.map(note => {
            // Make sure each note has formattedTime
            if (!note.formattedTime && note.videoTime) {
              note.formattedTime = formatVideoTime(note.videoTime);
            }
            return note;
          })
        };
        
        // Save back to storage
        chrome.storage.local.set({ notes_storage: notesStorage }, () => {
          console.log('[WordStream] Notes migrated to unified storage');
        });
      }
    });
  }
  
  // Format video time from seconds to MM:SS
  function formatVideoTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Delete note
  function deleteNote(index: number): void {
    chrome.storage.local.get([`notes-${videoId}`], (result) => {
      const notes = result[`notes-${videoId}`] || [];
      notes.splice(index, 1);
      
      chrome.storage.local.set({
        [`notes-${videoId}`]: notes
      }, () => {
        displayNotes(notes);
      });
    });
  }
  
  // Handle jump to time
  function handleJumpToTime(time: number) {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = time;
      videoElement.play().catch(() => {
        console.log('WordStream: Could not play video automatically');
      });
    }
  }
  
  // Update current timestamp
  let timestampInterval: any = null;
  function updateCurrentTimestamp() {
    const videoElement = document.querySelector('video');
    const timestampEl = panel.querySelector('#timestamp-value');
    
    if (videoElement && timestampEl) {
      const currentTime = videoElement.currentTime;
      timestampEl.textContent = formatVideoTime(currentTime);
    }
  }
  
  // Initialize timestamp update interval
  timestampInterval = setInterval(updateCurrentTimestamp, 1000);
  
  // Setup draggable functionality
  const header = panel.querySelector('.panel-header') as HTMLElement;
  if (header) {
    header.addEventListener('mousedown', (e) => {
      // Avoid dragging when clicking buttons in header
      if ((e.target as HTMLElement).closest('button')) return;
      
      isDragging = true;
      initialX = e.clientX;
      initialY = e.clientY;
      initialTop = parseInt(panel.style.top) || 0;
      initialLeft = parseInt(panel.style.left) || 0;
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - initialX;
        const dy = e.clientY - initialY;
        
        panel.style.top = `${initialTop + dy}px`;
        panel.style.left = `${initialLeft + dx}px`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
  
  // Setup size buttons
  const sizeButtons = panel.querySelectorAll('.size-button');
  sizeButtons.forEach(button => {
    button.addEventListener('click', function(this: HTMLElement) {
      const size = this.getAttribute('data-size') as keyof typeof PANEL_SIZES;
      if (size && PANEL_SIZES[size]) {
        // Update active button
        sizeButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Update panel size
        panel.style.width = PANEL_SIZES[size].width;
        panel.style.height = PANEL_SIZES[size].height;
        
        // Update class for styling
        panel.classList.remove('small', 'medium', 'large');
        panel.classList.add(size);
        
        // Apply matching styles to buttons
        updateSizeButtons();
      }
    });
  });
  
  // Handle theme button click
  const themeButton = panel.querySelector('.theme-button');
  if (themeButton) {
    // Update theme toggle appearance to match Gemini panel
    (themeButton as HTMLElement).style.background = 'transparent';
    (themeButton as HTMLElement).style.border = 'none';
    (themeButton as HTMLElement).style.borderRadius = '50%';
    (themeButton as HTMLElement).style.padding = '6px';
    (themeButton as HTMLElement).style.color = isDarkMode ? '#ffd700' : '#7c3aed';
    (themeButton as HTMLElement).style.boxShadow = 'none';
    (themeButton as HTMLElement).style.display = 'flex';
    (themeButton as HTMLElement).style.alignItems = 'center';
    (themeButton as HTMLElement).style.justifyContent = 'center';
    (themeButton as HTMLElement).style.gap = '0';
    (themeButton as HTMLElement).style.width = '32px';
    (themeButton as HTMLElement).style.height = '32px';
    (themeButton as HTMLElement).title = isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
    
    // Update icon to match Gemini panel
    themeButton.innerHTML = isDarkMode ? 
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>' : 
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
    
    themeButton.addEventListener('click', function() {
      // Toggle dark mode
      const isDarkMode = panel.classList.contains('dark-mode');
      if (isDarkMode) {
        panel.classList.remove('dark-mode');
        panel.classList.add('light-mode');
        panel.style.backgroundColor = '#F7F8FA';
        panel.style.color = '#333333';
        panel.style.border = '1px solid #e0e0e0';
        applyFooterStyle(); // פתרון לפס השחור כשעוברים למצב בהיר
        
        // עדכון כפתור בסגנון מינימליסטי
        (themeButton as HTMLElement).style.background = 'transparent';
        (themeButton as HTMLElement).style.border = 'none';
        (themeButton as HTMLElement).style.color = '#000000';
        (themeButton as HTMLElement).style.padding = '6px';
        (themeButton as HTMLElement).style.width = '32px';
        (themeButton as HTMLElement).style.height = '32px';
        (themeButton as HTMLElement).title = "Switch to Dark Mode";
        
        // אייקון ירח בלבד, ללא טקסט
        themeButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
                  } else {
        panel.classList.remove('light-mode');
        panel.classList.add('dark-mode');
        panel.style.backgroundColor = '#121212';
        panel.style.color = '#ffffff';
        panel.style.border = '1px solid #333333';
        applyFooterStyle();
        
        // עדכון כפתור בסגנון מינימליסטי
        (themeButton as HTMLElement).style.background = 'transparent';
        (themeButton as HTMLElement).style.border = 'none';
        (themeButton as HTMLElement).style.color = '#ffffff';
        (themeButton as HTMLElement).style.padding = '6px';
        (themeButton as HTMLElement).style.width = '32px';
        (themeButton as HTMLElement).style.height = '32px';
        (themeButton as HTMLElement).title = "Switch to Light Mode";
        
        // אייקון שמש בלבד, ללא טקסט
        themeButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
      }
      
      // עדכון כפתורי הגודל לאחר שינוי מצב
      updateSizeButtons();
    });
  }
  
  // Close button
  panel.querySelector('.close-button')?.addEventListener('click', () => {
    panel.style.display = 'none';
    if (timestampInterval) {
      clearInterval(timestampInterval);
      timestampInterval = null;
    }
  });
  
  // Add timestamp button
  const addTimestampButton = panel.querySelector('#add-timestamp-button');
  const noteInput = panel.querySelector('#note-input') as HTMLTextAreaElement;
  
  if (addTimestampButton && noteInput) {
    addTimestampButton.addEventListener('click', () => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        const currentTime = videoElement.currentTime;
        const timeFormatted = formatVideoTime(currentTime);
        noteInput.value += (noteInput.value ? '\n' : '') + `[${timeFormatted}] `;
        noteInput.focus();
      }
    });
  }
  
  // Save note button
  const saveButton = panel.querySelector('#save-note-button');
  if (saveButton && noteInput) {
    saveButton.addEventListener('click', () => {
      const content = noteInput.value.trim();
      if (!content) return;
      
      const videoElement = document.querySelector('video');
      const videoTime = videoElement ? videoElement.currentTime : undefined;
      const formattedTime = videoTime ? formatVideoTime(videoTime) : undefined;
      
      const newNote = {
        id: Date.now().toString(),
        content,
        timestamp: new Date().toISOString(),
        videoTime,
        formattedTime
      };
      
      // Save in the old format for backward compatibility
      chrome.storage.local.get([`notes-${videoId}`], (result) => {
        const notes = result[`notes-${videoId}`] || [];
        notes.push(newNote);
        
        chrome.storage.local.set({
          [`notes-${videoId}`]: notes
        }, () => {
          noteInput.value = '';
          displayNotes(notes);
          
          // גלילה אוטומטית להודעה האחרונה
          const notesContainer = panel.querySelector('#notes-container') as HTMLElement;
          if (notesContainer) {
            notesContainer.scrollTop = notesContainer.scrollHeight;
          }
          
          // Also save in the new format for Notes & Summaries feature
          saveNoteForSummaries(newNote);
        });
      });
    });
  }
  
  // Helper function to save notes in the new format for Notes & Summaries
  function saveNoteForSummaries(note: any) {
    try {
      console.log('WordStream: Saving note to summaries:', note);
      
      // במקום לייבא דינמית, השתמש בפונקציה מהמודול של BackgroundMessaging
      BackgroundMessaging.saveNote(note)
        .then(noteId => {
          console.log('WordStream: Note saved to Firestore with ID:', noteId);
        })
        .catch(error => {
          console.error('WordStream: Error saving note to Firestore:', error);
        });
    } catch (error) {
      console.error('WordStream: Error saving note for summaries:', error);
    }
  }

  // Helper function to save to local storage only
  function saveToLocalStorageOnly(note: any) {
    chrome.storage.local.get(['notes_storage'], (result) => {
      try {
        const notesStorage = result.notes_storage || {};
        
        // Check if we already have notes for this video
        if (!notesStorage[videoId]) {
          // Create new entry for this video
          notesStorage[videoId] = {
            videoId,
            videoTitle: note.videoTitle || document.title.replace(' - YouTube', '').trim(),
            videoURL: note.videoURL || window.location.href,
            lastUpdated: new Date().toISOString(),
            notes: []
          };
        }
        
        // Update the last updated timestamp
        notesStorage[videoId].lastUpdated = new Date().toISOString();
        
        // Add the new note
        notesStorage[videoId].notes.push(note);
        
        // Save back to storage
        chrome.storage.local.set({ notes_storage: notesStorage }, () => {
          console.log('[WordStream] Note saved to local storage');
        });
      } catch (storageError) {
        console.error('[WordStream] Error saving note to local storage:', storageError);
      }
    });
  }

  // Initial load of saved notes
  loadSavedNotes();
  
  return panel;
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('[WordStream] DOM loaded, initializing extension');
  
  // Start the caption detection
  startDetection();
  
  // Add direct floating controls
  setTimeout(addDirectFloatingControls, 1000);
  
  // Watch for URL changes (for SPA navigation)
  const currentUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== currentUrl) {
      console.log('[WordStream] URL changed, initializing for new page');
      // Restart caption detection
      startDetection();
      // Re-add controls
      setTimeout(addDirectFloatingControls, 1000);
    }
  }).observe(document, {subtree: true, childList: true});
});

// Also add controls when the window finishes loading
window.addEventListener('load', () => {
  console.log('[WordStream] Window loaded, initializing extension');
  // Ensure detection is running
  startDetection();
  // Add controls
  setTimeout(addDirectFloatingControls, 2000);
});

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