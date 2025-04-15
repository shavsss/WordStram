import React, { useState, useEffect, useRef } from 'react';
import { sendToGemini, GeminiMessage } from './gemini-service';
import '../shared/FloatingWindow.css';
import './ChatStyles.css';
import { FloatingWindow } from '../shared/FloatingWindow';

interface GeminiChatProps {
  isVisible: boolean;
  onClose: () => void;
}

export function GeminiChat({ isVisible, onClose }: GeminiChatProps) {
  const [messages, setMessages] = useState<GeminiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [videoTitle, setVideoTitle] = useState<string>('Current Page');

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Effect to detect video title
  useEffect(() => {
    // Try to detect if we're on YouTube
    const detectVideoTitle = () => {
      try {
        if (window.location.hostname.includes('youtube.com')) {
          const titleElement = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
          if (titleElement) {
            setVideoTitle(titleElement.textContent?.trim() || 'YouTube Video');
          }
        }
      } catch (error) {
        console.error('Error detecting video title:', error);
      }
    };

    detectVideoTitle();
  }, []);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    // Add user message
    const userMessage: GeminiMessage = {
      role: 'user',
      content: inputValue
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Send message to Gemini API
      const response = await sendToGemini(inputValue, messages, videoTitle);
      
      // Add assistant message
      const assistantMessage: GeminiMessage = {
        role: 'assistant',
        content: response
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in input field
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isVisible) return null;

  return (
    <FloatingWindow
      title={`Gemini AI - ${videoTitle}`}
      onClose={onClose}
      isVisible={isVisible}
      width="380px"
      height="500px"
      className="wordstream-gemini-window"
    >
      <div className="wordstream-gemini-chat-messages">
        {messages.length === 0 ? (
          <div className="wordstream-gemini-chat-welcome">
            <h4>Welcome to Gemini Chat</h4>
            <p>Ask me anything about this page or any words you've encountered!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`wordstream-gemini-chat-message ${
                message.role === 'user' ? 'wordstream-gemini-chat-user' : 'wordstream-gemini-chat-assistant'
              }`}
            >
              <div className="wordstream-gemini-chat-bubble">
                {message.content}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="wordstream-gemini-chat-message wordstream-gemini-chat-assistant">
            <div className="wordstream-gemini-chat-loading">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="wordstream-gemini-chat-error">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="wordstream-gemini-chat-input-container">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="wordstream-gemini-chat-input"
          rows={1}
          disabled={isLoading}
        />
        <button 
          className="wordstream-gemini-chat-send" 
          onClick={handleSendMessage}
          disabled={isLoading || inputValue.trim() === ''}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </FloatingWindow>
  );
}

/**
 * Creates and renders a GeminiChat component
 */
export function createGeminiChat() {
  const chatContainer = document.createElement('div');
  chatContainer.id = 'wordstream-gemini-chat-container';
  document.body.appendChild(chatContainer);

  let isVisible = false;
  
  const renderChat = (visible: boolean) => {
    const root = document.createElement('div');
    root.id = 'wordstream-gemini-chat-root';
    
    // Clear previous chat instance if exists
    chatContainer.innerHTML = '';
    chatContainer.appendChild(root);
    
    // Import React and ReactDOM dynamically
    import('react').then(React => {
      import('react-dom').then(ReactDOM => {
        ReactDOM.render(
          React.createElement(GeminiChat, { 
            isVisible: visible,
            onClose: () => {
              isVisible = false;
              renderChat(false);
            }
          }),
          root
        );
      });
    });
  };

  // Return control functions
  return {
    show: () => {
      isVisible = true;
      renderChat(true);
    },
    hide: () => {
      isVisible = false;
      renderChat(false);
    },
    toggle: () => {
      isVisible = !isVisible;
      renderChat(isVisible);
    },
    isVisible: () => isVisible
  };
} 