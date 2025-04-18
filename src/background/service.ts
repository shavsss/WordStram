/**
 * Background Script
 * This script runs in the background and handles events and communications
 * between content scripts, popup, and Firebase.
 */

// Import Firebase modules directly instead of through auth services
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, Auth, User } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, addDoc, getFirestore, Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { isServiceWorker, hasWindow } from '../utils/environment';

// Check environment
if (hasWindow()) {
  console.warn('WordStream: Background script running in an environment with window, this might cause issues');
} else {
  console.log('WordStream: Background script initialized in service worker environment');
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9KW1wQK_VlKIFdZz2vbCdHDZLYmAeOJ8",
  authDomain: "wordstream-extension.firebaseapp.com",
  projectId: "wordstream-extension",
  storageBucket: "wordstream-extension.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:3a6afb8b9b8e50dd4c3922",
  measurementId: "G-NSRPLRH38T"
};

// Initialize Firebase services
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Firebase services access functions
interface FirebaseServices {
  auth: Auth;
  db: Firestore;
  firestore: Firestore; // For backwards compatibility
  currentUser: User | null;
  initialized: boolean;
}

function getFirebaseServices(): FirebaseServices {
  return {
    auth,
    db,
    firestore: db, // For backwards compatibility
    currentUser: auth.currentUser,
    initialized: true
  };
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

/**
 * Message queue for storing messages that couldn't be delivered
 * These will be retried when the receivers become ready
 */
interface QueuedMessage {
  message: any;
  target: 'popup' | number | 'all';
  attempts: number;
  timestamp: number;
  responseCallback?: (response: any) => void;
}

const messageQueue: QueuedMessage[] = [];
let messageProcessorInterval: NodeJS.Timeout | null = null;

/**
 * Process the message queue, attempting to resend pending messages
 */
function processMessageQueue() {
  if (messageQueue.length === 0) return;
  
  console.log(`WordStream: Processing message queue (${messageQueue.length} pending messages)`);
  
  const now = Date.now();
  const remainingMessages: QueuedMessage[] = [];
  
  for (const item of messageQueue) {
    // Skip messages that have been queued for too long (5 minutes)
    if (now - item.timestamp > 5 * 60 * 1000) {
      console.warn('WordStream: Dropping old queued message:', item.message.action);
      continue;
    }
    
    // Skip messages that have had too many attempts (10)
    if (item.attempts >= 10) {
      console.warn('WordStream: Dropping message after too many attempts:', item.message.action);
      continue;
    }
    
    // Check if target is ready
    let isReady = false;
    
    if (item.target === 'all') {
      // For broadcast messages, always attempt delivery
      isReady = true;
    } else if (item.target === 'popup') {
      isReady = extensionReadiness.isPopupReady();
    } else if (typeof item.target === 'number') {
      isReady = extensionReadiness.isTabReady(item.target);
    }
    
    if (isReady) {
      // Target is ready, attempt to send
      try {
        if (item.target === 'all') {
          // Broadcast to all contexts
          chrome.runtime.sendMessage(item.message, (response) => {
            if (chrome.runtime.lastError) {
              // This is expected if no listeners, just ignore
            } else if (item.responseCallback) {
              item.responseCallback(response);
            }
          });
        } else if (item.target === 'popup') {
          // Send to popup
          chrome.runtime.sendMessage(item.message, (response) => {
            if (chrome.runtime.lastError) {
              // Failed again, increment attempts and requeue
              item.attempts++;
              remainingMessages.push(item);
            } else if (item.responseCallback) {
              item.responseCallback(response);
            }
          });
        } else if (typeof item.target === 'number') {
          // Send to specific tab
          chrome.tabs.sendMessage(item.target, item.message, (response) => {
            if (chrome.runtime.lastError) {
              // Failed again, increment attempts and requeue
              item.attempts++;
              remainingMessages.push(item);
            } else if (item.responseCallback) {
              item.responseCallback(response);
            }
          });
        }
      } catch (error) {
        // Error during send, increment attempts and requeue
        console.warn('WordStream: Error sending queued message:', error);
        item.attempts++;
        remainingMessages.push(item);
      }
    } else {
      // Target not ready, keep in queue
      remainingMessages.push(item);
    }
  }
  
  // Update queue with remaining messages
  messageQueue.length = 0;
  messageQueue.push(...remainingMessages);
  
  if (messageQueue.length > 0) {
    console.log(`WordStream: ${messageQueue.length} messages still in queue after processing`);
  }
}

/**
 * Start the message queue processor
 */
function startMessageQueueProcessor() {
  if (messageProcessorInterval !== null) {
    clearInterval(messageProcessorInterval);
  }
  
  messageProcessorInterval = setInterval(() => {
    try {
      processMessageQueue();
    } catch (error) {
      console.error('WordStream: Error processing message queue:', error);
    }
  }, 2000); // Process queue every 2 seconds
}

// Start message processor immediately
startMessageQueueProcessor();

/**
 * Safely send a message to all contexts of the extension
 * This handles errors gracefully and prevents unhandled promise rejections
 */
function safelySendMessage(message: any, responseCallback?: (response: any) => void): void {
  try {
    // Don't attempt to send AUTH_STATE_CHANGED messages from AUTH_STATE_CHANGED handlers
    // This prevents infinite loops in some edge cases
    if (message.action === 'AUTH_STATE_CHANGED' && message.source === 'auth_state_changed_handler') {
      console.warn('WordStream: Preventing recursive AUTH_STATE_CHANGED message');
      return;
    }
    
    // Add a timestamp to message for debugging
    const messageToSend = {
      ...message,
      _timestamp: Date.now(),
      _messageId: Math.random().toString(36).substr(2, 9)
    };
    
    // Try to send to popup if it's ready
    if (extensionReadiness.isPopupReady()) {
      try {
        chrome.runtime.sendMessage(messageToSend, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('WordStream: Error sending message to extension contexts:', chrome.runtime.lastError.message);
            
            // Queue message for retry
            messageQueue.push({
              message: messageToSend,
              target: 'popup',
              attempts: 1,
              timestamp: Date.now(),
              responseCallback
            });
          } else if (responseCallback) {
            responseCallback(response);
          }
        });
      } catch (error) {
        console.warn('WordStream: Error sending message to popup:', error);
        
        // Queue message for retry
        messageQueue.push({
          message: messageToSend,
          target: 'popup',
          attempts: 1,
          timestamp: Date.now(),
          responseCallback
        });
      }
    } else {
      // Queue message for when popup becomes ready
      console.log('WordStream: Popup not ready, queueing message:', message.action);
      
      messageQueue.push({
        message: messageToSend,
        target: 'popup',
        attempts: 0,
        timestamp: Date.now(),
        responseCallback
      });
    }
    
    // Get tabs and send to each one with error handling
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            try {
              chrome.tabs.sendMessage(tab.id, messageToSend, (response) => {
                // We expect these to fail for tabs without our content script
                if (chrome.runtime.lastError) {
                  // Just ignore errors from tabs - this is normal
                }
              });
            } catch (e) {
              // Ignore errors from tabs that can't receive messages
            }
          }
        });
      });
    } catch (tabError) {
      console.warn('WordStream: Error querying tabs:', tabError);
    }
  } catch (error) {
    console.error('WordStream: Critical error broadcasting message:', error);
    // Try to handle the response if possible
    if (responseCallback) responseCallback({ error: 'Message broadcast failed' });
  }
}

