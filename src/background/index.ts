/**
 * Background Script
 * This script runs in the background and handles events and communications
 * between content scripts, popup, and Firebase.
 */

import { initializeFirebase, getFirebaseServices } from '../auth';
import { collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { isServiceWorker, hasWindow } from '../utils/environment';

// Check environment
if (hasWindow()) {
  console.warn('WordStream: Background script running in an environment with window, this might cause issues');
} else {
  console.log('WordStream: Background script initialized in service worker environment');
}

/**
 * Track readiness of different parts of the extension
 */
const extensionReadiness = {
  background: false,
  popup: false,
  contentScripts: new Map<number, boolean>(), // tabId -> ready status
  
  setReady(component: 'background' | 'popup', value: boolean = true) {
    this[component] = value;
    console.log(`WordStream: ${component} is now ${value ? 'ready' : 'not ready'}`);
  },
  
  setTabReady(tabId: number, value: boolean = true) {
    this.contentScripts.set(tabId, value);
    console.log(`WordStream: Content script in tab ${tabId} is now ${value ? 'ready' : 'not ready'}`);
  },
  
  isPopupReady() {
    return this.popup;
  },
  
  isBackgroundReady() {
    return this.background;
  },
  
  isTabReady(tabId: number) {
    return this.contentScripts.has(tabId) && this.contentScripts.get(tabId) === true;
  }
};

// Add a flag to track background readiness
let isBackgroundReady = false;

/**
 * More robust message sending that handles receiver readiness
 */
function sendMessageWithReadinessCheck(target: 'popup' | number, message: any, maxAttempts: number = 5): Promise<any> {
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    function attemptSend() {
      attempts++;
      
      // Check if target is ready
      const isReady = typeof target === 'number' 
        ? extensionReadiness.isTabReady(target)
        : extensionReadiness.isPopupReady();
      
      if (isReady) {
        // Target is ready, send message
        if (typeof target === 'number') {
          // Send to specific tab
          chrome.tabs.sendMessage(target, message, (response) => {
            if (chrome.runtime.lastError) {
              console.warn(`WordStream: Error sending message to tab ${target}:`, chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            resolve(response);
          });
        } else {
          // Send to popup or other extension pages
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('WordStream: Error sending message to popup:', chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            resolve(response);
          });
        }
      } else if (attempts < maxAttempts) {
        // Target not ready yet, retry with exponential backoff
        const delay = Math.min(100 * Math.pow(2, attempts), 2000); // 100ms, 200ms, 400ms, 800ms, 1600ms
        console.log(`WordStream: Target not ready, attempt ${attempts}/${maxAttempts}, retrying in ${delay}ms`);
        setTimeout(attemptSend, delay);
      } else {
        // Max attempts reached
        console.warn(`WordStream: Failed to send message after ${maxAttempts} attempts - target not ready`);
        resolve(null);
      }
    }
    
    // Start attempt process
    attemptSend();
  });
}

// Initialize Firebase when background script loads
async function initializeBackgroundServices() {
  try {
    await initializeFirebase();
    console.log('WordStream: Firebase initialized in background');
    
    // Validate Gemini API key
    await validateGeminiApiKey();
    
    // Set up periodic auth token refresh
    setupAuthTokenRefresh();
    
    // Mark background as ready
    isBackgroundReady = true;
    console.log('WordStream: Background services fully initialized and ready');
    
    // Immediately check and restore authentication state
    try {
      // Check if we have stored auth data
      const data = await chrome.storage.local.get(['wordstream_user_info']);
      if (data.wordstream_user_info) {
        console.log('WordStream: Restoring authentication state from storage');
        
        // Delay sending messages to ensure receivers are ready
        setTimeout(() => {
          // Create auth state message
          const authStateMessage = { 
            action: 'AUTH_STATE_CHANGED',
            user: data.wordstream_user_info,
            isAuthenticated: true,
            source: 'background_init'
          };
          
          // Use the safe message sending function instead of direct calls
          safelySendMessage(authStateMessage);
          
          console.log('WordStream: Authentication state broadcast complete');
        }, 1000); // 1 second delay to give receivers time to initialize
      }
    } catch (error) {
      console.error('WordStream: Error restoring auth state:', error);
    }
    
    return true;
  } catch (error) {
    console.error('WordStream: Failed to initialize Firebase in background:', error);
    return false;
  }
}

