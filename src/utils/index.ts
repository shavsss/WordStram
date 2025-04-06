import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utils index - Export all utility functions
 */

export * from './background-messaging';
// Add other utility exports as needed 