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
import { getAuth, User, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { getFirebaseApp, getFirebaseAuth, getFirestoreDb } from '../core/firebase/config';
import { initializeFirebaseAuth, isUserAuthenticated, triggerTokenRefresh } from './firebase-auth-helper';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';

// Initialize Firebase
let app: any = null;
let auth: Auth | null = null;
let firestore: any = null;
let firebaseApp: FirebaseApp | null = null;

// עטיפה לניהול כל בקשות Firestore
async function initializeFirebase(): Promise<FirebaseApp> {
  try {
    console.log('WordStream: Initializing Firebase in background script');
    
    // אתחול Firebase באמצעות הפונקציות החדשות
    const fbApp = getFirebaseApp();
    const fbAuth = getFirebaseAuth();
    const fbFirestore = getFirestoreDb();
    
    // הצבת המשתנים המאותחלים כגלובליים לשימוש בסקריפט הרקע
    app = fbApp;
    auth = fbAuth;
    firestore = fbFirestore;
    firebaseApp = fbApp;
    
    console.log('WordStream: Firebase initialized successfully in background');
    
    // Initialize Firebase Auth with token refresh
    await initializeFirebaseAuth(fbApp);
    
    // Initialize API keys
    await initializeApiKeys();
    
    // וודא שמחזיר FirebaseApp תקין
    if (!fbApp) {
      throw new Error('Failed to initialize Firebase');
    }
    
    return fbApp;
  } catch (error) {
    console.error('WordStream: Error initializing Firebase:', error);
    throw error;
  }
}

// פונקציה לעדכון כל הטאבים על שינוי במצב האימות
async function notifyAllTabsAboutAuthChange(isAuthenticated: boolean, user: User | null): Promise<void> {
  try {
    // Query for all extension tabs
    const tabs = await chrome.tabs.query({});
    
    // Prepare the message
    const authChangeMessage = {
      action: 'AUTH_STATE_CHANGED',
      isAuthenticated,
      userInfo: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      } : null,
      timestamp: Date.now()
    };
    
    // Send message to all tabs
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, authChangeMessage).catch(() => {
            // Ignore errors when tab can't receive messages
          });
        } catch (tabError) {
          // Ignore errors for individual tabs
          console.log(`WordStream: Could not notify tab ${tab.id} about auth change`);
        }
      }
    }
    
    console.log(`WordStream: Notified all tabs about auth change: ${isAuthenticated ? 'authenticated' : 'signed out'}`);
    
    // Also save the state to storage for components that might load later
    await chrome.storage.local.set({
      'wordstream_last_auth_broadcast': {
        ...authChangeMessage,
        broadcastTime: Date.now()
      }
    });
  } catch (error) {
    console.error('WordStream: Error notifying tabs about auth change:', error);
  }
}

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
    console.log('WordStream: Attempting to retrieve Gemini API key from storage');
    
    // Check if we're in a service worker context
    const isServiceWorker = typeof self !== 'undefined' && typeof Window === 'undefined';
    if (!isServiceWorker) {
      console.warn('WordStream: Not in service worker context - using default API key');
      return DEFAULT_GEMINI_API_KEY;
    }
    
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
    
    // Cache successful response in chrome.storage
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
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('WordStream extension installed/updated:', details.reason);
  
  // Initialize Firebase first
  await initializeFirebase();
  
  // Clear all caches on extension update
  if (details.reason === 'update' || details.reason === 'install') {
    console.log('WordStream: Clearing extension caches on install/update');
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

// Initialize Firebase when background script starts
initializeFirebase().then(() => {
  console.log('WordStream: Firebase initialization complete');
  
  // המאזין onAuthStateChanged כבר מוגדר ב-firebase-auth-helper.ts
  // אין צורך להגדיר אותו שוב כאן
  
  // Set up request monitoring
  setupFirebaseRequestMonitoring();
  
  // Check connection status on startup
  checkFirestoreConnection().then(status => {
    console.log('Initial Firestore connection status:', status);
  });
});

// Register periodic token refresh to prevent session expiration
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

// פונקציה זו כבר מימושת ב-firebase-auth-helper.ts ולא צריכה להיות מוגדרת כאן
// נשאיר אותה פה לרפרנס אבל לא נקרא לה - הטיימר כבר מוגדר ב-helper
// function setupTokenRefreshTimer() {
//   // טיימר לחידוש טוקן האימות כל 50 דקות
//   const refreshInterval = 50 * 60 * 1000; // 50 דקות בms
//   
//   console.log('WordStream: Setting up token refresh timer');
//   
//   // נקה טיימר קודם אם יש
//   if (tokenRefreshInterval) {
//     clearInterval(tokenRefreshInterval);
//     tokenRefreshInterval = null;
//   }
//   
//   // הגדרת אינטרוול חדש
//   tokenRefreshInterval = setInterval(async () => {
//     try {
//       const isSuccess = await triggerTokenRefresh();
//       if (isSuccess) {
//         console.log('WordStream: Scheduled token refresh successful');
//       } else {
//         console.warn('WordStream: Scheduled token refresh failed');
//       }
//     } catch (error) {
//       console.error('WordStream: Error during scheduled token refresh:', error);
//     }
//   }, refreshInterval);
//   
//   console.log('WordStream: Token refresh timer set');
// }

// פונקציה זו כבר מימושת ב-firebase-auth-helper.ts כ-saveUserInfoToStorage ו-clearUserInfoFromStorage
// לא צריך לממש אותה שוב כאן
async function updateStoredUserInfo(user: User | null): Promise<void> {
  // אנחנו לא משתמשים בפונקציה זו יותר כי היא כפולה
  // אבל משאירים אותה כאן לרפרנס
  console.log('WordStream: updateStoredUserInfo is deprecated, using firebase-auth-helper instead');
}

// Safely access the Firebase auth object
export function safeGetAuth(): typeof auth | null {
  try {
    if (!auth) {
      console.warn('WordStream: Auth object is not available');
      return null;
    }
    return auth;
  } catch (error) {
    console.error('WordStream: Error accessing auth object:', error);
    return null;
  }
}

// Safely get current user
export function safeGetCurrentUser(): User | null {
  try {
    const authInstance = safeGetAuth();
    if (!authInstance) return null;
    
    return authInstance.currentUser;
  } catch (error) {
    console.error('WordStream: Error getting current user:', error);
    return null;
  }
}

// Update the refreshAuthToken function to use safe accessors
async function refreshAuthToken(): Promise<boolean> {
  try {
    return await triggerTokenRefresh();
  } catch (error) {
    console.error('WordStream: Error refreshing auth token:', error);
    return false;
  }
}

/**
 * פונקציית withAuth משודרגת לחלוטין
 * 
 * פונקציה זו:
 * 1. בודקת אם auth.currentUser קיים (המשתמש מחובר)
 * 2. אם לא, בודקת באחסון המקומי אם המשתמש היה מחובר קודם
 * 3. אם היה מחובר, ממתינה לאתחול האימות ובודקת שוב
 * 4. אם עדיין אין משתמש מחובר, מחזירה שגיאת פג תוקף
 * 
 * זו הפונקציה המרכזית להתמודדות עם שגיאות "User authentication session expired"
 */
async function withAuth<T>(operation: () => Promise<T>): Promise<T> {
  const authInstance = safeGetAuth();
  if (!authInstance) {
    throw new Error('מנגנון האימות לא אותחל');
  }
  
  // בדיקה ראשונית אם המשתמש מחובר
  if (!isUserAuthenticatedCompat(authInstance)) {
    console.log('WordStream: Authentication check failed, attempting token refresh...');
    
    // ניסיון לרענן את הטוקן
    try {
      const refreshed = await triggerTokenRefresh();
      
      // אם הריענון הצליח, בדוק שוב את מצב האימות
      if (refreshed) {
        console.log('WordStream: Token refresh successful, rechecking authentication...');
        
        // המתנה קצרה אחרי ריענון הטוקן
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // בדיקה מחדש של המשתמש
        if (isUserAuthenticatedCompat(authInstance)) {
          console.log('WordStream: Authentication successful after token refresh');
          return operation();
        }
      }
      
      // אם הריענון הרגיל לא הצליח, ננסה אתחול מחדש של Firebase Auth
      console.log('WordStream: Standard token refresh failed, attempting deep recovery...');
      
      // פונקציה פנימית לניסיון עמוק של התאוששות
      const attemptDeepRecovery = async (): Promise<boolean> => {
        try {
          // הפעלת הפונקציה שיצרנו לאתחול מחדש של Firebase
          const response = await new Promise<any>((resolve) => {
            // קריאה עצמית לפונקציה של אתחול מחדש
            reinitializeFirebaseAuth().then(resolve).catch(resolve);
          });
          
          // בדיקה אם האתחול הצליח
          if (response && response.success) {
            console.log('WordStream: Deep recovery successful');
            return true;
          }
          
          console.warn('WordStream: Deep recovery failed or partially succeeded');
          return false;
        } catch (error) {
          console.error('WordStream: Error during deep recovery attempt:', error);
          return false;
        }
      };
      
      // הפעלת ניסיון ההתאוששות העמוק
      const deepRecoverySuccessful = await attemptDeepRecovery();
      
      // אם ההתאוששות העמוקה הצליחה, בדוק שוב את מצב האימות
      if (deepRecoverySuccessful) {
        // המתנה קצרה אחרי האתחול מחדש
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // בדיקה מחדש של המשתמש
        if (isUserAuthenticatedCompat(authInstance)) {
          console.log('WordStream: Authentication successful after deep recovery');
          return operation();
        }
      }
      
      // אם הגענו לכאן, הריענון נכשל או שהמשתמש עדיין לא מחובר
      console.warn('WordStream: Authentication failed even after deep recovery');
      
      // בדוק אם יש מידע בסטורג'
      const storedUserInfo = await getStoredUserInfo();
      if (storedUserInfo) {
        console.log('WordStream: Found stored user info, but authentication failed. User session likely expired.');
      }
    } catch (refreshError) {
      console.error('WordStream: Error during token refresh attempt:', refreshError);
    }
    
    // אם הגענו לכאן, האימות נכשל - זרוק שגיאה
    throw new Error('User authentication session expired');
  }
  
  // המשתמש מחובר, בצע את הפעולה
  return operation();
}

// פונקציה עוטפת לאתחול מחדש של Firebase Auth - הוצאה החוצה משאר הקוד
async function reinitializeFirebaseAuth(): Promise<any> {
  try {
    // נקה את cache
    await clearCaches();
    
    // נסה לאתחל מחדש את Firebase ואת מנגנון האימות
    if (firebaseApp) {
      console.log('WordStream: Re-initializing Firebase Auth');
      
      // אתחול מחדש
      auth = await initializeFirebaseAuth(firebaseApp);
      
      // בדיקה אם האתחול הצליח - יש לנו משתמש?
      if (auth && auth.currentUser) {
        console.log('WordStream: Firebase Auth re-initialization successful with user:', auth.currentUser.email);
        
        // לאחר שיש לנו משתמש, ננסה לרענן את הטוקן
        const tokenRefreshed = await triggerTokenRefresh();
        
        if (tokenRefreshed) {
          console.log('WordStream: Auth retry completely successful');
          
          // נודיע לכל הטאבים שהאימות אוחסן בהצלחה
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id) {
                try {
                  chrome.tabs.sendMessage(tab.id, {
                    action: 'AUTH_STATE_CHANGED',
                    isAuthenticated: true,
                    userInfo: auth && auth.currentUser ? {
                      uid: auth.currentUser.uid,
                      email: auth.currentUser.email,
                      displayName: auth.currentUser.displayName
                    } : null,
                    timestamp: Date.now()
                  }).catch(() => {
                    // Ignore errors for inactive tabs
                  });
                } catch (error) {
                  // Ignore errors for individual tabs
                }
              }
            });
          });
          
          return {
            success: true,
            message: 'Authentication fully recovered'
          };
        }
      }
      
      // אם הגענו לכאן, האתחול לא הצליח לגמרי
      console.warn('WordStream: Auth retry partially successful');
      return {
        success: false,
        partialSuccess: true,
        message: 'Authentication partially recovered'
      };
    } else {
      console.error('WordStream: Firebase app not available for auth retry');
      return {
        success: false,
        error: 'Firebase app not available'
      };
    }
  } catch (error) {
    console.error('WordStream: Error during auth retry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ריענון טוקן מחוזק ואגרסיבי
 * מנסה גם לשחזר מידע שמור לפני הריענון
 */
async function triggerTokenRefreshForced(): Promise<boolean> {
  try {
    console.log('WordStream: Attempting forced token refresh');
    
    // בדיקת משתמש נוכחי
    if (auth && auth.currentUser) {
      // יש משתמש - ריענון רגיל
      console.log('WordStream: User exists, performing standard refresh');
      return await triggerTokenRefresh();
    }
    
    // אין משתמש נוכחי - בדיקה אם יש מידע בסטורג'
    const userInfo = await getStoredUserInfo();
    if (!userInfo || !userInfo.uid) {
      console.warn('WordStream: No stored user info for recovery');
      return false;
    }
    
    console.log('WordStream: Found stored credentials, attempting deep recovery');
    
    // התחלת תהליך התאוששות עמוק
    try {
      // ריענון אתחול Firebase
      await initializeFirebase();
      
      // המתנה קצרה לאתחול
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // בדיקה אם המשתמש חזר
      if (auth && auth.currentUser) {
        // יש משתמש אחרי האתחול - ריענון טוקן
        console.log('WordStream: User recovery succeeded, refreshing token');
        return await triggerTokenRefresh();
      }
      
      // אם עדיין אין משתמש, נכשל
      console.warn('WordStream: Deep recovery failed - user still null after reinitialization');
      return false;
    } catch (recoveryError) {
      console.error('WordStream: Error during deep recovery:', recoveryError);
      return false;
    }
  } catch (error) {
    console.error('WordStream: Forced token refresh failed:', error);
    return false;
  }
}

/**
 * פונקציה זו מחזירה את פרטי המשתמש מ-chrome.storage.local אם קיימים
 * גרסה משופרת עם תיעוד מפורט יותר והחזרת מידע מלא יותר
 */
export async function getStoredUserInfo(): Promise<any> {
  try {
    // הוצאת כל המידע הקשור לאימות מהסטורג'
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'wordstream_auth_state', 
        'wordstream_user_info', 
        'wordstream_auth_timestamp',
        'wordstream_token_refresh_time'
      ], (storedInfo) => {
        // בדיקה אם יש מידע על משתמש מחובר
        if (storedInfo.wordstream_auth_state === 'authenticated' && 
            storedInfo.wordstream_user_info && 
            storedInfo.wordstream_user_info.uid) {
          
          console.log('WordStream: Found stored user info:', 
            storedInfo.wordstream_user_info.email, 
            'last auth at:', new Date(storedInfo.wordstream_auth_timestamp || 0).toLocaleString(),
            'last token refresh:', new Date(storedInfo.wordstream_token_refresh_time || 0).toLocaleString());
          
          // מחזיר את כל המידע כדי לאפשר התאוששות מיטבית
          resolve({
            ...storedInfo.wordstream_user_info,
            lastAuth: storedInfo.wordstream_auth_timestamp,
            lastRefresh: storedInfo.wordstream_token_refresh_time
          });
        } else {
          // בדיקה אם יש מידע חלקי שיכול להועיל
          if (storedInfo.wordstream_user_info) {
            console.log('WordStream: Found partial user info but auth state is not authenticated');
            resolve(storedInfo.wordstream_user_info);
          } else {
            console.log('WordStream: No stored user info found or user not authenticated');
            resolve(null);
          }
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Error getting stored user info:', error);
    return null;
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
  
  // Handle token refresh requests
  if (message.action === 'REFRESH_TOKEN') {
    console.log('WordStream: Received token refresh request');
    
    // Attempt to refresh the token
    triggerTokenRefresh()
      .then(success => {
        console.log('WordStream: Token refresh result:', success ? 'success' : 'failed');
        
        // If refresh was successful, notify content scripts
        if (success) {
          // Broadcast the token refresh to all tabs
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id) {
                try {
                  chrome.tabs.sendMessage(tab.id, {
                    action: 'TOKEN_REFRESHED',
                    timestamp: Date.now()
                  }).catch(() => {
                    // Ignore errors for inactive tabs
                  });
                } catch (error) {
                  // Ignore errors for individual tabs
                }
              }
            });
          });
        }
        
        // Send response with refresh result
        safeRespond({
          success,
          timestamp: Date.now(),
          message: success ? 'Token refreshed successfully' : 'Token refresh failed'
        });
      })
      .catch(error => {
        console.error('WordStream: Error during token refresh:', error);
        safeRespond({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      });
    
    return true; // Keep message channel open for async response
  }
  
  // Handle deep auth recovery request
  if (message.action === 'AUTH_RETRY') {
    console.log('WordStream: Received auth retry request');
    
    // הפעלת פונקציית האתחול מחדש של Firebase
    reinitializeFirebaseAuth()
      .then(result => {
        console.log('WordStream: Auth retry result:', result);
        safeRespond(result);
      })
      .catch(error => {
        console.error('WordStream: Unhandled error during auth retry:', error);
        safeRespond({
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error during auth retry'
        });
      });
    
    return true; // Keep message channel open for async response
  }
  
  // ללא פעולה ספציפית - שגיאה
  sendResponse({ error: 'פעולה לא תקינה' });
  return false;
});

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
 * Clear all authentication and data caches
 * Used when we need to ensure a clean state for re-authentication
 */