/**
 * Set up periodic authentication token refresh
 */
function setupAuthTokenRefresh() {
  // Check and refresh auth token every 30 minutes
  setInterval(async () => {
    try {
      const data = await chrome.storage.local.get(['wordstream_user_info']);
      if (data.wordstream_user_info) {
        // Get Firebase auth services
        const services = await getFirebaseServices();
        
        if (services.auth && services.auth.currentUser) {
          // Force token refresh
          try {
            await services.auth.currentUser.getIdToken(true);
            console.log('WordStream: Auth token refreshed successfully');
            
            // Update timestamp in storage
            chrome.storage.local.set({
              'wordstream_user_info': {
                ...data.wordstream_user_info,
                lastAuthenticated: Date.now()
              }
            });
          } catch (err) {
            console.error('WordStream: Error refreshing token:', err);
          }
        } else {
          // Try to refresh through the auth manager
          try {
            const { checkAndRefreshAuth } = await import('../auth/auth-manager');
            await checkAndRefreshAuth();
            console.log('WordStream: Auth token refresh check completed via auth manager');
          } catch (error) {
            console.error('WordStream: Error checking/refreshing auth token via auth manager:', error);
          }
        }
      }
    } catch (error) {
      console.error('WordStream: Error in token refresh:', error);
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}

/**
 * Handle Google Sign In
 */
async function handleGoogleSignIn() {
  try {
    console.log('WordStream: Starting Google sign-in from background');
    
    // Make sure we have access to required APIs
    if (typeof chrome === 'undefined' || !chrome.identity) {
      throw new Error('Chrome identity API is not available in this context');
    }
    
    // Use chrome.identity directly from service worker environment
    // instead of trying to call signInWithGoogle that might use window
    try {
      // Get an auth token directly using chrome.identity
      const token = await new Promise<string>((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Chrome identity error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!token) {
            console.error('WordStream: Failed to get auth token');
            reject(new Error('Failed to get auth token'));
            return;
          }
          
          console.log('WordStream: Successfully retrieved auth token directly');
          resolve(token);
        });
      });
      
      // Get user info from the token
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }
      
      const userInfo = await response.json();
      
      // Create a user object with the retrieved information
      const user = {
        uid: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture,
        emailVerified: userInfo.email_verified,
        lastAuthenticated: Date.now()
      };
      
      // Store user info
      await chrome.storage.local.set({
        'wordstream_user_info': user
      });
      
      // Broadcast authentication state to all tabs
      console.log('WordStream: Broadcasting authentication state to all tabs');
      
      // Broadcast to all tabs
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              try {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'AUTH_STATE_CHANGED',
                  isAuthenticated: true,
                  user: user,
                  source: 'google_signin_broadcast'
                }).catch(() => {
                  // Ignore expected errors from tabs without listeners
                });
              } catch (tabError) {
                // Ignore errors in broadcasting to specific tabs
              }
            }
          });
        });
      } catch (broadcastError) {
        console.warn('WordStream: Error broadcasting auth state:', broadcastError);
      }
      
      console.log('WordStream: Google sign in successful using direct method');
      return user;
    } catch (directError) {
      console.error('WordStream: Direct Google sign-in failed, trying import method:', directError);
      
      // Fallback to dynamic import if the direct method fails
      const { signInWithGoogle } = await import('../auth/auth-manager');
      const result = await signInWithGoogle();
      
      // Also broadcast auth state after successful sign-in with fallback method
      const user = result.user;
      
      // Broadcast to all tabs
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              try {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'AUTH_STATE_CHANGED',
                  isAuthenticated: true,
                  user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    lastAuthenticated: Date.now()
                  },
                  source: 'google_signin_fallback_broadcast'
                }).catch(() => {
                  // Ignore expected errors from tabs without listeners
                });
              } catch (tabError) {
                // Ignore errors in broadcasting to specific tabs
              }
            }
          });
        });
      } catch (broadcastError) {
        console.warn('WordStream: Error broadcasting auth state:', broadcastError);
      }
      
      console.log('WordStream: Google sign in successful using import method');
      return result.user;
    }
  } catch (error) {
    console.error('WordStream: Error in Google sign in:', error);
    throw error;
  }
}

