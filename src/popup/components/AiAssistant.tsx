import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../shared/hooks/useAuth';
import { MessageType } from '../../shared/message-types';
import { Typography, TextField, Button, Box, CircularProgress, Alert, Paper } from '@mui/material';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import './AiAssistant.css';

// Define MessageData type
interface MessageData {
  type: MessageType;
  payload?: {
    message?: string;
    prompt?: string;
    saveHistory?: boolean;
    history?: any[];
    videoContext?: {
      title?: string;
      url?: string;
      channelName?: string;
      description?: string;
    };
    videoTitle?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
  error?: string;
}

interface VideoContext {
  title?: string;
  url?: string;
  channelName?: string;
  description?: string;
}

// Initialize markdown parser
const md = new MarkdownIt({
  breaks: true,
  linkify: true,
});

const MessageComponent: React.FC<{ message: Message }> = ({ message }) => {
  // Use markdown rendering for assistant messages
  const getContent = () => {
    if (message.sender === 'assistant') {
      const sanitized = DOMPurify.sanitize(md.render(message.content));
      return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
    }
    return <div>{message.content}</div>;
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: message.sender === 'assistant' ? '#f0f7ff' : '#f5f5f5',
        maxWidth: '80%',
        marginLeft: message.sender === 'user' ? 'auto' : '0',
        position: 'relative',
      }}
    >
      <Typography variant="body1">{getContent()}</Typography>
      {message.status === 'sending' && (
        <CircularProgress size={16} sx={{ position: 'absolute', bottom: 4, right: 4 }} />
      )}
      {message.status === 'error' && (
        <Typography color="error" variant="caption">
          {message.error || 'Failed to send'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block" textAlign="right">
        {new Date(message.timestamp).toLocaleTimeString()}
      </Typography>
    </Paper>
  );
};

const AiAssistant: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'available' | 'unavailable' | 'checking'>('checking');
  const [videoContext, setVideoContext] = useState<VideoContext | null>(null);
  const [isVideoPage, setIsVideoPage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Function to send message with timeout
  const sendMessageWithTimeout = (message: MessageData, timeout = 10000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, timeout);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    });
  };
  
  // Fetch video context from the active tab
  useEffect(() => {
    const fetchVideoContext = async () => {
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTabId = tabs[0]?.id;
        
        if (!activeTabId) return;
        
        // Send message to content script to get video context
        chrome.tabs.sendMessage(
          activeTabId,
          { type: MessageType.GET_VIDEO_CONTEXT },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log('No video context available');
              setIsVideoPage(false);
              return;
            }
            
            if (response && response.success && response.data) {
              console.log('Received video context:', response.data);
              setVideoContext(response.data);
              setIsVideoPage(true);
            } else {
              setIsVideoPage(false);
            }
          }
        );
      } catch (error) {
        console.error('Error fetching video context:', error);
        setIsVideoPage(false);
      }
    };
    
    if (isAuthenticated && serviceStatus === 'available') {
      fetchVideoContext();
    }
  }, [isAuthenticated, serviceStatus]);
  
  // Check if Gemini service is available
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const response = await sendMessageWithTimeout({
          type: MessageType.SYSTEM_STATUS,
        });
        
        if (response && response.initialized) {
          setServiceStatus('available');
        } else {
          setServiceStatus('unavailable');
          setError('AI service is not initialized. Please try again later.');
        }
      } catch (err) {
        console.error('Failed to check service status:', err);
        setServiceStatus('unavailable');
        setError('Could not connect to the background service. Please refresh the extension.');
      }
    };
    
    if (isAuthenticated) {
      checkServiceStatus();
    }
  }, [isAuthenticated]);
  
  // Load conversation history
  useEffect(() => {
    const loadHistory = async () => {
      if (!isAuthenticated || serviceStatus !== 'available') return;
      
      setIsLoading(true);
      try {
        const response = await sendMessageWithTimeout({
          type: MessageType.GEMINI_GET_HISTORY,
        });
        
        if (response && response.success && response.history) {
          const formattedMessages: Message[] = response.history.map((item: any) => ({
            id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            sender: item.role === 'user' ? 'user' : 'assistant',
            content: item.content,
            timestamp: item.timestamp || Date.now(),
            status: 'sent'
          }));
          
          setMessages(formattedMessages);
        }
      } catch (err: any) {
        console.error('Failed to load history:', err);
        setError(`Failed to load conversation history: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHistory();
  }, [isAuthenticated, serviceStatus]);
  
  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isAuthenticated || serviceStatus !== 'available') return;
    
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sender: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setError(null);
    
    try {
      // Include video context in the query if available
      const messageData: MessageData = {
        type: MessageType.GEMINI_QUERY,
        payload: {
          message: userMessage.content,
          saveHistory: true
        }
      };
      
      // Add video context if available
      if (videoContext && (videoContext.title || videoContext.url || videoContext.channelName || videoContext.description)) {
        // Ensure payload exists
        if (messageData.payload) {
          messageData.payload.videoContext = videoContext;
        }
        
        // Log the video context being sent
        console.log('Sending query with video context:', {
          message: userMessage.content,
          videoContext
        });
      }
      
      const response = await sendMessageWithTimeout(messageData);
      
      // Update user message status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
        )
      );
      
      if (response && response.success) {
        // Add assistant message
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          sender: 'assistant',
          content: response.result,
          timestamp: Date.now(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Handle unsuccessful response
        setError(response?.error || 'Failed to get response from AI');
        // Update user message to show error
        setMessages(prev => 
          prev.map(msg => 
            msg.id === userMessage.id ? { ...msg, status: 'error', error: 'No response received' } : msg
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(`Failed to communicate with AI service: ${err.message}`);
      
      // Update user message to show error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'error', error: err.message } : msg
        )
      );
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  if (loading) {
    return <CircularProgress />;
  }
  
  if (!isAuthenticated) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Please sign in to use the AI Assistant</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        AI Assistant
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {isVideoPage && videoContext && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Using context from: {videoContext.title || 'Current video'}
        </Alert>
      )}
      
      {serviceStatus === 'checking' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress size={30} />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Checking service status...
          </Typography>
        </Box>
      )}
      
      {serviceStatus === 'unavailable' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          AI service is currently unavailable. Please try again later.
        </Alert>
      )}
      
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ my: 3 }}>
            {isVideoPage ? 
              'Ask me anything about the video or any other questions!' :
              'No messages yet. Start a conversation with the AI assistant!'}
          </Typography>
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={isVideoPage ? "Ask about this video..." : "Ask a question..."}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={serviceStatus !== 'available'}
          multiline
          maxRows={4}
          size="small"
        />
        <Button 
          variant="contained" 
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || serviceStatus !== 'available'}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default AiAssistant; 