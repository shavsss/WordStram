/**
 * WordStream Content Script
 * 
 * This script is injected into video pages to detect and process captions.
 * It handles word translation and interaction with the background script.
 */

import { MessageType } from '../shared/message-types';
import messageBus from '../shared/message-bus';
import { getCaptionDetector } from './detectors';
import { showTranslationPopup } from './ui/translation-popup';

// Add this interface near the top of the file with other interfaces
interface VideoData {
  title: string;
  url: string;
  channelName: string;
  description: string;
  [key: string]: string | undefined;
}

// Add auth state to the state object
interface State {
  isInitialized: boolean;
  messageHandlersRegistered: boolean;
  hasFoundCaptions: boolean;
  captionDetector: any;
  detectionInterval: NodeJS.Timeout | null;
  lastDetectionTime: number;
  detectionAttempts: number;
  settings: {
    enableTranslation: boolean;
    showHighlights: boolean;
    targetLanguage: string;
    highlightColor: string;
    autoSave: boolean;
  };
  videoContext: {
    url: string;
    title: string;
    pageType: 'youtube' | 'netflix' | 'other' | null;
    description?: string;
    channelName?: string;
  };
  isAuthenticated: boolean;
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  } | null;
  directMessageHandlers: Map<any, any>;
}

// Enhanced state object with auth state
const state: State = {
  isInitialized: false,
  messageHandlersRegistered: false,
  hasFoundCaptions: false,
  captionDetector: null,
  detectionInterval: null,
  lastDetectionTime: 0,
  detectionAttempts: 0,
  settings: {
    enableTranslation: true,
    showHighlights: true,
    targetLanguage: 'en',
    highlightColor: 'rgba(100, 181, 246, 0.3)',
    autoSave: false
  },
  videoContext: {
    url: window.location.href,
    title: document.title,
    pageType: null
  },
  isAuthenticated: false,
  user: null,
  directMessageHandlers: new Map()
};

// IMPORTANT: Register a direct message listener first to ensure we can handle messages
// even before full initialization
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if we have a handler for this message type
  if (message && message.type) {
    console.log(`WordStream: Received message ${message.type} via direct listener`);
    
    // For GET_VIDEO_CONTEXT messages, respond immediately
    if (message.type === MessageType.GET_VIDEO_CONTEXT) {
      sendResponse({
        success: true,
        data: state.videoContext
      });
      return true;
    }
    
    // For AUTH_STATE_CHANGED messages, update our state
    if (message.type === MessageType.AUTH_STATE_CHANGED) {
      state.isAuthenticated = message.payload?.user != null;
      console.log(`WordStream: Authentication state updated: ${state.isAuthenticated}`);
      sendResponse({ success: true });
      return true;
    }
    
    // Check if we have a registered handler
    const handler = state.directMessageHandlers.get(message.type);
    if (handler) {
      try {
        // Call the handler and wait for response
        Promise.resolve(handler(message, sender))
          .then(response => sendResponse(response))
          .catch(err => {
            console.error(`WordStream: Error in handler for ${message.type}:`, err);
            sendResponse({ success: false, error: err.message });
          });
        return true; // Indicate async response
      } catch (err) {
        console.error(`WordStream: Error in direct handler for ${message.type}:`, err);
        sendResponse({ success: false, error: 'Error processing message' });
        return true;
      }
    }
  }
  
  // Let other listeners handle it or respond with a default
  if (message && message.type && !state.isInitialized) {
    sendResponse({ success: false, error: 'Content script not fully initialized' });
    return true;
  }
  
  return false; // Let other listeners handle it
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM already loaded, initialize directly
  initialize();
}

/**
 * Initialize the content script
 */
export async function initialize() {
  if (state.isInitialized) {
    return;
  }

  console.log('WordStream: Content script initializing');

  // Check authentication state first
  await checkAuthState();

  // Set up DOM observer
  setupDOMObserver();

  // Register message handlers if not yet registered
  if (!state.messageHandlersRegistered) {
    registerMessageHandlers();
    state.messageHandlersRegistered = true;
  }

  // Set initialization flag
  state.isInitialized = true;
  console.log('WordStream: Content script initialized');
}

