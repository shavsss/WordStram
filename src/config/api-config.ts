/**
 * Central API configuration for WordStream
 * This file centralizes all API configurations and version information
 */

// Gemini API Configuration
export const GEMINI_API_CONFIG = {
  // Current model version - updated from gemini-pro to gemini-1.5-pro
  MODEL: 'gemini-1.5-pro',
  
  // API version - updated from v1beta to v1
  API_VERSION: 'v1',
  
  // Default max tokens
  MAX_TOKENS: 4096,
  
  // Fallback API key (should be replaced in production)
  FALLBACK_API_KEY: 'AIzaSyC9LYYnWBb4OvIZhisFHpYTnbBV3XFvzYE',
  
  // Generation defaults
  DEFAULTS: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024
  },
  
  // Get the full API URL
  getApiUrl(apiKey: string, model?: string): string {
    const modelToUse = model || this.MODEL;
    return `https://generativelanguage.googleapis.com/${this.API_VERSION}/models/${modelToUse}:generateContent?key=${apiKey}`;
  }
};

// Authentication Configuration
export const AUTH_CONFIG = {
  // Check if user is authenticated from multiple sources
  async isUserAuthenticated(): Promise<boolean> {
    try {
      // Check window.WordStream first if available
      if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated === true) {
        return true;
      }
      
      // Try Chrome messaging as fallback
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        const response = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (result) => {
            if (chrome.runtime.lastError) {
              resolve({ isAuthenticated: false });
              return;
            }
            resolve(result || { isAuthenticated: false });
          });
        });
        
        return response?.isAuthenticated === true;
      }
      
      // Check chrome.storage.local as final fallback
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await new Promise<any>((resolve) => {
          chrome.storage.local.get(['wordstream_user_info'], (items) => {
            if (chrome.runtime.lastError) {
              resolve({});
              return;
            }
            resolve(items);
          });
        });
        
        return !!result?.wordstream_user_info;
      }
      
      return false;
    } catch (error) {
      console.error('WordStream: Error checking authentication status:', error);
      return false;
    }
  }
};

// YouTube Configuration
export const YOUTUBE_CONFIG = {
  // Check for YouTube authentication
  async checkYouTubeAuthentication(): Promise<boolean> {
    return AUTH_CONFIG.isUserAuthenticated();
  }
};

// Firebase Configuration
export const FIREBASE_CONFIG = {
  // Retry Firebase operations with authentication check
  async retryWithAuth<T>(operation: () => Promise<T>): Promise<T> {
    try {
      // First check authentication
      const isAuthenticated = await AUTH_CONFIG.isUserAuthenticated();
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      // Try the operation
      return await operation();
    } catch (error) {
      // If permission error, try to refresh auth state
      if (error instanceof Error && 
          (error.message.includes('permission-denied') || 
           error.message.includes('Missing or insufficient permissions'))) {
        
        // Try to refresh auth state
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
          await new Promise<void>((resolve) => {
            chrome.runtime.sendMessage({ action: 'REFRESH_AUTH_STATE' }, () => {
              resolve();
            });
          });
          
          // Retry operation
          return await operation();
        }
      }
      
      // Re-throw if unable to recover
      throw error;
    }
  }
}; 