export async function clearCaches(): Promise<void> {
  try {
    console.log('WordStream: Clearing auth caches and related data');
    
    // List of cache keys to remove
    const keysToRemove = [
      // Auth related caches
      'wordstream_auth_state',
      'wordstream_user_info',
      'wordstream_auth_timestamp',
      'wordstream_last_auth_check',
      'wordstream_last_auth_broadcast',
      
      // Data caches that might contain stale data
      'videosWithNotesCache',
      'chatsCache',
      'wordstream_retry_after_auth'
    ];
    
    // Clear all specified caches
    await chrome.storage.local.remove(keysToRemove);
    
    // Log success
    console.log('WordStream: Auth caches cleared');
  } catch (error) {
    console.error('WordStream: Error clearing caches:', error);
  }
}

/**
 * אתחול Firebase והגדרת מאזינים
 */
export async function initializeBackgroundService() {
  try {
    console.log('WordStream: מאתחל שירות הרקע');
    
    // אתחל Firebase (קוד קיים)
    firebaseApp = await initializeFirebase();
    
    if (!firebaseApp) {
      throw new Error('נכשל באתחול Firebase');
    }
    
    // אתחל Firebase Auth עם הגדרות אימות לתוספי Chrome
    auth = await initializeFirebaseAuth(firebaseApp);
    
    // הגדר מאזין להודעות
    setupMessageListener();
    
    // בדוק אם המשתמש מחובר
    if (auth) {
      const isAuthenticated = isUserAuthenticatedCompat(auth);
      console.log('WordStream: מצב אימות בהתחלה:', isAuthenticated ? 'מחובר' : 'לא מחובר');
    }
    
    return true;
  } catch (error) {
    console.error('WordStream: שגיאה באתחול שירות הרקע:', error);
    return false;
  }
}

