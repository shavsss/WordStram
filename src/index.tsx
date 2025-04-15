import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeFirebase } from './auth/firebase-init'; // Import the Firebase initialization function
import './index.css';
import Popup from './popup/Popup';

// Log initialization sequence
console.log('Main index.tsx initialization');

// ברגע שהדף נטען, ננסה לאתחל את Firebase ולרנדר את האפליקציה
(async function initializeApp() {
  try {
    console.log('Starting Firebase initialization from index.tsx');
    // אתחל את Firebase
    const firebaseServices = await initializeFirebase();
    
    if (firebaseServices.initialized) {
      console.log('Firebase successfully initialized');
    } else {
      console.warn('Firebase initialization did not complete successfully');
    }
    
    // Get the root element and render the app
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      console.error('Root element not found');
    } else {
      console.log('Creating React root');
      const root = ReactDOM.createRoot(rootElement);
      
      console.log('Rendering React app');
      root.render(
        <React.StrictMode>
          <Popup />
        </React.StrictMode>
      );
      console.log('React app rendered');
    }
  } catch (error) {
    console.error('Critical error during initialization:', error);
    
    // עדיין ננסה לרנדר את האפליקציה למרות השגיאה
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <Popup />
        </React.StrictMode>
      );
      console.log('React app rendered despite initialization error');
    }
  }
})(); 