import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  enableIndexedDbPersistence,
  connectFirestoreEmulator 
} from 'firebase/firestore';

// Environment configurations
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
    apiKey: "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
    authDomain: "wordstream-extension-add3a.firebaseapp.com",
    projectId: "wordstream-extension-add3a",
    storageBucket: "wordstream-extension-add3a.firebasestorage.app",
    messagingSenderId: "719695800723",
    appId: "1:719695800723:web:bd113109dcfd3077136066"
  }
};

// Determine environment 
function getEnvironment(): 'development' | 'production' {
  // Check if this is the production extension ID
  const isProdExtension = chrome.runtime.id === 'YOUR_PRODUCTION_EXTENSION_ID';
  
  // Override with explicit development flag if set
  const isDev = process.env.NODE_ENV === 'development';
  
  return (isDev || !isProdExtension) ? 'development' : 'production';
}

const ENV = getEnvironment();
const firebaseConfig = firebaseConfigs[ENV];

// Safe initialization with singleton pattern
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isInitialized = false;

/**
 * Initialize Firebase with proper error handling
 */
export function initializeFirebase() {
  if (isInitialized) {
    console.log('[WordStream] Firebase already initialized');
    return { app, auth, db };
  }
  
  try {
    // Initialize the app if not already initialized
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log(`[WordStream] Firebase initialized in ${ENV} mode`);
    } else {
      app = getApp();
      console.log('[WordStream] Using existing Firebase app');
    }
    
    // Initialize Auth
    auth = getAuth(app);
    
    // Initialize Firestore
    db = getFirestore(app);
    
    // Connect to emulators in development mode
    if (ENV === 'development') {
      if (auth) connectAuthEmulator(auth, 'http://localhost:9099');
      if (db) connectFirestoreEmulator(db, 'localhost', 8080);
    }
    
    // Enable offline persistence for Firestore
    if (db) {
      enableIndexedDbPersistence(db)
        .then(() => {
          console.log('[WordStream] Offline persistence enabled');
        })
        .catch((error) => {
          if (error.code === 'failed-precondition') {
            console.warn('[WordStream] Multiple tabs open, persistence can only be enabled in one tab at a time');
          } else if (error.code === 'unimplemented') {
            console.warn('[WordStream] The current browser does not support offline persistence');
          }
        });
    }
    
    isInitialized = true;
    return { app, auth, db };
  } catch (error) {
    console.error('[WordStream] Firebase initialization error:', error);
    return { app: null, auth: null, db: null };
  }
}

// Export initialized instances
export const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb } = initializeFirebase();

// Export function to check initialization status
export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

// Export environment information
export function getFirebaseEnvironment(): string {
  return ENV;
}

// Function to enable multi-tab synchronization if needed
export function enableMultiTabSync(): Promise<void> {
  if (!db) {
    return Promise.reject(new Error('Firestore not initialized'));
  }
  
  // Using a type assertion for the options since TS may not recognize synchronizeTabs
  // This is a documented option in Firebase
  return enableIndexedDbPersistence(db, { synchronizeTabs: true } as any)
    .then(() => {
      console.log('[WordStream] Multi-tab synchronization enabled');
    })
    .catch((error) => {
      console.error('[WordStream] Error enabling multi-tab sync:', error);
      throw error;
    });
} 