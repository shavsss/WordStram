/**
 * Date utility functions
 */

/**
 * Safely parse a date string or timestamp to a Date object
 * Returns current date if parsing fails
 */
export function safeDate(date: string | number | Date | undefined | null): Date {
  if (!date) return new Date();
  
  try {
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);
    return new Date(date);
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date();
  }
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date | string | number): string {
  const safeDateTime = safeDate(date);
  
  return safeDateTime.toISOString().split('T')[0];
}

/**
 * Format a date as a readable string (e.g. "January 1, 2023")
 */
export function formatReadableDate(date: Date | string | number): string {
  const safeDateTime = safeDate(date);
  
  return safeDateTime.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get the time difference in a human-readable format (e.g. "2 hours ago")
 */
export function getTimeDifference(date: Date | string | number): string {
  const safeDateTime = safeDate(date);
  const now = new Date();
  const diffMs = now.getTime() - safeDateTime.getTime();
  
  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) {
    return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);
  
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to hours
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to days
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay < 30) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to months
  const diffMonth = Math.floor(diffDay / 30);
  
  if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to years
  const diffYear = Math.floor(diffMonth / 12);
  
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
} 