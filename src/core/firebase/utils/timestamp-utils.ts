/**
 * Utility functions for handling timestamps in Firestore
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Safely handle Firestore timestamps by converting them to dates
 * @param timestamp The timestamp to convert
 * @returns A JavaScript Date object or undefined if timestamp is invalid
 */
export function handleFirestoreTimestamp(timestamp: any): Date | undefined {
  try {
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle ISO strings
    if (timestamp && typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    // Handle numeric timestamps (milliseconds since epoch)
    if (timestamp && typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    return undefined;
  } catch (error) {
    console.error('Error handling Firestore timestamp:', error);
    return undefined;
  }
}

/**
 * Convert a Date, timestamp, or string to a Firestore Timestamp
 * @param date Date, timestamp in milliseconds, or ISO string
 * @returns Firestore Timestamp or null
 */
export function toFirestoreTimestamp(date: Date | number | string | null | undefined): Timestamp | null {
  if (!date) return null;
  
  try {
    // Handle Date objects
    if (date instanceof Date) {
      return Timestamp.fromDate(date);
    }
    
    // Handle numeric timestamps
    if (typeof date === 'number') {
      return Timestamp.fromMillis(date);
    }
    
    // Handle ISO strings
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error converting to Firestore timestamp:', error);
    return null;
  }
}

/**
 * Format a timestamp in seconds to video time format (HH:MM:SS)
 * @param seconds Time in seconds
 * @returns Formatted time string
 */
export function formatVideoTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');
  
  if (hrs > 0) {
    const formattedHrs = String(hrs).padStart(2, '0');
    return `${formattedHrs}:${formattedMins}:${formattedSecs}`;
  }
  
  return `${formattedMins}:${formattedSecs}`;
} 