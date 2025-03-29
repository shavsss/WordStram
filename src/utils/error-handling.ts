/**
 * המרה בטוחה של אובייקט שגיאה למחרוזת
 * Safely converts an error object to a string, handling various error types
 */
export function safeStringifyError(error: unknown): string {
  if (!error) return 'Unknown error';
  
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unserializable error';
  }
} 