/**
 * Complete the initialization process after video page detection
 */
async function completeInitialization() {
  try {
    // Get settings from background
    const settingsResponse = await messageBus.sendMessage({
      type: MessageType.GET_SETTINGS,
      payload: {}
    });
    
    if (settingsResponse && settingsResponse.success) {
      state.settings = settingsResponse.settings;
      console.log('WordStream: Retrieved settings', state.settings);
    } else {
      console.warn('WordStream: Failed to get settings, using defaults');
      // Use default settings if we couldn't get them from background
      state.settings = {
        enableTranslation: true,
        showHighlights: true,
        targetLanguage: 'en',
        highlightColor: 'rgba(100, 181, 246, 0.3)',
        autoSave: false
      };
    }
    
    // Check authentication state
    try {
      const authResponse = await messageBus.sendMessage({
        type: MessageType.GET_AUTH_STATE,
        payload: {}
      });
      
      if (authResponse && authResponse.success) {
        state.isAuthenticated = authResponse.user != null;
        console.log(`WordStream: Authentication state: ${state.isAuthenticated}`);
      }
    } catch (authError) {
      console.warn('WordStream: Failed to get auth state:', authError);
    }
    
    // Notify background script that content script is ready
    try {
      await messageBus.sendMessage({
        type: MessageType.CONTENT_SCRIPT_READY,
        payload: {
          url: window.location.href,
          videoFound: true
        }
      });
    } catch (msgError) {
      console.warn('WordStream: Could not notify background of ready state:', msgError);
    }
    
    // Start caption detection
    startCaptionDetection();
    
    // Add DOM observation for late-loaded videos
    observeDOM();
    
    // Initialize pop-up styles
    initializeStyles();
    
    // Mark as initialized
    state.isInitialized = true;
    
    console.log('WordStream: Content script initialized successfully');
  } catch (error) {
    console.error('WordStream: Error completing initialization:', error);
  }
}

/**
 * Start caption detection process
 */
function startCaptionDetection() {
  // Clear any existing interval
  if (state.detectionInterval) {
    clearInterval(state.detectionInterval);
  }
  
  // Create a new detector
  state.captionDetector = getCaptionDetector();
  console.log(`WordStream: Using caption detector for ${state.captionDetector.source}`);
  
  // Try detecting captions immediately
  detectCaptions();
  
  // Set up interval to try again if needed
  state.detectionInterval = setInterval(() => {
    // Only try if no successful detection in last 5 seconds
    const now = Date.now();
    if (now - state.lastDetectionTime > 5000) {
      detectCaptions();
    }
    
    // After 15 attempts (roughly 30 seconds), slow down the attempts
    if (state.detectionAttempts > 15) {
      if (state.detectionInterval) {
        clearInterval(state.detectionInterval);
        // Try less frequently (every 10 seconds)
        state.detectionInterval = setInterval(detectCaptions, 10000);
      }
    }
  }, 2000);
}

/**
 * Detect captions using the appropriate detector
 */
