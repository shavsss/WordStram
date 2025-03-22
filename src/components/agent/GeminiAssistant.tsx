import React, { useState, useRef, useEffect } from 'react';
import { fetchChatCompletions } from '../../utils/api';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiAssistantProps {
  videoId: string;
  videoTitle: string;
  isVisible: boolean;
  onClose: () => void;
}

// Predefined sizes for the popup
type SizeOption = 'small' | 'medium' | 'large';
interface SizeConfig {
  width: number;
  height: number;
}

const SIZES: Record<SizeOption, SizeConfig> = {
  small: { width: 320, height: 400 },
  medium: { width: 400, height: 550 },
  large: { width: 500, height: 700 }
};

/**
 * Gemini AI assistant component to chat about video content
 */
export function GeminiAssistant({
  videoId,
  videoTitle,
  isVisible,
  onClose
}: GeminiAssistantProps) {
  // States
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Size and position state
  const [sizeOption, setSizeOption] = useState<SizeOption>('medium');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Get current size based on selected option
  const currentSize = SIZES[sizeOption];
  
  // Initialize the chat with a welcome message
  useEffect(() => {
    if (isVisible && messages.length === 0) {
      const welcomeMessage: AssistantMessage = {
        role: 'assistant',
        content: `Hello! I'm your AI video assistant. I can help you understand "${videoTitle}" better. What would you like to know?`
      };
      setMessages([welcomeMessage]);
    }
  }, [isVisible, messages.length, videoTitle]);
  
  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Send message to Gemini API
  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;
    
    const userMessage: AssistantMessage = {
      role: 'user',
      content: currentMessage
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    
    try {
      // Create prompt context about the video
      const context = `You are an expert assistant analyzing a YouTube video titled "${videoTitle}". The user is watching this video and asking questions about it. If you don't know specific details about the video content that weren't mentioned, you can ask them to provide more context or details from the video. Be helpful, concise, and focus on educational value.`;
      
      // Get previous chat history for context
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      
      // Add user's new message
      chatHistory.push({
        role: 'user',
        parts: [{ text: currentMessage }]
      });
      
      // Call Gemini API
      const response = await fetchChatCompletions(context, chatHistory);
      
      if (response && response.candidates && response.candidates[0].content) {
        const botMessage: AssistantMessage = {
          role: 'assistant',
          content: response.candidates[0].content.parts[0].text
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('WordStream: Error calling Gemini API:', error);
      const errorMessage: AssistantMessage = {
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'Sorry, I encountered an error processing your request. Please try again later.'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle drag functionality
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('textarea')) return;
    
    if (!(e.target as HTMLElement).closest('.header')) return;
    
    setIsDragging(true);
    dragStartPos.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    };
    
    e.preventDefault();
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Handle size change
  const handleSizeChange = (size: SizeOption) => {
    setSizeOption(size);
  };
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };
  
  if (!isVisible) return null;
  
  return (
    <div 
      ref={containerRef}
      className={isDarkMode ? 'dark' : 'light'}
      style={{ 
        position: 'fixed',
        width: `${currentSize.width}px`,
        height: `${currentSize.height}px`,
        top: `${position.y}px`, 
        left: `${position.x}px`,
        zIndex: 9999999,
        backgroundColor: isDarkMode ? '#121212' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'rgba(0, 0, 0, 0.25) 0px 4px 12px',
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
        fontSize: '14px',
        color: isDarkMode ? '#ffffff' : '#121212'
      }}
    >
      {/* Header */}
      <div 
        className="header"
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
          cursor: 'move'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ fontSize: '16px', fontWeight: 600 }}>AI Video Assistant</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Size options */}
          <div style={{ 
            display: 'flex', 
            border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
            borderRadius: '4px', 
            overflow: 'hidden' 
          }}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                style={{
                  padding: '4px 8px',
                  backgroundColor: sizeOption === size 
                    ? (isDarkMode ? '#6366F1' : '#6366F1') 
                    : (isDarkMode ? '#333' : '#f0f0f0'),
                  color: sizeOption === size 
                    ? 'white' 
                    : (isDarkMode ? '#ccc' : '#333'),
                  border: 'none',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSizeChange(size);
                }}
              >
                {size.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          
          {/* Dark mode toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDarkMode();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#ffffff' : '#000000',
              transition: 'all 0.2s ease',
              width: '32px',
              height: '32px'
            }}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {/* Close button */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              color: isDarkMode ? '#ffffff' : '#121212',
              width: '24px',
              height: '24px'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Messages container */}
      <div 
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: isDarkMode ? '#121212' : '#ffffff'
        }}
      >
        {messages.map((message, index) => (
          <div 
            key={index}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: message.role === 'user' 
                  ? (isDarkMode ? '#10B981' : '#10B981')
                  : (isDarkMode ? '#1e1e1e' : '#f5f5f5'),
                color: message.role === 'user' ? 'white' : (isDarkMode ? '#ffffff' : '#121212'),
                wordBreak: 'break-word',
                lineHeight: 1.5,
                whiteSpace: 'pre-line'
              }}
            >
              {message.content}
            </div>
            <div 
              style={{ 
                fontSize: '11px', 
                marginTop: '4px',
                marginLeft: message.role === 'user' ? 'auto' : '12px',
                marginRight: message.role === 'user' ? '8px' : 'auto',
                color: isDarkMode ? '#888888' : '#888888'
              }}
            >
              {message.role === 'user' ? 'You' : 'AI Assistant'}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div 
            style={{
              alignSelf: 'flex-start',
              marginLeft: '8px',
              display: 'flex',
              gap: '4px'
            }}
          >
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#888888' : '#888888',
                opacity: 0.6,
                animation: 'pulse 1s infinite'
              }}
            />
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#888888' : '#888888',
                opacity: 0.6,
                animation: 'pulse 1s infinite 0.2s'
              }}
            />
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#888888' : '#888888',
                opacity: 0.6,
                animation: 'pulse 1s infinite 0.4s'
              }}
            />
            <style>
              {`
                @keyframes pulse {
                  0%, 100% { opacity: 0.4; transform: scale(0.8); }
                  50% { opacity: 1; transform: scale(1.2); }
                }
              `}
            </style>
          </div>
        )}
      </div>
      
      {/* Input area - fixed to bottom */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5'
      }}>
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}
        >
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="Ask me anything about this video..."
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
              borderRadius: '12px',
              resize: 'none',
              minHeight: '60px',
              backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#121212',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: isDarkMode ? '#aaaaaa' : '#666666'
            }}>
              Press Shift+Enter for a new line
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !currentMessage.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: isLoading || !currentMessage.trim() 
                  ? (isDarkMode ? '#444' : '#ddd') 
                  : '#10B981',
                color: isLoading || !currentMessage.trim() 
                  ? (isDarkMode ? '#888' : '#aaa')
                  : 'white',
                border: 'none',
                cursor: isLoading || !currentMessage.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isLoading ? 'Thinking...' : 'Send'}
              {!isLoading && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2z"></path>
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* Attribution */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: isDarkMode ? '#121212' : '#ffffff',
        borderTop: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        fontSize: '11px',
        textAlign: 'center',
        color: isDarkMode ? '#888888' : '#888888'
      }}>
        Powered by Google Gemini AI
      </div>
    </div>
  );
} 