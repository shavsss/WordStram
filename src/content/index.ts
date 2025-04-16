/**
 * Content Script
 * This script runs in the context of web pages.
 * 
 * Provides functionality for translating captions, saving translations,
 * and taking notes during video playback.
 */

import { initializeFirebase, getFirebaseServices } from '../auth';
import { sendToGemini, GeminiMessage } from '../features/gemini/gemini-service';
import { createNotesPanel, toggleNotesPanel } from '../features/notes/notes-service';
import { createChatPanel, toggleChatPanel } from '../features/gemini/gemini-chat-service';

console.log('WordStream: Content script initialized');

// State for the extension
const state = {
  isFeatureActive: false,
  isTranslationEnabled: true,
  isNotesPanelOpen: false,
  selectedLanguage: 'he',
  currentVideoId: '',
  currentVideoTitle: '',
  captionsAvailable: false,
  videoSpeed: 1.0, // Default video speed
  speedControllerVisible: false,
  isChatPanelOpen: false,
  chatHistory: [] as GeminiMessage[],
  isProcessingChatRequest: false,
};

// Attach state to window object for cross-module access
window.wordstreamState = state;

/**
 * Create and inject the WordStream UI
 */
function createWordStreamUI() {
  // Create container for our UI
  const container = document.createElement('div');
  container.id = 'wordstream-container';
  container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 20px;
    transform: translateY(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  `;
  
  // Create chat button
  const chatButton = document.createElement('button');
  chatButton.id = 'wordstream-chat-button';
  chatButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  chatButton.style.cssText = `
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: #10b981;
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
  `;
  
  // Add hover effect
  chatButton.onmouseover = () => {
    chatButton.style.transform = 'scale(1.05)';
    chatButton.style.backgroundColor = '#059669';
  };
  chatButton.onmouseout = () => {
    chatButton.style.transform = 'scale(1)';
    chatButton.style.backgroundColor = '#10b981';
  };
  
  // Add click handler
  chatButton.addEventListener('click', () => {
    toggleChatPanel();
  });
  
  // Create notes button
  const notesButton = document.createElement('button');
  notesButton.id = 'wordstream-notes-button';
  notesButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  notesButton.style.cssText = `
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: #f59e0b;
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
  `;
  
  // Add hover effect
  notesButton.onmouseover = () => {
    notesButton.style.transform = 'scale(1.05)';
    notesButton.style.backgroundColor = '#d97706';
  };
  notesButton.onmouseout = () => {
    notesButton.style.transform = 'scale(1)';
    notesButton.style.backgroundColor = '#f59e0b';
  };
  
  // Add click handler
  notesButton.addEventListener('click', () => {
    toggleNotesPanel();
  });
  
  // Add elements to the page
  container.appendChild(chatButton);
  container.appendChild(notesButton);
  document.body.appendChild(container);
  
  // Make the buttons container draggable
  makeDraggable(container);
  
  // Try to load saved position from localStorage
  const savedPosition = localStorage.getItem('wordstream-container-position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      container.style.top = position.top;
      container.style.right = position.right;
      container.style.bottom = position.bottom;
      container.style.left = position.left;
    } catch (error) {
      console.error('WordStream: Error loading saved position', error);
    }
  }
  
  console.log('WordStream: UI injected');
}

/**
 * Create and show the feature panel
 */
function createFeaturePanel() {
  // Check if panel already exists
  let panel = document.getElementById('wordstream-panel');
  if (panel) {
    panel.style.display = 'block';
    return;
  }
  
  // Create panel
  panel = document.createElement('div');
  panel.id = 'wordstream-panel';
  panel.style.cssText = `
    width: 320px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    margin-bottom: 10px;
    animation: slideIn 0.3s ease;
  `;
  
  // Check if we're on YouTube or another site
  const isYouTube = window.location.hostname.includes('youtube.com');
  
  // Customize message based on site type
  const translateMessage = isYouTube
    ? 'Automatic translation will be enabled when captions are available in the video.'
    : 'Translate selected text on this page.';
  
  const notesPlaceholder = isYouTube
    ? 'Write notes about this video here...'
    : 'Write notes about this page...';
  
  // Add dark mode support
  panel.innerHTML = `
    <style>
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      #wordstream-panel {
        color: #1e293b;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      @media (prefers-color-scheme: dark) {
        #wordstream-panel {
          background-color: #1e293b;
          color: #f1f5f9;
        }
        
        #wordstream-panel .tab-button {
          background-color: #334155;
          color: #f1f5f9;
        }
        
        #wordstream-panel .tab-button.active {
          background-color: #3b82f6;
          color: white;
        }
      }
    </style>
    
    <div style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">WordStream</h3>
        <div style="display: flex; gap: 6px;">
          <button id="wordstream-minimize" style="background: none; border: none; cursor: pointer; padding: 2px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button id="wordstream-close" style="background: none; border: none; cursor: pointer; padding: 2px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <div style="display: flex; border-bottom: 1px solid #e2e8f0;">
      <button class="tab-button active" data-tab="translate" style="flex: 1; padding: 10px; border: none; background: none; cursor: pointer; font-weight: 500; border-bottom: 2px solid #3b82f6;">
        Translation
      </button>
      <button class="tab-button" data-tab="notes" style="flex: 1; padding: 10px; border: none; background: none; cursor: pointer; font-weight: 500; border-bottom: 2px solid transparent;">
        Notes
      </button>
    </div>
    
    <div id="wordstream-tab-content" style="height: 320px; overflow-y: auto; padding: 16px;">
      <div id="translate-tab" class="tab-content">
        <p style="margin-top: 0;">${translateMessage}</p>
        
        <div style="margin-top: 12px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 500;">Target Language:</label>
          <select id="wordstream-target-language" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
            <option value="he">Hebrew</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ru">Russian</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        
        <div style="margin-top: 16px; display: flex; align-items: center;">
          <label style="margin-right: 8px;">Enable automatic translation:</label>
          <div id="wordstream-translation-toggle" class="toggle-switch" style="position: relative; display: inline-block; width: 40px; height: 20px; background-color: #4f46e5; border-radius: 20px; cursor: pointer;">
            <div class="toggle-switch-handle" style="position: absolute; top: 2px; left: 22px; width: 16px; height: 16px; background-color: white; border-radius: 50%; transition: left 0.2s;"></div>
          </div>
        </div>
      </div>
      
      <div id="notes-tab" class="tab-content" style="display: none;">
        <textarea id="wordstream-notes" placeholder="${notesPlaceholder}" style="width: 100%; height: 200px; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0; resize: none;"></textarea>
        
        <button id="wordstream-save-notes" style="margin-top: 12px; padding: 8px 16px; background-color: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
          Save Notes
        </button>
      </div>
    </div>
  `;
  
  // Add panel to container
  const container = document.getElementById('wordstream-container');
  if (container) {
    container.prepend(panel);
    
    // Set up event listeners
    setupPanelEventListeners();
  }
}

/**
 * Setup panel event listeners
 */
function setupPanelEventListeners() {
  const panel = document.getElementById('wordstream-panel');
  if (!panel) return;
  
  // Close button
  const closeButton = document.getElementById('wordstream-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      state.isFeatureActive = false;
      panel.style.display = 'none';
    });
  }
  
  // Minimize button
  const minimizeButton = document.getElementById('wordstream-minimize');
  if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }
  
  // Tab buttons
  const tabButtons = panel.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');
      
      // Show the selected tab content
      document.querySelectorAll('.tab-content').forEach(tab => {
        (tab as HTMLElement).style.display = 'none';
      });
      
      const activeTab = document.getElementById(`${tabName}-tab`);
      if (activeTab) {
        activeTab.style.display = 'block';
      }
    });
  });
  
  // Translation toggle
  const translationToggle = document.getElementById('wordstream-translation-toggle');
  if (translationToggle) {
    translationToggle.addEventListener('click', () => {
      state.isTranslationEnabled = !state.isTranslationEnabled;
      
      // Update toggle visual state
      const handle = translationToggle.querySelector('.toggle-switch-handle') as HTMLElement;
      if (handle) {
        if (state.isTranslationEnabled) {
          handle.style.left = '22px';
          translationToggle.style.backgroundColor = '#4f46e5';
        } else {
          handle.style.left = '2px';
          translationToggle.style.backgroundColor = '#94a3b8';
        }
      }
      
      console.log(`WordStream: Translation ${state.isTranslationEnabled ? 'enabled' : 'disabled'}`);
    });
  }
  
  // Target language select
  const targetLanguageSelect = document.getElementById('wordstream-target-language') as HTMLSelectElement;
  if (targetLanguageSelect) {
    targetLanguageSelect.value = state.selectedLanguage;
    targetLanguageSelect.addEventListener('change', () => {
      state.selectedLanguage = targetLanguageSelect.value;
      console.log(`WordStream: Target language changed to ${state.selectedLanguage}`);
    });
  }
  
  // Save notes button
  const saveNotesButton = document.getElementById('wordstream-save-notes');
  if (saveNotesButton) {
    // Import the saveNotes function from the notes service
    import('../features/notes/notes-service').then(notesService => {
      saveNotesButton.addEventListener('click', notesService.saveNotes);
    });
  }
}

/**
 * Toggle the feature panel
 */
function toggleFeaturePanel() {
  const panel = document.getElementById('wordstream-panel');
  if (panel) {
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  } else {
    createFeaturePanel();
  }
}

/**
 * Activate WordStream features on the page
 */
function activateFeatures() {
  state.isFeatureActive = true;
  
  // Get current page info
  updatePageInfo();
  
  // Create the feature panel
  createFeaturePanel();
  
  // Listen for navigation events
  listenForPageNavigation();
}

/**
 * Update current page information
 */
function updatePageInfo() {
  // For YouTube videos
  if (window.location.hostname.includes('youtube.com')) {
    updateYouTubeVideoInfo();
  } else {
    // For all other pages
    updateGenericPageInfo();
  }
}

/**
 * Update information for YouTube videos
 */
function updateYouTubeVideoInfo() {
  // Parse video ID from URL
  const url = new URL(window.location.href);
  const videoId = url.searchParams.get('v');
  
  if (videoId) {
    state.currentVideoId = videoId;
    
    // Try to get video title
    const titleElement = document.querySelector('h1.title') || 
                         document.querySelector('h1.ytd-video-primary-info-renderer');
    
    if (titleElement) {
      state.currentVideoTitle = titleElement.textContent?.trim() || '';
    }
    
    console.log(`WordStream: YouTube video detected - ${state.currentVideoId} - ${state.currentVideoTitle}`);
    
    // Check for captions
    setTimeout(checkForCaptions, 2000);
  }
}

/**
 * Update information for non-video pages
 */
function updateGenericPageInfo() {
  // Generate a page ID based on URL
  const url = new URL(window.location.href);
  state.currentVideoId = btoa(url.pathname).substring(0, 20); // Use base64 encoding of path as ID
  
  // Get page title
  state.currentVideoTitle = document.title || 'Untitled Page';
  
  console.log(`WordStream: Generic page detected - ${state.currentVideoTitle}`);
  
  // No captions for generic pages
  state.captionsAvailable = false;
}

/**
 * Listen for navigation between pages
 */
function listenForPageNavigation() {
  let lastUrl = window.location.href;
  
  // Create an observer to watch for URL changes
  const observer = new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      console.log('WordStream: URL changed, updating page info');
      updatePageInfo();
    }
  });
  
  // Start observing
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Check if captions are available in the current video
 */
function checkForCaptions() {
  // On YouTube, look for caption button
  const captionButton = document.querySelector('.ytp-subtitles-button');
  if (captionButton) {
    state.captionsAvailable = true;
    console.log('WordStream: Captions available for this video');
  } else {
    state.captionsAvailable = false;
    console.log('WordStream: No captions available for this video');
  }
}

/**
 * Video Speed Controller - Create and inject the controller UI
 */
function createSpeedController() {
  // Check if the controller already exists
  if (document.getElementById('wordstream-speed-controller')) {
    return;
  }
  
  // Create container for the speed controller
  const speedController = document.createElement('div');
  speedController.id = 'wordstream-speed-controller';
  speedController.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(79, 70, 229, 0.85);
    color: white;
    border-radius: 10px;
    padding: 8px 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    user-select: none;
    cursor: move;
    border: 1px solid rgba(255, 255, 255, 0.2);
  `;
  
  // Add hover effect
  speedController.onmouseover = () => {
    speedController.style.backgroundColor = 'rgba(79, 70, 229, 0.95)';
  };
  speedController.onmouseout = () => {
    speedController.style.backgroundColor = 'rgba(79, 70, 229, 0.85)';
  };
  
  // Create speed indicator
  const speedDisplay = document.createElement('div');
  speedDisplay.id = 'wordstream-speed-display';
  speedDisplay.innerText = `${state.videoSpeed}x`;
  speedDisplay.style.cssText = `
    font-weight: bold;
    min-width: 36px;
    text-align: center;
    font-size: 16px;
  `;
  
  // Create decrease button
  const decreaseButton = document.createElement('button');
  decreaseButton.id = 'wordstream-speed-decrease';
  decreaseButton.innerText = '−';
  decreaseButton.style.cssText = `
    background: rgba(0, 0, 0, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    font-weight: bold;
  `;
  
  // Create increase button
  const increaseButton = document.createElement('button');
  increaseButton.id = 'wordstream-speed-increase';
  increaseButton.innerText = '+';
  increaseButton.style.cssText = `
    background: rgba(0, 0, 0, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    font-weight: bold;
  `;
  
  // Create reset button
  const resetButton = document.createElement('button');
  resetButton.id = 'wordstream-speed-reset';
  resetButton.innerText = '1x';
  resetButton.style.cssText = `
    background: rgba(0, 0, 0, 0.2);
    border: none;
    color: white;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
  `;
  
  // Add event listeners
  decreaseButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent dragging when clicking button
    changeVideoSpeed(-0.1);
  });
  
  increaseButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent dragging when clicking button
    changeVideoSpeed(0.1);
  });
  
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent dragging when clicking button
    resetVideoSpeed();
  });
  
  // Add hover effects to buttons
  const hoverButtons = [decreaseButton, increaseButton, resetButton];
  hoverButtons.forEach(button => {
    button.onmouseover = () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    };
    button.onmouseout = () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    };
  });
  
  // Assemble controller
  speedController.appendChild(decreaseButton);
  speedController.appendChild(speedDisplay);
  speedController.appendChild(increaseButton);
  speedController.appendChild(resetButton);
  
  // Add to document
  document.body.appendChild(speedController);
  state.speedControllerVisible = true;
  
  // Make the speed controller draggable
  makeDraggable(speedController);
  
  // Try to load saved position from localStorage
  const savedPosition = localStorage.getItem('wordstream-speed-controller-position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      speedController.style.top = position.top;
      speedController.style.right = position.right;
      speedController.style.bottom = position.bottom;
      speedController.style.left = position.left;
    } catch (error) {
      console.error('WordStream: Error loading saved position', error);
    }
  }
  
  console.log('WordStream: Speed controller injected');
}