/**
 * הגדר מאזין להודעות מתסריטי תוכן ו-popup
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('WordStream: קבלת הודעה:', message?.action || message);
    
    // טפל בהודעות אימות וחיבור
    if (message && message.action) {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('WordStream: שגיאה בטיפול בהודעה:', error);
          sendResponse({ error: error.message || 'שגיאה בטיפול בהודעה' });
        });
      
      return true; // שמור את ערוץ התקשורת פתוח לתשובה א-סינכרונית
    }
    
    // ללא פעולה ספציפית - שגיאה
    sendResponse({ error: 'פעולה לא תקינה' });
    return false;
  });
}

/**
 * טיפל בהודעות נכנסות
 */
async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
  const { action } = message;
  
  // הודעות שלא מחייבות אימות
  if (action === 'CHECK_AUTH') {
    return handleCheckAuth();
  }
  
  if (action === 'SIGN_IN_WITH_GOOGLE') {
    return handleSignInWithGoogle();
  }
  
  if (action === 'CHECK_FIRESTORE_CONNECTION') {
    return handleCheckFirestoreConnection();
  }
  
  // הודעות שמחייבות אימות
  return withAuth(async () => {
    switch (action) {
      case 'GET_ALL_VIDEOS_WITH_NOTES':
        return handleGetAllVideosWithNotes();
      
      case 'GET_CHATS':
        return handleGetChats();
      
      // טפל בעוד פעולות לפי הצורך
      
      default:
        throw new Error(`פעולה לא מוכרת: ${action}`);
    }
  });
}

