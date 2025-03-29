import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Add runtime checks for Chrome extension environment
const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.firebasestorage.app",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806"
  // measurementId has been removed as Analytics is not supported in Chrome extensions
};

// Initialize Firebase with special config for extension
const app = initializeApp(firebaseConfig);

// Initialize services - Analytics removed
const auth = getAuth(app);
const firestore = getFirestore(app);

// Special handling for Chrome extension environment
if (isExtension) {
  console.log('WordStream: Running in Chrome extension environment');
  
  // Chrome extensions need special configuration
  // Note: We can't modify auth.settings directly as it's read-only
  // Instead we use the proper methods to configure auth behavior
  
  // Additional auth settings for extension
  const extensionOrigin = chrome.runtime.id ? 
    `chrome-extension://${chrome.runtime.id}` : '';
  
  if (extensionOrigin) {
    console.log(`WordStream: Extension origin: ${extensionOrigin}`);
  }
}

// Debug Firebase config status
console.log('WordStream: Firebase initialized with config:', 
  Object.keys(firebaseConfig).filter(k => k !== 'apiKey').join(', '));

// Export Firebase instances
export { app, auth, firestore }; 