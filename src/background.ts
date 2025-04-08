/**
 * Background Service Worker
 * 
 * מנהל את תהליך האימות ותקשורת בין חלונות
 */

import AuthManager from './core/auth-manager';
import { subscribeToAuthChanges, signInWithGoogle, signOutUser } from './core/firebase/auth';

let authManager: AuthManager;

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('WordStream extension installed or updated');
  initAuth();
});

// Also initialize when the service worker starts
initAuth();

function initAuth() {
  console.log('Initializing auth manager...');
  authManager = AuthManager.getInstance();
  
  // Subscribe to auth changes
  const unsubscribe = subscribeToAuthChanges((user) => {
    console.log('Auth state changed:', user ? 'Authenticated' : 'Not authenticated');
    
    if (user) {
      AuthManager.verifyTokenAndRefresh()
        .then(success => {
          console.log('Token verification', success ? 'succeeded' : 'failed');
        })
        .catch(error => {
          console.error('Token verification error:', error);
        });
    }
    
    // Broadcast to all windows
    chrome.runtime.sendMessage({
      action: 'BROADCAST_AUTH_STATE',
      state: {
        isAuthenticated: !!user,
        userInfo: user
      }
    }).catch(err => {
      // Ignore errors when no receivers are available
      if (!err.message.includes('Could not establish connection')) {
        console.error('Broadcast error:', err);
      }
    });
  });
  
  // Store the unsubscribe function
  chrome.storage.local.set({ authUnsubscribeFunction: unsubscribe });
}

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.action);
  
  switch (message.action) {
    case 'CHECK_AUTH':
      sendResponse({
        isAuthenticated: AuthManager.isAuthenticated(),
        userInfo: AuthManager.getCurrentUser()
      });
      break;
      
    case 'SIGN_IN_GOOGLE':
      signInWithGoogle()
        .then(user => {
          console.log('Sign in successful for user:', user.email);
          sendResponse({ user });
        })
        .catch(error => {
          console.error('Sign in error:', error);
          sendResponse({ error: error.message });
        });
      return true; // async response
      
    case 'SIGN_OUT':
      signOutUser()
        .then(() => {
          console.log('Sign out successful');
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Sign out error:', error);
          sendResponse({ error: error.message });
        });
      return true;
      
    case 'REFRESH_TOKEN':
      AuthManager.verifyTokenAndRefresh(true)
        .then(success => {
          console.log('Token refresh', success ? 'successful' : 'failed');
          sendResponse({ success });
        })
        .catch(error => {
          console.error('Token refresh error:', error);
          sendResponse({ error: error.message });
        });
      return true;
      
    default:
      // Handle unknown actions - return false to allow other listeners to process
      return false;
  }
}); 