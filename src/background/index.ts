/**
 * Background Script
 * Responsible for all Firebase operations in the extension
 */

import { 
  getWords, saveWord, deleteWord, 
  getNotes, saveNote, deleteNote, getAllVideosWithNotes,
  getChats, saveChat, deleteChat,
  getUserStats, saveUserStats, checkFirestoreConnection,
  getDocument, saveDocument, formatErrorForLog,
  getCurrentUserId,
  deleteAllNotesForVideo
} from './firebase-service';
import { getAuth, User } from 'firebase/auth';

// Initialize Firebase Auth
const auth = getAuth();

// API Configurations
let GOOGLE_TRANSLATE_API_KEY: string = 'AIzaSyCLBHKWu7l78tS2xVmizicObSb0PpUqsxM';
// Gemini API keys - we'll get these dynamically later
let GEMINI_API_KEY: string | null = null;
// Using the advanced Gemini 2.5 Pro Preview model
const GEMINI_MODEL = 'gemini-2.5-pro-preview-03-25';
// Fallback to the best stable model if the preview isn't available
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-pro-latest';

// Default API keys (will be replaced with actual keys)
const DEFAULT_GEMINI_API_KEY = 'AIzaSyB5Qy1TjKY62TwHiGHFvpFF6LfkUhIavm8';

// Firebase API domains that might need special monitoring
const FIREBASE_DOMAINS = [
  'firestore.googleapis.com', 
  'identitytoolkit.googleapis.com', 
  'securetoken.googleapis.com',
  'googleapis.com'
];

// Monitoring variables to detect Firebase issues
let firebaseNetworkErrors = 0;
const MAX_FIREBASE_ERRORS = 5;
const RESET_ERROR_COUNT_INTERVAL = 10 * 60 * 1000; // 10 minutes
let lastFirebaseRecoveryAttempt = 0;
const MIN_RECOVERY_INTERVAL = 2 * 60 * 1000; // 2 minutes

// Pattern to identify Firebase authentication and network errors
const networkErrorPattern = /network error|timeout|connection|unavailable|failed to fetch|no internet|offline/i;
const authErrorPattern = /auth|token|permission|unauthorized|unauthenticated|not allowed/i;

/**
 * Initialize API keys from the configuration file
 */
async function initializeApiKeys() {
  try {
    // Fetch API keys from the api-keys.json file
    const apiKeysResponse = await fetch(chrome.runtime.getURL('api-keys.json'));
    
    if (!apiKeysResponse.ok) {
      console.error('WordStream: Failed to load API keys configuration');
      return;
    }
    
    const apiKeys = await apiKeysResponse.json();
    
    // Update API keys
    if (apiKeys.google) {
      if (apiKeys.google.translate) {
        GOOGLE_TRANSLATE_API_KEY = apiKeys.google.translate;
        console.log('WordStream: Loaded Translate API key:', GOOGLE_TRANSLATE_API_KEY.substring(0, 6) + '...');
      }
      
      if (apiKeys.google.gemini) {
        GEMINI_API_KEY = apiKeys.google.gemini;
        // Make sure it's not null for TypeScript
        if (GEMINI_API_KEY) {
          // Save to storage for future use
          await chrome.storage.local.set({ 'gemini_api_key': GEMINI_API_KEY });
          console.log('WordStream: Loaded Gemini API key:', GEMINI_API_KEY.substring(0, 6) + '...');
        }
      }
    }
    
    // Save Firebase API key to storage if available
    if (apiKeys.firebase && apiKeys.firebase.apiKey) {
      await chrome.storage.local.set({ 'firebase_api_key': apiKeys.firebase.apiKey });
      console.log('WordStream: Saved Firebase API key to storage');
    }
  } catch (error) {
    console.error('WordStream: Error initializing API keys:', error);
  }
}

/**
 * Sets up monitoring for Firebase auth-related requests
 * Automatically detects failures and attempts recovery
 */
