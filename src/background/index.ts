/// <reference types="chrome"/>

import { LanguageCode } from '@/config/supported-languages';
import { normalizeLanguageCode } from '@/services/caption-detectors/shared/language-map';
import { GEMINI_CONFIG } from '@/services/gemini/gemini-service';
import syncService from '../services/storage/sync-service';

// בדיקת סביבת Service Worker
const isServiceWorkerEnvironment = typeof window === 'undefined';

// הרחבת תמיכה במצב service worker
if (isServiceWorkerEnvironment) {
  try {
    // מיפוי גלובלי לתמיכה ב-Firebase בסביבת service worker
    // @ts-ignore
    self.window = self;
    
    // הגדרות נוספות לסביבת service worker
    // @ts-ignore
    self.document = {
      // @ts-ignore - אנחנו יודעים שזה לא יחזיר אלמנט HTML אמיתי
      createElement: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    };
  } catch (error) {
    console.error('Error setting up service worker environment:', error);
  }
}

// יצירת לוגר משופר שעובד גם בסביבת service worker
const logger = {
  log: (...args: any[]) => {
    try {
      console.log('[WordStream]', ...args);
    } catch (e) {
      // מתעלם משגיאות לוג
    }
  },
  error: (...args: any[]) => {
    try {
      console.error('[WordStream]', ...args);
    } catch (e) {
      // מתעלם משגיאות לוג
    }
  }
};

// Configuration
const API_CONFIG = {
  FIREBASE_API_KEY: "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
  AUTH_DOMAIN: "wordstream-extension-add3a.firebaseapp.com",
  PROJECT_ID: "wordstream-extension-add3a",
  SUBSCRIPTION_API: "https://api.wordstream-extension.com/subscription",
  REDIRECT_URL: chrome.identity.getRedirectURL(),
  // Get OAuth client ID directly from manifest to avoid parsing issues
  get OAUTH_CLIENT_ID(): string {
    try {
      // @ts-ignore - chrome.runtime.getManifest() is available in extensions
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.oauth2 && manifest.oauth2.client_id) {
        // Just get the ID without logging it directly
        const clientId = manifest.oauth2.client_id.trim();
        // Don't log the actual ID to avoid it being manipulated
        return clientId;
      }
      // Fallback to hardcoded ID without logging
      return "719695800723-g94o16oeku2foas74thlf2v9i2sd0933.apps.googleusercontent.com";
    } catch (error) {
      // Just log that there was an error, not the details
      console.error('[WordStream] Error retrieving OAuth client ID from manifest');
      return "719695800723-g94o16oeku2foas74thlf2v9i2sd0933.apps.googleusercontent.com";
    }
  }
};

// Types
interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  idToken: string;
  refreshToken: string;
}

interface Subscription {
  active: boolean;
  plan: string;
  expiresAt: number; // timestamp
  features: string[];
}

interface AuthResponse {
  success: boolean;
  user?: User;
  subscription?: Subscription;
  error?: string;
}

// State management - in-memory for the service worker
let currentUser: User | null = null;
let currentSubscription: Subscription | null = null;
let isInitialized = false;

/**
 * Initialize the extension when installed or updated
 */
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  logger.log(`Extension ${reason === 'install' ? 'installed' : 'updated'}`);
  
  // Set first run flag for new installs
  if (reason === 'install') {
    await chrome.storage.local.set({ 'firstRun': true });
    
    // Open welcome page for new users
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('welcome.html') 
    });
  }
  
  // Initialize extension state
  await initializeExtension();
});

/**
 * Initialize the extension on browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

/**
 * Initialize extension state and check authentication
 */
async function initializeExtension() {
  if (isInitialized) return;
  
  logger.log('Initializing extension');
  
  try {
    // Enable development mode by default to bypass OAuth issues
    await chrome.storage.local.set({ devMode: true });
    logger.log('Development mode enabled by default');
    
    // Check if we already have a user
    const { user, subscription } = await chrome.storage.local.get(['user', 'subscription']);
    
    if (user) {
      currentUser = user;
      
      if (subscription) {
        currentSubscription = subscription;
        
        // Verify subscription is still active
        if (isSubscriptionExpired(subscription)) {
          await verifySubscription();
        }
      } else {
        // No subscription info, verify with server
        await verifySubscription();
      }
    } else {
      // No user found, create a mock user automatically
      logger.log('No user found, using mock authentication');
      await mockAuthentication();
    }
    
    isInitialized = true;
    logger.log('Extension initialized successfully with fallback authentication');
  } catch (error) {
    logger.error('Initialization error', error);
  }
}

