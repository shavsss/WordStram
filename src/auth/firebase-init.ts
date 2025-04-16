/**
 * Firebase Initialization Module
 * 
 * THIS IS THE MAIN FIREBASE INITIALIZATION FILE FOR THE ENTIRE APPLICATION.
 * All Firebase services should be initialized and accessed through this module.
 * 
 * This file centralizes all Firebase initialization and exports services in an organized way.
 */
import { initializeApp, FirebaseApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Global instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let storageService: FirebaseStorage | null = null;
let isInitialized = false;

// Firebase instance validity flag
let isFirebaseValid = false;

// Determine the current runtime environment
const isServiceWorker = typeof window === 'undefined' || 
                       (typeof self !== 'undefined' && (self as any).constructor?.name === 'ServiceWorkerGlobalScope');

// Promise that will be resolved when Firebase is initialized successfully
let initializationPromise: Promise<{
  initialized: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}> | null = null;

// Flag to prevent multiple concurrent initialization attempts
let isInitializationInProgress = false;

// Last initialization timestamp to prevent too frequent reinitializations
let lastInitializationTime = 0;
const MIN_REINITIALIZATION_INTERVAL = 2000; // 2 seconds

/**
 * Load Firebase configuration from storage or fallback to static config
 */
async function getFirebaseConfig() {
  try {
    // Try to get the API key from storage first
    const storageResult = await chrome.storage.local.get('firebase_config');
    if (storageResult && storageResult.firebase_config) {
      console.log('Using Firebase config from storage');
      return storageResult.firebase_config;
    }
  } catch (err) {
    console.warn('Could not load Firebase config from storage, using default');
  }
  
  // Fallback to static configuration if needed
  return {
    apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
    authDomain: "vidlearn-ai.firebaseapp.com",
    projectId: "vidlearn-ai",
    storageBucket: "vidlearn-ai.firebasestorage.app",
    messagingSenderId: "1097713470067",
    appId: "1:1097713470067:web:821f08db03951f83363806",
    measurementId: "G-PQDV30TTX1"
  };
}

/**
 * Clean up existing Firebase instances, but only if really necessary
 */
async function cleanupExistingFirebaseInstances() {
  try {
    const apps = getApps();
    
    // Only clean up if we have more than one app or we're in a service worker
    if (apps.length > 1 || (isServiceWorker && apps.length > 0)) {
      // Clean up existing instances to prevent duplicate instances
      for (const app of apps) {
        try {
          await deleteApp(app);
        } catch (err) {
          console.warn(`Could not delete app ${app.name}:`);
          // Continue despite errors
        }
      }
      
      // Reset our global variables
      firebaseApp = null;
      firebaseAuth = null;
      firestoreDb = null;
      storageService = null;
      isInitialized = false;
      isFirebaseValid = false;
    }
  } catch (error) {
    console.error("Error cleaning up Firebase instances:", error);
    // Continue despite error - we'll try to initialize a new instance
  }
}

/**
 * Check if Firebase app is still valid and not deleted
 */
function isFirebaseAppValid(app: FirebaseApp | null): boolean {
  if (!app) return false;
  
  try {
    // Try to access a property of the app
    const name = app.name;
    return true;
  } catch (error: any) {
    if (error.code === 'app/app-deleted' || 
        error.message?.includes('app-deleted') || 
        error.message?.includes('has been deleted')) {
      return false;
    }
    // For other errors, we're not sure if the app is invalid,
    // but we'll return false to be safe
    return false;
  }
}

/**
 * Initialize Firebase and all its services
 * 
 * This is the MAIN function for initializing Firebase in the application.
 * All components should call this function to ensure Firebase is initialized.
 */
export function initializeFirebase(): Promise<{
  initialized: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}> {
  // Check if the app is still valid before returning existing promise
  if (firebaseApp && !isFirebaseAppValid(firebaseApp)) {
    console.log('Firebase app has been deleted, forcing reinitialization');
    initializationPromise = null;
    isInitialized = false;
    firebaseApp = null;
  }

  // Always create a new initialization in service worker context, or use existing one
  if (initializationPromise && !isServiceWorker) {
    return initializationPromise;
  }
  
  // If initialization is already in progress, wait a bit and try again
  if (isInitializationInProgress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(initializeFirebase());
      }, 500);
    });
  }
  
  // Check if we've tried to initialize too frequently
  const now = Date.now();
  if (now - lastInitializationTime < MIN_REINITIALIZATION_INTERVAL) {
    console.log(`Delaying Firebase initialization (last attempt was ${now - lastInitializationTime}ms ago)`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(initializeFirebase());
      }, MIN_REINITIALIZATION_INTERVAL);
    });
  }
  
  lastInitializationTime = now;
  isInitializationInProgress = true;
  
  // Create a new initialization promise
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      // Get Firebase configuration
      const firebaseConfig = await getFirebaseConfig();
      
      // Clean up existing instances if needed
      if (isServiceWorker || getApps().length > 1) {
        await cleanupExistingFirebaseInstances();
      }
      
      // If app already exists and we're not in service worker, use it
      const apps = getApps();
      if (apps.length > 0 && !isServiceWorker) {
        firebaseApp = apps[0];
        if (!isFirebaseAppValid(firebaseApp)) {
          console.log('Existing Firebase app is invalid, creating a new one');
          // Try to delete it if it exists but is invalid
          try {
            await deleteApp(firebaseApp);
          } catch (e) {
            // Ignore errors when deleting already-deleted app
          }
          firebaseApp = null;
        }
      }
      
      // Create a new app if needed
      if (!firebaseApp) {
        try {
          console.log('Creating new Firebase app instance');
          firebaseApp = initializeApp(firebaseConfig);
        } catch (err: any) {
          // If app already exists, try again with a unique name
          if (err.code === 'app/duplicate-app') {
            const uniqueName = `app-${Date.now()}`;
            console.log(`App already exists, creating with unique name: ${uniqueName}`);
            firebaseApp = initializeApp(firebaseConfig, uniqueName);
          } else {
            throw err;
          }
        }
      }
      
      if (!firebaseApp) {
        throw new Error("Firebase app initialization failed");
      }
      
      // Verify the app is valid
      if (!isFirebaseAppValid(firebaseApp)) {
        throw new Error("Firebase app is invalid immediately after initialization");
      }
      
      // Initialize Firebase services
      firebaseAuth = getAuth(firebaseApp);
      firestoreDb = getFirestore(firebaseApp);
      storageService = getStorage(firebaseApp);
      
      // Mark initialization as complete
      isInitialized = true;
      isFirebaseValid = true;
      
      // Resolve the promise with the initialized services
      resolve({
        initialized: true,
        app: firebaseApp,
        auth: firebaseAuth,
        firestore: firestoreDb,
        storage: storageService
      });
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      
      // Mark as not initialized
      isInitialized = false;
      isFirebaseValid = false;
      
      // Resolve with empty services on failure
      resolve({
        initialized: false,
        app: null,
        auth: null,
        firestore: null,
        storage: null
      });
    } finally {
      isInitializationInProgress = false;
    }
  });
  
  return initializationPromise;
}

