/**
 * Auth Manager - ניהול אימות משתמשים
 * 
 * מספק גישה מרכזית למצב האימות של המשתמש
 */

import { auth } from './firebase/config';
import { getCurrentUser as getCurrentUserFromFirebase } from './firebase/auth';
import type { User } from 'firebase/auth';

// משתנים גלובליים לשמירת מידע האימות
let isInitialized = false;
let currentUser: User | null = null;

/**
 * אתחול מנהל האימות
 */
function initialize() {
  if (isInitialized) return;
  
  try {
    // קבלת המשתמש הנוכחי מ-Firebase
    currentUser = auth.currentUser;
    
    // הוספת מאזין לשינויים במצב האימות
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      console.log(`WordStream: Auth state changed, user ${user ? 'logged in' : 'logged out'}`);
    });
    
    isInitialized = true;
  } catch (error) {
    console.error('WordStream: Error initializing AuthManager:', error);
  }
}

// אתחול אוטומטי
initialize();

/**
 * האם המשתמש מחובר
 */
function isAuthenticated(): boolean {
  return !!currentUser;
}

/**
 * קבלת המשתמש הנוכחי
 */
function getCurrentUser(): User | null {
  if (!isInitialized) initialize();
  return currentUser || auth.currentUser;
}

/**
 * אימות תוקף הטוקן ורענון במידת הצורך
 */
async function verifyTokenAndRefresh(): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) return false;
    
    try {
      // נסיון לקבל טוקן חדש - יזרוק שגיאה אם האימות לא תקף
      await user.getIdToken(true);
      return true;
    } catch (error) {
      console.error('WordStream: Error refreshing token:', error);
      return false;
    }
  } catch (error) {
    console.error('WordStream: Error in verifyTokenAndRefresh:', error);
    return false;
  }
}

// ייצוא הפונקציות העיקריות 
export default {
  initialize,
  isAuthenticated,
  getCurrentUser,
  verifyTokenAndRefresh
}; 