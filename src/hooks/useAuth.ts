import { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserCredential } from 'firebase/auth';
import { auth } from '@/core/firebase/config';
import { 
  signInWithEmail as firebaseSignInWithEmail, 
  signInWithGoogle as firebaseSignInWithGoogle, 
  registerWithEmail, 
  logOut,
  resetPassword as resetPasswordFn,
  getCurrentUser,
  subscribeToAuthChanges
} from '@/core/firebase/auth';
import { syncNotesBetweenStorageAndFirestore } from '@/core/firebase/firestore';

// Constants for login security
const MAX_FAILED_ATTEMPTS = 5; // Maximum failed login attempts before locking
const ACCOUNT_LOCK_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Interface for additional user data
export interface UserData {
  gender?: string;
  age?: number;
  location?: string;
}

/**
 * Authentication hook for managing user authentication state
 * Integrates with Firebase Auth and the global WordStream object
 */
export function useAuth() {
  // Auth state with loading and error handling
  const [authState, setAuthState] = useState<AuthState>({
    currentUser: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Update global WordStream object with auth state
  const updateGlobalAuthState = useCallback((user: User | null) => {
    if (typeof window !== 'undefined' && window.WordStream) {
      window.WordStream.currentUser = user ? {
        uid: user.uid,
        displayName: user.displayName || undefined,
        email: user.email || undefined,
        photoURL: user.photoURL || undefined
      } : undefined;
      window.WordStream.isAuthenticated = Boolean(user);
    }
  }, []);

  // Handle auth state changes
  useEffect(() => {
    // Check for current user immediately
    const user = getCurrentUser();
    
    // If user exists, update state
    if (user) {
      setAuthState({
        currentUser: user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      updateGlobalAuthState(user);
    } else {
      setAuthState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
    
    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuthChanges((user) => {
      setAuthState({
        currentUser: user,
        isAuthenticated: Boolean(user),
        isLoading: false,
        error: null
      });
      updateGlobalAuthState(user);
      
      // Sync data when authentication state changes
      if (user) {
        syncNotesBetweenStorageAndFirestore()
          .catch((err: Error) => console.error('Failed to sync notes after auth change:', err));
      }
    });

    return () => unsubscribe();
  }, [updateGlobalAuthState]);

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userCredential = await firebaseSignInWithEmail(email, password);
      
      // Check if userCredential exists and has user
      if (userCredential && userCredential.user) {
        setAuthState({
          currentUser: userCredential.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        updateGlobalAuthState(userCredential.user);
        return true;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Sign in failed' 
      }));
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return false;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userCredential = await firebaseSignInWithGoogle();
      
      // Check if userCredential exists and has user
      if (userCredential && userCredential.user) {
        setAuthState({
          currentUser: userCredential.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        updateGlobalAuthState(userCredential.user);
        return true;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Google sign in failed' 
      }));
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return false;
    }
  };

  // Register with email and password
  const register = async (email: string, password: string, userData?: UserData): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await registerWithEmail(email, password, userData);
      setAuthState({
        currentUser: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      updateGlobalAuthState(result.user);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return false;
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await logOut();
      setAuthState({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
      updateGlobalAuthState(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await resetPasswordFn(email);
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return false;
    }
  };

  // Return auth state and methods
  return {
    ...authState,
    signInWithEmail,
    signInWithGoogle,
    register,
    signOut,
    resetPassword
  };
} 