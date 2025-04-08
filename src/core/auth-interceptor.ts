/**
 * Auth Interceptor - Manages authentication state globally
 * Provides utilities to ensure token refresh and proper error handling
 */

import AuthManager from '@/core/auth-manager';
import { processDateFields, handleFirestoreTimestamp } from '@/utils/date-utils';

/**
 * Max number of retry attempts for authentication operations
 */
const MAX_AUTH_RETRIES = 2;

/**
 * Global authentication interceptor
 */
const AuthInterceptor = {
  /**
   * Execute a function with authentication safeguards
   * Will try to refresh token if a permission error occurs
   * 
   * @param operation Function to execute with authentication handling
   * @param defaultValue Fallback value to return in case of failure
   * @returns The result of the operation or the default value
   */
  async executeWithAuth<T>(
    operation: () => Promise<T>,
    defaultValue: T
  ): Promise<T> {
    let retries = 0;
    
    // First, ensure we have a valid token
    try {
      await AuthManager.verifyTokenAndRefresh();
    } catch (error) {
      console.warn('WordStream AuthInterceptor: Token refresh failed:', error);
      // Continue anyway, the operation might still work
    }
    
    const executeWithRetry = async (): Promise<T> => {
      try {
        return await operation();
      } catch (error: any) {
        console.warn('WordStream AuthInterceptor: Operation failed:', error?.message || error);
        
        // Check if it's a permission error that can be retried
        if (
          retries < MAX_AUTH_RETRIES && 
          (error?.code === 'permission-denied' || error?.name === 'FirebaseError')
        ) {
          retries++;
          console.log(`WordStream AuthInterceptor: Retry attempt ${retries}/${MAX_AUTH_RETRIES}`);
          
          // Try to refresh the token before retrying
          const refreshed = await AuthManager.verifyTokenAndRefresh();
          if (!refreshed) {
            console.warn('WordStream AuthInterceptor: Token refresh failed on retry');
            return defaultValue;
          }
          
          // Retry the operation
          return executeWithRetry();
        }
        
        // If we've exhausted retries or it's not a permission error, return default
        return defaultValue;
      }
    };
    
    return executeWithRetry();
  },
  
  /**
   * Process response data, handling date fields and other common data transformations
   * 
   * @param data The data to process
   * @param dateFields Array of field names to process as dates
   * @returns Processed data
   */
  processResponse<T>(data: T[], dateFields: string[] = []): T[] {
    if (!Array.isArray(data)) {
      console.warn('WordStream AuthInterceptor: processResponse received non-array data:', 
        typeof data === 'object' ? JSON.stringify(data).substring(0, 100) + '...' : data);
      return Array.isArray(data) ? data : [];
    }
    
    // Helper function to safely process a single item
    const processSingleItem = (item: any): any => {
      if (!item) return item;
      
      try {
        const result = { ...item } as Record<string, any>;
        
        // Process date fields more safely
        dateFields.forEach(field => {
          // Support nested paths like 'metadata.created'
          if (field.includes('.')) {
            const parts = field.split('.');
            let current = result;
            const lastPart = parts.pop();
            
            // Navigate to the nested object
            for (const part of parts) {
              if (part in current && current[part] !== null && typeof current[part] === 'object') {
                current = current[part];
              } else {
                // If path doesn't exist, skip this field
                return;
              }
            }
            
            // Process the actual date field if it exists
            if (lastPart && lastPart in current) {
              try {
                current[lastPart] = handleFirestoreTimestamp(current[lastPart]);
              } catch (err) {
                console.warn(`WordStream: Error processing nested date field "${field}":`, err);
                // Leave as is if we can't process
              }
            }
          } 
          // Handle simple fields
          else if (field in result) {
            try {
              result[field] = handleFirestoreTimestamp(result[field]);
            } catch (err) {
              console.warn(`WordStream: Error processing date field "${field}":`, err);
              
              // If the value is literally [object Object], replace with current date
              if (String(result[field]) === '[object Object]') {
                console.warn(`WordStream: Replacing invalid [object Object] in ${field} with current date`);
                result[field] = new Date();
              }
              // Otherwise leave as is
            }
          }
        });
        
        return result;
      } catch (itemError) {
        console.warn('WordStream: Error processing item in response:', itemError);
        return item; // Return original if processing fails
      }
    };
    
    // Process all items with better error handling
    try {
      return data.map(item => {
        try {
          return processSingleItem(item) as T;
        } catch (err) {
          console.warn('WordStream: Error processing individual item:', err);
          return item;
        }
      });
    } catch (error) {
      console.warn('WordStream AuthInterceptor: Error in processResponse:', error);
      return data; // Return original data if processing fails
    }
  },

  /**
   * Handle a Firestore error and convert it to a user-friendly message
   * 
   * @param error The error from Firestore
   * @returns User-friendly error message
   */
  handleFirestoreError(error: any): string {
    // Default generic message
    let message = 'An error occurred while accessing the database.';
    
    try {
      if (error) {
        // Check for Firebase error code
        if (error.code) {
          switch (error.code) {
            case 'permission-denied':
              message = 'You do not have permission to access this data. Please sign in again.';
              break;
            case 'unauthenticated':
              message = 'Your session has expired. Please sign in again.';
              break;
            case 'not-found':
              message = 'The requested data could not be found.';
              break;
            case 'unavailable':
              message = 'The service is currently unavailable. Please try again later.';
              break;
            case 'resource-exhausted':
              message = 'You have exceeded the rate limit. Please try again later.';
              break;
            case 'cancelled':
              message = 'The operation was cancelled.';
              break;
            default:
              message = `Database error: ${error.code}`;
          }
        } else if (error.message) {
          message = error.message;
        }
      }
    } catch (err) {
      console.warn('WordStream: Error processing Firestore error:', err);
    }
    
    return message;
  }
};

export default AuthInterceptor; 