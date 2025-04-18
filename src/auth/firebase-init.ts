/**
 * Firebase Initialization Module
 * 
 * THIS IS THE MAIN FIREBASE INITIALIZATION FILE FOR THE ENTIRE APPLICATION.
 * All Firebase services should be initialized and accessed through this module.
 * 
 * This file centralizes all Firebase initialization and exports services in an organized way.
 */
import { initializeApp, FirebaseApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Type for Firebase services
interface FirebaseServices {
  initialized: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

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
let initializationPromise: Promise<FirebaseServices> | null = null;

// Last initialization timestamp to prevent too frequent reinitializations
let lastInitializationTime = 0;
const MIN_REINITIALIZATION_INTERVAL = 2000; // 2 seconds

/**
 * More comprehensive check if extension context is valid
 * This helps prevent "Extension context invalidated" errors
 */
export function isExtensionContextValid(): boolean {
  if (typeof chrome === 'undefined') {
    console.warn('Chrome API is not available');
    return false;
  }
  
  if (!chrome.runtime) {
    console.warn('Chrome runtime is not available');
    return false;
  }
  
  try {
    // This will throw if extension context is invalidated
    const extensionId = chrome.runtime.id;
    if (!extensionId) {
      console.warn('Extension ID is not available - context may be invalidated');
      return false;
    }
    
    // Additional check - try to access chrome APIs
    if (typeof chrome.storage === 'undefined') {
      console.warn('Chrome storage API is not available');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Error checking extension context:', error);
    return false;
  }
}

/**
 * Load Firebase configuration from storage or fallback to static config
 */
async function getFirebaseConfig() {
  try {
    // Check extension context before trying to access storage
    if (!isExtensionContextValid()) {
      throw new Error('Extension context is invalid');
    }
    
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
 * 
 * Improved with retry logic, better error handling, and extension context validation.
 */
export function initializeFirebase(): Promise<FirebaseServices> {
  // First check if extension context is valid with our enhanced check
  if (!isExtensionContextValid()) {
    console.error('Firebase initialization failed: Extension context is invalid');
    return Promise.reject(new Error('Extension context is invalid'));
  }
  
  // Check if the app is still valid before returning existing promise
  if (firebaseApp && !isFirebaseAppValid(firebaseApp)) {
    console.log('Firebase app has been deleted, forcing reinitialization');
    initializationPromise = null;
    isInitialized = false;
    firebaseApp = null;
  }

  // Return existing promise if available and valid
  if (initializationPromise) return initializationPromise;
  
  // Create a new initialization promise using async IIFE pattern
  initializationPromise = (async () => {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastError: any = null;
    
    while (retryCount < MAX_RETRIES) {
      try {
        // Recheck extension context with each retry attempt
        if (!isExtensionContextValid()) {
          throw new Error('Extension context is invalid');
        }
        
        // Check if we've tried to initialize too frequently
        const now = Date.now();
        if (now - lastInitializationTime < MIN_REINITIALIZATION_INTERVAL) {
          await new Promise(resolve => 
            setTimeout(resolve, MIN_REINITIALIZATION_INTERVAL - (now - lastInitializationTime))
          );
        }
        
        lastInitializationTime = Date.now();
        
        // Get Firebase configuration
        const firebaseConfig = await getFirebaseConfig();
        
        // Clean up existing instances if needed
        await cleanupExistingFirebaseInstances();
        
        // Get existing apps
        const apps = getApps();
        
        // If app already exists and valid, use it
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
            
            // Generate a unique name for this instance to avoid collisions
            const uniqueName = isServiceWorker ? 
              `service-worker-${Date.now()}` : 
              `app-${Date.now()}`;
              
            // Always use a unique name to avoid duplicate app issues
            firebaseApp = initializeApp(firebaseConfig, uniqueName);
          } catch (err: any) {
            if (err.code === 'app/duplicate-app') {
              // If we get here, we should try with an even more unique name
              const uniquerName = `app-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
              console.log(`App already exists, creating with more unique name: ${uniquerName}`);
              firebaseApp = initializeApp(firebaseConfig, uniquerName);
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
        
        // Set persistence to LOCAL to keep the user logged in between sessions
        try {
          await setPersistence(firebaseAuth, browserLocalPersistence);
          console.log('Firebase Auth persistence set to LOCAL');
        } catch (error) {
          console.error('Error setting auth persistence:', error);
          // Continue despite error - default persistence will be used
        }
        
        firestoreDb = getFirestore(firebaseApp);
        storageService = getStorage(firebaseApp);
        
        // Mark initialization as complete
        isInitialized = true;
        isFirebaseValid = true;
        
        // Return the initialized services
        return {
          initialized: true,
          app: firebaseApp,
          auth: firebaseAuth,
          firestore: firestoreDb,
          storage: storageService
        };
      } catch (error) {
        lastError = error;
        retryCount++;
        
        console.error(`Failed to initialize Firebase (attempt ${retryCount}/${MAX_RETRIES}):`, error);
        
        // Wait longer between retries
        const backoffTime = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    
    // Mark as not initialized after all retries failed
    isInitialized = false;
    isFirebaseValid = false;
    
    throw lastError || new Error("Failed to initialize Firebase after multiple attempts");
  })();
  
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

/**
 * Check if a Firebase auth token is still valid
 * @param token The token to check
 * @returns Boolean indicating if token is valid
 */
export async function isTokenValid(token: string): Promise<boolean> {
  try {
    // We can't directly validate the token client-side, 
    // but we can check if Firebase still considers us logged in
    const auth = getAuth();
    if (auth.currentUser) {
      // If we have a current user, the token is likely still valid
      return true;
    }
    
    // Otherwise, token may be expired. Could try a lightweight Firebase operation
    // to check, but for now we'll assume it's invalid
    return false;
  } catch (error) {
    console.error('Error validating token:', error);
    // Assume invalid on error
    return false;
  }
}

/**
 * Force refresh the Firebase auth token
 * @returns Promise resolving to whether refresh was successful
 */
export async function forceRefreshAuthToken(): Promise<boolean> {
  try {
    const services = await getFirebaseServices();
    if (!services.auth || !services.auth.currentUser) {
      console.warn('Cannot refresh token - no current user');
      return false;
    }
    
    // Force token refresh
    await services.auth.currentUser.getIdToken(true);
    console.log('Auth token refreshed successfully');
    return true;
  } catch (error) {
    console.error('Failed to refresh auth token:', error);
    return false;
  }
}

// Default export for convenience
export default initializeFirebase;