async function detectCaptions() {
  try {
    state.detectionAttempts++;
    
    // Skip detection if document is hidden (tab in background)
    if (document.hidden) {
      return;
    }

    if (!state.captionDetector) {
      console.error('WordStream: No caption detector available');
          return;
        }
        
    const captionElement = await state.captionDetector.detect();
    
    if (captionElement) {
      state.lastDetectionTime = Date.now();
      console.log('WordStream: Caption detection was successful');
      
      // Process the caption element
      state.captionDetector.processCaption(captionElement);
      
      // If we've found captions, reduce detection frequency
      if (state.detectionInterval) {
        clearInterval(state.detectionInterval);
        // Check occasionally for new captions (every 10 seconds)
        state.detectionInterval = setInterval(detectCaptions, 10000);
      }
      
      // Track the caption detection event
      messageBus.sendMessage({
        type: MessageType.CONTENT_SCRIPT_READY,
        payload: {
          captionsDetected: true,
          source: state.captionDetector.source,
          url: window.location.href
        }
      }).catch(err => {
        console.error('WordStream: Error reporting caption detection:', err);
      });
      
      return true;
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
  }
  
  return false;
}

/**
 * Check if we're on a page that might have videos
 */
function isVideoPage(): boolean {
  // Check for video-specific URLs first (faster than DOM checks)
  const url = window.location.href;
  if (
    // תבניות YouTube סטנדרטיות
    url.includes('youtube.com/watch') || 
    // תבניות קצרות של YouTube
    url.includes('youtube.com/shorts') ||
    // תבניות מוטמעות של YouTube (לפעמים בדומיינים אחרים)
    url.includes('youtube.com/embed') ||
    // הזרמה ישירה של YouTube
    url.includes('youtube.com/live') ||
    // נטפליקס (ודא שמתאים לתבנית URL של נטפליקס)
    url.includes('netflix.com/watch') ||
    // דפי וידאו גנריים
    url.includes('vimeo.com') ||
    url.includes('/video/') ||
    url.includes('/watch/') ||
    url.includes('music.youtube.com')
  ) {
    console.log('WordStream: Valid video page detected by URL:', url);
    return true;
  }
  
  // Check for YouTube-specific player elements
  if (
    document.querySelector('#movie_player') ||
    document.querySelector('.html5-video-player') ||
    document.querySelector('.ytp-cued-thumbnail-overlay')
  ) {
    console.log('WordStream: YouTube player elements detected');
    return true;
  }

  // Get all videos on the page and check for valid ones
  const videos = document.querySelectorAll('video');
  if (videos.length > 0) {
    // Check for visible videos with content
    for (const video of Array.from(videos)) {
      // נבדוק האם הוידאו גדול מספיק להיות משמעותי
      const rect = video.getBoundingClientRect();
      const isVisible = (rect.width > 200 && rect.height > 100) || 
                        (video.offsetWidth > 200 && video.offsetHeight > 100);
      
      if (isVisible && (video.duration > 0 || video.src || video.querySelector('source'))) {
        console.log('WordStream: Valid video element detected');
        return true;
      }
    }
  }
  
  // Check for common video page elements
  const videoElementSelectors = [
    'video-player',
    'player-container',
    'video-container',
    'media-player',
    'ytp-player-content',
    'watch-video--player-view',
    'html5-video-container',
    '.video-stream',
    '.player'
  ];
  
  for (const selector of videoElementSelectors) {
    if (document.querySelector(`.${selector}`) || document.getElementById(selector)) {
      console.log('WordStream: Video container element detected');
      return true;
    }
  }
  
  console.log('WordStream: Not a video page - no matching URL pattern or video element found');
  return false;
}

/**
 * Observe DOM changes to detect videos added after page load
 * with optimized performance for dynamic content
 */
function observeDOM() {
  // Configuration for observation
  const config = {
    videoCheckInterval: 500,     // Milliseconds between checks for new video elements
    maxObservationTime: 300000,  // Maximum time to observe (5 minutes)
    throttleDelay: 100,          // Delay for throttling mutation processing
    videoSelectors: [
      'video',                   // Standard video element
      '.video-player video',     // Common video player containers
      '.player-container video',
      '#movie_player video',
      '.html5-video-player video'
    ]
  };
  
  let lastProcessTime = 0;
  let startObservationTime = Date.now();
  let activeVideoElements = new Set<HTMLVideoElement>();
  let pendingCheck = false;
  let observer: MutationObserver | null = null;
  
  // Function to check for new videos with throttling
  const checkForNewVideos = () => {
    if (pendingCheck) return;
    
    const now = Date.now();
    if (now - lastProcessTime < config.throttleDelay) {
      // Throttle to avoid excessive processing
      pendingCheck = true;
    setTimeout(() => {
        pendingCheck = false;
        checkForNewVideos();
      }, config.throttleDelay);
      return;
    }
    
    lastProcessTime = now;
    
    // Check if we've been observing too long (for performance)
    if (now - startObservationTime > config.maxObservationTime) {
      if (observer) {
        console.log('WordStream: Stopping DOM observation after timeout');
        observer.disconnect();
        observer = null;
        
        // Set up a periodic check instead
        setInterval(detectNewVideos, config.videoCheckInterval);
      }
    return;
  }
  
    detectNewVideos();
  };
  
  // Function to find new videos and process them
  const detectNewVideos = () => {
    // Targeted search for video elements
    for (const selector of config.videoSelectors) {
      document.querySelectorAll(selector).forEach(video => {
        if (!(video instanceof HTMLVideoElement)) return;
        
        // Skip already processed videos
        if (activeVideoElements.has(video) || video.dataset.wordstreamProcessed) return;
        
        // Only process videos with some duration or source
        if ((video.duration > 0 || video.src || video.querySelector('source')) && video.offsetWidth > 0) {
          console.log('WordStream: New video element detected', video);
          
          // Mark as processed
          video.dataset.wordstreamProcessed = 'true';
          activeVideoElements.add(video);
          
          // Trigger caption detection
          setTimeout(detectCaptions, 1000);
        }
      });
    }
    
    // Clean up removed videos
    activeVideoElements.forEach(video => {
      if (!document.body.contains(video)) {
        activeVideoElements.delete(video);
      }
    });
  };
  
  // Create an optimized mutation observer
  observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;
    
    // Quick scan of mutations to see if any are relevant
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      // Check if added nodes include video elements or possible containers
      for (const node of Array.from(mutation.addedNodes)) {
        if (
          (node instanceof HTMLVideoElement) || 
          (node instanceof HTMLElement && (
            node.tagName === 'DIV' || 
            node.tagName === 'SECTION' || 
            node.querySelector('video')
          ))
        ) {
          hasRelevantChanges = true;
          break;
        }
      }
      
      if (hasRelevantChanges) break;
    }
    
    // Only process if we found relevant changes
    if (hasRelevantChanges) {
      checkForNewVideos();
    }
  });
  
  // Initialize by checking for videos first
  detectNewVideos();
  
  // Then start observing for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also add a periodic check as a fallback for video players that 
  // might load videos dynamically without DOM mutations
  const periodicChecker = setInterval(() => {
    if (!observer) {
      clearInterval(periodicChecker);
      return;
    }
    detectNewVideos();
  }, 5000); // Check every 5 seconds
}

