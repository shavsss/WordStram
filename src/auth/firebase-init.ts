/**
 * firebase-init.ts - מודול מאוחד לאתחול Firebase
 * קובץ זה מרכז את כל האתחול של Firebase ומייצא את השירותים באופן מסודר
 */
import { initializeApp, FirebaseApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

console.log("Firebase initialization module loading...");

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.firebasestorage.app",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

// שמירת מופעים גלובליים
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let storageService: FirebaseStorage | null = null;
let isInitialized = false;

// Determine the current runtime environment
const isServiceWorker = typeof window === 'undefined' || 
                      (typeof self !== 'undefined' && (self as any).constructor?.name === 'ServiceWorkerGlobalScope');
console.log(`Running in ${isServiceWorker ? 'service worker' : 'window'} context`);

// Promise שיושלם כאשר Firebase מאותחל בהצלחה
let initializationPromise: Promise<{
  initialized: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}> | null = null;

// Flag to prevent multiple concurrent initialization attempts
let isInitializationInProgress = false;

/**
 * פונקציה שמנקה את המופעים הקיימים של Firebase
 */
async function cleanupExistingFirebaseInstances() {
  try {
    const apps = getApps();
    
    // Clean up existing instances to prevent duplicate instances
    for (const app of apps) {
      console.log(`Deleting existing Firebase app: ${app.name}`);
      try {
        await deleteApp(app);
      } catch (err) {
        console.warn(`Could not delete app ${app.name}:`, err);
        // Continue despite errors
      }
    }
    
    // Reset our global variables
    firebaseApp = null;
    firebaseAuth = null;
    firestoreDb = null;
    storageService = null;
    isInitialized = false;
    
    console.log("Cleaned up existing Firebase instances");
  } catch (error) {
    console.error("Error cleaning up Firebase instances:", error);
    // Continue despite error - we'll try to initialize a new instance
  }
}

/**
 * פונקציה שמאתחלת את Firebase וכל השירותים שלו
 */
export function initializeFirebase(): Promise<{
  initialized: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}> {
  // Always create a new initialization in service worker context, or use existing one
  if (initializationPromise && !isServiceWorker) {
    console.log("Using existing Firebase initialization promise");
    return initializationPromise;
  }
  
  // If initialization is already in progress, wait a bit and try again
  if (isInitializationInProgress) {
    console.log("Firebase initialization already in progress, waiting...");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(initializeFirebase());
      }, 500);
    });
  }
  
  console.log("Starting Firebase initialization...");
  isInitializationInProgress = true;
  
  // יצירת promise חדש לאתחול
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Firebase initialization starting");
      
      // Clean up existing instances if needed
      if (isServiceWorker || getApps().length > 0) {
        await cleanupExistingFirebaseInstances();
      }
      
      // Initialize Firebase app
      console.log("Initializing Firebase app...");
      
      try {
        // Create a standard app name 
        firebaseApp = initializeApp(firebaseConfig);
        console.log(`Firebase app initialized successfully`);
      } catch (err: any) {
        console.error("Error initializing Firebase app:", err);
        
        // If app already exists, try again with a unique name
        if (err.code === 'app/duplicate-app') {
          console.log("Handling duplicate app error by using a unique name");
          const uniqueName = `app-${Date.now()}`;
          firebaseApp = initializeApp(firebaseConfig, uniqueName);
          console.log(`Firebase app initialized with unique name: ${uniqueName}`);
        } else {
          throw err;
        }
      }
      
      if (!firebaseApp) {
        throw new Error("Firebase app initialization failed");
      }
      
      // Initialize Firebase services
      console.log("Initializing Firebase services...");
      
      try {
        // Get Auth service
        firebaseAuth = getAuth(firebaseApp);
        console.log("Auth service initialized");
        
        // Get Firestore service
        firestoreDb = getFirestore(firebaseApp);
        console.log("Firestore service initialized");
        
        // Get Storage service
        storageService = getStorage(firebaseApp);
        console.log("Storage service initialized");
        
        // Mark initialization as complete
        isInitialized = true;
        console.log("Firebase initialization complete!");
        
        // Resolve the promise with the initialized services
        resolve({
          initialized: true,
          app: firebaseApp,
          auth: firebaseAuth,
          firestore: firestoreDb,
          storage: storageService
        });
      } catch (err) {
        console.error("Error initializing Firebase services:", err);
        throw err;
      }
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      
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
 * פונקציה שבודקת אם Firebase מאותחל ומחזירה את השירותים
 */
export async function getFirebaseServices() {
  if (!isInitialized) {
    return await initializeFirebase();
  }
  
  return {
    initialized: isInitialized,
    app: firebaseApp,
    auth: firebaseAuth,
    firestore: firestoreDb,
    storage: storageService
  };
}

/**
 * פונקציה שמחזירה את מופע האימות לאחר שהוא מאותחל
 * הוספנו פונקציה זו כדי לתמוך בקוד קיים
 */
export async function getFirebaseAuth(): Promise<Auth | null> {
  const services = await getFirebaseServices();
  return services.auth;
}

// Export services directly
export { firebaseApp as app };
export { firebaseAuth as auth };
export { firestoreDb as firestore };
export { storageService as storage };
export { isInitialized };
export default initializeFirebase;