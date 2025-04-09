/// <reference types="chrome"/>

import { SupportedLanguageCode } from '@/config/supported-languages';

interface GeminiConfig {
  apiKey: string;
  model: string;
  fallbackModel: string;
  secondaryFallbackModel: string;
  maxTokens: number;
}

// Default configuration for Gemini API
export const GEMINI_CONFIG: GeminiConfig = {
  apiKey: 'REQUIRES_SECURE_LOADING', // Replace with secure loading mechanism
  model: 'gemini-pro-latest', // תמיד מצביע על הגרסה העדכנית ביותר הזמינה
  fallbackModel: 'gemini-1.5-pro', // המודל העדכני והחזק ביותר הזמין רשמית (2024)
  secondaryFallbackModel: 'gemini-1.5-flash', // המודל המהיר והעדכני ביותר לתרחישי גיבוי
  maxTokens: 8192 // הגדלת מספר הטוקנים המקסימלי לתשובות ארוכות ומפורטות יותר
};

// Message format for conversation history
export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Send a query to Gemini API with conversation history
 */
export async function sendToGemini(
  query: string,
  history: GeminiMessage[],
  videoTitle: string
): Promise<string> {
  try {
    // Try to get API key from Chrome Storage or use the same as Google Translate
    const storageResult = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = storageResult.geminiApiKey || GEMINI_CONFIG.apiKey;
    
    console.log("Using API key for Gemini:", apiKey.substring(0, 10) + "...");
    
    if (!apiKey) {
      return "API key not configured. Please set your Gemini API key in the extension settings.";
    }
    
    // Instead of making a direct fetch request, use chrome.runtime.sendMessage to send via background script
    const response = await chrome.runtime.sendMessage({
      action: 'gemini',
      message: query,
      history: history,
      videoTitle: videoTitle
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get response from Gemini');
    }
    
    return response.answer || 'No answer received';
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "Sorry, I couldn't process your request at this time. Please try again later.";
  }
} 