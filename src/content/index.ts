/**
 * Content Script
 * This script runs in the context of web pages.
 * 
 * Provides functionality for translating captions, saving translations,
 * and taking notes during video playback.
 */

import { getPortConnection } from '../utils/port-connection';
import { Message, MessageType, TranslateTextMessage, TranslationResultMessage, GeminiRequestMessage, GeminiResponseMessage } from '../shared/message';
import { initializeConnectionRecovery } from '../utils/connection-recovery';

console.log('WordStream: Content script initialized');

// Create a connection to the background service
const portConnection = getPortConnection({ 
  name: 'content-script',
  reconnect: true,
  onDisconnect: () => {
    console.log('WordStream: Connection to background service lost, attempting to reconnect...');
  }
});

// Initialize connection recovery mechanism
try {
  initializeConnectionRecovery();
  console.log('WordStream: Connection recovery mechanism initialized');
} catch (error) {
  console.warn('WordStream: Failed to initialize connection recovery', error);
}

// Add listeners for connection recovery events
window.addEventListener('wordstream:connection_lost', (event: any) => {
  console.warn('WordStream: Connection to background service lost', event.detail);
  
  // Show a toast notification to the user
  showToast('Connection to WordStream lost. Attempting to reconnect automatically.', 10000);
  
  // Disable interactive features that require background service
  disableBackgroundDependentFeatures();
});

window.addEventListener('wordstream:connection_recovered', () => {
  console.log('WordStream: Connection to background service recovered');
  
  // Show a toast notification to the user
  showToast('Connection to WordStream restored!', 3000);
  
  // Re-enable features
  enableBackgroundDependentFeatures();
  
  // Refresh authentication state
  checkAuthenticationState();
});

// Interface for chat messages
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

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
  chatHistory: [] as ChatMessage[],
  isProcessingChatRequest: false,
  isAuthenticated: false,
  user: null as any,
  isBackgroundConnected: true // New state to track background connection
};

// Attach state to window object for cross-module access
(window as any).wordstreamState = state;

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
 * Create and inject the chat panel
 */
function createChatPanel() {
  // Check if panel already exists
  let chatPanel = document.getElementById('wordstream-chat-panel');
  if (chatPanel) {
    return chatPanel as HTMLElement;
  }
  
  chatPanel = document.createElement('div');
  chatPanel.id = 'wordstream-chat-panel';
  chatPanel.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 350px;
    height: 500px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10000;
    transition: all 0.3s ease;
    transform: translateY(20px);
    opacity: 0;
  `;
  
  // Set up the chat panel with header, messages area, and input
  chatPanel.innerHTML = `
    <div style="padding: 15px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">WordStream Assistant</h3>
      <button id="close-chat-panel" style="background: none; border: none; cursor: pointer; padding: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
    <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px;"></div>
    <div style="padding: 15px; border-top: 1px solid #e9ecef;">
      <div style="display: flex; gap: 10px;">
        <input id="chat-input" type="text" placeholder="Ask about the video..." style="flex: 1; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; outline: none; font-size: 14px;">
        <button id="send-chat" style="padding: 10px 15px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;">
          Send
      </button>
    </div>
        </div>
  `;
  
  document.body.appendChild(chatPanel);
  
  // Add event listeners
  document.getElementById('close-chat-panel')?.addEventListener('click', toggleChatPanel);
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
  document.getElementById('send-chat')?.addEventListener('click', sendChatMessage);
  
  // Make the panel draggable
  makeDraggable(chatPanel, chatPanel.querySelector('div') as HTMLElement);
  
  // Show initial message
  addChatMessage({
    role: 'assistant',
    content: 'Hello! I can help you with information about this video. What would you like to know?',
    timestamp: Date.now()
  });
  
  return chatPanel;
}

/**
 * Toggle the chat panel visibility
 */
function toggleChatPanel() {
  const chatPanel = document.getElementById('wordstream-chat-panel') || createChatPanel();
  
  if (state.isChatPanelOpen) {
    chatPanel.style.transform = 'translateY(20px)';
    chatPanel.style.opacity = '0';
    setTimeout(() => {
      chatPanel.style.display = 'none';
    }, 300);
  } else {
    chatPanel.style.display = 'flex';
    setTimeout(() => {
      chatPanel.style.transform = 'translateY(0)';
      chatPanel.style.opacity = '1';
    }, 10);
  }
  
  state.isChatPanelOpen = !state.isChatPanelOpen;
}

/**
 * Add a message to the chat panel
 */
function addChatMessage(message: ChatMessage) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${message.role}`;
  messageEl.style.cssText = `
    padding: 10px 12px;
    border-radius: 8px;
    max-width: 80%;
    align-self: ${message.role === 'user' ? 'flex-end' : 'flex-start'};
    background-color: ${message.role === 'user' ? '#3b82f6' : '#f1f5f9'};
    color: ${message.role === 'user' ? 'white' : '#1e293b'};
  `;
  
  messageEl.textContent = message.content;
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Add to history
  state.chatHistory.push(message);
}

