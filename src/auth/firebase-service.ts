import { 
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  DocumentReference,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';

// Import from centralized Firebase module
import { getFirebaseServices, initializeFirebase } from './firebase-init';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase (from centralized module)
initializeFirebase().catch(error => {
  console.error("Failed to initialize Firebase in firebase-service.ts:", error);
});

// Provide a function to get authenticated services
const getServices = async () => {
  const services = await getFirebaseServices();
  if (!services.app || !services.auth || !services.firestore || !services.storage) {
    throw new Error("Firebase services not fully initialized");
  }
  return services;
};

// Create Google provider
const googleProvider = new GoogleAuthProvider();

// Authentication methods
export const signInWithGoogle = async () => {
  try {
    const services = await getServices();
    const result = await signInWithPopup(services.auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  try {
    const services = await getServices();
    const result = await signInWithEmailAndPassword(services.auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Error signing in with email/password:', error);
    throw error;
  }
};

export const registerWithEmailPassword = async (email: string, password: string) => {
  try {
    const services = await getServices();
    const result = await createUserWithEmailAndPassword(services.auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Error registering with email/password:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    const services = await getServices();
    await firebaseSignOut(services.auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const auth = getAuth();
  return onAuthStateChanged(auth, callback);
};

// Firestore methods
export const getDocument = async <T = DocumentData>(path: string): Promise<T | null> => {
  try {
    const services = await getServices();
    const docRef = doc(services.firestore, path);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as T;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting document at ${path}:`, error);
    throw error;
  }
};

export const saveDocument = async <T extends DocumentData>(path: string, data: T): Promise<string> => {
  try {
    const services = await getServices();
    const docRef = doc(services.firestore, path);
    const timestamp = serverTimestamp();
    const dataWithTimestamp = {
      ...data,
      updatedAt: timestamp,
      // Add createdAt only if this is a new document
      ...(!(await getDoc(docRef)).exists() && { createdAt: timestamp })
    };
    
    await setDoc(docRef, dataWithTimestamp, { merge: true });
    return docRef.id;
  } catch (error) {
    console.error(`Error saving document at ${path}:`, error);
    throw error;
  }
};

export const deleteDocument = async (path: string): Promise<void> => {
  try {
    const services = await getServices();
    const docRef = doc(services.firestore, path);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document at ${path}:`, error);
    throw error;
  }
};

export const queryDocuments = async <T = DocumentData>(
  collectionPath: string,
  fieldName: string,
  operator: '==' | '<' | '<=' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'not-in' | 'array-contains-any',
  value: any
): Promise<T[]> => {
  try {
    const services = await getServices();
    const collectionRef = collection(services.firestore, collectionPath);
    const q = query(collectionRef, where(fieldName, operator, value));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
  } catch (error) {
    console.error(`Error querying documents in ${collectionPath}:`, error);
    throw error;
  }
};

export const getAllDocuments = async <T = DocumentData>(collectionPath: string): Promise<T[]> => {
  try {
    const services = await getServices();
    const collectionRef = collection(services.firestore, collectionPath);
    const querySnapshot = await getDocs(collectionRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
  } catch (error) {
    console.error(`Error getting all documents from ${collectionPath}:`, error);
    throw error;
  }
};

// Storage methods
export const uploadFile = async (path: string, file: File): Promise<string> => {
  try {
    const services = await getServices();
    const storageRef = ref(services.storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error(`Error uploading file to ${path}:`, error);
    throw error;
  }
};

export const getFileURL = async (path: string): Promise<string> => {
  try {
    const services = await getServices();
    const storageRef = ref(services.storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error(`Error getting download URL for ${path}:`, error);
    throw error;
  }
};

export const deleteFile = async (path: string): Promise<void> => {
  try {
    const services = await getServices();
    const storageRef = ref(services.storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error(`Error deleting file at ${path}:`, error);
    throw error;
  }
};

// Local/Extension storage interface
export const storageProvider = {
  setItem: async (key: string, value: any): Promise<void> => {
    try {
      // First try Chrome extension storage API if available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error storing item with key ${key}:`, error);
      throw error;
    }
  },
  
  getItem: async <T = any>(key: string): Promise<T | null> => {
    try {
      // First try Chrome extension storage API if available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return await new Promise<T | null>((resolve, reject) => {
          chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result[key] || null);
            }
          });
        });
      } else {
        // Fallback to localStorage
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.error(`Error retrieving item with key ${key}:`, error);
      throw error;
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      // First try Chrome extension storage API if available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.remove(key, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing item with key ${key}:`, error);
      throw error;
    }
  }
};

// Export a safe way to get the Firebase services
export { getServices as getFirebaseServices };

// Export a single Firebase service object
const firebaseService = {
  signInWithGoogle,
  signInWithEmailPassword,
  registerWithEmailPassword,
  signOut,
  onAuthStateChange,
  getDocument,
  saveDocument,
  deleteDocument,
  queryDocuments,
  getAllDocuments,
  uploadFile,
  getFileURL,
  deleteFile,
  storageProvider
};

export default firebaseService;