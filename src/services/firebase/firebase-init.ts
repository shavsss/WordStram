import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Simple logger for debugging
const logger = {
  log: (...args: any[]) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[WordStream:Firebase:Init][${timestamp}]`, ...args);
    } catch (e) {
      // Ignore logging errors
    }
  },
  error: (...args: any[]) => {
    try {
      const timestamp = new Date().toISOString();
      console.error(`[WordStream:Firebase:Init][${timestamp}]`, ...args);
    } catch (e) {
      // Ignore logging errors
    }
  }
};

// Firebase configuration - using hardcoded values to avoid initialization issues
const firebaseConfigs = {
  production: {
    apiKey: "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
    authDomain: "wordstream-extension-add3a.firebaseapp.com",
    projectId: "wordstream-extension-add3a",
    storageBucket: "wordstream-extension-add3a.firebasestorage.app",
    messagingSenderId: "719695800723",
    appId: "1:719695800723:web:bd113109dcfd3077136066",
    measurementId: "G-Q8H15ZYLPN"
  },
  development: {
    // ניתן להוסיף כאן הגדרות לסביבת פיתוח אם יש צורך
    apiKey: "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
    authDomain: "wordstream-extension-add3a.firebaseapp.com",
    projectId: "wordstream-extension-add3a",
    storageBucket: "wordstream-extension-add3a.firebasestorage.app",
    messagingSenderId: "719695800723",
    appId: "1:719695800723:web:bd113109dcfd3077136066",
    measurementId: "G-Q8H15ZYLPN"
  }
};

// בחירת הקונפיגורציה בהתאם לסביבה
const ENV = process.env.NODE_ENV || 'production';
const firebaseConfig = firebaseConfigs[ENV as keyof typeof firebaseConfigs] || firebaseConfigs.production;

// Detect if we're in a service worker environment
const isServiceWorkerEnvironment = typeof window === 'undefined';

// Add shims for service worker environment
if (isServiceWorkerEnvironment) {
  try {
    logger.log('Service worker environment detected, adding shims');
    
    // Make self.window available
    // @ts-ignore
    self.window = self;
    
    // Add mock document
    // @ts-ignore
    self.document = {
      // @ts-ignore
      createElement: () => ({}),
      // @ts-ignore
      querySelector: () => null,
      // @ts-ignore
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      // @ts-ignore
      documentElement: { style: {} },
      // @ts-ignore
      head: { appendChild: () => {} },
      // @ts-ignore
      body: { appendChild: () => {} }
    };
  } catch (error) {
    logger.error('Error setting up service worker environment:', error);
  }
}

// Initialize Firebase with retry logic
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let initializationSuccessful = false;
let offlineEnabled = false;

interface FirebaseInstances {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  isInitialized: boolean;
}

/**
 * Initialize Firebase with retry logic
 */
export function initializeFirebase(): FirebaseInstances {
  if (initializationSuccessful && firebaseApp && firebaseAuth && firebaseDb && firebaseStorage) {
    logger.log('Firebase already initialized successfully');
    return { 
      app: firebaseApp, 
      auth: firebaseAuth, 
      db: firebaseDb, 
      storage: firebaseStorage,
      isInitialized: true 
    };
  }
  
  try {
    logger.log('Initializing Firebase with configuration:', {
      apiKey: firebaseConfig.apiKey,
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      env: ENV
    });
    
    // Initialize Firebase app
    if (getApps().length > 0) {
      logger.log('Existing Firebase app detected, using existing');
      firebaseApp = getApp();
    } else {
      logger.log('Creating new Firebase app');
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    // Initialize Firebase services
    try {
      logger.log('Initializing Firebase Auth...');
      firebaseAuth = getAuth(firebaseApp);
      logger.log('Firebase Auth initialized successfully');
    } catch (authError) {
      logger.error('Failed to initialize Firebase Auth:', authError);
      firebaseAuth = null;
    }
    
    try {
      logger.log('Initializing Firestore...');
      firebaseDb = getFirestore(firebaseApp);
      
      // Enable local persistence - only in browser environment
      if (!isServiceWorkerEnvironment) {
        try {
          logger.log('Enabling IndexedDB for Firestore...');
          enableIndexedDbPersistence(firebaseDb).then(() => {
            logger.log('IndexedDB enabled successfully');
            offlineEnabled = true;
          }).catch((error) => {
            logger.error('Error enabling IndexedDB:', error);
          });
        } catch (persistError) {
          logger.error('Error enabling local persistence:', persistError);
        }
      }
      
      logger.log('Firestore initialized successfully');
    } catch (dbError) {
      logger.error('Failed to initialize Firestore:', dbError);
      firebaseDb = null;
    }
    
    try {
      logger.log('Initializing Firebase Storage...');
      firebaseStorage = getStorage(firebaseApp);
      logger.log('Firebase Storage initialized successfully');
    } catch (storageError) {
      logger.error('Failed to initialize Firebase Storage:', storageError);
      firebaseStorage = null;
    }
    
    // Check if all services were initialized successfully
    initializationSuccessful = !!(firebaseAuth && firebaseDb);
    
    if (initializationSuccessful) {
      logger.log('All Firebase services initialized successfully');
    } else {
      logger.error('Some Firebase services failed to initialize');
    }
    
    return { 
      app: firebaseApp, 
      auth: firebaseAuth, 
      db: firebaseDb, 
      storage: firebaseStorage,
      isInitialized: initializationSuccessful
    };
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    return { app: null, auth: null, db: null, storage: null, isInitialized: false };
  }
}

// Run initialization immediately
const firebase = initializeFirebase();

// Export Firebase instances
export const app = firebase.app;
export const auth = firebase.auth;
export const db = firebase.db;
export const storage = firebase.storage;

// Export function to check initialization status
export function isFirebaseInitialized(): boolean {
  return initializationSuccessful;
}

// Export function to check if offline persistence is enabled
export function isOfflinePersistenceEnabled(): boolean {
  return offlineEnabled;
}

// Export function to retry initialization
export async function retryInitialization(maxRetries: number = 3, delayMs: number = 1000): Promise<boolean> {
  if (initializationSuccessful) return true;
  
  logger.log(`Retrying initialization (max ${maxRetries} attempts)`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.log(`Retry attempt ${attempt}/${maxRetries}`);
    
    const result = initializeFirebase();
    
    if (result.isInitialized) {
      logger.log('Initialization succeeded');
      return true;
    }
    
    // Wait between attempts
    if (attempt < maxRetries) {
      logger.log(`Waiting ${delayMs}ms before next attempt`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  logger.error('All retry attempts failed');
  return false;
}

export default {
  app,
  auth,
  db,
  storage,
  initializeFirebase,
  isFirebaseInitialized,
  isOfflinePersistenceEnabled,
  retryInitialization
}; 