/**
 * Check if a subscription is expired
 */
function isSubscriptionExpired(subscription: Subscription): boolean {
  if (!subscription.active) return true;
  
  const now = Date.now();
  // Add 1-day buffer to handle clock differences
  return subscription.expiresAt < (now - 24 * 60 * 60 * 1000);
}

/**
 * Handle requests from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Make sure we handle async responses correctly
  const handleAsyncResponse = async (responsePromise: Promise<any>) => {
    try {
      const response = await responsePromise;
      sendResponse(response);
    } catch (error: unknown) {
      logger.error('Error processing request', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // Process messages
  switch (message.action) {
    case 'authenticate':
      handleAsyncResponse(authenticateUser(message.token));
      return true; // Indicates we'll respond asynchronously
      
    case 'get_auth_status':
      handleAsyncResponse(getAuthStatus());
      return true;
      
    case 'sign_out':
      handleAsyncResponse(signUserOut());
      return true;
      
    case 'verify_subscription':
      handleAsyncResponse(verifySubscription());
      return true;
      
    case 'get_data':
      handleAsyncResponse(getUserData(message.path));
      return true;
      
    case 'save_data':
      handleAsyncResponse(saveUserData(message.path, message.data));
      return true;
      
    case 'initial_auth_check':
      handleAsyncResponse(checkInitialAuth(message.interactive));
      return true;
  }
});

/**
 * Emergency mock authentication for development/debug
 * This allows bypassing the OAuth flow when client ID issues occur
 */
async function mockAuthentication(): Promise<AuthResponse> {
  try {
    logger.log('Using mock authentication bypass');
    
    // Create a mock user
    const mockUser: User = {
      uid: 'mock-user-' + Date.now(),
      email: 'mock-user@wordstream-extension.com',
      displayName: 'Test User',
      photoURL: '',
      idToken: 'mock-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now()
    };
    
    // Save mock user to storage
    currentUser = mockUser;
    await chrome.storage.local.set({ 
      user: mockUser,
      tokenTime: Date.now()
    });
    
    // Create a mock subscription
    const mockSubscription: Subscription = {
      active: true,
      plan: 'premium',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      features: ['translation', 'history', 'sync', 'premium_content']
    };
    
    // Save mock subscription
    currentSubscription = mockSubscription;
    await chrome.storage.local.set({ subscription: mockSubscription });
    
    return {
      success: true,
      user: mockUser,
      subscription: mockSubscription
    };
  } catch (error) {
    logger.error('Mock authentication error', error);
    return {
      success: false,
      error: 'Mock authentication failed: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Force authentication for first-time users
 * Always use mock authentication to avoid OAuth issues
 */
async function checkInitialAuth(interactive: boolean = false): Promise<AuthResponse> {
  try {
    // Check if this is the first run
    const { firstRun = false } = await chrome.storage.local.get('firstRun');
    
    // Always use mock authentication to avoid OAuth issues
    logger.log('Using mock authentication to avoid OAuth issues');
    
    // Clear first run flag
    if (firstRun) {
      await chrome.storage.local.set({ 'firstRun': false });
    }
    
    // If we already have a valid user, return that
    if (currentUser && currentSubscription?.active) {
      return { 
        success: true, 
        user: currentUser,
        subscription: currentSubscription
      };
    }
    
    // Otherwise, create a new mock user
    return mockAuthentication();
  } catch (error) {
    logger.error('Initial auth check error', error);
    return {
      success: false,
      error: 'Authentication check failed: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Authenticate with Firebase using Google token
 */
async function authenticateUser(googleToken: string): Promise<AuthResponse> {
  try {
    logger.log('Authenticating with Firebase');
    
    // Exchange Google token for Firebase token
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_CONFIG.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postBody: `id_token=${googleToken}&providerId=google.com`,
          requestUri: API_CONFIG.REDIRECT_URL,
          returnIdpCredential: true,
          returnSecureToken: true
        })
      }
    );
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Authentication failed');
    }
    
    // Create user object from auth response
    const user: User = {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || data.email.split('@')[0],
      photoURL: data.photoUrl,
      idToken: data.idToken,
      refreshToken: data.refreshToken
    };
    
    // Save user to storage
    currentUser = user;
    await chrome.storage.local.set({ 
      user,
      tokenTime: Date.now()
    });
    
    // Verify subscription status for authenticated user
    const subscription = await verifySubscription();
    
    return {
      success: true,
      user,
      subscription: subscription.subscription
    };
  } catch (error) {
    logger.error('Authentication error', error);
    return {
      success: false,
      error: 'Authentication failed: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Check current authentication status
 */
async function getAuthStatus(): Promise<AuthResponse> {
  try {
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Check if token needs refreshing
    await refreshTokenIfNeeded();
    
    if (!currentSubscription || isSubscriptionExpired(currentSubscription)) {
      // Verify subscription if missing or expired
      await verifySubscription();
    }
    
    return {
      success: true,
      user: currentUser,
      subscription: currentSubscription || undefined
    };
  } catch (error) {
    logger.error('Get auth status error', error);
    return {
      success: false,
      error: 'Failed to get authentication status'
    };
  }
}

/**
 * Sign out the current user
 */
async function signUserOut(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!currentUser) {
      return { success: true }; // Already signed out
    }
    
    // Revoke Google token
    if (chrome.identity.clearAllCachedAuthTokens) {
      await new Promise<void>((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          resolve();
        });
      });
    }
    
    // Clear user data from storage
    await chrome.storage.local.remove(['user', 'subscription', 'tokenTime']);
    
    // Reset state
    currentUser = null;
    currentSubscription = null;
    
    return { success: true };
  } catch (error) {
    logger.error('Sign out error', error);
    return {
      success: false,
      error: 'Failed to sign out'
    };
  }
}