/**
 * Get Firebase services, initializing if necessary
 * 
 * Safe way to access Firebase services throughout the application.
 */
export async function getFirebaseServices() {
  try {
    // Check if app is deleted or not initialized
    if (!isInitialized || !firebaseApp || !isFirebaseValid) {
      console.log('Firebase not initialized or app deleted, initializing...');
      return await initializeFirebase();
    }
    
    // Check if the Firebase app is still valid
    if (!isFirebaseAppValid(firebaseApp)) {
      console.log('Firebase app is no longer valid, reinitializing...');
      isFirebaseValid = false;
      return await initializeFirebase();
    }
    
    return {
      initialized: isInitialized,
      app: firebaseApp,
      auth: firebaseAuth,
      firestore: firestoreDb,
      storage: storageService
    };
  } catch (error) {
    console.error("Error in getFirebaseServices:", error);
    // Reset state and try to reinitialize
    isInitialized = false;
    isFirebaseValid = false;
    return await initializeFirebase();
  }
}

/**
 * Manually force a Firebase reinitialization
 * Useful when you know the app is in a bad state
 */
export async function forceFirebaseReinitialization() {
  console.log('Forcing Firebase reinitialization');
  
  // Reset all flags and references
  isInitialized = false;
  isFirebaseValid = false;
  initializationPromise = null;
  
  // Clean up existing instances
  await cleanupExistingFirebaseInstances();
  
  // Reinitialize
  return await initializeFirebase();
}

/**
 * Get Firebase Auth instance after initialization
 * Added to support existing code
 */
export async function getFirebaseAuth(): Promise<Auth | null> {
  const services = await getFirebaseServices();
  return services.auth;
}

// Periodically check and reinitialize Firebase if needed (every 5 minutes)
setInterval(async () => {
  if (firebaseApp && !isFirebaseAppValid(firebaseApp)) {
    console.log('Periodic check: Firebase app is invalid, reinitializing');
    await forceFirebaseReinitialization();
  }
}, 5 * 60 * 1000);

// Initialize Firebase right away to ensure it's ready when needed
initializeFirebase().catch(error => {
  console.error("Failed to initialize Firebase:", error);
});

// Export services directly for use in import statements
export { firebaseApp as app };
export { firebaseAuth as auth };
export { firestoreDb as firestore };
export { storageService as storage };
export { isInitialized };

// Default export for convenience
export default initializeFirebase;