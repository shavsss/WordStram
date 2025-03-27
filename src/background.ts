/**
 * WordStream2 Service Worker
 * Handles Firebase initialization, authentication, and background events
 */

import { initializeFirebase, getAuthInstance, getFirestoreInstance } from './firebase/firebase-config';

// API key for Google Translate
const TRANSLATE_API_KEY = 'AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw'; // Google API key

// Initialize Firebase when service worker starts
initializeFirebase();
const auth = getAuthInstance();
const db = getFirestoreInstance();

console.log('[WordStream2] Service worker initialized');

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WordStream2] Message received:', message);
  
  if (message.action === 'checkAuth') {
    // Return authentication status
    sendResponse({
      isAuthenticated: !!auth?.currentUser,
      user: auth?.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName
      } : null
    });
    return true;
  } 
  else if (message.action === 'translate') {
    // Handle translation request
    translateText(message.text, message.targetLanguage || 'en')
      .then(translation => {
        sendResponse({ translation });
      })
      .catch(error => {
        console.error('[WordStream2] Translation error:', error);
        sendResponse({ error: error.message });
      });
    
    // Keep the message channel open for async response
    return true;
  }
  else if (message.action === 'openLogin') {
    // Open the extension popup for login
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
  
  // Keep the message channel open for async responses
  return true;
});

/**
 * Translate text using Google Translate API
 */
async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: targetLanguage
      })
    });
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data && 
        data.data.translations && 
        data.data.translations.length > 0 && 
        data.data.translations[0].translatedText) {
      return data.data.translations[0].translatedText;
    } else {
      throw new Error('Invalid translation response');
    }
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// Track auth state changes
auth.onAuthStateChanged((user) => {
  console.log('[WordStream2] Auth state changed:', user ? 'logged in' : 'logged out');
});

// On install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[WordStream2] Extension installed/updated:', details.reason);
  
  // Initialize default settings if needed
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      const defaultSettings = {
        targetLanguage: 'en',
        nativeLanguage: 'en',
        autoTranslate: true,
        notifications: true,
        darkMode: false
      };
      
      chrome.storage.sync.set({ settings: defaultSettings });
      console.log('[WordStream2] Default settings initialized');
    }
  });
  
  // Open welcome page on install
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome.html' });
  }
}); 