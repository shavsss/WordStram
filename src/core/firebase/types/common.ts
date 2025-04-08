/**
 * Common Types
 * Defines shared interfaces and types used across the Firebase module
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Connection status response
 */
export interface ConnectionStatus {
  online: boolean;
  authenticated: boolean;
  error?: string;
}

/**
 * Broadcast message interface
 */
export interface BroadcastMessage {
  action: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Firestore document with ID
 */
export interface FirestoreDocument {
  id: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  userId?: string;
  [key: string]: any;
}

/**
 * Pending operation interface
 */
export interface PendingOperation {
  type: string;
  data: any;
  timestamp: number;
}

/**
 * Sync state structure
 */
export interface SyncState {
  initialized: boolean;
  unsubscribeFunctions: Array<() => void>;
  pendingOperations: PendingOperation[];
} 