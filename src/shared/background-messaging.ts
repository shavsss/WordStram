/**
 * Background Messaging Utilities
 * 
 * This module provides utilities for communicating with the background script
 * from content scripts and popup.
 */

/**
 * Send a message to the background script
 * @param action The action to perform
 * @param data Optional data to send with the action
 * @returns Promise that resolves with the response from the background script
 */
export function sendBackgroundMessage<T = any>(action: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { action, data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response && response.success === false) {
            const error = new Error(response.error || 'Unknown error');
            if (response.errorDetails) {
              try {
                const details = JSON.parse(response.errorDetails);
                Object.assign(error, details);
              } catch (e) {
                // If parsing fails, attach the string version
                Object.assign(error, { details: response.errorDetails });
              }
            }
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check authentication status
 * @returns Promise resolving to authentication status
 */
export async function checkAuth(): Promise<{ isAuthenticated: boolean, userInfo?: any }> {
  return sendBackgroundMessage('CHECK_AUTH');
}

/**
 * Sign out the current user
 * @returns Promise resolving when sign out is complete
 */
export async function signOut(): Promise<{ success: boolean }> {
  return sendBackgroundMessage('SIGN_OUT');
}

/**
 * Sign in with Google
 * @returns Promise resolving with user info
 */
export async function signInWithGoogle(): Promise<{ userInfo: any }> {
  return sendBackgroundMessage('SIGN_IN_WITH_GOOGLE');
}

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 * @returns Promise resolving with user info
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<{ userInfo: any }> {
  return sendBackgroundMessage('SIGN_IN_WITH_EMAIL_PASSWORD', { email, password });
}

/**
 * Register with email and password
 * @param email User email
 * @param password User password
 * @param displayName User display name
 * @param age Optional user age
 * @param country Optional user country
 * @returns Promise resolving with user info
 */
export async function registerWithEmailPassword(
  email: string, 
  password: string, 
  displayName: string, 
  age?: number, 
  country?: string
): Promise<{ userInfo: any }> {
  return sendBackgroundMessage('REGISTER_WITH_EMAIL_PASSWORD', {
    email,
    password,
    displayName,
    age,
    country
  });
}

/**
 * Translate text
 * @param text Text to translate
 * @param targetLang Target language code
 * @returns Promise resolving with translation result
 */
export async function translateText(
  text: string, 
  targetLang?: string
): Promise<{ translation: string, detectedSourceLanguage?: string }> {
  return sendBackgroundMessage('TRANSLATE_TEXT', {
    text,
    targetLang,
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if translation service is available
 * @returns Promise resolving with availability status
 */
export async function checkTranslationAvailable(): Promise<{ available: boolean, error?: string }> {
  return sendBackgroundMessage('CHECK_TRANSLATION_AVAILABLE');
}

/**
 * Send a request to Gemini AI
 * @param message User message
 * @param history Optional conversation history
 * @param videoContext Optional video context
 * @returns Promise resolving with AI response
 */
export async function sendGeminiRequest(
  message: string,
  history?: Array<{ role: string, content: string }>,
  videoContext?: {
    videoId?: string,
    videoTitle?: string,
    description?: string,
    channelName?: string,
    url?: string
  }
): Promise<{ answer: string }> {
  return sendBackgroundMessage('GEMINI_REQUEST', {
    action: 'chat',
    message,
    history,
    videoId: videoContext?.videoId,
    videoTitle: videoContext?.videoTitle,
    videoContext: videoContext ? {
      description: videoContext.description,
      channelName: videoContext.channelName,
      url: videoContext.url
    } : undefined
  });
}

/**
 * Check if Gemini service is available
 * @returns Promise resolving with availability status
 */
export async function checkGeminiAvailable(): Promise<{ available: boolean, error?: string }> {
  return sendBackgroundMessage('CHECK_GEMINI_AVAILABLE');
}

/**
 * Clear authentication cache
 * @returns Promise resolving when cache is cleared
 */
export async function clearAuthCache(): Promise<{ success: boolean, message?: string }> {
  return sendBackgroundMessage('CLEAR_AUTH_CACHE');
}

/**
 * Retry authentication
 * @returns Promise resolving with retry result
 */
export async function retryAuth(): Promise<{ success: boolean, message?: string }> {
  return sendBackgroundMessage('AUTH_RETRY');
}

/**
 * Reinitialize Firebase
 * @returns Promise resolving when Firebase is reinitialized
 */
export async function reinitializeFirebase(): Promise<{ success: boolean, message?: string }> {
  return sendBackgroundMessage('REINITIALIZE_FIREBASE');
}

/**
 * Reload authentication state from storage
 * @returns Promise resolving with auth state
 */
export async function reloadAuthStateFromStorage(): Promise<{ success: boolean, isAuthenticated: boolean }> {
  return sendBackgroundMessage('RELOAD_AUTH_STATE_FROM_STORAGE');
} 