/**
 * Initialize styles for translation popups
 */
function initializeStyles() {
  if (document.getElementById('wordstream-styles')) {
    return; // Styles already added
  }
  
  const style = document.createElement('style');
  style.id = 'wordstream-styles';
  style.textContent = `
    .wordstream-word {
      cursor: pointer;
      display: inline-block;
      border-radius: 3px;
      transition: background-color 0.2s;
    }
    
    .wordstream-word:hover {
      background-color: ${state.settings?.highlightColor || 'rgba(100, 181, 246, 0.3)'};
    }
    
    .wordstream-translation-popup {
      position: absolute;
      z-index: 999999;
      background: rgba(28, 28, 28, 0.95);
      color: white;
      padding: 12px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 300px;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .wordstream-popup-save {
      background: #64B5F6;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      margin-top: 8px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .wordstream-popup-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      position: absolute;
      top: 5px;
      right: 8px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Register message handlers from the background script
 */
function registerMessageHandlers() {
  // Handle requests to translate a word
  messageBus.registerHandler(MessageType.TRANSLATE_WORD_RESULT, async (message) => {
    if (message.payload && message.payload.originalWord && message.payload.translatedWord) {
      // This happens when the background script sends us a translation
      // We might want to update any UI with this translation
      console.log('WordStream: Received translation:', message.payload);
    }
    return { success: true };
  });
  
  // Handle requests to toggle translation feature
  messageBus.registerHandler(MessageType.SETTINGS_UPDATED, async (message) => {
    if (message.payload && message.payload.settings) {
      console.log('WordStream: Settings updated', message.payload.settings);
      
      // Update specific features based on settings
      if (state.settings) {
        state.settings = { ...state.settings, ...message.payload.settings };
        
        // Re-initialize styles with new settings
        initializeStyles();
      }
    }
    return { success: true };
  });
  
  // Another handler for direct setting changes (legacy support)
  messageBus.registerHandler(MessageType.SAVE_SETTINGS, async (message) => {
    if (message.payload && message.payload.settings) {
      console.log('WordStream: Updating settings', message.payload.settings);
      state.settings = { ...state.settings, ...message.payload.settings };
      
      // Re-initialize styles with new settings
      initializeStyles();
    }
    return { success: true };
  });
  
  // Handler for GET_VIDEO_CONTEXT message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('WordStream: Content script received message', message);

    if (!message || !message.type) {
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    // Handle different message types
    switch (message.type) {
      case MessageType.GET_VIDEO_CONTEXT:
        try {
          const videoData = {
            title: document.title || undefined,
            url: window.location.href,
            channelName: getChannelName(),
            description: getVideoDescription()
          };

          // Filter out undefined or null values
          const filteredData = Object.fromEntries(
            Object.entries(videoData).filter(([_, value]) => value !== undefined && value !== null)
          );

          sendResponse({ success: true, data: filteredData });
        } catch (error) {
          console.error('WordStream: Error getting video context', error);
          sendResponse({ success: false, error: 'Failed to get video context' });
        }
        return true;

      case MessageType.AUTH_STATE_CHANGED:
        // Update local auth state when it changes in the background
        if (message.data) {
          state.isAuthenticated = message.data.isAuthenticated;
          state.user = message.data.user;
          console.log('WordStream: Auth state updated from background', { 
            isAuthenticated: state.isAuthenticated, 
            user: state.user 
          });
        }
        sendResponse({ success: true });
        return true;

      default:
        // Unhandled message type
        sendResponse({ success: false, error: 'Unhandled message type' });
        return false;
    }

    return true;
  });
}

/**
 * Get video description if available
 */
function getVideoDescription(): string {
  // YouTube
  const ytDescription = document.querySelector('meta[name="description"]');
  if (ytDescription && ytDescription.getAttribute('content')) {
    return ytDescription.getAttribute('content') || '';
  }
  
  // Netflix
  const netflixInfo = document.querySelector('.title-info');
  if (netflixInfo) {
    return netflixInfo.textContent || '';
  }
  
  return '';
}

/**
 * Get channel name if available
 */
function getChannelName(): string {
  // YouTube
  const ytChannel = document.querySelector('#owner-name a, .ytd-channel-name a');
  if (ytChannel) {
    return ytChannel.textContent || '';
  }
  
  // Fallback to document title
  return '';
}

// For clean-up when navigating away
window.addEventListener('beforeunload', () => {
  if (state.detectionInterval) {
    clearInterval(state.detectionInterval);
  }
  
  if (state.captionDetector && typeof state.captionDetector.cleanup === 'function') {
    state.captionDetector.cleanup();
  }
});

// Export for testing
export { state, detectCaptions };

// Check authentication state
async function checkAuthState() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_AUTH_STATE
    });

    if (response && response.success) {
      state.isAuthenticated = response.data.isAuthenticated;
      state.user = response.data.user;
      console.log('WordStream: Auth state updated', { 
        isAuthenticated: state.isAuthenticated, 
        user: state.user 
      });
    } else {
      console.error('WordStream: Failed to check auth state', response?.error || 'Unknown error');
      state.isAuthenticated = false;
      state.user = null;
    }
  } catch (error) {
    console.error('WordStream: Error checking auth state', error);
    state.isAuthenticated = false;
    state.user = null;
  }
}

// Set up DOM observer
function setupDOMObserver() {
  // Implementation of setupDOMObserver function
} 