/**
 * Authentication Module
 * 
 * This module centralizes all authentication and database-related functionality.
 * All auth and database functions should be imported from this module.
 */

// Export from firebase-init
export { 
  initializeFirebase, 
  getFirebaseServices,
  getFirebaseAuth,
  isExtensionContextValid,
  app,
  auth,
  firestore,
  storage
} from './firebase-init';

// Export from auth-manager
export {
  initializeAuth,
  signInWithEmail,
  signInWithGoogle,
  signInWithGithub,
  signOut,
  createUser,
  resetPassword,
  updateUserProfile,
  isAuthenticated,
  getCurrentUser,
  getUserIdToken,
  verifyTokenAndRefresh,
  addAuthStateListener,
  removeAuthStateListener
} from './auth-manager';

// Export from database-service
export {
  getFirestore,
  getDocument,
  saveDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  listenToDocument,
  listenToCollection
} from './database-service';

// Export React hook for authentication
export { default as useAuth } from './useAuth';

// Export default objects for convenience
export { default as databaseService } from './database-service';