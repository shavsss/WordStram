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
 * Create a chat panel
 */
export function createChatPanel() {
  // Check if the window already exists
  let chatPanel = document.getElementById('wordstream-chat-panel');
  if (chatPanel) {
    chatPanel.style.display = 'block';
    return;
  }
  
  // Create the panel
  chatPanel = document.createElement('div');
  chatPanel.id = 'wordstream-chat-panel';
  chatPanel.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    width: 350px;
    height: 450px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 9998;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #4f46e5;
    color: white;
    cursor: move;
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Gemini Chat';
  title.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeButton.addEventListener('click', () => {
    chatPanel.style.display = 'none';
    window.wordstreamState.isChatPanelOpen = false;
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create chat container
  const chatContainer = document.createElement('div');
  chatContainer.style.cssText = `
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background-color: #f8f9fa;
  `;
  
  // Create input area
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    display: flex;
    padding: 12px;
    gap: 8px;
    border-top: 1px solid #e2e8f0;
    background-color: white;
  `;
  
  const chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = 'Type your message...';
  chatInput.style.cssText = `
    flex-grow: 1;
    padding: 8px 12px;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    font-size: 14px;
  `;
  
  const sendButton = document.createElement('button');
  sendButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  `;
  sendButton.style.cssText = `
    background-color: #4f46e5;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `;
  
  // Add logic for sending 
  sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
      sendChatMessage(message);
      chatInput.value = '';
    }
  });
  
  // Allow sending with Enter
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendButton.click();
    }
  });
  
  // Assemble the window
  inputContainer.appendChild(chatInput);
  inputContainer.appendChild(sendButton);
  
  chatPanel.appendChild(header);
  chatPanel.appendChild(chatContainer);
  chatPanel.appendChild(inputContainer);
  
  // Add to document
  document.body.appendChild(chatPanel);
  
  // Make the window draggable
  makeDraggable(chatPanel, header);
  
  // Try to load saved position from localStorage
  const savedPosition = localStorage.getItem('wordstream-chat-panel-position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      chatPanel.style.top = position.top;
      chatPanel.style.right = position.right;
      chatPanel.style.bottom = position.bottom;
      chatPanel.style.left = position.left;
    } catch (error) {
      console.error('WordStream: Error loading saved position', error);
    }
  }
  
  // Load chat history
  loadChatHistory();
  
  return chatPanel;
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