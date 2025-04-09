/**
 * Firebase Auth Helper
 * מספק פונקציות עזר לאימות משתמשים ורענון טוקנים
 */

import { getFirebaseApp, getFirebaseAuth } from '../core/firebase/config';
import { FirebaseApp } from 'firebase/app';
import { Auth, getIdToken, onAuthStateChanged, User } from 'firebase/auth';

// Status variables
let isInitialized = false;
let tokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes

/**
 * אתחול Firebase Auth עם רענון טוקן אוטומטי
 * @param app אובייקט Firebase App
 */
export async function initializeFirebaseAuth(app: FirebaseApp): Promise<void> {
  if (isInitialized) {
    console.log('WordStream: Firebase Auth already initialized');
    return;
  }
  
  try {
    const auth = getFirebaseAuth();
    
    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('WordStream: User authenticated in auth helper');
        setupTokenRefresh(auth);
      } else {
        console.log('WordStream: User signed out in auth helper');
        clearTokenRefresh();
      }
    });
    
    isInitialized = true;
    console.log('WordStream: Firebase Auth initialized with auto token refresh');
  } catch (error) {
    console.error('WordStream: Error initializing Firebase Auth:', error);
    throw error;
  }
}

/**
 * בדיקה האם המשתמש מאומת
 */
export function isUserAuthenticated(authInstance?: Auth): boolean {
  try {
    const auth = authInstance || getFirebaseAuth();
    return !!auth.currentUser;
  } catch (error) {
    console.error('WordStream: Error checking user authentication:', error);
    return false;
  }
}

/**
 * רענון טוקן אימות
 * @returns Promise שמתרכז לאמת אם רענון הטוקן הצליח
 */
export async function triggerTokenRefresh(): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('WordStream: Cannot refresh token - No authenticated user');
      return false;
    }
    
    // Force token refresh
    await getIdToken(user, true);
    console.log('WordStream: Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('WordStream: Error refreshing token:', error);
    return false;
  }
}

/**
 * הגדרת רענון טוקן אוטומטי
 */
function setupTokenRefresh(auth: Auth): void {
  clearTokenRefresh(); // Clear any existing timer
  
  tokenRefreshTimeout = setTimeout(async () => {
    console.log('WordStream: Auto-refreshing authentication token');
    const success = await triggerTokenRefresh();
    
    if (success && auth.currentUser) {
      setupTokenRefresh(auth); // Setup next refresh
    } else {
      console.warn('WordStream: Token refresh failed or user signed out, stopping auto-refresh');
    }
  }, TOKEN_REFRESH_INTERVAL);
}

/**
 * ניקוי טיימר רענון הטוקן
 */
function clearTokenRefresh(): void {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
    tokenRefreshTimeout = null;
  }
} 