/**
 * טיפול בבקשת בדיקת אימות
 */
async function handleCheckAuth() {
  try {
    if (!auth) {
      return { isAuthenticated: false };
    }
    
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      return {
        isAuthenticated: true,
        userInfo: {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName
        }
      };
    }
    
    return { isAuthenticated: false };
  } catch (error) {
    console.error('WordStream: שגיאה בבדיקת אימות:', error);
    return { isAuthenticated: false, error: 'שגיאה בבדיקת אימות' };
  }
}

/**
 * טיפול בבקשת התחברות עם Google
 */
async function handleSignInWithGoogle() {
  try {
    // We now import signInWithGoogle from core/firebase/auth
    // But we need to make that import available here
    // For now, we'll just redirect to the popup for authentication
    console.log('WordStream: Opening popup for Google sign-in');
    
    const popup = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html?action=sign_in'),
      type: 'popup',
      width: 400,
      height: 600
    });
    
    return { success: true, message: 'Opening sign-in popup' };
  } catch (error) {
    console.error('WordStream: Error handling Google sign-in:', error);
    return { 
      success: false, 
      error: 'Failed to open sign-in popup',
      errorDetails: formatErrorForLog(error)
    };
  }
}

/**
 * טיפול בבקשת בדיקת חיבור ל-Firestore
 */
