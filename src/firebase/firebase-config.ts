import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration for your project
const firebaseConfig = {
  apiKey: "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
  authDomain: "wordstream-extension-add3a.firebaseapp.com",
  projectId: "wordstream-extension-add3a",
  storageBucket: "wordstream-extension-add3a.firebasestorage.app",
  messagingSenderId: "719695800723",
  appId: "1:719695800723:web:bd113109dcfd3077136066",
  measurementId: "G-Q8H15ZYLPN"
};

// Initialize Firebase
let firebaseApp: ReturnType<typeof initializeApp>;
let isInitialized = false;

/**
 * Initializes Firebase for the WordStream2 extension
 * 
 * @returns The initialized Firebase app
 */
export function initializeFirebase() {
  if (isInitialized) {
    return firebaseApp;
  }

  // Initialize the Firebase app
  firebaseApp = initializeApp(firebaseConfig);
  
  // Get auth and firestore instances
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // Connect to emulators in development mode
  if (process.env.NODE_ENV === 'development') {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(firestore, 'localhost', 8080);
    console.log('Connected to Firebase emulators');
  }

  isInitialized = true;
  return firebaseApp;
}

/**
 * Gets the authentication instance
 * 
 * @returns Firebase Auth instance
 */
export function getAuthInstance() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return getAuth(firebaseApp);
}

/**
 * Gets the Firestore instance
 * 
 * @returns Firebase Firestore instance
 */
export function getFirestoreInstance() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return getFirestore(firebaseApp);
} 