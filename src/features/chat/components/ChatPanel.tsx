import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { addExactDraggableCode } from '../../../shared/panels/utils/floating-controls';

/**
 * Props for ChatPanel component
 */
interface ChatPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Chat message type
 */
interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  isUser: boolean;
}

/**
 * ChatPanel component that displays chat messages and allows user interaction
 */
export function ChatPanel({ isVisible, onClose }: ChatPanelProps) {
  // State for chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Effect to setup draggable panel
  useEffect(() => {
    if (panelRef.current) {
      addExactDraggableCode(panelRef.current);
    }
  }, []);

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      timestamp: new Date().toISOString(),
      isUser: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    // Simulate response (replace with actual API call)
    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `Response to: ${inputValue}`,
        timestamp: new Date().toISOString(),
        isUser: false
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1000);
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
    <div
      ref={panelRef}
      className="wordstream-panel chat-panel size-m"
      style={{
        position: 'fixed',
        width: '350px',
        height: '400px',
        right: '20px',
        top: '100px',
        zIndex: 999999,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div className="panel-content" style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.isUser ? 'flex-end' : 'flex-start',
                marginBottom: '10px'
              }}
            >
              <div
                style={{
                  backgroundColor: message.isUser ? '#007bff' : '#f1f1f1',
                  color: message.isUser ? 'white' : 'black',
                  padding: '8px 12px',
                  borderRadius: '18px',
                  maxWidth: '80%',
                  wordBreak: 'break-word'
                }}
              >
                {message.content}
              </div>
              <small style={{ marginTop: '2px', color: '#888', fontSize: '10px' }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </small>
            </div>
          ))
        )}
        {isLoading && (
          <div style={{ display: 'flex', padding: '10px', alignItems: 'center' }}>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div
        style={{
          display: 'flex',
          padding: '10px',
          borderTop: '1px solid #eee',
          backgroundColor: '#f9f9f9'
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          style={{
            flex: 1,
            border: '1px solid #ddd',
            borderRadius: '18px',
            padding: '8px 12px',
            resize: 'none',
            outline: 'none',
            fontSize: '14px',
            fontFamily: 'inherit',
            maxHeight: '100px',
            minHeight: '40px'
          }}
          rows={1}
        />
        <button
          onClick={handleSendMessage}
          disabled={inputValue.trim() === '' || isLoading}
          style={{
            marginLeft: '8px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputValue.trim() === '' || isLoading ? 'not-allowed' : 'pointer',
            opacity: inputValue.trim() === '' || isLoading ? 0.7 : 1
          }}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Creates and renders a ChatPanel component
 */
export function createChatPanel() {
  const panelContainer = document.createElement('div');
  panelContainer.id = 'wordstream-chat-panel-container';
  document.body.appendChild(panelContainer);

  const root = document.createElement('div');
  root.id = 'wordstream-chat-panel-root';
  panelContainer.appendChild(root);

  // Initial render with panel hidden
  let isVisible = false;
  
  const render = () => {
    ReactDOM.render(
      <ChatPanel 
        isVisible={isVisible} 
        onClose={() => {
          isVisible = false;
          render();
        }}
      />,
      root
    );
  };

  // Initial render
  render();

  // Return control functions
  return {
    show: () => {
      isVisible = true;
      render();
    },
    hide: () => {
      isVisible = false;
      render();
    },
    toggle: () => {
      isVisible = !isVisible;
      render();
    },
    isVisible: () => isVisible
  };
}

export default ChatPanel; 