// Initialize Firebase when background script loads
async function initializeBackgroundServices() {
  try {
    await initializeApp(firebaseConfig);
    console.log('WordStream: Firebase initialized in background');
    
    // Validate Gemini API key
    await validateGeminiApiKey();
    
    // Set up periodic auth token refresh
    setupAuthTokenRefresh();
    
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
  // Check and refresh auth token more frequently (every 15 minutes)
  const refreshInterval = setInterval(async () => {
    try {
      // Use the auth manager to handle token refresh
      const { checkAndRefreshAuth } = await import('../auth/auth-manager');
      
      console.log('WordStream: Running scheduled auth token refresh check');
      const refreshed = await checkAndRefreshAuth();
      
      if (refreshed) {
        console.log('WordStream: Scheduled auth token refresh completed successfully');
      } else {
        console.warn('WordStream: Scheduled auth token refresh failed, user may need to sign in again');
        
        // Get current auth state to check if we still think user is authenticated
        const { getAuthState } = await import('../auth/auth-manager');
        const authState = await getAuthState();
        
        if (authState.isAuthenticated) {
          console.warn('WordStream: Auth state inconsistency detected - state shows authenticated but refresh failed');
          
          // Check if token is really valid with Firebase
          const services = await getFirebaseServices();
          
          if (services.initialized && services.auth && services.auth.currentUser) {
            try {
              // One last attempt to refresh token directly with Firebase
              await services.auth.currentUser.getIdToken(true);
              console.log('WordStream: Manual token refresh with Firebase succeeded');
            } catch (firebaseError) {
              console.error('WordStream: Firebase token refresh failed, clearing auth state:', firebaseError);
              
              // Token is definitely invalid, clear auth state
              const { updateAuthState } = await import('../auth/auth-manager');
              await updateAuthState({
                isAuthenticated: false,
                user: null
              });
            }
          } else {
            console.warn('WordStream: Firebase auth not available for token verification');
          }
        }
      }
    } catch (error) {
      console.error('WordStream: Error in token refresh interval:', error);
    }
  }, 15 * 60 * 1000); // Every 15 minutes
  
  // Also refresh token immediately on startup
  setTimeout(async () => {
    try {
      const { checkAndRefreshAuth } = await import('../auth/auth-manager');
      await checkAndRefreshAuth();
      console.log('WordStream: Initial auth token refresh check completed');
    } catch (error) {
      console.error('WordStream: Error in initial token refresh:', error);
    }
  }, 5000); // 5 seconds after startup
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
      
      console.log('WordStream: Google sign in successful using direct method');
      return user;
    } catch (directError) {
      console.error('WordStream: Direct Google sign-in failed, trying import method:', directError);
      
      // Fallback to dynamic import if the direct method fails
      const { signInWithGoogle } = await import('../auth/auth-manager');
      const result = await signInWithGoogle();
      
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

// Set up listeners for messages from content scripts and popup
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('WordStream: Background received message:', message);

    // Handle message based on action type
    switch (message.action) {
      case 'SIGN_IN_WITH_GOOGLE':
        // Handle Google Sign In
        console.log('WordStream: Processing Google Sign In request');
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
        return true; // Indicates async response
        
      case 'AUTH_STATE_CHANGED':
        // Use a separate async function to handle this case
        handleAuthStateChanged(message, sender, sendResponse);
        return true; // Indicate we'll send a response asynchronously
        
      case 'SAVE_NOTE':
        handleSaveNote(message.data)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true; // Indicates async response
        
      case 'GET_AUTH_STATE':
        getAuthState()
          .then(authState => sendResponse(authState))
          .catch(error => sendResponse({ isAuthenticated: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
        
      case 'GEMINI_CHAT':
        // Handle Gemini chat request
        console.log('WordStream: Processing Gemini chat request');
        
        // Verify user authentication
        if (!message.userId) {
          console.error('WordStream: Gemini request missing user ID');
          sendResponse({
            success: false,
            error: 'Authentication required'
          });
          return true;
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
              saveGeminiChatToFirebase(message.userId, message.query, responseText, message.context)
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
        
        // Return true to indicate we will respond asynchronously
        return true;
        
      case 'CHECK_GEMINI_CONFIG':
        validateGeminiApiKey()
          .then(isValid => sendResponse({ success: true, configured: isValid }))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;

      case 'SAVE_TRANSLATION':
        // Handle saving translation to Firestore
        handleSaveTranslation(message.translation)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;

      case 'OPEN_AUTH_POPUP':
        // Open the login popup
        openAuthPopup()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;

      case 'SAVE_CHAT':
        // Save a new chat session to Firestore
        handleSaveChat(message.chat)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;

      case 'UPDATE_CHAT':
        // Update an existing chat session
        handleUpdateChat(message.chatId, message.updates)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    
    return false;
  });
}

/**
 * Handle AUTH_STATE_CHANGED message asynchronously
 */
async function handleAuthStateChanged(message: any, sender: any, sendResponse: (response?: any) => void) {
  try {
    // Forward to the auth-manager to handle centrally
    const { getAuthState } = await import('../auth/auth-manager');
    
    // Get current auth state from the single source of truth
    const authState = await getAuthState();
    
    // Forward safely to all contexts
    safelySendMessage({
      action: 'AUTH_STATE_UPDATED',
      isAuthenticated: authState.isAuthenticated,
      user: authState.user
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('WordStream: Error handling AUTH_STATE_CHANGED:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
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
    // First check if we need to refresh auth
    try {
      const { checkAndRefreshAuth } = await import('../auth/auth-manager');
      const authRefreshed = await checkAndRefreshAuth();
      
      if (authRefreshed) {
        console.log('WordStream: Auth refreshed before saving note');
      } else {
        console.warn('WordStream: Auth refresh failed before saving note, will try anyway');
      }
    } catch (authError) {
      console.error('WordStream: Error refreshing auth before saving note:', authError);
      // Continue despite auth refresh error - the operation might still succeed
    }
    
    // Get Firebase services
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth || !services.firestore) {
      throw new Error('Firebase services not available');
    }
    
    // Check if user is signed in
    const user = services.auth.currentUser;
    
    // If user is not authenticated in Firebase, try to get from storage
    if (!user) {
      // Try to restore auth from storage
      console.log('WordStream: No Firebase user, attempting to restore auth from storage');
      
      try {
        const { getAuthState } = await import('../auth/auth-manager');
        const authState = await getAuthState();
        
        if (authState.isAuthenticated && authState.user) {
          console.log('WordStream: Using stored auth for saving note');
          // Continue with the stored user ID
          if (authState.user.uid !== noteData.userId) {
            throw new Error('User ID mismatch');
          }
        } else {
          throw new Error('User not signed in');
        }
      } catch (authCheckError) {
        console.error('WordStream: Failed to restore auth for saving note:', authCheckError);
        throw new Error('Authentication required');
      }
    } else {
      // Validate user ID matches
      if (user.uid !== noteData.userId) {
        throw new Error('User ID mismatch');
      }
    }
    
    // Save to Firestore
    const notesCollection = collection(services.firestore, 'notes');
    
    // Check for existing note for this video
    const existingNotes = await getDocs(
      query(
        notesCollection,
        where('userId', '==', noteData.userId),
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
    
    // If the error is authentication-related, send a message to trigger re-authentication
    if (
      error instanceof Error && 
      (error.message.includes('Authentication required') || 
       error.message.includes('User not signed in') ||
       error.message.includes('PERMISSION_DENIED'))
    ) {
      // Broadcast authentication issue
      safelySendMessage({
        action: 'AUTH_ERROR',
        error: error.message,
        source: 'note_save'
      });
    }
    
    throw error;
  }
}

/**
 * Get the current authentication state
 */
async function getAuthState() {
  try {
    // Use the auth-manager as the single source of truth
    const { getAuthState: getAuthStateFromManager } = await import('../auth/auth-manager');
    return await getAuthStateFromManager();
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