function setupFirebaseRequestMonitoring() {
  if (!chrome || !chrome.webRequest || !chrome.webRequest.onCompleted || !chrome.webRequest.onErrorOccurred) {
    console.warn('WordStream: Web request API not available for Firebase monitoring');
    return;
  }

  // Configuration for monitoring
  const firebaseUrls = [
    "*://*.firebaseio.com/*",
    "*://*.firebaseapp.com/*",
    "*://firestore.googleapis.com/*",
    "*://identitytoolkit.googleapis.com/*",
    "*://securetoken.googleapis.com/*",
  ];

  // Listen for Firebase request errors
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      // Check if this is related to Firebase
      if (isFirebaseRequest(details.url)) {
        console.warn(`WordStream: Firebase request error: ${details.error} for ${details.url}`);
        
        // Count network-related errors
        if (networkErrorPattern.test(details.error)) {
          firebaseNetworkErrors++;
          console.warn(`WordStream: Firebase network error count: ${firebaseNetworkErrors}/${MAX_FIREBASE_ERRORS}`);
          
          // If we've seen too many errors, try recovery
          if (firebaseNetworkErrors >= MAX_FIREBASE_ERRORS) {
            // Only attempt recovery if enough time has passed since last attempt
            const now = Date.now();
            if (now - lastFirebaseRecoveryAttempt > MIN_RECOVERY_INTERVAL) {
              lastFirebaseRecoveryAttempt = now;
              recoverFromFirebaseConnectionFailure();
            }
          }
        }
      }
    },
    { urls: firebaseUrls }
  );

  // Listen for successful requests to reset error counter
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      // If we see a successful Firebase request, reset the error counter
      if (isFirebaseRequest(details.url) && details.statusCode >= 200 && details.statusCode < 300) {
        if (firebaseNetworkErrors > 0) {
          console.log('WordStream: Resetting Firebase error count after successful request');
          firebaseNetworkErrors = 0;
        }
      }
    },
    { urls: firebaseUrls }
  );

  // Periodically reset error counter to avoid false positives
  setInterval(() => {
    if (firebaseNetworkErrors > 0) {
      console.log('WordStream: Resetting Firebase error count after interval');
      firebaseNetworkErrors = 0;
    }
  }, RESET_ERROR_COUNT_INTERVAL);
}

/**
 * Checks if a URL is a Firebase-related request
 * @param url URL to check
 * @returns Boolean indicating if URL is Firebase-related
 */
function isFirebaseRequest(url: string): boolean {
  return url.includes('firebase') || 
         url.includes('firestore') || 
         url.includes('identitytoolkit') || 
         url.includes('securetoken');
}

// Helper function to format errors safely
function safeStringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch (e) {
        return 'Object error - cannot stringify';
      }
    }
    
    return String(error);
  } catch (e) {
    return 'Unknown error - cannot format';
  }
}

// Interface for translation requests
interface TranslationRequest {
  text: string;
  timestamp?: string;
  targetLang?: string;
}

