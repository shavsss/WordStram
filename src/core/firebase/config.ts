/**
 * Firebase Configuration
 * כל תצורת Firebase והאיתחול
 */
import { initializeApp, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getFirestoreFromFirebase, Firestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';

// Firebase configuration - קבועי תצורה
const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

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
      app = initializeApp(FIREBASE_CONFIG);
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
    
    // Set persistence on first initialization 
    // This doesn't need to be awaited as it won't block other operations
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log('WordStream: Auth persistence set to browserLocalPersistence'))
      .catch(error => console.error('WordStream: Failed to set auth persistence:', error));
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