/**
 * Send a message to the Gemini AI
 */
async function sendChatMessage() {
  // Check if background is connected before sending
  if (!state.isBackgroundConnected) {
    showToast('Cannot send message: connection to WordStream service lost', 3000);
    return;
  }

  const inputElement = document.getElementById('chat-input') as HTMLInputElement;
  if (!inputElement || !inputElement.value.trim()) return;
  
  const userMessage = inputElement.value.trim();
  inputElement.value = '';
  
  // Add user message to chat
  addChatMessage({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  });
  
  // Prevent multiple requests
  if (state.isProcessingChatRequest) {
    return;
  }
  
  state.isProcessingChatRequest = true;
  
  // Add loading indicator
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'chat-message assistant loading';
  loadingMessage.style.cssText = `
    padding: 10px 12px;
    border-radius: 8px;
    max-width: 80%;
    align-self: flex-start;
    background-color: #f1f5f9;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  loadingMessage.innerHTML = `
    <div class="loading-dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  `;
  
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) {
    messagesContainer.appendChild(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  try {
    // Prepare context about the current video
    let context = {};
    if (state.currentVideoId && state.currentVideoTitle) {
      context = {
        videoId: state.currentVideoId,
        videoTitle: state.currentVideoTitle
      };
    }
    
    // Get previous messages (last 5)
    const recentHistory = state.chatHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const request: GeminiRequestMessage = {
      type: MessageType.GET_GEMINI_RESPONSE,
      query: userMessage,
      history: recentHistory,
      context
    };
    
    // Send request to background service
    const response = await portConnection.sendMessage<GeminiResponseMessage>(
      request,
      MessageType.GEMINI_RESPONSE
    );
    
    // Remove loading indicator
    if (messagesContainer && loadingMessage.parentNode === messagesContainer) {
      messagesContainer.removeChild(loadingMessage);
    }
    
    if (response.success && response.content) {
      // Add AI response to chat
      addChatMessage({
        role: 'assistant',
        content: response.content,
        timestamp: Date.now()
      });
    } else {
      throw new Error(response.error || 'Failed to get response');
    }
  } catch (error) {
    console.error('WordStream: Error getting Gemini response', error);
    
    // Remove loading indicator
    if (messagesContainer && loadingMessage.parentNode === messagesContainer) {
      messagesContainer.removeChild(loadingMessage);
    }
    
    // Show error message
    addChatMessage({
      role: 'assistant',
      content: 'Sorry, I had trouble processing your request. Please try again later.',
      timestamp: Date.now()
    });
  } finally {
    state.isProcessingChatRequest = false;
  }
}

/**
 * Create and inject the notes panel
 */
function createNotesPanel() {
  // Check if panel already exists
  let notesPanel = document.getElementById('wordstream-notes-panel');
  if (notesPanel) {
    return notesPanel as HTMLElement;
  }
  
  notesPanel = document.createElement('div');
  notesPanel.id = 'wordstream-notes-panel';
  notesPanel.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 350px;
    height: 500px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10000;
    transition: all 0.3s ease;
    transform: translateY(20px);
    opacity: 0;
  `;
  
  // Set up the notes panel with header, notes area, and save button
  notesPanel.innerHTML = `
    <div style="padding: 15px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Video Notes</h3>
      <button id="close-notes-panel" style="background: none; border: none; cursor: pointer; padding: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <textarea id="notes-content" placeholder="Write your notes here..." style="flex: 1; padding: 15px; border: none; resize: none; outline: none; font-size: 14px;"></textarea>
    <div style="padding: 15px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end;">
      <button id="save-notes" style="padding: 10px 15px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;">
        Save Notes
      </button>
    </div>
  `;
  
  document.body.appendChild(notesPanel);
  
  // Add event listeners
  document.getElementById('close-notes-panel')?.addEventListener('click', toggleNotesPanel);
  document.getElementById('save-notes')?.addEventListener('click', saveNotes);
  
  // Make the panel draggable
  makeDraggable(notesPanel, notesPanel.querySelector('div') as HTMLElement);
  
  return notesPanel;
}

/**
 * Toggle the notes panel visibility
 */
function toggleNotesPanel() {
  const notesPanel = document.getElementById('wordstream-notes-panel') || createNotesPanel();
  
  if (state.isNotesPanelOpen) {
    notesPanel.style.transform = 'translateY(20px)';
    notesPanel.style.opacity = '0';
    setTimeout(() => {
      notesPanel.style.display = 'none';
    }, 300);
  } else {
    notesPanel.style.display = 'flex';
    setTimeout(() => {
      notesPanel.style.transform = 'translateY(0)';
      notesPanel.style.opacity = '1';
      
      // Load saved notes if available
      loadNotes();
    }, 10);
  }
  
  state.isNotesPanelOpen = !state.isNotesPanelOpen;
}

/**
 * Load saved notes for current video
 */
async function loadNotes() {
  // If not authenticated, show login message
  if (!state.isAuthenticated) {
    showToast('Please sign in to use notes feature', 3000);
    return;
  }
  
  if (!state.currentVideoId) {
    return;
  }
  
  // Logic to load notes from background service would go here
}

/**
 * Save notes for current video
 */
async function saveNotes() {
  // Check if background is connected before saving
  if (!state.isBackgroundConnected) {
    showToast('Cannot save notes: connection to WordStream service lost', 3000);
    return;
  }

  // If not authenticated, show login message
  if (!state.isAuthenticated) {
    showToast('Please sign in to save notes', 3000);
    return;
  }
  
  const notesContent = (document.getElementById('notes-content') as HTMLTextAreaElement)?.value;
  if (!notesContent || !state.currentVideoId) {
    return;
  }
  
  try {
    // Send request to background service to save note
    const response = await portConnection.sendMessage(
      {
        type: MessageType.SAVE_NOTE,
        videoId: state.currentVideoId,
        videoTitle: state.currentVideoTitle,
        content: notesContent
      },
      MessageType.SAVE_NOTE_RESULT
    );
    
    if (response.success) {
      showToast('Notes saved successfully', 2000);
    } else {
      throw new Error(response.error || 'Failed to save notes');
    }
    } catch (error) {
    console.error('WordStream: Error saving notes', error);
    showToast('Failed to save notes. Please try again.', 3000);
    }
}

/**
 * Make an element draggable
 */
function makeDraggable(element: HTMLElement, dragHandle?: HTMLElement) {
  const handle = dragHandle || element;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.style.cursor = 'move';
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Calculate new position ensuring the element stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const elementRect = element.getBoundingClientRect();
    
    let newTop = elementRect.top - pos2;
    let newLeft = elementRect.left - pos1;
    
    // Ensure element stays within bounds
    newTop = Math.max(0, Math.min(newTop, viewportHeight - elementRect.height));
    newLeft = Math.max(0, Math.min(newLeft, viewportWidth - elementRect.width));
    
    // Set the element's new position
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    element.style.bottom = "auto";
    element.style.right = "auto";
    
    // Save position to localStorage for buttons container
    if (element.id === 'wordstream-container') {
      localStorage.setItem('wordstream-container-position', JSON.stringify({
      top: element.style.top,
      left: element.style.left,
        bottom: 'auto',
        right: 'auto'
    }));
    }
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/**
 * Show a toast notification
 */
function showToast(message: string, duration: number = 3000) {
  // Check if toast container exists, create if not
  let toastContainer = document.getElementById('wordstream-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'wordstream-toast-container';
    toastContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
      z-index: 10001;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'wordstream-toast';
  toast.style.cssText = `
    padding: 12px 20px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-bottom: 8px;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(10px);
  `;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toastContainer.removeChild(toast);
      }
      
      // Remove container if empty
      if (toastContainer.children.length === 0) {
        document.body.removeChild(toastContainer);
      }
    }, 300);
  }, duration);
}

/**
 * Translate text using the background service
 */
async function translateText(text: string, targetLang: string = state.selectedLanguage): Promise<string> {
  if (!text || text.trim().length === 0) {
    return '';
  }
  
  try {
    const request: TranslateTextMessage = {
      type: MessageType.TRANSLATE_TEXT,
      text,
      targetLang
    };
    
    const response = await portConnection.sendMessage<TranslationResultMessage>(
      request,
      MessageType.TRANSLATION_RESULT
    );
    
    if (response.success && response.translation) {
      return response.translation;
    } else {
      throw new Error(response.error || 'Translation failed');
    }
  } catch (error) {
    console.error('WordStream: Error translating text', error);
    return '';
  }
}

/**
 * Setup message listeners for background communication
 */
function setupMessageListeners() {
  // Listen for auth state changes
  portConnection.addListener(MessageType.AUTH_STATE_CHANGED, (message) => {
    state.isAuthenticated = message.isAuthenticated;
    state.user = message.user;
    
    // Update UI based on auth state
    updateUIForAuthState();
  });
  
  // Listen for background ready message
  portConnection.addListener(MessageType.BACKGROUND_READY, () => {
    // Request initial auth state
    portConnection.postMessage({
      type: MessageType.GET_AUTH_STATE
    });
  });
}

/**
 * Update UI based on authentication state
 */
function updateUIForAuthState() {
  // Update UI elements based on auth state
  // This would be implemented based on your specific UI needs
}

/**
 * Disable features that depend on background service
 */
function disableBackgroundDependentFeatures() {
  state.isBackgroundConnected = false;
  
  // Disable chat panel if open
  if (state.isChatPanelOpen) {
    const chatPanel = document.getElementById('wordstream-chat-panel');
    if (chatPanel) {
      // Add a connection error message to the chat
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I\'ve lost connection to the WordStream service. I\'ll try to reconnect automatically.',
        timestamp: Date.now()
      });
      
      // Disable the input
      const chatInput = document.getElementById('chat-input') as HTMLInputElement;
      const sendButton = document.getElementById('send-chat') as HTMLButtonElement;
      
      if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Connection lost. Reconnecting...';
      }
      
      if (sendButton) {
        sendButton.disabled = true;
      }
    }
  }
  
  // Disable notes panel if open
  if (state.isNotesPanelOpen) {
    const notesPanel = document.getElementById('wordstream-notes-panel');
    if (notesPanel) {
      const notesArea = document.getElementById('notes-content') as HTMLTextAreaElement;
      const saveButton = document.getElementById('save-notes') as HTMLButtonElement;
      
      if (notesArea) {
        notesArea.disabled = true;
      }
      
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Connection Lost';
      }
    }
  }
}

/**
 * Re-enable features after background connection is restored
 */
function enableBackgroundDependentFeatures() {
  state.isBackgroundConnected = true;
  
  // Re-enable chat panel if open
  if (state.isChatPanelOpen) {
    const chatPanel = document.getElementById('wordstream-chat-panel');
    if (chatPanel) {
      // Add a recovery message to the chat
      addChatMessage({
        role: 'assistant',
        content: 'I\'m back online! How can I help you?',
        timestamp: Date.now()
      });
      
      // Re-enable the input
      const chatInput = document.getElementById('chat-input') as HTMLInputElement;
      const sendButton = document.getElementById('send-chat') as HTMLButtonElement;
      
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Ask about the video...';
      }
      
      if (sendButton) {
        sendButton.disabled = false;
      }
    }
  }
  
  // Re-enable notes panel if open
  if (state.isNotesPanelOpen) {
    const notesPanel = document.getElementById('wordstream-notes-panel');
    if (notesPanel) {
      const notesArea = document.getElementById('notes-content') as HTMLTextAreaElement;
      const saveButton = document.getElementById('save-notes') as HTMLButtonElement;
      
      if (notesArea) {
        notesArea.disabled = false;
      }
      
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Notes';
      }
    }
  }
}

/**
 * Check the authentication state
 */
async function checkAuthenticationState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' });
    if (response) {
      state.isAuthenticated = response.isAuthenticated;
      state.user = response.user;
      updateUIForAuthState();
    }
  } catch (error) {
    console.error('WordStream: Error checking auth state', error);
  }
}

/**
 * Initialize the content script
 */
async function initContentScript() {
  try {
    console.log('WordStream: Initializing content script');
    
    // Create UI
    createWordStreamUI();
    
    // Setup message listeners
    setupMessageListeners();
    
    // Request initial auth state
    portConnection.postMessage({
      type: MessageType.GET_AUTH_STATE
    });
    
    // Page-specific initialization
    if (window.location.hostname.includes('youtube.com')) {
      // YouTube specific initialization
      // Monitor for video player and captions
    }
    
    console.log('WordStream: Content script initialized successfully');
  } catch (error) {
    console.error('WordStream: Error initializing content script', error);
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
initContentScript();
}

// Export for webpack
export default {}; 