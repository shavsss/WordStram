/**
 * Firebase CORS override for Chrome extensions
 * 
 * This file helps with CORS issues that Chrome extensions might face when working with Firebase.
 * It needs to be loaded before any Firebase modules.
 */

// Check if we're in a Chrome extension
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  console.log('WordStream: Applying Firebase CORS overrides for Chrome extension');
  
  // Add extension origin to trusted origins
  const trustedOrigins = [];
  if (chrome.runtime?.id) {
    const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;
    trustedOrigins.push(extensionOrigin);
  }
  
  // Override fetch to modify CORS handling for Firebase domains
  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    // Clone init to avoid modifying the original
    const modifiedInit = init ? { ...init } : {};
    
    // Check if the request is going to a Firebase domain
    const url = resource instanceof Request ? resource.url : resource.toString();
    const isFirebaseRequest = (
      url.includes('firebaseio.com') ||
      url.includes('firebaseapp.com') ||
      url.includes('googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com')
    );
    
    // Add our CORS headers for Firebase requests
    if (isFirebaseRequest) {
      modifiedInit.credentials = 'include';
      modifiedInit.mode = 'cors';
      modifiedInit.headers = {
        ...modifiedInit.headers,
        'Origin': trustedOrigins[0] || window.location.origin,
      };
    }
    
    return originalFetch.call(window, resource, modifiedInit);
  };
}