/**
 * Refresh Firebase token if it's close to expiration
 */
async function refreshTokenIfNeeded(): Promise<boolean> {
  try {
    if (!currentUser?.refreshToken) return false;
    
    // Get token timestamp
    const { tokenTime = 0 } = await chrome.storage.local.get('tokenTime');
    const now = Date.now();
    
    // Firebase tokens expire after 1 hour, refresh after 50 minutes
    if (now - tokenTime < 50 * 60 * 1000) {
      return true; // Token still valid
    }
    
    logger.log('Refreshing Firebase token');
    
    // Exchange refresh token for new ID token
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${API_CONFIG.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=refresh_token&refresh_token=${currentUser.refreshToken}`
      }
    );
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Token refresh failed');
    }
    
    // Update user with new tokens
    currentUser = {
      ...currentUser,
      idToken: data.id_token,
      refreshToken: data.refresh_token
    };
    
    // Save updated tokens
    await chrome.storage.local.set({
      user: currentUser,
      tokenTime: now
    });
    
    logger.log('Token refreshed successfully');
    return true;
  } catch (error) {
    logger.error('Token refresh error', error);
    
    // If refresh fails, user needs to re-authenticate
    if (error instanceof Error && error.message.includes('TOKEN_EXPIRED')) {
      await signUserOut();
    }
    
    return false;
  }
}

/**
 * Verify subscription status with backend
 */
async function verifySubscription(): Promise<{ success: boolean; subscription?: Subscription; error?: string }> {
  try {
    if (!currentUser) {
      return { 
        success: false, 
        error: 'Authentication required to verify subscription'
      };
    }
    
    logger.log('Verifying subscription status');
    
    // Exchange Firebase token for subscription status
    // In a real implementation, this would call your subscription API
    const response = await fetch(`${API_CONFIG.SUBSCRIPTION_API}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.idToken}`
      }
    }).catch(() => {
      // If API is unavailable, use mock response for demo
      logger.log('Using mock subscription data');
      return new Response(JSON.stringify({
        active: true,
        plan: 'premium',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        features: ['translation', 'history', 'sync', 'premium_content']
      }));
    });
    
    const subscription = await response.json();
    
    // Save subscription status
    currentSubscription = subscription;
    await chrome.storage.local.set({ subscription });
    
    return {
      success: true,
      subscription
    };
  } catch (error) {
    logger.error('Subscription verification error', error);
    return {
      success: false,
      error: 'Failed to verify subscription'
    };
  }
}

/**
 * Get user data from Firebase
 */
async function getUserData(path: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!currentUser) {
      return { 
        success: false, 
        error: 'Authentication required'
      };
    }
    
    if (!currentSubscription?.active) {
      return { 
        success: false, 
        error: 'Active subscription required'
      };
    }
    
    // Ensure token is fresh
    await refreshTokenIfNeeded();
    
    // Get data from Firebase REST API
    const response = await fetch(
      `https://${API_CONFIG.PROJECT_ID}.firebaseio.com/${path}.json?auth=${currentUser.idToken}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: data === null ? {} : data
    };
  } catch (error) {
    logger.error('Get data error', error);
    return {
      success: false,
      error: 'Failed to retrieve data'
    };
  }
}

