/**
 * Background Script
 * This script runs in the background and handles events and communications
 * between content scripts, popup, and Firebase.
 */

import { initializeFirebase, getFirebaseServices } from '../auth';
import { collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { GEMINI_API_CONFIG } from '../config/api-config';
import { AI_ASSISTANT_CONTEXT } from '../features/gemini/chat-context';

console.log('WordStream: Background script initialized');

// Initialize Firebase when background script loads
async function initializeBackgroundServices() {
  try {
    await initializeFirebase();
    console.log('WordStream: Firebase initialized in background');
    
    // Validate Gemini API key
    await validateGeminiApiKey();
    
    // Sync auth state to make it available for content scripts
    await syncAuthStateToStorage();
    
    return true;
  } catch (error) {
    console.error('WordStream: Failed to initialize Firebase in background:', error);
    return false;
  }
}

/**
 * Sync the current authentication state to chrome.storage.local
 * This ensures content scripts can access the current auth state
 */
async function syncAuthStateToStorage() {
  try {
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth) {
      console.warn('WordStream: Cannot sync auth state - Firebase not initialized');
      return;
    }
    
    const user = services.auth.currentUser;
    if (user) {
      // Store user info in chrome.storage.local
      const userInfo = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
      
      await chrome.storage.local.set({ 'wordstream_user_info': userInfo });
      console.log('WordStream: Auth state synced to storage during initialization');
    } else {
      // Clear existing user info if not logged in
      await chrome.storage.local.remove('wordstream_user_info');
      console.log('WordStream: No user logged in, cleared storage during initialization');
    }
  } catch (error) {
    console.error('WordStream: Error syncing auth state to storage:', error);
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
        
      case 'REFRESH_AUTH_STATE':
        syncAuthStateToStorage()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
        
      case 'GEMINI_CHAT':
        // Handle Gemini chat request
        console.log('WordStream: Processing Gemini chat request');
        
        // Process Gemini chat request with better authentication handling
        (async () => {
          try {
            // First check Firebase authentication (most authoritative)
            const services = await getFirebaseServices();
            let user = services.auth?.currentUser || null;
            
            // If not authenticated in Firebase, check chrome.storage.local as backup
            if (!user) {
              const result = await chrome.storage.local.get(['wordstream_user_info']);
              if (result?.wordstream_user_info) {
                console.log('WordStream: User found in storage but not in Firebase, syncing auth state');
                user = result.wordstream_user_info;
                
                // Try to refresh auth state
                await syncAuthStateToStorage();
              }
            }
            
            // Verify user authentication
            if (!user) {
              console.error('WordStream: User not authenticated for Gemini request');
              sendResponse({
                success: false,
                error: 'Authentication required'
              });
              return;
            }
            
            // Get API key from storage
            const result = await chrome.storage.local.get(['api_keys']);
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
            
            // Update URL from v1beta to v1 and ensure compatibility with gemini-pro models
            const url = GEMINI_API_CONFIG.getApiUrl(apiKey);
            
            const requestBody: GeminiRequestBody = {
              contents: []
            };
            
            // Add AI Assistant context as system message
            requestBody.contents.push({
              role: 'system',
              parts: [{ text: AI_ASSISTANT_CONTEXT }]
            });
            
            // Add message history if available
            if (message.history && message.history.length > 0) {
              requestBody.contents = requestBody.contents.concat(message.history.map((msg: GeminiMessage) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
              })));
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
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error('WordStream: Gemini API error:', errorData);
              
              // שיפור הודעות השגיאה למשתמש
              let errorMessage = `HTTP error ${response.status}`;
              
              if (errorData.error?.message) {
                // בדיקה למקרה שהשגיאה הינה 'model not found' - לעיתים קרובות זה קורה כאשר יש בעיה עם הגרסה
                if (errorData.error.message.includes('models/gemini-pro is not found')) {
                  errorMessage = 'Gemini API error: The model "gemini-pro" is not available or the API version is incorrect. Please update the extension.';
                  console.log('WordStream: Gemini API model version issue detected');
                } else {
                  errorMessage = errorData.error.message;
                }
              }
              
              throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('WordStream: Gemini API response received');
            
            // Extract the text from the response
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
            
            // Send the response back to the content script
            sendResponse({
              success: true,
              content: responseText
            });
            
            // Save chat to Firebase
            saveGeminiChatToFirebase(user.uid, message.query, responseText, message.context)
              .catch(error => console.error('WordStream: Error saving chat to Firebase:', error));
            
          } catch (error) {
            console.error('WordStream: Error in Gemini chat processing:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Error processing Gemini request'
            });
          }
        })();
        
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
    const services = await getFirebaseServices();
    if (!services.initialized || !services.auth) {
      return { isAuthenticated: false };
    }
    
    const user = services.auth.currentUser;
    if (user) {
      return {
        isAuthenticated: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      };
    } else {
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

