import { format } from 'date-fns';

/**
 * פונקציית עזר להמרת מחרוזת תאריך לאובייקט Date
 */
export function parseDate(dateString: string): Date | null {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * פונקציית עזר לפורמט תאריך לקלט
 */
export function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  try {
    return format(date, "yyyy-MM-dd");
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Helper function to wait for Chrome API to be available
 * @param retries - Number of retry attempts
 * @returns Promise resolving to boolean indicating if Chrome API is available
 */
export async function waitForChromeAPI(retries = 5): Promise<boolean> {
  const RETRY_DELAY = 1000;
  
  for (let i = 0; i < retries; i++) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.sync) {
      return true;
    }
    console.log(`WordStream: Waiting for Chrome API (attempt ${i + 1}/${retries})...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  return false;
} 