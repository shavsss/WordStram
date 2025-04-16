/**
 * useAuth Hook
 * This hook provides authentication state and functions for the application.
 */

import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';

// Import from centralized Firebase modules
import { 
  getFirebaseServices, 
  initializeFirebase,
  initializeAuth,
  signInWithEmail as authSignInWithEmail,
  signInWithGoogle as authSignInWithGoogle,
  signOut as authSignOut,
  createUser as authCreateUser
} from './index';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export default function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      try {
        // Ensure Firebase is initialized
        await initializeFirebase();
        
        // Initialize auth
        await initializeAuth();
        
        // Get services
        const services = await getFirebaseServices();
        if (!services.auth) {
          throw new Error("Firebase auth is not initialized");
        }
        
        // Set up auth state listener
        unsubscribe = onAuthStateChanged(services.auth, (authUser) => {
          setAuthState({
            isAuthenticated: !!authUser,
            user: authUser,
            loading: false,
            error: null
          });
        }, (err) => {
          setAuthState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: err.message
          });
        });
      } catch (error: any) {
        console.error("Failed to set up auth state listener:", error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: error.message || "Failed to initialize authentication"
        });
      }
    };

    setupAuth();

    // Clean up subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signInWithEmailPassword = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authSignInWithEmail(email, password);
      return true;
    } catch (err: any) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message
      }));
      throw err;
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authCreateUser(email, password);
      return true;
    } catch (err: any) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message
      }));
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authSignInWithGoogle();
      return true;
    } catch (err: any) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message
      }));
      throw err;
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authSignOut();
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });
    } catch (err: any) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message
      }));
      throw err;
    }
  };

  const reloadAuthState = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    // This will trigger the auth state listener which will update the state
  };

  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    logout,
    reloadAuthState
  };
}