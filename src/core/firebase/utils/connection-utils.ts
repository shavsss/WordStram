/**
 * Connection Utilities
 * Contains helper functions for checking Firestore connectivity
 */

import { ensureAuthenticatedUser } from '../auth/auth-service';

/**
 * Check if the device is connected to the internet
 * @returns Boolean indicating online status
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Check connection to Firestore and authenticate user
 * @returns A promise with connection status
 */
export async function checkFirestoreConnection(): Promise<boolean> {
  // Check if we're online
  if (!isOnline()) {
    console.log('WordStream: Device is offline');
    return false;
  }

  // Check if we have an authenticated user
  const userId = await ensureAuthenticatedUser();
  if (!userId) {
    console.log('WordStream: No authenticated user');
    return false;
  }

  return true;
} 