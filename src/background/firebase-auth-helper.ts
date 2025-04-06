/**
 * Firebase Authentication Helper for Chrome Extensions
 * Provides additional support for Firebase Auth in extension context
 */

import { auth } from '@/core/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';

/**
 * Initialize Firebase Auth with Chrome extension specific handling
 */
export function initFirebaseAuthForExtension() {
  console.log('WordStream: Initializing Firebase Auth for Chrome extension');
  
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('WordStream: Auth state changed - User signed in', user.email);
      
      // Store auth state in chrome.storage.local for persistence
      try {
        chrome.storage.local.set({
          'wordstream_auth_state': 'authenticated',
          'wordstream_user_info': {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          }
        }, () => {
          console.log('WordStream: Auth state saved to chrome.storage.local');
        });
      } catch (error) {
        console.error('WordStream: Failed to save auth state to chrome.storage.local', error);
      }
      
      // Broadcast authentication state to all tabs
      broadcastAuthState(true, user);
    } else {
      console.log('WordStream: Auth state changed - User signed out');
      
      // Clear auth state from chrome.storage.local
      try {
        chrome.storage.local.remove(['wordstream_auth_state', 'wordstream_user_info'], () => {
          console.log('WordStream: Auth state cleared from chrome.storage.local');
        });
      } catch (error) {
        console.error('WordStream: Failed to clear auth state from chrome.storage.local', error);
      }
      
      // Broadcast sign-out to all tabs
      broadcastAuthState(false, null);
    }
  });
  
  // Setup message listeners for auth-related actions
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'GET_AUTH_STATE') {
      const user = auth.currentUser;
      
      if (user) {
        console.log('WordStream: Responding to GET_AUTH_STATE - User authenticated', user.email);
        sendResponse({ 
          isAuthenticated: true,
          userInfo: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          }
        });
      } else {
        console.log('WordStream: Responding to GET_AUTH_STATE - No authenticated user');
        sendResponse({ isAuthenticated: false, userInfo: null });
      }
      
      return true; // Keep the message channel open for async response
    }
    
    // Default response for unhandled messages
    return false;
  });
}

/**
 * Broadcast authentication state to all tabs
 */
function broadcastAuthState(isAuthenticated: boolean, user: User | null): void {
  try {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'AUTH_STATE_CHANGED',
            isAuthenticated,
            userInfo: user ? {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            } : null
          }).catch((err) => {
            // Ignore errors from tabs that can't receive messages
            console.debug('WordStream: Failed to send message to tab', tab.id, err);
          });
        }
      });
    });
  } catch (error) {
    console.error('WordStream: Failed to broadcast auth state', error);
  }
} 