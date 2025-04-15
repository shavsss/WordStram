/**
 * Database Service
 * This module centralizes all database-related functionality.
 * It provides functions for working with Firestore.
 */

import { useState, useEffect } from 'react';
import { 
  doc, 
  collection, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Word } from '@/shared/types';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Import from centralized Firebase module
import { getFirebaseServices, initializeFirebase } from './firebase-init';

// Types
interface Stats {
  totalWords: number;
  todayWords: number;
  streak: number;
  lastActive: string;
}

interface Settings {
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  targetLanguage: string;
}

// State
export let words: Word[] = [];
export let stats: Stats = {
  totalWords: 0,
  todayWords: 0,
  streak: 0,
  lastActive: new Date().toISOString()
};
export let settings: Settings = {
  autoTranslate: true,
  notifications: true,
  darkMode: false,
  targetLanguage: 'en'
};
export let isLoading = true;
export let error: string | null = null;

// Initialize listeners
let unsubscribeWords: (() => void) | null = null;
let unsubscribeStats: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;

// Helper function to get user ID with safety check
const getUserId = () => {
  try {
    const auth = getAuth();
    if (!auth || !auth.currentUser) {
      console.log("Auth not initialized or user not logged in");
      return null;
    }
    return auth.currentUser.uid;
  } catch (error) {
    console.error("Error getting user ID:", error);
    return null;
  }
};

