import { useEffect, useRef, useState, useCallback } from 'react';
import { syncAllData } from '@/services/firebase-sync';

interface UseBackgroundSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  onSyncStart?: () => void;
  onSyncComplete?: (success: boolean) => void;
  onSyncError?: (error: unknown) => void;
}

/**
 * Hook for background synchronization with Firebase
 * Automatically syncs data at regular intervals when enabled
 */
export function useBackgroundSync({
  enabled = true,
  intervalMs = 5 * 60 * 1000, // Default: 5 minutes
  onSyncStart,
  onSyncComplete,
  onSyncError
}: UseBackgroundSyncOptions = {}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<boolean | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Function to perform sync
  const sync = useCallback(async () => {
    if (isSyncing) return false; // Prevent multiple concurrent syncs
    
    try {
      setIsSyncing(true);
      onSyncStart?.();
      
      console.log('WordStream: Starting background sync');
      await syncAllData();
      
      // נניח שהסינכרון הצליח אם לא נזרקה שגיאה
      const success = true;
      
      setLastSyncStatus(success);
      setLastSyncTime(new Date());
      onSyncComplete?.(success);
      
      return success;
    } catch (error) {
      console.error('WordStream: Background sync error', error);
      setLastSyncStatus(false);
      onSyncError?.(error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onSyncStart, onSyncComplete, onSyncError]);

  // Force an immediate sync
  const forceSync = useCallback(async () => {
    return await sync();
  }, [sync]);

  // Setup and cleanup interval
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Set up new interval if enabled
    if (enabled) {
      // Run an initial sync
      sync();
      
      // Setup periodic sync
      intervalRef.current = window.setInterval(sync, intervalMs);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, sync]);

  // Add listener for online status to trigger sync when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      console.log('WordStream: Network connection restored, triggering sync');
      sync();
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [sync]);

  return {
    isSyncing,
    lastSyncTime,
    lastSyncStatus,
    forceSync
  };
} 