/**
 * עדכון פונקציית makeDraggable כדי לתמוך במאחז (handle) אופציונלי
 */
function makeDraggable(element: HTMLElement, dragHandle?: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  const handle = dragHandle || element;
  handle.style.cursor = 'move';
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    // קבלת מיקום הסמן בתחילת הגרירה
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // קריאה לפונקציה בכל תזוזת הסמן
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    // חישוב המיקום החדש של הסמן
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // חישוב המיקום החדש וודא שהאלמנט נשאר בגבולות החלון
    const newTop = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, element.offsetTop - pos2));
    const newLeft = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, element.offsetLeft - pos1));
    
    // הגדרת המיקום החדש של האלמנט
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    
    // איפוס right/bottom אם הוגדרו
    element.style.right = "auto";
    element.style.bottom = "auto";
    
    // שמירת המיקום ב-localStorage
    localStorage.setItem(`${element.id}-position`, JSON.stringify({
      top: element.style.top,
      left: element.style.left,
      right: 'auto',
      bottom: 'auto'
    }));
  }
  
  function closeDragElement() {
    // עצירת התזוזה כאשר משחררים את הכפתור
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/**
 * Change the playback speed of all videos on the page
 */
function changeVideoSpeed(delta: number) {
  // Find all video elements
  const videos = document.querySelectorAll('video');
  
  if (videos.length === 0) {
    console.log('WordStream: No videos found on page');
    return;
  }
  
  // Calculate new speed (between 0.1 and 4.0)
  const newSpeed = Math.max(0.1, Math.min(4.0, state.videoSpeed + delta));
  state.videoSpeed = parseFloat(newSpeed.toFixed(1)); // Round to 1 decimal place
  
  // Update all videos
  videos.forEach(video => {
    video.playbackRate = state.videoSpeed;
  });
  
  // Update display
  const speedDisplay = document.getElementById('wordstream-speed-display');
  if (speedDisplay) {
    speedDisplay.innerText = `${state.videoSpeed}x`;
  }
  
  // Save preference
  localStorage.setItem('wordstream-video-speed', state.videoSpeed.toString());
  
  console.log(`WordStream: Changed video speed to ${state.videoSpeed}x`);
}

/**
 * Reset the playback speed to 1.0
 */
function resetVideoSpeed() {
  // Find all video elements
  const videos = document.querySelectorAll('video');
  
  if (videos.length === 0) {
    return;
  }
  
  // Reset speed
  state.videoSpeed = 1.0;
  
  // Update all videos
  videos.forEach(video => {
    video.playbackRate = state.videoSpeed;
  });
  
  // Update display
  const speedDisplay = document.getElementById('wordstream-speed-display');
  if (speedDisplay) {
    speedDisplay.innerText = `${state.videoSpeed}x`;
  }
  
  // Save preference
  localStorage.setItem('wordstream-video-speed', state.videoSpeed.toString());
  
  console.log('WordStream: Reset video speed to 1.0x');
}

/**
 * Check if a video is present on the page and show/hide speed controller accordingly
 */
function checkForVideos() {
  const videos = document.querySelectorAll('video');
  
  if (videos.length > 0) {
    // Found videos on the page
    if (!state.speedControllerVisible) {
      createSpeedController();
      // Apply saved speed from localStorage (if any)
      const savedSpeed = localStorage.getItem('wordstream-video-speed');
      if (savedSpeed) {
        state.videoSpeed = parseFloat(savedSpeed);
        // Apply to all videos
        videos.forEach(video => {
          video.playbackRate = state.videoSpeed;
        });
        // Update display
        const speedDisplay = document.getElementById('wordstream-speed-display');
        if (speedDisplay) {
          speedDisplay.innerText = `${state.videoSpeed}x`;
        }
      }
      
      // Add listeners to apply speed when videos play
      videos.forEach(video => {
        video.addEventListener('play', () => {
          video.playbackRate = state.videoSpeed;
        });
      });
    }
  } else {
    // No videos found, hide controller if it exists
    const controller = document.getElementById('wordstream-speed-controller');
    if (controller) {
      controller.remove();
      state.speedControllerVisible = false;
    }
  }
}

/**
 * Monitor for new videos being added to the page
 */
function monitorForVideos() {
  // Initial check
  checkForVideos();
  
  // Set up a mutation observer to detect when new videos are added to the page
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    // Check if any mutations might have added a video
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'VIDEO' || 
              (node.nodeType === Node.ELEMENT_NODE && (node as Element).querySelector('video'))) {
            shouldCheck = true;
          }
        });
      }
    });
    
    if (shouldCheck) {
      checkForVideos();
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check periodically as a fallback
  setInterval(checkForVideos, 2000);
  
  // Add keyboard shortcuts for speed control
  document.addEventListener('keydown', (e) => {
    // Don't interfere with input fields
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    
    // Check if videos exist on the page
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;
    
    // Only listen for keyboard shortcuts when controller is visible
    if (!state.speedControllerVisible) return;
    
    // Check for key combinations
    if (e.shiftKey && e.key === '+') { // Shift + +
      e.preventDefault();
      changeVideoSpeed(0.1);
    } else if (e.shiftKey && e.key === '_') { // Shift + -
      e.preventDefault();
      changeVideoSpeed(-0.1);
    } else if (e.shiftKey && e.key === '0') { // Shift + 0
      e.preventDefault();
      resetVideoSpeed();
    }
  });
}

