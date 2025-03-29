import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import * as AuthService from '@/firebase/auth';
import * as FirestoreService from '@/firebase/firestore';

interface AuthState {
  user: User | null;
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
 * Custom hook to manage authentication state
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null
  });

  // Monitor auth state
  useEffect(() => {
    console.log('WordStream: Setting up auth state listener');
    
    const unsubscribe = AuthService.subscribeToAuthChanges((user) => {
      setAuthState(prev => ({
        ...prev,
        user,
        isLoading: false
      }));
      
      console.log('WordStream: Auth state changed:', user ? `User ${user.displayName || user.email}` : 'No user');
      
      // Notify background script about auth state change
      try {
        chrome.runtime.sendMessage({
          action: 'AUTH_STATE_UPDATED',
          isAuthenticated: !!user
        }).catch(err => {
          // It's OK if this fails, the background script itself is also listening to auth changes
          console.log('WordStream: Could not notify background about auth change:', err);
        });
      } catch (error) {
        console.error('WordStream: Error notifying about auth change:', error);
      }
      
      // Initialize Firestore collections when user logs in
      if (user) {
        // Initialize Firestore collections
        FirestoreService.initializeFirestoreCollections()
          .then(() => {
            // Sync local storage data to Firestore if this is the first login
            syncLocalDataToFirestore(user.uid);
          })
          .catch(err => {
            console.error('WordStream: Error initializing Firestore collections:', err);
          });
      }
    });
    
    // Check for current user on mount
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setAuthState(prev => ({
        ...prev,
        user: currentUser,
        isLoading: false
      }));
      
      // Initialize Firestore collections for existing user
      FirestoreService.initializeFirestoreCollections()
        .then(() => {
          // Try to sync on mount too
          syncLocalDataToFirestore(currentUser.uid);
        })
        .catch(err => {
          console.error('WordStream: Error initializing Firestore collections:', err);
        });
    } else {
      // If no current user, stop loading
      setAuthState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
    
    return () => {
      console.log('WordStream: Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);
  
  // Function to sync data from local storage to Firestore
  const syncLocalDataToFirestore = async (userId: string) => {
    try {
      console.log('WordStream: Syncing local data to Firestore');
      
      // Get all data from local storage
      chrome.storage.local.get(null, async (items) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error getting local storage data:', chrome.runtime.lastError);
          return;
        }
        
        // Check for chats data
        if (items.chats_storage) {
          console.log('WordStream: Found local chats, syncing to Firestore');
          const chatsStorage = items.chats_storage;
          
          // For each chat, save to Firestore
          for (const chatId in chatsStorage) {
            const chat = chatsStorage[chatId];
            try {
              await FirestoreService.saveChat({
                conversationId: chat.conversationId,
                videoId: chat.videoId,
                videoTitle: chat.videoTitle,
                videoURL: chat.videoURL,
                messages: chat.messages
              });
            } catch (error) {
              console.error(`WordStream: Error saving chat ${chatId} to Firestore:`, error);
            }
          }
        }
        
        // Check for words data in new grouped format
        try {
          if (items.words_metadata && items.words_groups && Array.isArray(items.words_groups)) {
            console.log('WordStream: Found words metadata, syncing words to Firestore');
            
            // Fetch all word groups
            chrome.storage.sync.get(items.words_groups, async (groupsResult) => {
              if (chrome.runtime.lastError) {
                console.error('WordStream: Error getting word groups:', chrome.runtime.lastError);
                return;
              }
              
              // Combine all groups into one array
              const allWords = [];
              for (const groupKey of items.words_groups) {
                if (groupsResult[groupKey] && Array.isArray(groupsResult[groupKey])) {
                  allWords.push(...groupsResult[groupKey]);
                }
              }
              
              if (allWords.length > 0) {
                console.log(`WordStream: Syncing ${allWords.length} words to Firestore`);
                await FirestoreService.saveWords(allWords);
              }
            });
          } 
          // Check for words data in old format
          else if (items.words && Array.isArray(items.words)) {
            console.log('WordStream: Found words in old format, syncing to Firestore');
            await FirestoreService.saveWords(items.words);
          }
        } catch (wordError) {
          console.error('WordStream: Error syncing words to Firestore:', wordError);
        }
        
        console.log('WordStream: Local data sync to Firestore completed');
      });
    } catch (error) {
      console.error('WordStream: Error in syncLocalDataToFirestore:', error);
    }
  };

  /**
   * Register with email and password
   */
  const register = async (email: string, password: string, userData?: UserData): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await AuthService.registerWithEmail(email, password, userData);
      return true;
    } catch (error: any) {
      let errorMessage = 'Registration failed';
      
      // Format Firebase error message
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage
      }));
      return false;
    }
  };
  
  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await AuthService.signInWithEmail(email, password);
      return true;
    } catch (error: any) {
      let errorMessage = 'Sign in failed';
      
      // Format Firebase error message
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage
      }));
      return false;
    }
  };
  
  /**
   * Sign out
   */
  const signOut = async (): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await AuthService.logOut();
      setAuthState({ 
        user: null, 
        isLoading: false, 
        error: null
      });
    } catch (error: any) {
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || 'Sign out failed'
      }));
    }
  };
  
  /**
   * Reset password
   */
  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await AuthService.resetPassword(email);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return true;
    } catch (error: any) {
      let errorMessage = 'Password reset failed';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage
      }));
      return false;
    }
  };

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    error: authState.error,
    isAuthenticated: !!authState.user,
    register,
    signInWithEmail,
    signOut,
    resetPassword
  };
} 