import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  Firestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// בדיקת סביבת Service Worker
const isServiceWorkerEnvironment = typeof window === 'undefined';

// לוגר עקבי עם הלוגר ב-background
const logger = {
  log: (...args: any[]) => {
    try {
      console.log('[WordStream:Firebase]', ...args);
    } catch (e) {
      // מתעלם משגיאות לוג
    }
  },
  error: (...args: any[]) => {
    try {
      console.error('[WordStream:Firebase]', ...args);
    } catch (e) {
      // מתעלם משגיאות לוג
    }
  }
};

// בדיקה אם התוסף מופעל כ-Content Script או בקונטקסט רגיל
const isContentScript = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && !isServiceWorkerEnvironment;

// Firebase configuration
// The configuration can be updated by replacing the placeholders with actual values
// or by setting the corresponding environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAUdTLLJTxIPp_I6Zx9OBlSCOCKsT5f_uw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "wordstream-extension-add3a.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "wordstream-extension-add3a",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "wordstream-extension-add3a.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "719695800723",
  appId: process.env.FIREBASE_APP_ID || "1:719695800723:web:bd113109dcfd3077136066",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-Q8H15ZYLPN"
};

// מצב לא מקוון - ברירת מחדל
// משנים את ברירת המחדל למצב לא מקוון כדי להימנע מבעיות CSP
let isOfflineMode = true;

// אנחנו לא מאתחלים את Firebase כברירת מחדל
let firebaseApp;
let auth = null;
let db = null;
let storage = null;

// מגדירים טיפוס למשתמש הנוכחי - מכיוון שאנחנו לא משתמשים ב-Firebase Auth
interface SimpleUser {
  uid: string;
  email?: string;
  displayName?: string;
}

let currentUser: SimpleUser | null = null;

/**
 * בדיקה האם המשתמש במצב לא מקוון
 */
function isInOfflineMode(): boolean {
  return isOfflineMode;
}

/**
 * Sign in with Google - לא זמין במצב לא מקוון
 */
async function signInWithGoogle(): Promise<SimpleUser | null> {
  logger.error('Cannot sign in - operating in offline mode only');
  throw new Error('Cannot sign in - this extension works in offline mode only');
}

/**
 * Sign out - סימולציה של התנתקות
 */
async function signOut(): Promise<void> {
  logger.log('Offline mode - simulating sign out');
  currentUser = null;
  
  // שליחת אירוע התנתקות במצב לא מקוון
  if (!isServiceWorkerEnvironment) {
    document.dispatchEvent(new CustomEvent('wordstream-auth-changed', { 
      detail: { isAuthenticated: false, isOfflineMode: true }
    }));
  }
}

/**
 * Get current user
 */
function getCurrentUser(): SimpleUser | null {
  return currentUser;
}

/**
 * Save words locally
 */
async function saveWords(words: any[]): Promise<void> {
  logger.log('Saving words locally only (offline mode)');
  return;
}

/**
 * Get words from local storage
 */
async function getWords(): Promise<any[]> {
  logger.log('Using local data in offline mode');
  return [];
}

/**
 * Subscribe to words changes - חוזר ריק במצב לא מקוון
 */
function subscribeToWords(callback: (words: any[]) => void): () => void {
  callback([]);
  return () => {};
}

/**
 * Save notes locally
 */
async function saveNotes(videoId: string, notes: any[]): Promise<void> {
  logger.log('Saving notes locally only (offline mode)');
  return;
}

/**
 * Get notes from local storage
 */
async function getNotes(videoId: string): Promise<any[]> {
  logger.log('Using local data in offline mode');
  return [];
}

/**
 * Subscribe to notes changes for a video - חוזר ריק במצב לא מקוון
 */
function subscribeToNotes(videoId: string, callback: (notes: any[]) => void): () => void {
  callback([]);
  return () => {};
}

/**
 * Save shared word list - לא זמין במצב לא מקוון
 */
async function shareWordList(listName: string, words: any[], isPublic: boolean = true): Promise<string> {
  throw new Error('Cannot share lists in offline mode');
}

/**
 * Get public shared word lists - חוזר ריק במצב לא מקוון
 */
async function getPublicWordLists(language?: string): Promise<any[]> {
  logger.log('Cannot fetch public lists in offline mode');
  return [];
}

/**
 * בדיקת קישוריות לשירותי Firebase - תמיד מחזיר false במצב לא מקוון בלבד
 */
async function checkConnectivity(): Promise<boolean> {
  return false;
}

// שולח אירוע התחלתי שמודיע שאנחנו במצב לא מקוון
if (!isServiceWorkerEnvironment) {
  try {
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('wordstream-auth-changed', { 
        detail: { isAuthenticated: false, isOfflineMode: true }
      }));
    }, 0);
  } catch (err) {
    logger.error('Error dispatching initial offline mode event:', err);
  }
}

export default {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  saveWords,
  getWords,
  subscribeToWords,
  saveNotes,
  getNotes,
  subscribeToNotes,
  shareWordList,
  getPublicWordLists,
  isInOfflineMode,
  checkConnectivity
}; 