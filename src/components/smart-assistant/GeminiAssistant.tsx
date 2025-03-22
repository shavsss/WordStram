import React, { useState, useRef, useEffect } from 'react';
import { sendToGemini, GeminiMessage } from '@/services/gemini/gemini-service';
import { ChatConversation, ChatsStorage, VideoChatsMap } from '@/types/chats';

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
 * Gemini AI Assistant component for asking questions about video content
 * Simplified version without chat persistence
 */
export function GeminiAssistant({ 
  videoId, 
  videoTitle, 
  isVisible, 
  onClose 
}: GeminiAssistantProps) {
  // States
  const [messages, setMessages] = useState<GeminiMessage[]>([]);
  const [input, setInput] = useState('');
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get current size based on selected option
  const currentSize = SIZES[sizeOption];
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Visibility logging
  useEffect(() => {
    console.log('WordStream: GeminiAssistant visibility changed to', isVisible ? 'visible' : 'hidden');
    if (isVisible) {
      console.log('WordStream: GeminiAssistant position:', position);
    }
  }, [isVisible, position]);
  
  // Save chat to storage
  const saveChat = async (updatedMessages: GeminiMessage[]) => {
    try {
      // Skip if no messages or Chrome API not available
      if (!updatedMessages.length || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.log('WordStream: Skipping chat save - no messages or Chrome API not available');
        return;
      }
      
      console.log('WordStream: Saving chat for videoId:', videoId);
      
      const videoURL = window.location.href;
      
      // שמירה בפורמט הישן עבור תאימות לאחור
      chrome.storage.local.set(
        { [`chat-${videoId}`]: updatedMessages },
        () => {
          if (chrome.runtime.lastError) {
            console.error('WordStream ERROR: Failed to save chat in old format:', chrome.runtime.lastError);
          } else {
            console.log('WordStream: Chat saved in legacy format successfully');
          }
        }
      );
      
      // יצירת מזהה ייחודי לשיחה אם עוד לא קיים
      // אנחנו משתמשים בסטייט כדי לשמור על אותו מזהה לאורך כל השיחה
      const [conversationId] = useState(() => `chat_${videoId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`);
      
      // שמירה בפורמט החדש לקומפוננטת SavedChats
      chrome.storage.local.get(['chats_storage', 'video_chats_map'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream ERROR: Failed to get storage:', chrome.runtime.lastError);
          return;
        }
        
        // Initialize or get current storages
        const chatsStorage: ChatsStorage = result.chats_storage || {};
        const videoChatsMap: VideoChatsMap = result.video_chats_map || {};
        
        console.log('WordStream: Current chats storage:', chatsStorage);
        
        // עדכון או יצירת השיחה
        chatsStorage[conversationId] = {
          conversationId,
          videoId,
          videoTitle,
          videoURL,
          lastUpdated: new Date().toISOString(),
          messages: updatedMessages
        };
        
        // עדכון מיפוי הוידאו לשיחות
        if (!videoChatsMap[videoId]) {
          videoChatsMap[videoId] = [];
        }
        
        // וודא שה-conversationId נמצא במיפוי
        if (!videoChatsMap[videoId].includes(conversationId)) {
          videoChatsMap[videoId].push(conversationId);
        }
        
        // שמירת שני המאגרים
        console.log('WordStream: Saving updated chats storage and mapping');
        chrome.storage.local.set({ 
          chats_storage: chatsStorage,
          video_chats_map: videoChatsMap 
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('WordStream ERROR: Error saving chat:', chrome.runtime.lastError);
            return;
          }
          console.log('WordStream: Chat saved successfully in unified format, conversationId:', conversationId);
        });
      });
    } catch (error) {
      console.error('WordStream ERROR: Exception in chat saving process:', error);
    }
  };
  
  // Handle sending message to Gemini
  const handleSendMessage = async (inputValue: string) => {
    // Skip if input is empty
    if (!inputValue.trim()) return;

    // Add user message to chat
    const userMsg: GeminiMessage = { role: 'user', content: inputValue };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      console.log('WordStream: Sending message with history:', messages.length, 'previous messages');
      
      // Always send the full conversation history to maintain context
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        throw new Error('Chrome runtime API not available');
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'gemini',
        message: inputValue,
        history: messages,
        videoId: videoId
      });

      console.log('WordStream: Received response from Gemini API:', !!response);
        
      if (!response || response.error) {
        console.error('WordStream ERROR: Problem with Gemini response:', response?.error || "Empty response");
        throw new Error('Error processing response');
      }

      // Add the response to the chat
      if (response && response.answer) {
        const assistantMsg: GeminiMessage = { role: 'assistant', content: response.answer };
        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);
        
        // Save the chat after adding assistant response
        saveChat(updatedMessages);
      }
    } catch (error) {
      console.error('WordStream ERROR: Error sending message:', error);
      
      // Add error message
      const errorMsg: GeminiMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please try again.' 
      };
      const updatedMessages = [...newMessages, errorMsg];
      setMessages(updatedMessages);
      
      // Save the chat even if there was an error
      saveChat(updatedMessages);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };
  
  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('input')) return;
    
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
        right: `${position.x}px`,
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
        <div style={{ fontSize: '16px', fontWeight: 600 }}>AI Assistant</div>
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
                    ? '#6366F1'
                    : (isDarkMode ? '#333' : '#e8e8e8'),
                  color: sizeOption === size 
                    ? 'white' 
                    : (isDarkMode ? '#ccc' : '#555'),
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

      {/* Content area */}
      <div 
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: isDarkMode ? '#121212' : '#ffffff'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            textAlign: 'center' 
          }}>
            <div style={{ 
              marginBottom: '16px', 
              color: isDarkMode ? '#a885ff' : '#6366F1',  
              background: isDarkMode ? 'rgba(168, 133, 255, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              borderRadius: '50%',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <h3 style={{ 
              marginBottom: '8px', 
              color: isDarkMode ? '#ffffff' : '#050505',
              fontWeight: 600
            }}>
              Ask about the video content
            </h3>
            <p style={{ 
              color: isDarkMode ? '#cccccc' : '#666666', 
              marginBottom: '24px', 
              maxWidth: '280px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Example: "What does this expression mean?" or "Explain the historical context"
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((message, index) => (
              <div 
                key={index} 
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: message.role === 'user' 
                    ? (isDarkMode ? '#4c6ef5' : '#4b8df8')
                    : (isDarkMode ? '#2a2a30' : '#eff1f5'),
                  color: message.role === 'user' 
                    ? 'white' 
                    : (isDarkMode ? '#e8e8e8' : '#333333'),
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: message.role === 'user' 
                    ? 'none'
                    : `1px solid ${isDarkMode ? '#444444' : '#e0e0e0'}`
                }}
              >
                <p style={{ whiteSpace: 'pre-line', margin: 0 }}>
                  {message.content}
                </p>
              </div>
            ))}
            {isLoading && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                maxWidth: '85%',
                alignSelf: 'flex-start',
                backgroundColor: isDarkMode ? '#1e1e20' : '#f2f4f8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isDarkMode ? '#ffffff' : '#121212'
              }}>
                <div className="spinner" style={{ 
                  width: '16px', 
                  height: '16px',
                  border: `2px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderTopColor: '#6366F1',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}>
                </div>
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area - fixed to bottom */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
        position: 'relative'
      }}>
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} 
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
              borderRadius: '8px',
              backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
              color: isDarkMode ? '#ffffff' : '#121212',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: isLoading || !input.trim() 
                ? (isDarkMode ? '#444' : '#ddd')
                : '#6366F1',
              color: isLoading || !input.trim() 
                ? (isDarkMode ? '#888' : '#aaa')
                : 'white',
              border: 'none',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
          </button>
        </form>
      </div>
      
      {/* Animation for spinner */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
} 