async function handleCheckFirestoreConnection() {
  try {
    // כאן אפשר להוסיף בדיקה אמיתית של חיבור ל-Firestore
    const isConnected = !!auth && !!firebaseApp;
    return { connected: isConnected };
  } catch (error) {
    console.error('WordStream: שגיאה בבדיקת חיבור ל-Firestore:', error);
    return { connected: false };
  }
}

/**
 * טיפול בבקשת קבלת כל הסרטונים עם הערות
 */
async function handleGetAllVideosWithNotes() {
  // יש לממש פונקציה זו לפי הצורך
  // היישום צריך לקרוא לפונקציה המתאימה ב-firebase-service
  return { success: true, data: [] };
}

/**
 * טיפול בבקשת קבלת שיחות
 */
async function handleGetChats() {
  try {
    // בדיקה אם המשתמש מחובר
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('WordStream: User not authenticated when trying to get chats');
      return { success: true, data: [] }; // החזרת מערך ריק אבל ללא שגיאה
    }
    
    // ניסיון לקבל צ'אטים
    const chats = await getChats();
    
    // במקרה שהפונקציה מחזירה שגיאה 'Not implemented'
    if (!chats.success && chats.error === 'Not implemented') {
      console.log('WordStream: Chat functionality not implemented yet, returning empty array');
      return { success: true, data: [] };
    }
    
    return chats;
  } catch (error) {
    console.error('WordStream: Error getting chats:', error);
    return { success: true, data: [] }; // החזרת מערך ריק במקרה של שגיאה
  }
}

// התחל את שירות הרקע
initializeBackgroundService().catch(error => {
  console.error('WordStream: שגיאה קריטית בהפעלת שירות הרקע:', error);
});

/**
 * Wrapper around isUserAuthenticated to maintain compatibility with existing code
 */
function isUserAuthenticatedCompat(authInstance?: Auth): boolean {
  // Ignore the parameter and use the function without parameters
  return isUserAuthenticated();
}

/**
 * Wrapper around triggerTokenRefresh to maintain compatibility with existing code
 */
async function refreshAuthTokenCompat(): Promise<boolean> {
  // Use the function without parameters
  return await triggerTokenRefresh();
}

