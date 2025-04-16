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
    return true;
    } catch (error) {
    console.error('WordStream: Failed to initialize Firebase in background:', error);
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
        
      case 'GEMINI_CHAT':
        // Handle Gemini chat request
        console.log('WordStream: Processing Gemini chat request');
        
        // Use a hardcoded API key for development
        const API_KEY = 'AIzaSyC9LYYnWBb4OvIZhisFHpYTnbBV3XFvzYE';
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
        
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
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.candidates && data.candidates.length > 0 && 
              data.candidates[0].content && 
              data.candidates[0].content.parts && 
              data.candidates[0].content.parts.length > 0) {
            
            sendResponse({
              success: true,
              content: data.candidates[0].content.parts[0].text
            });
          } else {
            sendResponse({
              success: false,
              error: 'Invalid response format from Gemini API'
            });
          }
        })
        .catch(error => {
          console.error('WordStream: Error calling Gemini API:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        });
        
        return true; // Indicates async response
    }
    
    return false;
  });
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

