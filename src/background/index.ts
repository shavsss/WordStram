/**
 * Background Script
 * This script runs in the background and handles events and communications
 * between content scripts, popup, and Firebase.
 */

import { initializeFirebase, getFirebaseServices } from '../auth';
import { collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';

console.log('WordStream: Background script initialized');

// Initialize Firebase when background script loads
async function initializeBackgroundServices() {
  try {
    await initializeFirebase();
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
        
        // Get Firebase auth services
        const services = await getFirebaseServices();
        
        // If we have auth services and user data, broadcast auth state
        if (services.auth) {
          // Wait for onAuthStateChanged to fire once
          await new Promise<void>(resolve => {
            const unsubscribe = services.auth!.onAuthStateChanged((user) => {
              // If Firebase already has a user, we're good
              if (user) {
                console.log('WordStream: Firebase auth state restored automatically');
              } 
              // If Firebase doesn't have a user but we have storage data, broadcast the stored data
              else if (data.wordstream_user_info) {
                console.log('WordStream: Broadcasting stored auth state to all contexts');
                chrome.runtime.sendMessage({ 
                  action: 'AUTH_STATE_CHANGED',
                  user: data.wordstream_user_info,
                  isAuthenticated: true,
                  source: 'background_init'
                });
              }
              
              unsubscribe();
              resolve();
            });
          });
        }
      }
    } catch (error) {
      console.error('WordStream: Error restoring auth state:', error);
      // Non-fatal error, continue initialization
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
  // Check and refresh auth token every 15 minutes
  setInterval(async () => {
    try {
      const { checkAndRefreshAuth } = await import('../auth/auth-manager');
      await checkAndRefreshAuth();
      console.log('WordStream: Auth token refresh check completed');
    } catch (error) {
      console.error('WordStream: Error checking/refreshing auth token:', error);
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}

/**
 * Handle Google Sign In
 */
async function handleGoogleSignIn() {
  try {
    // Dynamically import auth manager to ensure we're getting the latest version
    const { signInWithGoogle } = await import('../auth/auth-manager');
    const result = await signInWithGoogle();
    
    console.log('WordStream: Google sign in successful');
    return result.user;
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
            // Broadcast authentication state change
            chrome.runtime.sendMessage({ 
              action: "AUTH_STATE_CHANGED", 
              user,
              isAuthenticated: true
            });
            
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
initializeBackgroundServices().then((initialized) => {
  if (initialized) {
    setupMessageListeners();
    console.log('WordStream: Background script fully initialized');
  }
}).catch(error => {
  console.error('WordStream: Critical background script error:', error);
});

// Export for webpack
export default {};

