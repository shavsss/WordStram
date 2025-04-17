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
  isExtensionContextValid,
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

  // Track extension context validation status
  const [isContextValid, setIsContextValid] = useState<boolean>(true);

  // Function to check and update context validity
  const checkExtensionContext = () => {
    const isValid = isExtensionContextValid();
    setIsContextValid(isValid);
    return isValid;
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      try {
        // Check extension context first
        if (!checkExtensionContext()) {
          setAuthState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: "Extension context is invalid. Try reloading the extension."
          });
          return;
        }

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
          // Recheck context validity when auth state changes
          if (checkExtensionContext()) {
            setAuthState({
              isAuthenticated: !!authUser,
              user: authUser,
              loading: false,
              error: null
            });
          }
        }, (err) => {
          // Check if error is related to extension context
          if (err.message?.includes('extension context') ||
              err.message?.includes('Extension context') ||
              (err as any).code === 'auth/internal-error') {
            setIsContextValid(false);
            setAuthState({
              isAuthenticated: false,
              user: null,
              loading: false,
              error: "Extension context is invalid. Please reload the extension."
            });
          } else {
            setAuthState({
              isAuthenticated: false,
              user: null,
              loading: false,
              error: err.message
            });
          }
        });
      } catch (error: any) {
        console.error("Failed to set up auth state listener:", error);
        
        // Check if error is context-related
        if (error.message?.includes('extension context') || 
            error.message?.includes('Extension context')) {
          setIsContextValid(false);
          setAuthState({
            isAuthenticated: false,
            user: null, 
            loading: false,
            error: "Extension context is invalid. Please reload the extension."
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: error.message || "Failed to initialize authentication"
          });
        }
      }
    };

    setupAuth();

    // Set up periodic context validation check
    const contextCheckInterval = setInterval(() => {
      if (!checkExtensionContext() && isContextValid) {
        // Context has become invalid
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: "Extension context has become invalid. Please reload the extension."
        });
      }
    }, 5000);

    // Clean up subscription and interval on unmount
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(contextCheckInterval);
    };
  }, []);

  const signInWithEmailPassword = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Check extension context first
      if (!checkExtensionContext()) {
        throw new Error("Extension context is invalid. Please reload the extension.");
      }
      
      await authSignInWithEmail(email, password);
      return true;
    } catch (err: any) {
      const errorMessage = err.message?.includes('extension context') || 
                          err.message?.includes('Extension context') ?
                          "Extension context is invalid. Please reload the extension." :
                          err.message;
      
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage
      }));
      throw err;
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Check extension context first
      if (!checkExtensionContext()) {
        throw new Error("Extension context is invalid. Please reload the extension.");
      }
      
      await authCreateUser(email, password);
      return true;
    } catch (err: any) {
      const errorMessage = err.message?.includes('extension context') || 
                          err.message?.includes('Extension context') ?
                          "Extension context is invalid. Please reload the extension." :
                          err.message;
      
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage
      }));
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Check extension context first
      if (!checkExtensionContext()) {
        throw new Error("Extension context is invalid. Please reload the extension.");
      }
      
      await authSignInWithGoogle();
      return true;
    } catch (err: any) {
      const errorMessage = err.message?.includes('extension context') || 
                          err.message?.includes('Extension context') ?
                          "Extension context is invalid. Please reload the extension." :
                          err.message;
      
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage
      }));
      throw err;
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Check extension context first
      if (!checkExtensionContext()) {
        throw new Error("Extension context is invalid. Please reload the extension.");
      }
      
      await authSignOut();
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });
    } catch (err: any) {
      const errorMessage = err.message?.includes('extension context') || 
                          err.message?.includes('Extension context') ?
                          "Extension context is invalid. Please reload the extension." :
                          err.message;
      
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage
      }));
      throw err;
    }
  };

  const reloadAuthState = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    // Check context validity when manually reloading auth state
    if (!checkExtensionContext()) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: "Extension context is invalid. Please reload the extension."
      });
      return;
    }
    // Otherwise trigger auth state listener update through Firebase
  };

  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    isContextValid, // Expose context validity status
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithGoogle,
    logout,
    reloadAuthState,
    checkExtensionContext // Expose function to manually check context
  };
}