/**
 * Validate Gemini API key
 */
async function validateGeminiApiKey() {
  try {
    const result = await chrome.storage.local.get(['api_keys']);
    const apiKey = result?.api_keys?.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.warn('WordStream: Gemini API key not found, using fallback key');
      
      // Set a fallback API key (this should be replaced with a proper key in production)
      const fallbackKey = "AIzaSyC9LYYnWBb4OvIZhisFHpYTnbBV3XFvzYE";
      
      // Save fallback key to storage for future use
      await chrome.storage.local.set({
        'api_keys': { 'GOOGLE_API_KEY': fallbackKey }
      });
      
      return false;
    }
    
    // Basic validation - check if key has reasonable length
    if (apiKey.length < 20) {
      console.error('WordStream: Invalid Gemini API key format');
      return false;
    }
    
    console.log('WordStream: Gemini API key validated successfully');
    return true;
  } catch (error) {
    console.error('WordStream: Error validating Gemini API key:', error);
    return false;
  }
}

// Define types for Gemini API
interface GeminiMessage {
  role: string;
  content: string;
}

interface GeminiRequestContent {
  role: string;
  parts: { text: string }[];
}

interface GeminiRequestBody {
  contents: GeminiRequestContent[];
  generationConfig?: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
}

/**
 * Safely send a message to all contexts of the extension
 * This handles errors gracefully and prevents unhandled promise rejections
 */
function safelySendMessage(message: any, responseCallback?: (response: any) => void): void {
  try {
    // Check if this is an authentication message
    const isAuthMessage = message.action === 'AUTH_STATE_CHANGED';
    
    // Log message type
    console.log(`WordStream: Broadcasting ${isAuthMessage ? 'AUTHENTICATION' : 'standard'} message to extension contexts`);
    
    // For auth messages, we want to be more persistent
    const retryCount = isAuthMessage ? 3 : 1;
    const initialDelay = isAuthMessage ? 100 : 500;
    
    // Try to send to popup if it's ready
    if (extensionReadiness.isPopupReady()) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('WordStream: Error sending message to extension contexts:', chrome.runtime.lastError.message);
          // Continue despite error
        }
        
        if (responseCallback) responseCallback(response);
      });
    } else {
      // Queue message for when popup becomes ready
      console.log('WordStream: Popup not ready, queueing message');
      
      // We'll send the message with delay to allow receivers to initialize
      setTimeout(() => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            // This is expected if no listeners
            if (responseCallback) responseCallback(null);
            return;
          }
          if (responseCallback) responseCallback(response);
        });
      }, initialDelay);
    }
    
    // Get tabs and check each tab's readiness before sending
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          // For auth messages, try multiple times with increasing delays
          const sendToTab = (attempt = 0) => {
            try {
              chrome.tabs.sendMessage(tab.id!, message, (response) => {
                // Individual tab responses are ignored
                if (chrome.runtime.lastError) {
                  // If this is an auth message and we have retries left, try again
                  if (isAuthMessage && attempt < retryCount) {
                    const nextAttempt = attempt + 1;
                    const delay = initialDelay * Math.pow(2, nextAttempt);
                    console.log(`WordStream: Retry ${nextAttempt}/${retryCount} for auth message to tab ${tab.id} in ${delay}ms`);
                    setTimeout(() => sendToTab(nextAttempt), delay);
                  }
                }
              });
            } catch (e) {
              // Ignore errors from tabs that can't receive messages
              if (isAuthMessage && attempt < retryCount) {
                const nextAttempt = attempt + 1;
                const delay = initialDelay * Math.pow(2, nextAttempt);
                setTimeout(() => sendToTab(nextAttempt), delay);
              }
            }
          };
          
          // Use a slight delay to reduce chances of "receiving end does not exist"
          setTimeout(() => sendToTab(0), 200);
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Critical error broadcasting message:', error);
    // Try to handle the response if possible
    if (responseCallback) responseCallback({ error: 'Message broadcast failed' });
  }
}

