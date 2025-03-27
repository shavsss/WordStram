/**
 * Simple logger for Firebase-related operations
 */
export const logger = {
  log: (...args: any[]) => {
    try {
      console.log('[WordStream:Firebase]', ...args);
    } catch (e) {
      // Ignore logging errors
    }
  },
  error: (...args: any[]) => {
    try {
      console.error('[WordStream:Firebase]', ...args);
    } catch (e) {
      // Ignore logging errors
    }
  },
  warn: (...args: any[]) => {
    try {
      console.warn('[WordStream:Firebase]', ...args);
    } catch (e) {
      // Ignore logging errors
    }
  },
  info: (...args: any[]) => {
    try {
      console.info('[WordStream:Firebase]', ...args);
    } catch (e) {
      // Ignore logging errors
    }
  }
}; 