// Safe accessor for Firestore with retry
const getFirestore = async (): Promise<Firestore> => {
  try {
    // נסה לקבל את ה-Firestore
    const services = await getFirebaseServices();
    
    if (!services.firestore) {
      console.log("Firestore not initialized, attempting re-initialization");
      
      // נסה לאתחל מחדש
      const reinitResult = await initializeFirebase();
      if (!reinitResult.firestore) {
        throw new Error('Failed to initialize Firestore after retry');
      }
      
      return reinitResult.firestore;
    }
    
    return services.firestore;
  } catch (error) {
    console.error("Error accessing Firestore:", error);
    throw new Error('Cannot access Firestore: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

// Firebase helper functions 
export const getDocument = async (collectionPath: string, docId: string) => {
  const firestore = await getFirestore();
  const docRef = doc(firestore, collectionPath, docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const saveDocument = async (collectionPath: string, docId: string, data: any) => {
  const firestore = await getFirestore();
  const docRef = doc(firestore, collectionPath, docId);
  await setDoc(docRef, data, { merge: true });
  return { id: docId, ...data };
};

export const deleteDocument = async (collectionPath: string, docId: string) => {
  const firestore = await getFirestore();
  const docRef = doc(firestore, collectionPath, docId);
  await deleteDoc(docRef);
  return true;
};

export const queryDocuments = async (collectionPath: string, fieldPath: string, operator: any, value: any) => {
  const firestore = await getFirestore();
  const q = query(collection(firestore, collectionPath), where(fieldPath, operator, value));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getAllDocuments = async (collectionPath: string) => {
  const firestore = await getFirestore();
  const querySnapshot = await getDocs(collection(firestore, collectionPath));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Storage helper functions
export const uploadFile = async (path: string, file: File) => {
  const services = await getFirebaseServices();
  if (!services.storage) {
    throw new Error('Storage is not initialized');
  }
  const storage = services.storage;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return path;
};

export const getFileURL = async (path: string) => {
  const services = await getFirebaseServices();
  if (!services.storage) {
    throw new Error('Storage is not initialized');
  }
  const storage = services.storage;
  const storageRef = ref(storage, path);
  return await getDownloadURL(storageRef);
};

export const deleteFile = async (path: string) => {
  const services = await getFirebaseServices();
  if (!services.storage) {
    throw new Error('Storage is not initialized');
  }
  const storage = services.storage;
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
  return true;
};

// Initialize database listeners
export const initializeListeners = async () => {
  console.log("Initializing database listeners...");
  
  try {
    // Make sure Firebase is initialized
    const services = await getFirebaseServices();
    
    // Check if firestore is available
    if (!services.firestore) {
      console.error("Firestore is not initialized. Firebase might not be ready.");
      error = "Firestore is not initialized";
      isLoading = false;
      return;
    }
    
    const firestore = services.firestore;
    
    const userId = getUserId();
    console.log("Current user ID:", userId);
    
    if (!userId) {
      console.log("User not authenticated, skipping database listeners");
      isLoading = false;
      error = 'User not authenticated';
      return;
    }

    isLoading = true;
    error = null;

    try {
      // Words listener
      console.log(`Setting up words listener for user ${userId}`);
      const wordsRef = collection(firestore, `users/${userId}/words`);
      unsubscribeWords = onSnapshot(wordsRef, (snapshot) => {
        console.log(`Words update received, ${snapshot.docs.length} documents`);
        words = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
        isLoading = false;
      }, (err) => {
        console.error(`Error in words listener: ${err.message}`, err);
        error = `Error fetching words: ${err.message}`;
        isLoading = false;
      });

      // Stats listener
      console.log(`Setting up stats listener for user ${userId}`);
      const statsRef = doc(firestore, `users/${userId}/metadata/stats`);
      unsubscribeStats = onSnapshot(statsRef, (doc) => {
        console.log(`Stats update received: ${doc.exists() ? 'document exists' : 'no document'}`);
        if (doc.exists()) {
          stats = doc.data() as Stats;
        }
        isLoading = false;
      }, (err) => {
        console.error(`Error in stats listener: ${err.message}`, err);
        error = `Error fetching stats: ${err.message}`;
        isLoading = false;
      });

      // Settings listener
      console.log(`Setting up settings listener for user ${userId}`);
      const settingsRef = doc(firestore, `users/${userId}/metadata/settings`);
      unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
        console.log(`Settings update received: ${doc.exists() ? 'document exists' : 'no document'}`);
        if (doc.exists()) {
          settings = doc.data() as Settings;
        }
        isLoading = false;
      }, (err) => {
        console.error(`Error in settings listener: ${err.message}`, err);
        error = `Error fetching settings: ${err.message}`;
        isLoading = false;
      });
    } catch (err: any) {
      console.error("Failed to set up listeners:", err);
      error = `Failed to initialize database: ${err.message}`;
      isLoading = false;
    }
  } catch (err: any) {
    console.error("Fatal error in initializeListeners:", err);
    error = `Fatal database error: ${err.message}`;
    isLoading = false;
  }
};

// Cleanup function
export const cleanup = () => {
  if (unsubscribeWords) unsubscribeWords();
  if (unsubscribeStats) unsubscribeStats();
  if (unsubscribeSettings) unsubscribeSettings();
};

// Update functions
export const updateWords = async (newWords: Word[]) => {
  const userId = getUserId();
  if (!userId) return;

  isLoading = true;
  try {
    const firestore = await getFirestore();
    
    // Update each word or add new ones
    for (const word of newWords) {
      const wordRef = doc(firestore, `users/${userId}/words/${word.id}`);
      await setDoc(wordRef, word, { merge: true });
    }
    isLoading = false;
  } catch (err: any) {
    error = `Error updating words: ${err.message}`;
    isLoading = false;
  }
};

export const updateStats = async (newStats: Partial<Stats>) => {
  const userId = getUserId();
  if (!userId) return;

  isLoading = true;
  try {
    const firestore = await getFirestore();
    const statsRef = doc(firestore, `users/${userId}/metadata/stats`);
    await updateDoc(statsRef, newStats);
    isLoading = false;
  } catch (err: any) {
    error = `Error updating stats: ${err.message}`;
    isLoading = false;
  }
};

export const updateSettings = async (newSettings: Partial<Settings>) => {
  const userId = getUserId();
  if (!userId) return;

  isLoading = true;
  try {
    const firestore = await getFirestore();
    const settingsRef = doc(firestore, `users/${userId}/metadata/settings`);
    await updateDoc(settingsRef, newSettings);
    isLoading = false;
  } catch (err: any) {
    error = `Error updating settings: ${err.message}`;
    isLoading = false;
  }
};

// Initialize listeners when auth state changes
const auth = getAuth();
auth.onAuthStateChanged((user) => {
  if (user) {
    initializeListeners();
  } else {
    cleanup();
  }
});

// Word-related database operations
export const getWords = async (userId: string) => {
  try {
    return await getAllDocuments(`users/${userId}/words`);
  } catch (error) {
    console.error('Error getting words:', error);
    throw error;
  }
};

export const saveWord = async (userId: string, word: any) => {
  try {
    const wordId = word.id || Date.now().toString();
    const data = {
      ...word,
      id: wordId,
      timestamp: new Date().toISOString()
    };
    await saveDocument(`users/${userId}/words`, wordId, data);
    return wordId;
  } catch (error) {
    console.error('Error saving word:', error);
    throw error;
  }
};

export const deleteWord = async (userId: string, wordId: string) => {
  try {
    await deleteDocument(`users/${userId}/words`, wordId);
  } catch (error) {
    console.error('Error deleting word:', error);
    throw error;
  }
};

// Note-related database operations
export const getNotes = async (userId: string) => {
  try {
    return await getAllDocuments(`users/${userId}/notes`);
  } catch (error) {
    console.error('Error getting notes:', error);
    throw error;
  }
};

export const saveNote = async (userId: string, note: any) => {
  try {
    const noteId = note.id || Date.now().toString();
    const data = {
      ...note,
      id: noteId,
      timestamp: new Date().toISOString()
    };
    await saveDocument(`users/${userId}/notes`, noteId, data);
    return noteId;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
};

export const deleteNote = async (userId: string, noteId: string) => {
  try {
    await deleteDocument(`users/${userId}/notes`, noteId);
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Chat-related database operations
export const getChats = async (userId: string) => {
  try {
    return await getAllDocuments(`users/${userId}/chats`);
  } catch (error) {
    console.error('Error getting chats:', error);
    throw error;
  }
};

export const saveChat = async (userId: string, chat: any) => {
  try {
    const chatId = chat.id || Date.now().toString();
    const data = {
      ...chat,
      id: chatId,
      timestamp: new Date().toISOString()
    };
    await saveDocument(`users/${userId}/chats`, chatId, data);
    return chatId;
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
};

export const deleteChat = async (userId: string, chatId: string) => {
  try {
    await deleteDocument(`users/${userId}/chats`, chatId);
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
};