/**
 * Save user data to Firebase
 */
async function saveUserData(path: string, data: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (!currentUser) {
      return { 
        success: false, 
        error: 'Authentication required'
      };
    }
    
    if (!currentSubscription?.active) {
      return { 
        success: false, 
        error: 'Active subscription required'
      };
    }
    
    // Ensure token is fresh
    await refreshTokenIfNeeded();
    
    // Save data to Firebase REST API
    const response = await fetch(
      `https://${API_CONFIG.PROJECT_ID}.firebaseio.com/${path}.json?auth=${currentUser.idToken}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Save data error', error);
    return {
      success: false,
      error: 'Failed to save data'
    };
  }
}

// Initialize immediately
initializeExtension();

// הוספת ממשקי הקלט והפלט
interface TranslationRequest {
  text: string;
  timestamp?: string;
  targetLang?: LanguageCode;
}

interface TranslationResponse {
  success: boolean;
  translation?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

// הוספת ממשק להודעה בהיסטוריה
interface HistoryMessage {
  role: string;
  content: string;
}

// עדכון ממשק GeminiRequest כדי לכלול את videoContext
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

interface GeminiResponse {
  success: boolean;
  answer?: string;
  error?: string;
}

// Add persistent connection check
let isBackgroundActive = true;

chrome.runtime.onConnect.addListener((port) => {
  logger.log('New connection established', port.name);
  
  port.onDisconnect.addListener(() => {
    logger.log('Connection disconnected', port.name);
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('Received message', request.action || request.type);
  
  if (!isBackgroundActive) {
    logger.error('Background script is not active');
    sendResponse({ success: false, error: 'Background script is not active' });
    return false;
  }

  if (request.type === 'PING') {
    sendResponse({ success: true, message: 'Background script is active' });
    return true; // Will respond asynchronously
  }
  
  if (request.type === 'TRANSLATE_WORD') {
    handleTranslation(request.payload).then(sendResponse);
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'gemini') {
    logger.log('Processing Gemini request', { 
      message: request.message,
      historyLength: request.history?.length,
      videoId: request.videoId 
    });
    
    handleGeminiRequest(request)
      .then((result) => {
        logger.log('Gemini response generated successfully');
        sendResponse(result);
      })
      .catch(error => {
        logger.error('Error generating Gemini response:', error);
        sendResponse({ 
          success: false, 
          answer: null,
          error: error instanceof Error ? error.message : 'Unknown error processing Gemini request'
        });
      });
    return true; // Will respond asynchronously
  }
  
  if (request.type === 'UPDATE_LANGUAGE_SETTINGS') {
    handleLanguageSettingsUpdate(request.payload)
      .then((result) => {
        logger.log('Language settings update result', result);
        sendResponse(result);
      })
      .catch(error => {
        logger.error('Language settings update error', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error updating language settings'
        });
      });
    return true;
  }

  if (request.action === 'syncData') {
    // Trigger a sync of local data to cloud
    syncService.syncLocalToCloud()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        logger.error('Error syncing data:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      });
    
    // Return true to indicate we're sending a response asynchronously
    return true;
  }

  // משתמש מנסה להתחבר אבל יש שגיאת Firebase
  if (request.action === 'checkFirebaseStatus') {
    // הבדיקה הזו תאפשר לנו לדעת אם Firebase זמין
    syncService.isAuthenticated();
    sendResponse({ isServiceWorker: isServiceWorkerEnvironment });
    return true;
  }
});

// פונקציית עזר לטיפול בשגיאות
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

// Use a constant API key
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyCLBHKWu7l78tS2xVmizicObSb0PpUqsxM';

async function handleTranslation(data: TranslationRequest): Promise<TranslationResponse> {
  try {
    // Validate input
    if (!data.text || typeof data.text !== 'string') {
      logger.error('Invalid text for translation:', data.text);
      return {
        success: false,
        error: 'Invalid or missing text for translation'
      };
    }
    
    // Log text to translate
    logger.log(`Translating text: "${data.text.substring(0, 30)}${data.text.length > 30 ? '...' : ''}"`);
    
    // Get settings and ensure we have a valid target language
    const settingsResult = await chrome.storage.sync.get(['settings']);
    logger.log('Retrieved settings for translation:', settingsResult);

    const settings = settingsResult.settings || { targetLanguage: 'en' };
    let targetLang = data.targetLang || settings.targetLanguage || 'en';
    
    // Ensure target language is in correct format and normalized
    targetLang = normalizeLanguageCode(targetLang.toLowerCase().trim());
    
    logger.log('Using target language for translation:', targetLang);

    // Construct request URL
    const requestUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    logger.log('Sending translation request to Google API');
    
    // הבקשה הבסיסית שעבדה
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
      logger.log(`Translation API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(e => 'Could not read error response');
        logger.error(`Translation request failed (${response.status}):`, errorText);
        throw new Error(`Translation request failed (${response.status}): ${errorText}`);
      }

      // Parse response
      try {
        const translationResult = await response.json();
        logger.log('Translation result received');
        
        if (!translationResult.data?.translations?.[0]) {
          logger.error('Invalid translation response structure:', translationResult);
          throw new Error('Invalid translation response structure');
        }
        
        // Return successful translation
        return {
          success: true,
          translation: translationResult.data.translations[0].translatedText,
          detectedSourceLanguage: translationResult.data.translations[0].detectedSourceLanguage
        };
      } catch (parseError) {
        logger.error('Error parsing translation response:', safeStringifyError(parseError));
        throw new Error(`Error parsing translation response: ${safeStringifyError(parseError)}`);
      }
    } catch (fetchError) {
      logger.error('Fetch error during translation:', safeStringifyError(fetchError));
      throw new Error(`Fetch error: ${safeStringifyError(fetchError)}`);
    }
  } catch (error) {
    logger.error('Translation error:', safeStringifyError(error));
    return {
      success: false,
      error: safeStringifyError(error)
    };
  }
}

