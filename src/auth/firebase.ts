// Import Firebase SDK functions
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

console.log("Firebase module loading...");

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

// Initialize Firebase
let app;
let auth;
let firestore;
let storage;

try {
  console.log("Initializing Firebase app...");
  app = initializeApp(firebaseConfig);
  console.log("Firebase app initialized successfully");

  // Initialize Firebase services
  console.log("Initializing Firebase auth...");
  auth = getAuth(app);
  console.log("Firebase auth initialized");

  console.log("Initializing Firestore...");
  firestore = getFirestore(app);
  console.log("Firestore initialized");

  console.log("Initializing Storage...");
  storage = getStorage(app);
  console.log("Storage initialized");
} catch (error) {
  console.error("Error initializing Firebase:", error);
  throw error; // Re-throw to ensure the error is visible
}

// Export the initialized services
export { auth, firestore, storage };
export default app; 