/**
 * Initialize the content script
 */
async function initContentScript() {
  try {
    console.log('WordStream: Initializing content script');
    
    // Check if we're on a video site or any site with videos
    if (document.readyState === 'complete') {
    createWordStreamUI();
      updatePageInfo();
      listenForPageNavigation();
      setupMessageListeners();
      
      // Initialize video speed controller
      monitorForVideos();
    } else {
      window.addEventListener('load', () => {
        createWordStreamUI();
        updatePageInfo();
        listenForPageNavigation();
    setupMessageListeners();
    
        // Initialize video speed controller
        monitorForVideos();
      });
    }
    
    // Initialize Firebase (if needed)
    await initializeFirebase();
    
    // Check if user is signed in
    const services = await getFirebaseServices();
    if (services.auth) {
      services.auth.onAuthStateChanged((user: any) => {
        if (user) {
          console.log('WordStream: User is signed in');
        } else {
          console.log('WordStream: User is not signed in');
        }
      });
    }
    
  } catch (error) {
    console.error('WordStream: Error initializing content script', error);
  }
}

// Set up message listeners for communication with popup and background
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('WordStream: Received message:', message);
    
    // Handle different message types
    if (message.action === 'ACTIVATE_FEATURES') {
      activateFeatures();
      
      // Apply settings if provided
      if (message.settings) {
        updateSettings(message.settings);
      }
      
      sendResponse({ success: true });
    }
    
    // Handle settings update
    if (message.action === 'UPDATE_SETTINGS') {
      if (message.settings) {
        updateSettings(message.settings);
      }
      sendResponse({ success: true });
    }
    
    // Return true to indicate you will respond asynchronously
    return true;
  });
}

