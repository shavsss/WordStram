/// <reference types="chrome"/>

/**
 * Gemini API Service
 * Provides functionality for interacting with Google's Gemini API.
 */

import { getUserAuthentication } from '../shared/WindowManager';
import { GEMINI_API_CONFIG } from '../../config/api-config';
import { AI_ASSISTANT_CONTEXT } from './chat-context';

interface GeminiConfig {
  model: string;
  maxTokens: number;
}

// Default configuration for Gemini API
export const GEMINI_CONFIG: GeminiConfig = {
  model: GEMINI_API_CONFIG.MODEL,
  maxTokens: GEMINI_API_CONFIG.MAX_TOKENS
};

// Message format for conversation history
export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Context for Gemini API calls
interface GeminiContext {
  videoTitle?: string;
  videoId?: string;
  videoURL?: string;
  channelName?: string;
  description?: string;
}

// Message with metadata for storage
export interface GeminiMessageWithMetadata extends GeminiMessage {
  timestamp: number;
  id: string;
}

// Chat session interface for Firebase storage
export interface GeminiChatSession {
  id: string;
  title: string;
  messages: GeminiMessageWithMetadata[];
  context: GeminiContext;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

/**
 * Generate a unique ID for messages and sessions
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Send a query to Gemini API with conversation history
 * @param query The query to send to Gemini
 * @param history Conversation history
 * @param videoTitle Optional video title for context
 * @param options Additional options including language
 * @returns A string containing the Gemini response
 */
export async function sendToGemini(
  query: string,
  history: GeminiMessage[],
  videoTitle: string = '',
  options: {
    language?: string,
    syncAcrossDevices?: boolean
  } = {}
): Promise<string> {
  try {
    // Get user authentication
    const user = await getUserAuthentication();
    if (!user) {
      throw new Error('User not authenticated. Please sign in to use this feature.');
    }
    
    // Create context object with available information
    const context: GeminiContext = { videoTitle };
    
    // Try to get additional context if on YouTube
    if (window.location.hostname.includes('youtube.com')) {
      // Extract video ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      context.videoId = urlParams.get('v') || undefined;
      
      // Try to get video description
      const descElement = document.querySelector('div#description-inline-expander');
      if (descElement) {
        context.description = descElement.textContent?.trim() || undefined;
      }
      
      // Try to get channel name
      const channelElement = document.querySelector('div#owner #channel-name');
      if (channelElement) {
        context.channelName = channelElement.textContent?.trim() || undefined;
      }
      
      // Set video URL
      if (context.videoId) {
        context.videoURL = `https://www.youtube.com/watch?v=${context.videoId}`;
      }
    } else {
      // For non-YouTube pages, get current page URL and title
      context.videoURL = window.location.href;
      context.videoTitle = document.title;
    }
    
    // Convert messages to the format expected by the background script
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get preferred language from options or localStorage
    const preferredLanguage = options.language || 
      localStorage.getItem('wordstream-language') || 
      'en';
    
    // Send request to background script which has access to Gemini API
    const response = await new Promise<string>((resolve, reject) => {
      // Add timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        reject(new Error('Request to Gemini API timed out'));
      }, 30000);

      try {
        chrome.runtime.sendMessage({
          action: 'GEMINI_CHAT',
          query,
          history: formattedHistory,
          context,
          language: preferredLanguage,
          userId: user.uid
        }, (response) => {
          clearTimeout(timeout);
          
          // Check for chrome runtime errors
          if (chrome.runtime.lastError) {
            console.error('Error sending message to Gemini:', chrome.runtime.lastError);
            
            // If the message port closed error occurred, provide a fallback response
            if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes('message port closed')) {
              console.log('WordStream: Using fallback response due to closed message port');
              resolve("I'm sorry, but I couldn't process your request through the Gemini API. The connection was interrupted. Please try again later.");
              return;
            }
            
            reject(new Error(chrome.runtime.lastError.message || 'Unknown runtime error'));
            return;
          }
          
          if (!response || !response.success) {
            // Check if response contains a suggestion to set up an API key
            if (response?.error?.includes('API key')) {
              reject(new Error('Gemini API key not configured. Please set up your API key in the extension settings.'));
              return;
            }
            
            reject(new Error(response?.error || 'Failed to get response from Gemini'));
            return;
          }
          
          resolve(response.content || response.answer || 'No response content');
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('Error in sendMessage:', error);
        resolve("I'm sorry, but I couldn't connect to the Gemini API. Please try again later.");
      }
    });

    // Save chat history to Firebase with proper user authentication
    await saveGeminiChat(user.uid, query, response, history, context);
    
    return response;
  } catch (error) {
    console.error('Error in sendToGemini:', error);
    // Provide more user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Gemini API key not configured. Please set up your API key in the extension settings.');
      } else if (error.message.includes('timed out')) {
        throw new Error('The request to Gemini timed out. Please check your internet connection and try again.');
      } else if (error.message.includes('quota')) {
        throw new Error('Your Gemini API quota has been exceeded. Please try again later.');
      } else if (error.message.includes('message port closed')) {
        return "I'm sorry, I couldn't process your request through the Gemini API. The connection was interrupted. Please try again later.";
      } else if (error.message.includes('not authenticated')) {
        throw new Error('Please sign in to use the Gemini AI features.');
      }
    }
    throw error;
  }
}

