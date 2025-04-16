/**
 * Gemini Chat Service
 * Handles chat-related functionality including creating panels, sending messages, etc.
 */

import { makeDraggable } from '../shared/DraggableUtil';
import { sendToGemini, GeminiMessage } from './gemini-service';
import { WordStreamState } from '../shared/global-state';

// State management
interface ChatState {
  chatHistory: GeminiMessage[];
}

const chatState: ChatState = {
  chatHistory: []
};

/**
 * Create Gemini chat panel
 */
export function createChatPanel() {
  // Check if panel already exists
  if (document.getElementById('wordstream-chat-panel')) {
    return;
  }
  
  // Create main panel
  const panel = document.createElement('div');
  panel.id = 'wordstream-chat-panel';
  panel.className = 'wordstream-gemini-chat';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'wordstream-gemini-chat-header';
  
  const title = document.createElement('h3');
  title.textContent = 'WordStream Assistant';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'wordstream-gemini-chat-close';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    toggleChatPanel();
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create chat container
  const chatContainer = document.createElement('div');
  chatContainer.className = 'wordstream-gemini-chat-messages';
  
  // Add welcome message
  const welcomeMsg = document.createElement('div');
  welcomeMsg.className = 'wordstream-gemini-chat-welcome';
  welcomeMsg.innerHTML = `
    <h4>Hello! I'm your WordStream Assistant</h4>
    <p>I can help you learn languages while watching videos. Ask me anything about:</p>
    <ul style="text-align: left; margin-top: 10px; padding-left: 20px;">
      <li>Translations or explanations of words</li>
      <li>Grammar clarifications</li>
      <li>Cultural context from the video</li>
      <li>Language learning strategies</li>
      <li>Video content questions</li>
    </ul>
    <p style="margin-top: 10px; font-style: italic;">I'll respond in the same language you use - Hebrew, English, or any other language!</p>
  `;
  chatContainer.appendChild(welcomeMsg);
  
  // Create input area
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    display: flex;
    padding: 12px;
    border-top: 1px solid #e2e8f0;
    background-color: white;
  `;
  
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type your message...';
  textarea.style.cssText = `
    flex-grow: 1;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 8px 12px;
    resize: none;
    height: 40px;
    max-height: 120px;
    font-family: inherit;
    font-size: 14px;
    overflow-y: auto;
    margin-right: 8px;
  `;
  
  // Auto-resize textarea as user types
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;
  });
  
  // Send button
  const sendButton = document.createElement('button');
  sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  sendButton.style.cssText = `
    background-color: #4285F4;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    flex-shrink: 0;
  `;
  
  // Handle sending messages
  const handleSend = () => {
    const message = textarea.value.trim();
    if (message) {
      // Clear welcome message if present
      const welcomeMsg = chatContainer.querySelector('.wordstream-gemini-chat-welcome');
      if (welcomeMsg) {
        chatContainer.removeChild(welcomeMsg);
      }
      
      sendChatMessage(message);
      textarea.value = '';
      textarea.style.height = '40px';
      textarea.focus();
    }
  };
  
  sendButton.addEventListener('click', handleSend);
  
  // Handle Enter key (with shift+enter for new line)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  inputContainer.appendChild(textarea);
  inputContainer.appendChild(sendButton);
  
  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(chatContainer);
  panel.appendChild(inputContainer);
  
  // Add to document and make draggable
  document.body.appendChild(panel);
  makeDraggable(panel, header);
  
  // Set initial position
  const savedPosition = localStorage.getItem('wordstream-chat-position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      panel.style.top = position.top || '';
      panel.style.right = position.right || '';
      panel.style.bottom = position.bottom || '';
      panel.style.left = position.left || '';
    } catch (error) {
      console.error('Error restoring chat position:', error);
    }
  }
  
  // Focus textarea
  setTimeout(() => {
    textarea.focus();
  }, 100);
  
  // Store reference to chat in global state
  if (window.wordstreamState) {
    window.wordstreamState.isChatPanelOpen = true;
  }
  
  return panel;
}

/**
 * Add a message to the chat panel
 */
export function addChatMessage(sender: 'user' | 'ai', text: string) {
  const chatContainer = document.querySelector('#wordstream-chat-panel > div:nth-child(2)');
  if (!chatContainer) return;
  
  const messageElement = document.createElement('div');
  messageElement.style.cssText = `
    padding: 10px 14px;
    border-radius: 18px;
    max-width: 80%;
    word-break: break-word;
    ${sender === 'user' 
      ? 'background-color: #e9ecef; align-self: flex-end;' 
      : 'background-color: #4f46e5; color: white; align-self: flex-start;'}
  `;
  
  messageElement.textContent = text;
  chatContainer.appendChild(messageElement);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Send a chat message to Gemini
 */
export async function sendChatMessage(message: string) {
  const chatPanel = document.getElementById('wordstream-chat-panel');
  if (!chatPanel) return;
  
  const chatContainer = chatPanel.querySelector('div:nth-child(2)');
  if (!chatContainer) return;
  
  // Get current chat history
  const history = Array.from(chatContainer.children)
    .map(child => {
      const sender = child.classList.contains('user-message') ? 'user' : 'assistant';
      const text = child.textContent || '';
      return { role: sender as 'user' | 'assistant', content: text } as GeminiMessage;
    });
  
  // Add user message to chat
  addChatMessage('user', message);
  
  try {
    // Create loading message
    const loadingEl = document.createElement('div');
    loadingEl.className = 'assistant-message loading';
    loadingEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    loadingEl.style.cssText = `
      padding: 12px;
      background-color: #f1f5f9;
      border-radius: 12px;
      margin-bottom: 12px;
      align-self: flex-start;
      max-width: 80%;
      animation: fadeIn 0.3s ease;
    `;
    chatContainer.appendChild(loadingEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Get selected language
    const selectedLanguage = window.wordstreamState.selectedLanguage || 'en';
    
    // Send message to Gemini API
    const response = await sendToGemini(
      message, 
      history, 
      document.title,
      { language: selectedLanguage }
    );
    
    // Remove loading message
    if (loadingEl && loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl);
    }
    
    // Add AI message to chat
    addChatMessage('ai', response);
    
    // Save chat history 
    saveChatHistory();
    
  } catch (error) {
    console.error('WordStream: Error sending chat message', error);
    
    // Remove any loading message
    const loadingEl = chatContainer.querySelector('.loading');
    if (loadingEl && loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl);
    }
    
    // Add error message
    if (error instanceof Error) {
      addChatMessage('ai', `Error: ${error.message}`);
    } else {
      addChatMessage('ai', 'An error occurred while sending your message. Please try again.');
    }
  }
}

/**
 * Save chat history to localStorage
 */
export function saveChatHistory() {
  try {
    // Limit history to last 20 messages to prevent storage issues
    const trimmedHistory = chatState.chatHistory.slice(-20);
    localStorage.setItem('wordstream-chat-history', JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

/**
 * Load chat history from localStorage
 */
export function loadChatHistory() {
  try {
    const savedHistory = localStorage.getItem('wordstream-chat-history');
    if (savedHistory) {
      chatState.chatHistory = JSON.parse(savedHistory);
      
      // Display the history in the UI
      const chatContainer = document.querySelector('#wordstream-chat-panel > div:nth-child(2)');
      if (chatContainer && chatContainer.childElementCount === 0) {
        chatState.chatHistory.forEach(message => {
          addChatMessage(message.role as 'user' | 'ai', message.content);
        });
      }
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

/**
 * Toggle the visibility of the chat panel
 */
export function toggleChatPanel() {
  if (window.wordstreamState.isChatPanelOpen) {
    const chatPanel = document.getElementById('wordstream-chat-panel');
    if (chatPanel) {
      chatPanel.style.display = 'none';
      window.wordstreamState.isChatPanelOpen = false;
    }
  } else {
    createChatPanel();
    window.wordstreamState.isChatPanelOpen = true;
  }
} 