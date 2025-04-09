/**
 * Firebase Configuration
 * כל תצורת Firebase והאיתחול
 */
import { initializeApp, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getFirestoreFromFirebase, Firestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';

// SECURITY IMPROVEMENT: אבטחת מפתחות ומידע רגיש
// Secure Firebase configuration - קבועי תצורה מאובטחים
// השתמש בפונקציית getFirebaseConfig במקום במשתנה גלובלי עם הפרטים החשופים
function getFirebaseConfig(): FirebaseOptions {
  // בתוספי כרום, אופציה 1: שימוש במשתני סביבה או chrome.storage לאחסון המפתחות
  
  // במקרה של פיתוח מקומי - אתה יכול להשתמש בקובץ .env בתיקיית הפרויקט:
  // require('dotenv').config(); // פתרון NodeJS
  
  // אופציה 2: בסביבת ייצור, טען את המפתחות ממקור מאובטח
  try {
    // נסיון לטעון מפתחות מאובטחים מאחסון מקומי:
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      console.log('WordStream: Attempting to load Firebase config from chrome.storage');
      // טעינה סינכרונית לא אפשרית - נצטרך לאמת את הזמינות לפני השימוש
      return {
        // כאן יש להשתמש במפתחות הנטענים בצורה מאובטחת
        // בינתיים, נחזיר את הקונפיגורציה הקיימת אך היא חייבת להיות מוחלפת
        // במימוש מלא של המנגנון המאובטח
        apiKey: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        authDomain: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        projectId: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        storageBucket: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        messagingSenderId: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        appId: "REPLACE_WITH_SECURE_LOADING_MECHANISM",
        measurementId: "REPLACE_WITH_SECURE_LOADING_MECHANISM"
      };
    }
  
    // כברירת מחדל זמנית, החזר את הקונפיגורציה הקיימת
    // !חשוב: חייב להחליף עם מנגנון טעינה מאובטח במימוש סופי
    console.warn('WordStream: Using fallback config - MUST BE REPLACED with secure loading');
    return {
      // DO NOT EXPOSE ACTUAL API KEYS HERE! החלף בהקדם למנגנון טעינה מאובטח!
      apiKey: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      authDomain: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      projectId: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      storageBucket: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      messagingSenderId: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      appId: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM",
      measurementId: "REPLACE_THIS_WITH_SECURE_LOADING_MECHANISM"
    };
  } catch (error) {
    console.error('WordStream: Failed to load secure Firebase config:', error);
    throw new Error('Failed to initialize Firebase: Secure configuration unavailable');
  }
}

// Global variables (initialized on demand)
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

/**
 * Get Firebase App instance (initialize if needed)
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    try {
      app = getApp();
    } catch (e) {
      console.log('WordStream: Initializing Firebase app');
      const firebaseConfig = getFirebaseConfig();
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

/**
 * Get Firebase Auth instance (initialize if needed)
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = getFirebaseApp();
    auth = getAuth(app);
    
    // בדיקה אם אנחנו בסביבת Service Worker או בסביבת דפדפן רגילה
    const isServiceWorker = typeof self !== 'undefined' && typeof Window === 'undefined';
    
    if (!isServiceWorker) {
      // רק בסביבת דפדפן רגילה - הגדר מנגנון שמירת סשן
      setPersistence(auth, browserLocalPersistence)
        .then(() => console.log('WordStream: Auth persistence set to browserLocalPersistence'))
        .catch(error => console.error('WordStream: Failed to set auth persistence:', error));
    } else {
      console.log('WordStream: Running in Service Worker - skipping auth persistence');
    }
  }
  return auth;
}

/**
 * Get Firestore instance (initialize if needed)
 */
export function getFirestoreDb(): Firestore {
  if (!firestore) {
    const app = getFirebaseApp();
    firestore = getFirestoreFromFirebase(app);
  }
  return firestore;
}

// Pre-initialize for immediate use
try {
  app = getFirebaseApp();
  auth = getFirebaseAuth();
  firestore = getFirestoreDb();
  console.log('WordStream: Firebase pre-initialized successfully');
} catch (error) {
  console.error('WordStream: Firebase pre-initialization failed:', error);
}

// Export pre-initialized instances
export { app, auth, firestore };

/**
 * Log connection status
 */
export function logConnectionStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Simple connectivity check
      const timeout = setTimeout(() => {
        console.warn('WordStream: Connectivity check timed out');
        resolve(false);
      }, 5000);
      
      fetch('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel', { 
        method: 'OPTIONS' 
      })
        .then(() => {
          clearTimeout(timeout);
          console.log('WordStream: Firebase connectivity check passed');
          resolve(true);
        })
        .catch(error => {
          clearTimeout(timeout);
          console.warn('WordStream: Firebase connectivity check failed:', error);
          resolve(false);
        });
    } catch (error) {
      console.error('WordStream: Error checking connectivity:', error);
      resolve(false);
    }
  });
} 