/**
 * Save Gemini chat message to Firebase
 */
async function saveGeminiChat(
  userId: string,
  query: string,
  response: string,
  history: GeminiMessage[],
  context: GeminiContext
): Promise<void> {
  try {
    // Create new user message with metadata
    const userMessage: GeminiMessageWithMetadata = {
      role: 'user',
      content: query,
      timestamp: Date.now(),
      id: generateId()
    };

    // Create new assistant message with metadata
    const assistantMessage: GeminiMessageWithMetadata = {
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      id: generateId()
    };

    // Get existing session or create new one
    let sessionId = await getActiveSessionId();
    
    if (!sessionId) {
      // Create a new session
      sessionId = generateId();
      const title = context.videoTitle || 'Chat Session';
      
      // Save new session ID to storage but only as a reference
      await chrome.storage.local.set({
        'gemini_active_session': sessionId
      });
      
      // Create new chat session in Firebase
      await chrome.runtime.sendMessage({
        action: 'SAVE_CHAT',
        chat: {
          id: sessionId,
          title,
          messages: [...history.map(msg => ({
            ...msg,
            timestamp: Date.now(),
            id: generateId()
          })), userMessage, assistantMessage],
          context,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId
        }
      });
    } else {
      // Update existing session
      await chrome.runtime.sendMessage({
        action: 'UPDATE_CHAT',
        chatId: sessionId,
        updates: {
          messages: [...history, userMessage, assistantMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: (msg as GeminiMessageWithMetadata).timestamp || Date.now(),
            id: (msg as GeminiMessageWithMetadata).id || generateId()
          })),
          updatedAt: Date.now(),
          context
        }
      });
    }
  } catch (error) {
    console.error('Error saving Gemini chat to Firebase:', error);
    // Don't throw, just log the error to not interrupt the chat flow
  }
}

/**
 * Get the active session ID from storage
 */
async function getActiveSessionId(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    chrome.storage.local.get(['gemini_active_session'], (result) => {
      if (result && result.gemini_active_session) {
        resolve(result.gemini_active_session);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Generate a summary of text using Gemini
 * @param text The text to summarize
 * @param language Language to use for the summary (e.g., 'en', 'he')
 * @returns A promise resolving to the summary
 */
export async function generateSummary(text: string, language: string = 'en'): Promise<string> {
  try {
    // Create a prompt specifically for summarization
    const prompt = `Summarize the following text in ${language}. 
Make the summary concise but comprehensive, highlighting the key points:

${text}`;
    
    // Send request to background script
    return new Promise<string>((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'GEMINI_SUMMARIZE',
        text: prompt,
        language
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error generating summary:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response || !response.success) {
          reject(new Error(response?.error || 'Failed to generate summary'));
          return;
        }
        
        resolve(response.summary || response.content || response.answer || 'No summary generated');
      });
    });
  } catch (error) {
    console.error('Error in generateSummary:', error);
    throw error;
  }
}

/**
 * Check if Gemini API key is configured
 * @returns A promise resolving to a boolean indicating if the API key is configured
 */
export async function isGeminiConfigured(): Promise<boolean> {
  try {
    return new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage({
        action: 'CHECK_GEMINI_CONFIG'
      }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          resolve(false);
          return;
        }
        
        resolve(response.configured || false);
      });
    });
  } catch (error) {
    console.error('Error checking Gemini configuration:', error);
    return false;
  }
}

/**
 * Gemini AI Service
 * Handles interactions with Google's Gemini AI API
 */

// Define message history interface
export interface HistoryMessage {
  role: string;
  content: string;
}

// Define Gemini request interface
export interface GeminiRequest {
  action: string;
  message: string;
  history?: HistoryMessage[];
  videoId?: string;
  videoTitle?: string;
  videoContext?: {
    description?: string;
    channelName?: string;
    episodeTitle?: string;
    synopsis?: string;
    url?: string;
  };
  model?: string;
}

// Define Gemini response interface
export interface GeminiResponse {
  success: boolean;
  answer?: string;
  error?: string;
}

/**
 * Get Gemini API key from storage
 */
