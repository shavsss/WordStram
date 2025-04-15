/**
 * Authentication Module
 * This module centralizes all authentication-related functionality.
 * It exports all auth functions from firebase-service.ts.
 */

import {
  signInWithGoogle,
  signInWithEmailPassword,
  registerWithEmailPassword,
  signOut,
  onAuthStateChange,
} from './firebase-service';

// Re-export auth functions
export {
  signInWithGoogle,
  signInWithEmailPassword,
  registerWithEmailPassword,
  signOut, 
  onAuthStateChange,
};

// Hook for managing authentication
export { default as useAuth } from './useAuth'; 