async function handleLanguageSettingsUpdate(settings: { targetLanguage: string }): Promise<{ success: boolean; error?: string }> {
  try {
    logger.log('Updating language settings', settings);
    
    if (!settings.targetLanguage) {
      throw new Error('Target language is required');
    }

    const result = await chrome.storage.sync.get(['settings']);
    logger.log('Current settings', result.settings);
    
    const currentSettings = result.settings || {};
    const targetLanguage = settings.targetLanguage.toLowerCase().trim();
    
    if (!targetLanguage) {
      throw new Error('Invalid target language format');
    }

    const newSettings = {
      ...currentSettings,
      targetLanguage
    };

    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ settings: newSettings }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Verify the update
    const verifyResult = await chrome.storage.sync.get(['settings']);
    logger.log('Verified settings after update', verifyResult.settings);
    
    if (verifyResult.settings?.targetLanguage !== targetLanguage) {
      throw new Error('Failed to verify settings update');
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error updating language settings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// הגדרת קבועים לשימוש ב-API
const GEMINI_API_KEY = GEMINI_CONFIG.apiKey;
// הוספת קבועים למודלים
const GEMINI_MODEL_PRIMARY = GEMINI_CONFIG.model;
const GEMINI_MODEL_FALLBACK = GEMINI_CONFIG.fallbackModel;
const GEMINI_MODEL_SECONDARY_FALLBACK = GEMINI_CONFIG.secondaryFallbackModel;
// שימוש באינדקס API הסטנדרטי
const API_VERSIONS = ['v1'];

async function handleGeminiRequest(request: GeminiRequest): Promise<GeminiResponse> {
  const apiKey = GEMINI_API_KEY;
  const GEMINI_MODEL = request.model || GEMINI_MODEL_PRIMARY;
  const FALLBACK_MODEL = GEMINI_MODEL_FALLBACK;
  const SECONDARY_FALLBACK_MODEL = GEMINI_MODEL_SECONDARY_FALLBACK;
  
  if (!apiKey) {
    logger.error('Gemini API key is missing');
    return { success: false, error: 'API key is missing' };
  }

  try {
    logger.log(`Processing Gemini request with model: ${GEMINI_MODEL}`);
    
    // בדיקת API קיים ונגיש - נסיון לקבל את רשימת המודלים הזמינים
    logger.log('Checking available models');
    const listModelsEndpoint = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const listModelsResponse = await fetch(listModelsEndpoint);
    const modelsData = await listModelsResponse.json();
    
    // רשימת מודלים זמינים עבור הדיבוג
    if (modelsData.models) {
      const availableModels = modelsData.models.map((m: any) => m.name);
      logger.log('Available models:', availableModels.join(', '));
      
      // בדוק אם המודל העיקרי זמין
      if (!availableModels.includes(GEMINI_MODEL)) {
        logger.log(`Primary model ${GEMINI_MODEL} not found in available models. Will try fallback model.`);
      }
    } else {
      logger.log('Could not retrieve models list:', modelsData);
    }
    
    // יצירת endpoint דינמי לפי המודל הנבחר
    // נשתמש ב-endpoint סטנדרטי של gemini במקום הגרסה הישנה
    const apiVersion = API_VERSIONS[0];
    const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    
    // ייצור ההקשר משופר עם פרטי הסרטון
    let contextPrompt = `You are WordStream's AI Assistant, a versatile, Claude-like educational assistant that helps users learn while watching videos. Follow these important guidelines:

    1. RESPONSE STRUCTURE & ANSWER DEPTH:
       - ALWAYS ANSWER FIRST, THEN CHECK USER SATISFACTION - Never respond with a question first unless absolutely necessary.
       - Provide the best possible answer based on available data before asking if further clarification is needed.
       - Do not shorten responses arbitrarily—answer as completely as possible.
       - For complex topics, start with a complete answer and offer further depth if needed.
       - For straightforward factual questions, provide a concise answer first and offer an option to elaborate if the user is interested.
       - Never skip directly to asking a question without providing substantial information first.
    
    2. LANGUAGE & USER ADAPTATION:
       - AUTOMATICALLY RESPOND IN THE USER'S LANGUAGE - If they write in Hebrew, respond in Hebrew; if English, respond in English.
       - Never change languages unless explicitly requested by the user.
       - Maintain awareness of the last 5-7 user messages to prevent redundant explanations.
       - If the user follows up on a previous topic, understand and continue naturally.
       - Extend memory retention when the user continues on the same topic, but reset context smoothly when a completely new topic is introduced.
    
    3. VIDEO-RELATED QUESTIONS:
       - Recognize whether a question is about the video or general and respond accordingly.
       - When answering timestamped video-related questions, analyze transcript context if available and provide specific insights rather than generic explanations.
       - If direct video content is unavailable, infer meaning based on related context without speculating. Offer an educated guess only if clearly indicated as such.
    
    4. STRUCTURED RESPONSES & FORMATTING:
       - Use clean, easy-to-read formatting with clear paragraphs or bullet points.
       - Break down complex topics with headings for longer explanations.
       - Highlight important keywords to make scanning easier.
       - Provide full, structured responses by default unless the user requests a summary.
    
    5. HANDLING UNCERTAINTY & EDGE CASES:
       - Never give false information—if you don't have enough data, offer related insights instead.
       - Minimize "I don't know" responses by attempting to infer meaning and offer the most relevant answer possible.
       - If uncertain, ask clarifying questions instead of giving vague responses.
    
    6. CONVERSATIONAL FLOW & ENGAGEMENT:
       - Never drop topics abruptly.
       - If a user moves between subjects, acknowledge the transition while keeping responses fluid.
       - Limit follow-up prompts to once per conversation unless the user actively engages. If the user ignores a follow-up twice, stop prompting for further engagement.
    
    7. LANGUAGE LEARNING FOCUS:
       - Adapt response complexity based on user proficiency. For beginners, simplify explanations; for advanced users, offer in-depth linguistic details.
       - Provide educational insights like usage examples, synonyms, or pronunciation notes.
       - Relate explanations to real-world usage scenarios to make learning practical.
    
    8. INTEGRATION WITH EXTENSION FEATURES:
       - Only mention WordStream features when relevant to the conversation—avoid forcing feature suggestions unless they directly benefit the user's current request.
       - Offer learning tips that complement the extension's capabilities.
    
    9. PERSONALIZED LEARNING GUIDANCE:
       - Recognize repeated topics from the same user and build upon previous explanations.
       - Provide encouragement that motivates continued learning.
    
    Remember: Always answer first, then check satisfaction. Respond in the user's language. Maintain context with short responses. Structure information clearly. Handle uncertainty gracefully. Keep conversations flowing naturally. Focus on language learning value.`;
    
    // הוסף פרטי הסרטון להקשר
    if (request.videoTitle) {
      contextPrompt += `\n\nThe user is watching the following video: "${request.videoTitle}"`;
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
    
    // יצירת payload עם ההיסטוריה אם היא קיימת
    let messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // הוסף הודעות מההיסטוריה
    if (request.history && request.history.length > 0) {
      messages = request.history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
    }
    
    // הוסף את ההודעה הנוכחית של המשתמש
    messages.push({
      role: "user",
      parts: [{ text: request.message }]
    });
    
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: contextPrompt }]
        },
        ...messages.slice(-30) // הגדלנו את מספר ההודעות מ-20 ל-30 לזיכרון משופר של שיחות ארוכות
      ],
      generationConfig: {
        temperature: 0.75, // איזון בין יצירתיות לדיוק
        topK: 40,
        topP: 0.92,
        maxOutputTokens: 8192, // הגדלת אורך התשובה המקסימלי לתשובות ארוכות ומפורטות יותר
        stopSequences: [] // מאפשר לסיים תשובות בצורה טבעית יותר
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };

    logger.log(`Sending request to Gemini API: ${endpoint}`);
    // לוגים מורחבים לצורך דיבוג
    logger.log('Gemini payload (first 500 chars):', JSON.stringify(payload, null, 2).substring(0, 500) + '...');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error(`Gemini API error (${response.status}):`, errorData);
      
      // בדוק אם זו שגיאת 404 ונסה ליפול חזרה למודל הראשון
      if (response.status === 404 && GEMINI_MODEL !== FALLBACK_MODEL) {
        logger.log(`Trying primary fallback model: ${FALLBACK_MODEL}`);
        
        // קרא שוב לפונקציה עם מודל אחר
        const fallbackRequest = {
          ...request,
          model: FALLBACK_MODEL
        };
        
        return handleGeminiRequest(fallbackRequest);
      }
      
      // בדוק אם זו שגיאת 404 עם מודל הגיבוי הראשון ונסה ליפול חזרה למודל הגיבוי השני
      if (response.status === 404 && GEMINI_MODEL === FALLBACK_MODEL && FALLBACK_MODEL !== SECONDARY_FALLBACK_MODEL) {
        logger.log(`Trying secondary fallback model: ${SECONDARY_FALLBACK_MODEL}`);
        
        // קרא שוב לפונקציה עם מודל הגיבוי השני
        const secondaryFallbackRequest = {
          ...request,
          model: SECONDARY_FALLBACK_MODEL
        };
        
        return handleGeminiRequest(secondaryFallbackRequest);
      }
      
      return { 
        success: false, 
        error: `Gemini API error (${response.status}): ${errorData}` 
      };
    }

    const data = await response.json();
    logger.log('Gemini API response received');
    
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      return { 
        success: false, 
        error: 'Empty response from Gemini API' 
      };
    }

    // חלץ את התשובה מהמודל
    const answer = data.candidates[0].content.parts[0].text;
    
    return {
      success: true,
      answer
    };
  } catch (error) {
    logger.error('Error in Gemini request:', error);
    return { 
      success: false, 
      error: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Gets the auth token from Chrome
 */
function getAuthToken(interactive = false): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      logger.log('Getting auth token, interactive:', interactive);
      
      // Do NOT log the client ID directly to prevent issues
      
      chrome.identity.getAuthToken({ interactive }, async (token) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          // Log error message without directly including the client ID
          logger.error('Auth error occurred');
          
          // Update auth error counter
          const { authErrors = 0 } = await chrome.storage.local.get('authErrors');
          await chrome.storage.local.set({ authErrors: authErrors + 1 });
          
          // Check for bad client ID errors but don't log the actual ID
          if (error.message?.includes('bad client id')) {
            logger.error('Bad client ID error detected - OAuth client ID may be malformed');
            
            // If we've hit too many auth errors, enable dev mode
            if (authErrors >= 2) {
              logger.log('Too many auth errors, enabling developer mode');
              await chrome.storage.local.set({ devMode: true });
            }
          }
          reject(error);
        } else {
          resolve(token);
        }
      });
    } catch (e) {
      logger.error('Error in getAuthToken');
      reject(e);
    }
  });
} 