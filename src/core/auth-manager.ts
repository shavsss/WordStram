import { User } from 'firebase/auth';
import { auth } from '@/core/firebase/config';
import { getCurrentUser as getFirebaseCurrentUser } from '@/core/firebase/auth';
import {
  getDoc,
  doc,
  firestore,
  setDoc
} from '@/core/firebase/firestore';

// אובייקט מרכזי שמנהל אימות - גרסה פשוטה ומינימלית
const AuthManager = {
  /**
   * קבלת המשתמש הנוכחי ממקור אפשרי
   */
  getCurrentUser(): User | null {
    // הסתמכות בעיקר על Firebase
    const firebaseUser = auth.currentUser || getFirebaseCurrentUser();
    if (firebaseUser) {
      return firebaseUser;
    }

    // כגיבוי, לנסות להשתמש באובייקט גלובלי
    if (typeof window !== 'undefined' && window.WordStream?.currentUser) {
      return window.WordStream.currentUser as User;
    }
    
    return null;
  },

  /**
   * בדיקה אם משתמש מאומת
   */
  isAuthenticated(): boolean {
    return !!auth.currentUser || !!this.getCurrentUser();
  },

  /**
   * עדכון מצב האימות בכל המקומות הרלוונטיים
   */
  updateAuthState(user: User | null): void {
    // עדכון אובייקט גלובלי
    if (typeof window !== 'undefined') {
      if (!window.WordStream) {
        window.WordStream = {};
      }
      
      if (user) {
        // שמירת מידע מינימלי נדרש
        window.WordStream.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        window.WordStream.isAuthenticated = true;
      } else {
        window.WordStream.currentUser = undefined;
        window.WordStream.isAuthenticated = false;
      }
    }

    // שמירה ב-storage
    this.saveToStorage(user);
  },

  /**
   * שמירת מידע אימות ב-local storage
   */
  async saveToStorage(user: User | null): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const data = user ? {
          wordstream_auth_state: 'authenticated',
          wordstream_user_info: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          },
          lastAuthUpdate: new Date().toISOString()
        } : {
          wordstream_auth_state: 'unauthenticated',
          wordstream_user_info: null,
          lastAuthUpdate: new Date().toISOString()
        };

        await chrome.storage.local.set(data);
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error saving auth state:', error);
    }
  },

  /**
   * גרסה פשוטה ומינימלית של אימות הטוקן
   * מסתמכת על Firebase Auth ולא מנסה לנהל טוקנים ידנית
   */
  async verifyTokenAndRefresh(): Promise<boolean> {
    try {
      // פשוט לבדוק אם המשתמש מחובר דרך Firebase
      if (auth.currentUser) {
        console.log('WordStream AuthManager: User is authenticated via Firebase Auth');
        return true;
      }
      
      console.warn('WordStream AuthManager: No authenticated user in Firebase Auth');
      return false;
    } catch (error) {
      console.warn('WordStream AuthManager: Auth check failed:', error);
      return false;
    }
  },

  /**
   * בדיקת הרשאות משתמש לגישה לנתוני Firestore - גרסה פשוטה
   */
  async checkPermissions(): Promise<boolean> {
    // פשוט לבדוק אם המשתמש מחובר
    return this.isAuthenticated();
  },

  /**
   * לא צריך אימות מחדש כי אנחנו סומכים על Firebase
   */
  async reauthenticateIfNeeded(): Promise<boolean> {
    return this.isAuthenticated();
  }
};

export default AuthManager;

/**
 * קבלת מסמך פרופיל משתמש
 */
async function getUserProfileDocument() {
  try {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot get user profile - no authenticated user');
      return null;
    }
    
    // שימוש בגישה החדשה עם פונקציות Firestore ישירות
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    } else {
      // יצירת מסמך משתמש אם לא קיים
      console.log('WordStream: Creating new user profile document');
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date()
      };
      
      await setDoc(userDocRef, userData);
      return userData;
    }
  } catch (error) {
    console.error('WordStream: Error accessing user profile document:', error);
    return null;
  }
} 