/**
 * Update settings based on popup configuration
 */
function updateSettings(settings: any) {
  console.log('WordStream: Updating settings:', settings);
  
  // Update language settings
  if (settings.selectedLanguage) {
    state.selectedLanguage = settings.selectedLanguage;
    localStorage.setItem('wordstream-language', settings.selectedLanguage);
  }
  
  // Update translation toggle
  if (settings.isTranslationEnabled !== undefined) {
    state.isTranslationEnabled = settings.isTranslationEnabled;
    localStorage.setItem('wordstream-translation-enabled', String(settings.isTranslationEnabled));
  }
  
  // Update speed controller visibility
  if (settings.showSpeedController !== undefined) {
    if (settings.showSpeedController) {
      if (!state.speedControllerVisible) {
        createSpeedController();
      }
    } else if (state.speedControllerVisible) {
      const controller = document.getElementById('wordstream-speed-controller');
      if (controller) {
        controller.remove();
        state.speedControllerVisible = false;
      }
    }
    localStorage.setItem('wordstream-speed-controller', String(settings.showSpeedController));
  }
  
  // Update floating buttons visibility
  if (settings.showFloatingButtons !== undefined) {
    const container = document.getElementById('wordstream-container');
    if (container) {
      container.style.display = settings.showFloatingButtons ? 'flex' : 'none';
    }
    localStorage.setItem('wordstream-floating-buttons', String(settings.showFloatingButtons));
  }
}

// Start the content script
initContentScript();

// Export for webpack
export default {}; 