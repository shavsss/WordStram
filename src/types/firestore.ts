/**
 * Type definitions for Firestore-specific data structures
 */

import { Timestamp, FieldValue } from 'firebase/firestore';

/**
 * Types of valid timestamp values that can come from Firestore
 */
export type FirestoreTimestampValue = 
  | Timestamp 
  | Date 
  | number 
  | string 
  | { seconds: number; nanoseconds: number }
  | { toDate: () => Date }
  | FieldValue
  | null
  | undefined;

/**
 * Type guard to check if a value is a Firestore Timestamp object
 */
export function isFirestoreTimestamp(value: any): value is Timestamp {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    typeof value.toDate === 'function'
  );
}

/**
 * Type guard to check if a value is a plain timestamp-like object
 */
export function isTimestampLike(value: any): value is { seconds: number; nanoseconds: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    typeof value.toDate !== 'function'
  );
}

/**
 * Safely converts any Firestore timestamp value to a Date
 */
export function toDate(value: FirestoreTimestampValue): Date | null {
  if (!value) return null;

  try {
    // Firestore Timestamp
    if (isFirestoreTimestamp(value)) {
      return value.toDate();
    }

    // Plain object with seconds and nanoseconds
    if (isTimestampLike(value)) {
      return new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
    }

    // Object with toDate method
    if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
      return (value as any).toDate();
    }

    // Date object
    if (value instanceof Date) {
      return value;
    }

    // Number (timestamp)
    if (typeof value === 'number') {
      // Assume seconds if it's a small number (unix timestamp)
      if (value < 20000000000) {
        return new Date(value * 1000);
      }
      return new Date(value);
    }

    // String (ISO date)
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // FieldValue and other unsupported types
    return null;
  } catch (error) {
    console.warn('Failed to convert Firestore timestamp value to Date:', error);
    return null;
  }
}

/**
 * Generic document interface with common Firestore fields
 */
export interface FirestoreDocument {
  id: string;
  createdAt?: FirestoreTimestampValue;
  updatedAt?: FirestoreTimestampValue;
}

/**
 * User document structure in Firestore
 */
export interface UserDocument extends FirestoreDocument {
  email: string;
  displayName?: string;
  photoURL?: string;
  lastLogin?: FirestoreTimestampValue;
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notifications?: boolean;
  };
} 