async function getGeminiApiKey(): Promise<string> {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['api_keys'], (result) => {
        if (result && result.api_keys && result.api_keys.GOOGLE_API_KEY) {
          resolve(result.api_keys.GOOGLE_API_KEY);
        } else {
          // Fallback to configured API key
          const fallbackKey = GEMINI_API_CONFIG.FALLBACK_API_KEY;
          
          // Save fallback key to storage for future use
          chrome.storage.local.set({
            'api_keys': { 'GOOGLE_API_KEY': fallbackKey }
          });
          
          console.log('WordStream: Using fallback Gemini API key');
          resolve(fallbackKey);
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Error retrieving Gemini API key:', error);
    throw new Error('Failed to retrieve Gemini API key');
  }
}

/**
 * Initialize Gemini API key
 */
export async function initializeGeminiApiKey(): Promise<void> {
  try {
    const apiKey = await getGeminiApiKey();
    console.log('WordStream: Gemini API key initialized');
  } catch (error) {
    console.error('WordStream: Failed to initialize Gemini API key:', error);
    throw error;
  }
}

/**
 * Handle Gemini AI request
 * @param request GeminiRequest object containing message and context
 */
export async function handleGeminiRequest(request: GeminiRequest): Promise<GeminiResponse> {
  try {
    console.log('WordStream: Handling Gemini request:', request.action);
    
    if (!request.message || request.message.trim().length === 0) {
      return {
        success: false,
        error: 'No message provided for Gemini'
      };
    }
    
    // Get API key from storage
    const apiKey = await getGeminiApiKey();
    
    // Determine the model to use
    const model = request.model || GEMINI_API_CONFIG.MODEL;
    
    // Construct the API URL using centralized config
    const url = GEMINI_API_CONFIG.getApiUrl(apiKey, model);
    
    // Build the request body
    const requestBody: any = {
      contents: []
    };
    
    // IMPORTANT: Gemini doesn't support system role like OpenAI
    // Instead, we'll add the assistant context as a user message at the beginning
    // This resolves the "Content with system role is not supported" error
    requestBody.contents.push({
      role: 'user',
      parts: [{ text: `Instructions for the assistant: ${AI_ASSISTANT_CONTEXT}` }]
    });
    
    // If we have a response from the model acknowledging the instructions, add it
    requestBody.contents.push({
      role: 'model',
      parts: [{ text: 'I\'ll follow these instructions carefully.' }]
    });
    
    // Add message history if available
    if (request.history && request.history.length > 0) {
      // Convert history to Gemini format - ensure we don't have any system roles
      const historyMessages = request.history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model', // Convert 'assistant' to 'model'
        parts: [{ text: msg.content }]
      }));
      
      // Add history messages
      requestBody.contents = requestBody.contents.concat(historyMessages);
    }
    
    // Add current message
    requestBody.contents.push({
      role: 'user',
      parts: [{ text: constructPrompt(request) }]
    });
    
    // Set generation config for consistent outputs
    requestBody.generationConfig = GEMINI_API_CONFIG.DEFAULTS;
    
    // Send request to Gemini API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('WordStream: Gemini API response error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.candidates && result.candidates.length > 0 && 
        result.candidates[0].content && 
        result.candidates[0].content.parts && 
        result.candidates[0].content.parts.length > 0) {
      return {
        success: true,
        answer: result.candidates[0].content.parts[0].text
      };
    } else {
      console.error('WordStream: Invalid Gemini API response format:', result);
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    console.error('WordStream: Gemini request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Construct a prompt based on request data
 */
function constructPrompt(request: GeminiRequest): string {
  let prompt = request.message;
  
  // Add video context if available
  if (request.videoContext) {
    prompt = `
Video Information:
Title: ${request.videoTitle || 'N/A'}
${request.videoContext.channelName ? `Channel: ${request.videoContext.channelName}` : ''}
${request.videoContext.description ? `Description: ${request.videoContext.description}` : ''}
${request.videoContext.synopsis ? `Synopsis: ${request.videoContext.synopsis}` : ''}
${request.videoContext.url ? `URL: ${request.videoContext.url}` : ''}

User Question: ${request.message}
    `.trim();
  }
  
  return prompt;
}

/**
 * Check if Gemini service is available
 */
export async function checkGeminiAvailable(): Promise<{ success: boolean, available: boolean, error?: string }> {
  try {
    // Check if API key exists
    const apiKey = await getGeminiApiKey().catch(() => null);
    
    if (!apiKey) {
      return {
        success: true,
        available: false,
        error: 'No API key configured for Gemini service'
      };
    }
    
    // Test API with a simple request
    const testResult = await handleGeminiRequest({
      action: 'test',
      message: 'Hello',
      model: GEMINI_API_CONFIG.MODEL
    });
    
    return {
      success: true,
      available: testResult.success
    };
  } catch (error) {
    return {
      success: false,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 