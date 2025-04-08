/**
 * API utilities for communicating with Google's Gemini API
 */

// Type definitions for Gemini API responses
interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiContentPart[];
  role: string;
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiHistoryItem {
  role: string;
  parts: { text: string }[];
}

/**
 * Fetches chat completions from the Gemini API
 * 
 * @param systemPrompt - The system prompt or context for the conversation
 * @param history - Previous messages in the conversation
 * @returns The Gemini API response
 */
export async function fetchChatCompletions(
  systemPrompt: string,
  history: GeminiHistoryItem[]
): Promise<GeminiResponse> {
  try {
    // Get API key from storage
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      throw new Error('No API key found. Please set your Gemini API key in the extension settings.');
    }
    
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    const url = `${endpoint}?key=${apiKey}`;
    
    // Format messages according to Gemini API requirements
    const systemMessage = {
      role: 'user',
      parts: [{ text: systemPrompt }]
    };
    
    const messages = [systemMessage, ...history];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WordStream: Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as GeminiResponse;
  } catch (error) {
    console.error('WordStream: Error in fetchChatCompletions:', error);
    throw error;
  }
}

/**
 * Gets the API key from Chrome storage
 * Should be called before making API requests
 */
export async function getApiKey(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      resolve(result.geminiApiKey || '');
    });
  });
}

/**
 * Saves the API key to Chrome storage
 * 
 * @param apiKey - The Gemini API key to save
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      resolve();
    });
  });
} 