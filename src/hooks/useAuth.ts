import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { useAuth as useAuthFromModule, signInWithGoogle as authSignInWithGoogle, signOut as authSignOut } from '../auth';

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
  
  // Use the new consolidated auth hook
  const authModule = useAuthFromModule();

  // Update our state based on the auth module state
  useEffect(() => {
    if (authModule.user) {
      setUser({
        uid: authModule.user.uid,
        email: authModule.user.email,
        displayName: authModule.user.displayName,
        photoURL: authModule.user.photoURL
      });
    } else {
      setUser(null);
    }
    
    setLoading(authModule.loading);
    setError(authModule.error);
  }, [authModule.user, authModule.loading, authModule.error]);

  // התחברות באמצעות Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      await authModule.signInWithGoogle();
      return true;
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [authModule]);

  // התנתקות
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authModule.logout();
      return true;
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [authModule]);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    logout
  };
} 