import { useState, useEffect, useCallback } from 'react';
import { auth } from '../core/firebase/config';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { signInWithGoogle as firebaseSignInWithGoogle } from '../services/firebase-service';

export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Hook לניהול אימות משתמשים
 */
export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // הגדרת המאזין למצב האימות
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, 
      (authUser) => {
        setLoading(true);
        if (authUser) {
          setUser({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL
          });
        } else {
          setUser(null);
        }
        setError(null);
        setLoading(false);
      },
      (authError) => {
        console.error('Auth state change error:', authError);
        setError(authError.message);
        setLoading(false);
      }
    );

    // ניקוי המאזין בסיום
    return () => unsubscribe();
  }, []);

  // התחברות באמצעות Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const result = await firebaseSignInWithGoogle();
      if (!result.success) {
        throw new Error(result.error ? String(result.error) : 'Failed to sign in with Google');
      }
      return true;
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // התנתקות
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await signOut(auth);
      return true;
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    logout
  };
} 