// Set up listeners for messages from content scripts and popup
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('WordStream: Background received message:', message?.action || 'Unknown action');

    // Special case: Always respond to readiness check
    if (message?.action === 'IS_BACKGROUND_READY') {
      sendResponse({ ready: isBackgroundReady });
      return true;
    }
    
    // If background isn't ready yet, return an appropriate error
    if (!isBackgroundReady && message?.action !== 'READY_CHECK') {
      console.warn('WordStream: Background not ready yet for action:', message?.action);
      sendResponse({ 
        success: false, 
        error: 'Background service not ready yet',
        backgroundReady: false
      });
      return true;
    }

    // Handle message based on action type
    switch (message?.action) {
      case 'SIGN_IN_WITH_GOOGLE':
        // Handle Google Sign In
        console.log('WordStream: Processing Google Sign In request');
        try {
          handleGoogleSignIn()
            .then(user => {
              console.log('WordStream: Google sign-in successful, broadcasting state');
              
              // Prepare auth message with necessary user data
              const authStateMessage = { 
                action: "AUTH_STATE_CHANGED", 
                user,
                isAuthenticated: true,
                source: 'google_signin_success'
              };
              
              // Use safe message sending
              safelySendMessage(authStateMessage);
              
              // Send success response
              sendResponse({ 
                success: true, 
                user 
              });
            })
            .catch(error => {
              console.error('WordStream: Google Sign In error:', error);
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : "Authentication failed"
              });
            });
        } catch (error) {
          console.error('WordStream: Immediate error in Google Sign In:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Authentication failed"
          });
        }
        return true; // Indicates async response
        
      case 'AUTH_STATE_CHANGED':
        // Store authentication state in chrome.storage.local
        try {
          if (message.isAuthenticated && message.user) {
            console.log('WordStream: Received AUTH_STATE_CHANGED event (authenticated) from', message.source || 'unknown source');
            
            // Create user info with updated timestamp
            const userInfo = {
              ...message.user,
              lastAuthenticated: Date.now()
            };
            
            // Store in local storage
            try {
              chrome.storage.local.set({
                'wordstream_user_info': userInfo
              });
              console.log('WordStream: Updated authentication in storage');
            } catch (storageError) {
              console.error('WordStream: Failed to store authentication:', storageError);
            }
            
            // Forward safely to all contexts
            safelySendMessage({
              ...message,
              user: userInfo
            });
          } else {
            console.log('WordStream: Received AUTH_STATE_CHANGED event (signed out) from', message.source || 'unknown source');
            
            // Clear authentication when signed out
            try {
              chrome.storage.local.remove(['wordstream_user_info']);
              console.log('WordStream: Cleared authentication from storage');
            } catch (storageError) {
              console.error('WordStream: Error clearing authentication from storage:', storageError);
            }
            
            // Forward safely
            safelySendMessage(message);
          }
          
          // Always send a response
          sendResponse({ success: true });
        } catch (error) {
          console.error('WordStream: Error handling AUTH_STATE_CHANGED:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : "Error handling auth state change" 
          });
        }
        return true;
        
      case 'SAVE_NOTE':
        try {
          handleSaveNote(message.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in SAVE_NOTE:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true; // Indicates async response
        
      case 'GET_AUTH_STATE':
        try {
          getAuthState()
            .then(authState => sendResponse(authState))
            .catch(error => sendResponse({ 
              isAuthenticated: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in GET_AUTH_STATE:', error);
          sendResponse({ 
            isAuthenticated: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;
        
      case 'GEMINI_CHAT':
        // Handle Gemini chat request
        console.log('WordStream: Processing Gemini chat request');
        
        try {
          // First verify user authentication
          getAuthState().then(authState => {
            if (!authState.isAuthenticated) {
              console.error('WordStream: User not authenticated for Gemini chat');
              sendResponse({
                success: false,
                error: 'User not authenticated'
              });
              return;
            }
            
            // Get API key from storage
            chrome.storage.local.get(['api_keys'], async (result) => {
              try {
                let apiKey = result?.api_keys?.GOOGLE_API_KEY;
                
                // If API key not found, use fallback
                if (!apiKey) {
                  console.warn('WordStream: Gemini API key not found in storage, using fallback');
                  apiKey = 'AIzaSyC9LYYnWBb4OvIZhisFHpYTnbBV3XFvzYE';
                  
                  // Save fallback key to storage for future use
                  await chrome.storage.local.set({
                    'api_keys': { 'GOOGLE_API_KEY': apiKey }
                  });
                }
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
                
                const requestBody: GeminiRequestBody = {
                  contents: []
                };
                
                // Add message history if available
                if (message.history && message.history.length > 0) {
                  requestBody.contents = message.history.map((msg: GeminiMessage) => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                  }));
                }
                
                // Add the current message
                requestBody.contents.push({
                  role: 'user',
                  parts: [{ text: message.query }]
                });
                
                // Add generation configuration
                requestBody.generationConfig = {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 1024,
                };
                
                console.log('WordStream: Sending request to Gemini API');
                
                // Send request to Gemini API
                fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(requestBody)
                })
                .then(response => {
                  if (!response.ok) {
                    return response.json().then(errorData => {
                      console.error('WordStream: Gemini API error:', errorData);
                      throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
                    });
                  }
                  return response.json();
                })
                .then(data => {
                  console.log('WordStream: Gemini API response received');
                  // Extract the text from the response
                  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
                  
                  // Send the response back to the content script
                  sendResponse({
                    success: true,
                    content: responseText
                  });
                  
                  // Save chat to Firebase
                  saveGeminiChatToFirebase(message.userId || authState.user?.uid, message.query, responseText, message.context)
                    .catch(error => console.error('WordStream: Error saving chat to Firebase:', error));
                })
                .catch(error => {
                  console.error('WordStream: Error calling Gemini API:', error);
                  sendResponse({
                    success: false,
                    error: error.message || 'Error calling Gemini API'
                  });
                });
              } catch (error) {
                console.error('WordStream: Error processing Gemini request:', error);
                sendResponse({
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            });
          }).catch(error => {
            console.error('WordStream: Error checking auth for Gemini:', error);
            sendResponse({
              success: false,
              error: 'Failed to verify authentication: ' + (error instanceof Error ? error.message : String(error))
            });
          });
        } catch (error) {
          console.error('WordStream: Immediate error in Gemini chat:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Return true to indicate we will respond asynchronously
        return true;
        
      case 'CHECK_GEMINI_CONFIG':
        try {
          validateGeminiApiKey()
            .then(isValid => sendResponse({ success: true, configured: isValid }))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in CHECK_GEMINI_CONFIG:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;

      case 'SAVE_TRANSLATION':
        // Handle saving translation to Firestore
        try {
          handleSaveTranslation(message.translation)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in SAVE_TRANSLATION:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;

      case 'OPEN_AUTH_POPUP':
        // Open the login popup
        try {
          openAuthPopup()
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in OPEN_AUTH_POPUP:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;

      case 'SAVE_CHAT':
        // Save a new chat session to Firestore
        try {
          handleSaveChat(message.chat)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in SAVE_CHAT:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;

      case 'UPDATE_CHAT':
        // Update an existing chat session
        try {
          handleUpdateChat(message.chatId, message.updates)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
        } catch (error) {
          console.error('WordStream: Immediate error in UPDATE_CHAT:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        return true;
        
      case 'READY_CHECK':
        // Handle readiness check message
        if (sender.tab && sender.tab.id) {
          // Message from content script
          extensionReadiness.setTabReady(sender.tab.id, true);
          sendResponse({ ready: true, component: 'background' });
        } else {
          // Message from popup or options page
          extensionReadiness.setReady('popup', true);
          sendResponse({ ready: true, component: 'background' });
        }
        return true;
        
      case 'TRANSLATE':
        try {
          console.log('WordStream: Processing translation request');
          
          // First verify user authentication
          getAuthState().then(async authState => {
            if (!authState.isAuthenticated) {
              console.error('WordStream: User not authenticated for translation');
              sendResponse({
                success: false,
                error: 'Authentication required'
              });
              return;
            }
            
            // Process the translation
            try {
              const { text, targetLang } = message.data;
              
              if (!text) {
                sendResponse({
                  success: false,
                  error: 'No text provided for translation'
                });
                return;
              }
              
              // Get API key from storage
              const apiKeysResult = await chrome.storage.local.get(['api_keys']);
              let apiKey = apiKeysResult?.api_keys?.GOOGLE_API_KEY;
              
              // If API key not found, use fallback
              if (!apiKey) {
                console.warn('WordStream: Translation API key not found in storage, using fallback');
                apiKey = 'AIzaSyC9LYYnWBb4OvIZhisFHpYTnbBV3XFvzYE';
                
                // Save fallback key to storage for future use
                await chrome.storage.local.set({
                  'api_keys': { 'GOOGLE_API_KEY': apiKey }
                });
              }
              
              // Construct the translation request URL
              const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
              
              // Build the request
              const requestBody = {
                q: text,
                target: targetLang,
                format: 'text'
              };
              
              console.log('WordStream: Sending translation request to Google API');
              
              // Send the request
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('WordStream: Translation API error:', errorData);
                sendResponse({
                  success: false,
                  error: errorData.error?.message || `HTTP error ${response.status}`
                });
                return;
              }
              
              const data = await response.json();
              
              // Extract translation from response
              if (data?.data?.translations?.[0]) {
                const translation = data.data.translations[0];
                console.log('WordStream: Translation successful');
                
                sendResponse({
                  success: true,
                  translation: translation.translatedText,
                  detectedSourceLanguage: translation.detectedSourceLanguage
                });
                
                // Optionally save translation to history here
              } else {
                console.error('WordStream: Unexpected translation response format');
                sendResponse({
                  success: false,
                  error: 'Unexpected response format from translation API'
                });
              }
            } catch (translationError) {
              console.error('WordStream: Error in translation process:', translationError);
              sendResponse({
                success: false,
                error: translationError instanceof Error ? translationError.message : String(translationError)
              });
            }
          }).catch(error => {
            console.error('WordStream: Error checking auth for translation:', error);
            sendResponse({
              success: false,
              error: 'Failed to verify authentication: ' + (error instanceof Error ? error.message : String(error))
            });
          });
        } catch (error) {
          console.error('WordStream: Immediate error in translation:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Return true to indicate we will respond asynchronously
        return true;
        
      default:
        console.warn('WordStream: Unknown message action:', message?.action);
        sendResponse({ success: false, error: 'Unknown action' });
        return true;
    }
  });
}

/**
 * Save Gemini chat to Firebase
 */
async function saveGeminiChatToFirebase(userId: string, query: string, response: string, context: any) {
  try {
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Create chat document
    const chatData = {
      userId,
      query,
      response,
      context,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to Firestore
    const chatsCollection = collection(services.firestore, 'gemini_chats');
    await addDoc(chatsCollection, chatData);
    
    console.log('WordStream: Chat saved to Firebase');
  } catch (error) {
    console.error('WordStream: Error saving chat to Firebase:', error);
    throw error;
  }
}

/**
 * Handle saving a note to Firestore
 */
async function handleSaveNote(noteData: any) {
  try {
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    if (!user) {
      throw new Error('User not signed in');
    }
    
    // Validate user ID matches
    if (user.uid !== noteData.userId) {
      throw new Error('User ID mismatch');
    }
    
    // Save to Firestore
    const notesCollection = collection(services.firestore, 'notes');
    
    // Check for existing note for this video
    const existingNotes = await getDocs(
      query(
        notesCollection,
        where('userId', '==', user.uid),
        where('videoId', '==', noteData.videoId)
      )
    );
    
    if (!existingNotes.empty) {
      // Update existing note
      const noteDoc = existingNotes.docs[0];
      await updateDoc(noteDoc.ref, {
        content: noteData.content,
        updatedAt: new Date().toISOString()
      });
      console.log('WordStream: Updated existing note');
      return { success: true, updated: true };
    } else {
      // Create new note
      await addDoc(notesCollection, noteData);
      console.log('WordStream: Created new note');
      return { success: true, updated: false };
    }
  } catch (error) {
    console.error('WordStream: Error saving note:', error);
    throw error;
  }
}

/**
 * Get the current authentication state
 */
async function getAuthState() {
  try {
    // First check local storage for cached auth information
    const authInfo = await chrome.storage.local.get(['wordstream_user_info']);
    const userInfo = authInfo.wordstream_user_info;
    
    if (userInfo) {
      console.log('WordStream: User is authenticated (from storage)');
      
      // Update last authentication time
      const updatedUserInfo = {
        ...userInfo,
        lastAuthenticated: Date.now()
      };
      
      // Save updated timestamp
      await chrome.storage.local.set({
        'wordstream_user_info': updatedUserInfo
      });
      
      return {
        isAuthenticated: true,
        user: updatedUserInfo,
        source: 'storage'
      };
    }
    
    // Fallback to Firebase check if not in storage
    const services = await getFirebaseServices();
    if (!services.auth) {
      return { isAuthenticated: false };
    }
    
    const currentUser = services.auth.currentUser;
    
    if (currentUser) {
      console.log('WordStream: User is authenticated (from Firebase)');
      
      // Create user info object with current timestamp
      const updatedUserInfo = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        lastAuthenticated: Date.now()
      };
      
      // Cache user info in storage for future checks
      await chrome.storage.local.set({
        'wordstream_user_info': updatedUserInfo
      });
      
      return {
        isAuthenticated: true,
        user: updatedUserInfo,
        source: 'firebase'
      };
    } else {
      console.log('WordStream: User is not authenticated');
      
      // Clean up any stale user info in storage
      try {
        await chrome.storage.local.remove(['wordstream_user_info']);
      } catch (error) {
        console.warn('WordStream: Error cleaning up stale user info:', error);
      }
      
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error('WordStream: Error getting auth state:', error);
    return { isAuthenticated: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Handle saving a translation to Firestore
 */
async function handleSaveTranslation(translationData: any) {
  try {
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    if (!user) {
      throw new Error('User not signed in');
    }
    
    // Validate user ID matches
    if (user.uid !== translationData.userId) {
      throw new Error('User ID mismatch');
    }
    
    // Save to Firestore
    const translationsCollection = collection(services.firestore, 'translations');
    
    // Add the translation
    const docRef = await addDoc(translationsCollection, {
      ...translationData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('WordStream: Translation saved to Firebase');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('WordStream: Error saving translation:', error);
    throw error;
  }
}

/**
 * Handle saving a new chat to Firestore
 */
async function handleSaveChat(chatData: any) {
  try {
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    if (!user) {
      throw new Error('User not signed in');
    }
    
    // Validate user ID matches
    if (user.uid !== chatData.userId) {
      throw new Error('User ID mismatch');
    }
    
    // Save to Firestore
    const chatsCollection = collection(services.firestore, 'gemini_chats');
    
    // Add the chat
    const docRef = await addDoc(chatsCollection, chatData);
    
    console.log('WordStream: New chat saved to Firebase');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('WordStream: Error saving chat:', error);
    throw error;
  }
}

/**
 * Handle updating an existing chat in Firestore
 */
async function handleUpdateChat(chatId: string, updates: any) {
  try {
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    if (!user) {
      throw new Error('User not signed in');
    }
    
    // Query for the chat to verify ownership
    const chatsCollection = collection(services.firestore, 'gemini_chats');
    const q = query(chatsCollection, where('id', '==', chatId), where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Chat not found or you do not have permission to update it');
    }
    
    // Get the first matching document
    const chatDoc = querySnapshot.docs[0];
    
    // Update the document
    await updateDoc(chatDoc.ref, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    console.log('WordStream: Chat updated in Firebase');
    return { success: true };
  } catch (error) {
    console.error('WordStream: Error updating chat:', error);
    throw error;
  }
}

/**
 * Open the authentication popup
 */
async function openAuthPopup() {
  try {
    // Create or focus auth tab
    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("auth.html") });
    
    if (existingTabs.length > 0) {
      // Focus existing tab
      await chrome.tabs.update(existingTabs[0].id!, { active: true });
      if (existingTabs[0].windowId) {
        await chrome.windows.update(existingTabs[0].windowId, { focused: true });
      }
    } else {
      // Create new tab
      await chrome.tabs.create({ url: chrome.runtime.getURL("auth.html") });
    }
    
    return { success: true };
  } catch (error) {
    console.error('WordStream: Error opening auth popup:', error);
    throw error;
  }
}

// Add listener for installing/updating the extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('WordStream: Extension installed/updated', details.reason);
  
  // Set default options on first install
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      options: {
        darkMode: false,
        defaultLanguage: 'he',
        autoTranslate: true
      }
    }, () => {
      console.log('WordStream: Default options set');
    });
  }
});

// Add listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('WordStream: Action button clicked on tab', tab.id);
  
  // Open the popup
  chrome.runtime.openOptionsPage();
});

// Initialize the background script
async function initializeExtension() {
  try {
    // Mark background as not ready yet
    extensionReadiness.setReady('background', false);
    isBackgroundReady = false;
    
    // Initialize Firebase and other services
    const initialized = await initializeBackgroundServices();
    
    if (initialized) {
      // Set up message listeners
      setupMessageListeners();
      
      // Mark background as ready
      extensionReadiness.setReady('background', true);
      
      console.log('WordStream: Background script fully initialized and ready');
    } else {
      console.error('WordStream: Background initialization failed');
    }
  } catch (error) {
    console.error('WordStream: Critical error during extension initialization:', error);
  }
}

// Add listener for READY_CHECK messages
function setupReadinessListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'READY_CHECK') {
      // Handle readiness check message
      if (sender.tab && sender.tab.id) {
        // Message from content script
        extensionReadiness.setTabReady(sender.tab.id, true);
        sendResponse({ ready: true, component: 'background' });
      } else {
        // Message from popup or options page
        extensionReadiness.setReady('popup', true);
        sendResponse({ ready: true, component: 'background' });
      }
      return true;
    }
  });
}

// Set up listeners first
setupReadinessListeners();

// Then start initialization
initializeExtension().catch(error => {
  console.error('WordStream: Unhandled error during initialization:', error);
});

// Export for webpack
export default {};

