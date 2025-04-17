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

  // Listen for auth state changes via message passing
  useEffect(() => {
    const authStateListener = (message: any) => {
      if (message.action === 'AUTH_STATE_CHANGED') {
        if (message.isAuthenticated && message.user) {
          setUser({
            uid: message.user.uid,
            email: message.user.email,
            displayName: message.user.displayName,
            photoURL: message.user.photoURL
          });
          setLoading(false);
          setError(null);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // Add the listener
    chrome.runtime.onMessage.addListener(authStateListener);

    // Check for auth state from storage on mount
    const checkStoredAuth = async () => {
      try {
        const data = await chrome.storage.local.get(['wordstream_user_info']);
        if (data.wordstream_user_info) {
          setUser(data.wordstream_user_info);
          setLoading(false);
        } else {
          // No stored auth, continue with module auth state
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking stored auth:', error);
        setLoading(false);
      }
    };

    checkStoredAuth();

    // Clean up listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(authStateListener);
    };
  }, []);

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
      
      // Also remove from storage
      await chrome.storage.local.remove(['wordstream_user_info']);
      
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