// Interface for translation responses
interface TranslationResponse {
  success: boolean;
  translation?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

/**
 * Handle translation requests
 */
async function handleTranslation(data: TranslationRequest): Promise<TranslationResponse> {
  try {
    // Validate input
    if (!data.text || typeof data.text !== 'string') {
      console.error('WordStream: Invalid text for translation:', data.text);
      return {
        success: false,
        error: 'Invalid or missing text for translation'
      };
    }
    
    // Log text to translate
    console.log(`WordStream: Translating text: "${data.text.substring(0, 30)}${data.text.length > 30 ? '...' : ''}"`);
    
    // Get settings and ensure we have a valid target language
    const settingsResult = await chrome.storage.sync.get(['settings']);
    console.log('WordStream: Retrieved settings for translation:', settingsResult);

    const settings = settingsResult.settings || { targetLanguage: 'en' };
    let targetLang = data.targetLang || settings.targetLanguage || 'en';
    
    // Ensure target language is in correct format
    targetLang = targetLang.toLowerCase().trim();
    
    console.log('WordStream: Using target language for translation:', targetLang);

    // Construct request URL
    const requestUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    console.log('WordStream: Sending translation request to Google API');
    
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: data.text,
          target: targetLang
        }),
      });

      // Log response status
      console.log(`WordStream: Translation API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(e => 'Could not read error response');
        console.error(`WordStream: Translation request failed (${response.status}):`, errorText);
        throw new Error(`Translation request failed (${response.status}): ${errorText}`);
      }

      // Parse response
      try {
        const translationResult = await response.json();
        console.log('WordStream: Translation result received');
        
        if (!translationResult.data?.translations?.[0]) {
          console.error('WordStream: Invalid translation response structure:', translationResult);
          throw new Error('Invalid translation response structure');
        }
        
        // Return successful translation
        return {
          success: true,
          translation: translationResult.data.translations[0].translatedText,
          detectedSourceLanguage: translationResult.data.translations[0].detectedSourceLanguage
        };
      } catch (parseError) {
        console.error('WordStream: Error parsing translation response:', safeStringifyError(parseError));
        throw new Error(`Error parsing translation response: ${safeStringifyError(parseError)}`);
      }
    } catch (fetchError) {
      console.error('WordStream: Fetch error during translation:', safeStringifyError(fetchError));
      throw new Error(`Fetch error: ${safeStringifyError(fetchError)}`);
    }
  } catch (error) {
    console.error('WordStream: Translation error:', safeStringifyError(error));
    return {
      success: false,
      error: safeStringifyError(error)
    };
  }
}

// Interface for Gemini chat message
interface HistoryMessage {
  role: string;
  content: string;
}

// Interface for Gemini request
interface GeminiRequest {
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

// Interface for Gemini response
interface GeminiResponse {
  success: boolean;
  answer?: string;
  error?: string;
}

/**
 * Get Gemini API key from storage or set a default if not available
 */
async function getGeminiApiKey(): Promise<string> {
  try {
    // Try to get the API key from storage
    const result = await chrome.storage.local.get(['gemini_api_key']);
    
    if (result && result.gemini_api_key) {
      console.log('WordStream: Retrieved Gemini API key from storage');
      return result.gemini_api_key;
    }
    
    // If no key found, try to use the Firebase API key which might work
    // This is a temporary fallback
    try {
      const firebaseResult = await chrome.storage.local.get(['firebase_api_key']);
      if (firebaseResult && firebaseResult.firebase_api_key) {
        // Store it for future use
        await chrome.storage.local.set({ gemini_api_key: firebaseResult.firebase_api_key });
        console.log('WordStream: Using Firebase API key for Gemini API');
        return firebaseResult.firebase_api_key;
      }
    } catch (error) {
      console.warn('WordStream: Error accessing Firebase API key:', error);
    }
    
    // If we still don't have a key, use the default key
    console.warn('WordStream: No API key found, using default key (might not work)');
    return DEFAULT_GEMINI_API_KEY;
  } catch (error) {
    console.error('WordStream: Error getting Gemini API key from storage:', error);
    return DEFAULT_GEMINI_API_KEY;
  }
}

// Initialize the Gemini API key
getGeminiApiKey().then(key => {
  GEMINI_API_KEY = key;
  console.log('WordStream: Initialized Gemini API key:', key.substring(0, 6) + '...');
});

/**
 * Handle Gemini AI chat requests
 */
async function handleGeminiRequest(request: GeminiRequest): Promise<GeminiResponse> {
  // Get API key dynamically if not already set
  if (!GEMINI_API_KEY) {
    GEMINI_API_KEY = await getGeminiApiKey();
  }
  
  const apiKey = GEMINI_API_KEY;
  const geminiModel = request.model || GEMINI_MODEL;
  const fallbackModel = GEMINI_FALLBACK_MODEL;
  
  if (!apiKey) {
    console.error('[WordStream] Gemini API key is missing');
    return { success: false, error: 'API key is missing' };
  }

  try {
    console.log(`[WordStream] Processing Gemini request with model: ${geminiModel}`);
    
    // Check if using the preview model and adjust API version accordingly
    const isPreviewModel = geminiModel.includes('preview') || geminiModel.includes('2.5');
    const apiVersion = isPreviewModel ? 'v1beta' : 'v1';
    
    // Create endpoint for the model
    const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${geminiModel}:generateContent?key=${apiKey}`;
    
    // Create context prompt with information about WordStream and the video
    let contextPrompt = `You are WordStream's AI Assistant, a versatile educational assistant that helps users learn while watching videos. Follow these guidelines:

    1. RESPONSE STRUCTURE:
       - Always answer directly first, then check if further clarification is needed
       - For complex topics, provide complete answers with clear organization
       - Use user's language - if they write in Hebrew, respond in Hebrew
    
    2. VIDEO CONTEXT AWARENESS:
       - Recognize whether questions relate to the video or are general
       - Provide video-specific insights when relevant
    
    3. LANGUAGE LEARNING FOCUS:
       - Provide educational insights like usage examples and pronunciation notes
       - Adapt complexity based on user proficiency
    `;
    
    // Add video context if available
    if (request.videoTitle) {
      contextPrompt += `\n\nThe user is watching: "${request.videoTitle}"`;
    }
    
    if (request.videoContext) {
      if (request.videoContext.description) {
        contextPrompt += `\nVideo description: ${request.videoContext.description}`;
      }
      if (request.videoContext.channelName) {
        contextPrompt += `\nChannel: ${request.videoContext.channelName}`;
      }
      if (request.videoContext.url) {
        contextPrompt += `\nURL: ${request.videoContext.url}`;
      }
    }
    
    // Create messages array from history
    let messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Add messages from history
    if (request.history && request.history.length > 0) {
      messages = request.history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
    }
    
    // Add current user message
    messages.push({
      role: "user",
      parts: [{ text: request.message }]
    });
    
    // Create payload
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: contextPrompt }]
        },
        ...messages.slice(-30) // Use the last 30 messages for context
      ],
      generationConfig: {
        temperature: 0.75,
        topK: 40,
        topP: 0.92,
        maxOutputTokens: 8192,
        stopSequences: []
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };

    console.log(`[WordStream] Sending request to Gemini API: ${endpoint}`);
    
    // Create timeout promise
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request to Gemini API timed out after 30 seconds'));
      }, 30000); // 30 second timeout
    });
    
    // Make the API request with timeout
    const fetchPromise = fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Race the fetch against the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[WordStream] Gemini API error (${response.status}):`, errorData);
      
      // If a rate limit error, wait briefly and retry once
      if (response.status === 429) {
        console.log('[WordStream] Rate limit hit, waiting 2 seconds and retrying once');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return handleGeminiRequest(request);
      }
      
      // If using preview model and it fails, try the fallback model
      if (isPreviewModel) {
        console.log(`[WordStream] Preview model failed, trying fallback model: ${fallbackModel}`);
        
        const fallbackRequest = {
          ...request,
          model: fallbackModel
        };
        
        return handleGeminiRequest(fallbackRequest);
      }
      // Try the most basic fallback model as a last resort
      else if (geminiModel !== 'gemini-1.0-pro') {
        console.log(`[WordStream] Trying original fallback model: gemini-1.0-pro`);
        
        const legacyFallbackRequest = {
          ...request,
          model: 'gemini-1.0-pro'
        };
        
        return handleGeminiRequest(legacyFallbackRequest);
      }
      
      return { 
        success: false, 
        error: `Gemini API error (${response.status}): ${errorData}` 
      };
    }

    // Parse response with timeout protection
    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[WordStream] Error parsing Gemini API response:', parseError);
      return { 
        success: false, 
        error: `Error parsing response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}` 
      };
    }
    
    console.log('[WordStream] Gemini API response received');
    
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      return { 
        success: false, 
        error: 'Empty response from Gemini API' 
      };
    }

    // Extract the answer from the response
    const answer = data.candidates[0].content.parts[0].text;
    
    // Cache successful response in localStorage (if available)
    try {
      const cacheKey = `gemini_cache_${Buffer.from(request.message).toString('base64').substring(0, 50)}`;
      await chrome.storage.local.set({ 
        [cacheKey]: {
          answer,
          timestamp: Date.now(),
          model: geminiModel
        }
      });
    } catch (cacheError) {
      // Non-critical error, just log it
      console.warn('[WordStream] Failed to cache Gemini response:', cacheError);
    }
    
    return {
      success: true,
      answer
    };
  } catch (error) {
    console.error('[WordStream] Error in Gemini request:', error);
    
    // Check if we have a cached version as fallback for this query
    try {
      const cacheKey = `gemini_cache_${Buffer.from(request.message).toString('base64').substring(0, 50)}`;
      const cache = await chrome.storage.local.get([cacheKey]);
      
      if (cache && cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < 86400000) { // 24 hours
        console.log('[WordStream] Using cached response as fallback');
        return {
          success: true,
          answer: cache[cacheKey].answer + "\n\n(Note: This is a cached response as we couldn't reach the AI service)"
        };
      }
    } catch (cacheError) {
      console.warn('[WordStream] Failed to retrieve cached response:', cacheError);
    }
    
    return { 
      success: false, 
      error: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('WordStream extension installed/updated:', details.reason);
  
  // Clear all caches on extension update
  if (details.reason === 'update' || details.reason === 'install') {
    console.log('WordStream: Clearing extension caches');
    try {
      chrome.storage.local.clear();
      console.log('WordStream: Caches cleared');
    } catch (error) {
      console.error('WordStream: Error clearing caches:', error);
    }
  }
  
  // Initialize Firebase and authenticate with increased timeouts
  try {
    setupFirebaseRequestMonitoring();
    // Initialize API keys with a retry mechanism
    initializeApiKeys()
      .then(() => console.log('WordStream: API keys initialized successfully'))
      .catch((error) => console.error('WordStream: Error initializing API keys:', error));
  } catch (error) {
    console.error('WordStream: Error during initialization:', error);
  }
});

// Log startup message
console.log('WordStream background service worker started');

// Check connection status on startup
checkFirestoreConnection().then(status => {
  console.log('Initial Firestore connection status:', status);
});

/**
 * Checks and attempts to refresh authentication if needed
 * @returns Promise resolving to authentication status
 */
async function checkAndRefreshAuthentication(): Promise<boolean> {
  try {
    console.log('WordStream: Checking authentication state');
    
    // Check if user is authenticated
    const currentUser = auth.currentUser as User | null;
    if (!currentUser) {
      console.warn('WordStream: No authenticated user found during refresh check');
      
      // Check if token is in process of refreshing (avoid duplicate calls)
      const refreshStatusData = await chrome.storage.local.get(['auth_refresh_in_progress']);
      if (refreshStatusData && refreshStatusData.auth_refresh_in_progress) {
        const timestamp = refreshStatusData.auth_refresh_in_progress;
        // If refresh has been in progress for less than 30 seconds, wait
        if (Date.now() - timestamp < 30000) {
          console.log('WordStream: Authentication refresh already in progress, waiting');
          return false;
        } else {
          // Clear stuck refresh flag
          await chrome.storage.local.remove(['auth_refresh_in_progress']);
        }
      }
      
      // Set flag that we're refreshing auth
      await chrome.storage.local.set({ 'auth_refresh_in_progress': Date.now() });
      
      try {
        console.log('WordStream: Attempting to refresh authentication');
        // At this point we have no current user, so we can't refresh the token
        console.warn('WordStream: No user to refresh token for');
        
        // Clear refresh flag
        await chrome.storage.local.remove(['auth_refresh_in_progress']);
        return false;
      } catch (refreshError) {
        console.error('WordStream: Error refreshing authentication:', refreshError);
        
        // Clear refresh flag
        await chrome.storage.local.remove(['auth_refresh_in_progress']);
        return false;
      }
    }
    
    // User is authenticated, try to refresh the token
    try {
      await currentUser.getIdToken(true);
      console.log('WordStream: Authentication token refreshed successfully');
      return true;
    } catch (tokenError) {
      console.error('WordStream: Error refreshing authentication token:', tokenError);
      return false;
    }
  } catch (error) {
    console.error('WordStream: Error in authentication check:', error);
    return false;
  }
}

// Utility to wrap Firebase operations with authentication check
async function withAuth<T>(operation: () => Promise<T>, actionName: string): Promise<T | { error: string }> {
  try {
    // First check if user is authenticated and refresh if needed
    const isAuthenticated = await checkAndRefreshAuthentication();
    
    if (!isAuthenticated) {
      console.error(`WordStream: Cannot perform ${actionName} - authentication failed`);
      return { error: 'No authenticated user' };
    }
    
    // Now try the operation
    return await operation();
  } catch (error) {
    console.error(`WordStream: Error in ${actionName}:`, error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Register message listener for Firebase operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message.action || message.type);
  
  // Create a safe response function to handle potential port closed errors
  const safeRespond = (response: any) => {
    try {
      sendResponse(response);
    } catch (error) {
      console.warn('WordStream: Error sending response, port may be closed:', error);
    }
  };
  
  // Handle translation requests
  if (message.action === 'translate') {
    handleTranslation(message.data)
      .then(response => safeRespond(response))
      .catch(error => {
        console.error('WordStream: Translation error:', error);
        safeRespond({ success: false, error: safeStringifyError(error) });
      });
    return true; // Keep the message channel open for async response
  }
  
  // Handle legacy translation requests
  if (message.type === 'TRANSLATE_WORD') {
    handleTranslation(message.payload)
      .then(safeRespond)
      .catch(error => {
        console.error('WordStream: Translation error:', error);
        safeRespond({ success: false, error: safeStringifyError(error) });
      });
    return true;
  }
  
  // Handle Gemini chat requests
  if (message.action === 'gemini') {
    console.log('WordStream: Processing Gemini request', { 
      message: message.message,
      historyLength: message.history?.length,
      videoId: message.videoId 
    });
    
    handleGeminiRequest(message)
      .then((result) => {
        console.log('WordStream: Gemini response generated successfully');
        safeRespond(result);
      })
      .catch(error => {
        console.error('WordStream: Error generating Gemini response:', error);
        safeRespond({ 
          success: false, 
          answer: null,
          error: error instanceof Error ? error.message : 'Unknown error processing Gemini request'
        });
      });
    return true; // Will respond asynchronously
  }
  
  // Handle authentication state requests
  if (message.action === 'GET_AUTH_STATE') {
    try {
      const isAuthenticated = !!auth.currentUser;
      
      safeRespond({ 
        isAuthenticated, 
        userInfo: isAuthenticated ? {
          uid: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          displayName: auth.currentUser?.displayName,
          photoURL: auth.currentUser?.photoURL
        } : null
      });
    } catch (error) {
      console.error('WordStream: Error getting auth state:', error);
      safeRespond({ isAuthenticated: false, error: safeStringifyError(error) });
    }
    return true;
  }
  
  // Handle data initialization
  if (message.action === 'initializeDataSync') {
    try {
      safeRespond({
        success: true,
        cleanup: () => {
          // Optional cleanup operations
          console.log('WordStream: Data sync initialized');
        }
      });
    } catch (error) {
      console.error('WordStream: Error initializing data sync:', error);
      safeRespond({ success: false, error: safeStringifyError(error) });
    }
    return true;
  }
  
  // Handle different message actions
  switch (message.action) {
    case 'getCurrentUserId':
      withAuth(() => getCurrentUserId(), 'getCurrentUserId')
        .then(safeRespond);
      return true;
      
    case 'getWords':
      withAuth(() => getWords(), 'getWords')
        .then(safeRespond);
      return true;
      
    case 'saveWord':
      withAuth(() => saveWord(message.data), 'saveWord')
        .then(safeRespond);
      return true;
      
    case 'deleteWord':
      withAuth(() => deleteWord(message.id), 'deleteWord')
        .then(safeRespond);
      return true;
      
    case 'getNotes':
      withAuth(() => getNotes(message.videoId), 'getNotes')
        .then(safeRespond);
      return true;
      
    case 'saveNote':
      withAuth(() => saveNote(message.data), 'saveNote')
        .then(safeRespond);
      return true;
      
    case 'deleteNote':
      withAuth(() => deleteNote(message.id), 'deleteNote')
        .then(safeRespond);
      return true;
      
    case 'getAllVideosWithNotes':
      withAuth(() => getAllVideosWithNotes(), 'getAllVideosWithNotes')
        .then(safeRespond);
      return true;
      
    case 'getChats':
      withAuth(() => getChats(), 'getChats')
        .then(safeRespond);
      return true;
      
    case 'saveChat':
      withAuth(() => saveChat(message.data), 'saveChat')
        .then(safeRespond);
      return true;
      
    case 'deleteChat':
      withAuth(() => deleteChat(message.id), 'deleteChat')
        .then(safeRespond);
      return true;
      
    case 'getUserStats':
      withAuth(() => getUserStats(), 'getUserStats')
        .then(safeRespond);
      return true;
      
    case 'saveUserStats':
      withAuth(() => saveUserStats(message.data), 'saveUserStats')
        .then(safeRespond);
      return true;
      
    case 'checkFirestoreConnection':
      withAuth(() => checkFirestoreConnection(), 'checkFirestoreConnection')
        .then(safeRespond);
      return true;
      
    case 'getDocument':
      withAuth(() => getDocument(message.collection, message.id), 'getDocument')
        .then(safeRespond);
      return true;
      
    case 'saveDocument':
      withAuth(() => saveDocument(message.collection, message.id, message.data), 'saveDocument')
        .then(safeRespond);
      return true;
    
    case 'deleteAllNotesForVideo':
      if (message.videoId) {
        withAuth(() => deleteAllNotesForVideo(message.videoId), 'deleteAllNotesForVideo')
          .then(safeRespond);
      } else {
        safeRespond({ success: false, deletedCount: 0, error: 'Missing videoId' });
      }
      return true;
      
    case 'PING':
      safeRespond({ success: true, message: 'Background script is active' });
      return true;
      
    case 'REFRESH_FIREBASE_CONNECTION':
      withAuth(() => recoverFromFirebaseConnectionFailure(), 'REFRESH_FIREBASE_CONNECTION')
        .then(safeRespond);
      return true;
      
    default:
      console.log('Unknown message action:', message.action || message.type);
      safeRespond({ error: 'Unknown action' });
      return false;
  }
});

/**
 * Helper function to handle async operations and respond to the sender
 */
function handleAsyncOperation(promise: Promise<any>, sendResponse: (response: any) => void) {
  promise
    .then(result => {
      sendResponse(result);
    })
    .catch(error => {
      console.error('WordStream: Error in async operation:', error);
      sendResponse({ error: safeStringifyError(error) });
    });
}

// Add a network connectivity checker to help with retries
async function checkInternetConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    console.warn('WordStream: Network check failed:', e);
    return navigator.onLine; // Fallback to navigator.onLine
  }
}

/**
 * Recovers from Firebase connection failure
 * Clears caches and attempts to reconnect
 */
async function recoverFromFirebaseConnectionFailure() {
  console.log('WordStream: Attempting to recover from Firebase connection failure');
  
  try {
    // Clear all Firebase-related caches
    await clearCaches();
    
    // Check internet connection
    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      console.warn('WordStream: Cannot recover - device is offline');
      return;
    }
    
    // Attempt to reinitialize Firebase
    // We'll refresh the page which will trigger reinitialization
    console.log('WordStream: Requesting all tabs to refresh Firebase connections');
    
    // Reset error count
    firebaseNetworkErrors = 0;
    
    // Send message to all tabs to refresh connections
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'REFRESH_FIREBASE_CONNECTION' })
            .catch(() => {
              // Ignore errors for inactive tabs that can't receive messages
            });
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Error recovering from connection failure:', error);
  }
}

/**
 * Clears extension caches to fix authentication issues
 */
async function clearCaches() {
  console.log('WordStream: Clearing caches to improve recovery chances');
  
  try {
    // Clear local storage caches
    const keysToRemove = [
      'wordstream_user_id',
      'wordstream_user_id_timestamp',
      'wordstream_stats_cache',
      'wordstream_stats_cache_timestamp',
      'wordstream_auth_state',
    ];
    
    await chrome.storage.local.remove(keysToRemove);
    
    // Find and clear all cache timestamp entries
    const items = await chrome.storage.local.get(null);
    const timestampKeys = Object.keys(items).filter(key => 
      key.includes('cache') || key.includes('timestamp') || key.includes('token')
    );
    
    if (timestampKeys.length > 0) {
      await chrome.storage.local.remove(timestampKeys);
      console.log(`WordStream: Cleared ${timestampKeys.length} cache-related entries`);
    }
    
    return true;
  } catch (error) {
    console.error('WordStream: Error clearing caches:', error);
    return false;
  }
}

