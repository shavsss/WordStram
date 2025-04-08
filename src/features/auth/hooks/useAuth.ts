/**
 * Authentication Hook
 * 
 * הוק לניהול אימות משתמש, משלב את כל פונקציות האימות לממשק אחיד
 */

import { useState, useEffect, useCallback } from 'react';
import AuthManager from '@/core/auth-manager';
import { User } from '@/types';
import { 
  signInWithGoogle as firebaseSignInWithGoogle, 
  signOutUser,
  auth
} from '@/core/firebase/auth';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

interface UserData {
  gender?: string;
  age?: number;
  location?: string;
}

interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  register: (email: string, password: string, userData?: UserData) => Promise<User | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

/**
 * Hook משולב לניהול אימות המשתמש
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // אתחול האימות בעת טעינת הקומפוננטה
  useEffect(() => {
    const authManager = AuthManager.getInstance();
    
    // בדיקת מצב האימות הנוכחי
    const currentUser = AuthManager.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
    
    // האזנה לשינויים במצב האימות
    const unsubscribe = authManager.onAuthStateChanged((newUser) => {
      setUser(newUser);
      setIsAuthenticated(!!newUser);
      setError(null);
    });
    
    // ניקוי בעת פירוק הקומפוננטה
    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * כניסה עם אימייל וסיסמה
   */
  const signInWithEmail = useCallback(async (email: string, password: string): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const user: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        getIdToken: (forceRefresh?: boolean) => firebaseUser.getIdToken(forceRefresh)
      };
      
      return user;
    } catch (e: any) {
      setError(e.message || 'Failed to sign in');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * כניסה עם חשבון גוגל
   */
  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const user = await firebaseSignInWithGoogle();
      return user;
    } catch (e: any) {
      setError(e.message || 'Failed to sign in with Google');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * הרשמת משתמש חדש
   */
  const register = useCallback(async (
    email: string, 
    password: string,
    userData?: UserData
  ): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // כאן ניתן להוסיף את הנתונים הנוספים של המשתמש ל-Firestore
      
      const user: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        getIdToken: (forceRefresh?: boolean) => firebaseUser.getIdToken(forceRefresh)
      };
      
      return user;
    } catch (e: any) {
      setError(e.message || 'Failed to register');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * יציאה מהמערכת
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await signOutUser();
    } catch (e: any) {
      setError(e.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * איפוס סיסמה
   */
  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed to send password reset email');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * רענון טוקן האימות
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await AuthManager.verifyTokenAndRefresh(true);
      return success;
    } catch (e: any) {
      setError(e.message || 'Failed to refresh token');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    signInWithEmail,
    signInWithGoogle,
    register,
    signOut,
    resetPassword,
    refreshToken
  };
}

export default useAuth; 