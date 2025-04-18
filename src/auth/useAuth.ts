/**
 * useAuth Hook
 * This hook provides authentication state and functions for React components.
 */

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle as authSignInWithGoogle,
  signOut as authSignOut,
  getCurrentUser,
  isAuthenticated as checkIsAuthenticated
} from './auth-manager';

export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastAuthenticated: number;
}

/**
 * Hook לניהול אימות משתמשים
 */
export default function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Set up auth state listener on mount
  useEffect(() => {
    let unmounted = false;
    let authStateListener: ((message: any) => void) | null = null;
    
    const checkInitialAuthState = async () => {
      if (unmounted) return;
      
      setLoading(true);
      
      try {
        // Check storage first for immediate UI update
        const data = await chrome.storage.local.get(['wordstream_user_info']);
        if (data.wordstream_user_info) {
          if (!unmounted) {
            setUser(data.wordstream_user_info);
            setLoading(false);
          }
        }
        
        // Then check with Firebase for source of truth
        const currentUser = await getCurrentUser();
        if (!unmounted) {
          if (currentUser) {
            const userInfo = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              lastAuthenticated: Date.now()
            };
            setUser(userInfo);
            
            // Update storage with latest info
            try {
              chrome.storage.local.set({ 
                'wordstream_user_info': userInfo,
                'wordstream_auth_state': {
                  isAuthenticated: true,
                  lastChecked: Date.now()
                }
              });
            } catch (storageError) {
              console.error('useAuth: Error updating auth in storage:', storageError);
            }
          } else if (!data.wordstream_user_info) {
            // Only clear user if we don't have storage data
            setUser(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('useAuth: Error checking initial auth state:', error);
        
        // Fallback to storage if Firebase check fails
        try {
          const data = await chrome.storage.local.get(['wordstream_user_info']);
          if (!unmounted) {
            if (data.wordstream_user_info) {
              setUser(data.wordstream_user_info);
            } else {
              setUser(null);
            }
            setLoading(false);
          }
        } catch (storageError) {
          console.error('useAuth: Fatal error checking auth:', storageError);
          if (!unmounted) {
            setUser(null);
            setLoading(false);
          }
        }
      }
      
      if (!unmounted) {
        setIsInitialized(true);
      }
    };
    
    // Set up listener for auth state changes
    authStateListener = (message: any) => {
      if (message.action === 'AUTH_STATE_CHANGED' && !unmounted) {
        if (message.isAuthenticated && message.user) {
          setUser(message.user);
          setLoading(false);
        } else if (message.isAuthenticated === false) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // Add the listener
    chrome.runtime.onMessage.addListener(authStateListener);
    
    // Check initial state
    checkInitialAuthState();

    // Clean up listener on unmount
    return () => {
      unmounted = true;
      if (authStateListener) {
        chrome.runtime.onMessage.removeListener(authStateListener);
      }
    };
  }, []);

  // Enhanced Google Sign In with better error handling
  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try background script first
      try {
        const response = await chrome.runtime.sendMessage({ 
          action: "SIGN_IN_WITH_GOOGLE" 
        });
        
        if (!response || !response.success) {
          // Fall back to direct method
          throw new Error(response?.error || "Google sign-in failed via background");
        }
        
        // Success
        setLoading(false);
        return true;
      } catch (backgroundError) {
        console.warn('useAuth: Error using background sign-in, trying direct method:', backgroundError);
        
        // Fall back to direct method
        try {
          await authSignInWithGoogle();
          setLoading(false);
          return true;
        } catch (directError) {
          console.error('useAuth: Direct sign-in also failed:', directError);
          throw directError;
        }
      }
    } catch (error) {
      console.error("useAuth: Login error:", error);
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return false;
    }
  }, []);

  // Improved logout
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear local storage first for immediate UI update
      try {
        await chrome.storage.local.remove(['wordstream_user_info', 'wordstream_auth_state']);
        setUser(null);
      } catch (storageError) {
        console.error('useAuth: Error clearing storage during logout:', storageError);
      }
      
      // Then sign out from Firebase
      try {
        await authSignOut();
      } catch (signOutError) {
        console.error('useAuth: Error in Firebase signOut:', signOutError);
        // Continue despite error - we've already cleared local state
      }
      
      setLoading(false);
      return true;
    } catch (error) {
      console.error('useAuth: Logout error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setLoading(false);
      return false;
    }
  }, []);

  // Don't wait for loading if we have a user from storage - improves UX
  const effectivelyAuthenticated = !!user;
  
  return {
    user,
    loading: loading && !isInitialized, // Only show loading on initial load
    error,
    isAuthenticated: effectivelyAuthenticated,
    signInWithGoogle,
    logout
  };
}