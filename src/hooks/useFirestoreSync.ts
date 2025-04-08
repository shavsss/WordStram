/**
 * useFirestoreSync hook
 * Manages synchronization with Firestore
 */

import { useState, useEffect } from 'react';
import { 
  initializeDataSync, 
  setupNetworkListeners, 
  processPendingOperations
} from '../core/firebase';
import { checkFirestoreConnection } from '../core/firebase/utils/connection-utils';
import { getCurrentUser } from '../core/firebase/auth/auth-service';

/**
 * Hook for managing Firestore synchronization
 */
export function useFirestoreSync() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const setupSync = async () => {
      try {
        // Check connection
        const isConnected = await checkFirestoreConnection();
        
        if (!isMounted) return;
        
        if (!isConnected) {
          setError('Failed to connect to Firestore');
          setIsLoading(false);
          return;
        }
        
        // Get user ID
        const user = getCurrentUser();
        if (!user) {
          setError('No authenticated user');
          setIsLoading(false);
          return;
        }
        
        // Store user ID
        setUserId(user.uid);
        
        // Initialize sync
        await initializeDataSync();
        
        // Setup network listeners
        setupNetworkListeners();
        
        // Set online status
        setIsOnline(navigator.onLine);
        
        // Process any pending operations
        if (navigator.onLine) {
          setIsSyncing(true);
          await processPendingOperations();
          if (isMounted) setIsSyncing(false);
        }
        
        if (isMounted) setIsLoading(false);
      } catch (err) {
        console.error('Error setting up Firestore sync:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };
    
    // Handle online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      
      // Process pending operations when we come back online
      const syncPending = async () => {
        setIsSyncing(true);
        await processPendingOperations();
        if (isMounted) setIsSyncing(false);
      };
      
      syncPending();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    // Set up online/offline event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize sync
    setupSync();
    
    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return {
    isLoading,
    isSyncing,
    isOnline,
    error,
    userId
  };
} 