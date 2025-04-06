/**
 * Firebase Error Messages
 * Translates Firebase authentication error codes to user-friendly messages
 */

interface ErrorMap {
  [key: string]: string;
}

/**
 * Maps Firebase authentication error codes to user-friendly messages
 */
const authErrorMessages: ErrorMap = {
  // Email/password authentication errors
  'auth/email-already-in-use': 'This email is already registered. Please try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support for assistance.',
  'auth/user-not-found': 'We couldn\'t find an account with this email. Please check your email or sign up.',
  'auth/wrong-password': 'The password you entered is incorrect. Please try again or reset your password.',
  'auth/too-many-requests': 'Too many unsuccessful attempts. Please try again later or reset your password.',
  'auth/weak-password': 'Your password isn\'t strong enough. Please create a stronger password.',
  'auth/requires-recent-login': 'For security reasons, please sign in again before making this change.',
  'auth/invalid-credential': 'Your login information appears to be incorrect. Please try again.',
  'auth/invalid-verification-code': 'The verification code you entered is invalid. Please try again.',
  'auth/invalid-verification-id': 'Your verification session has expired. Please try again.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email but with a different sign-in method.',
  
  // Google authentication errors
  'auth/popup-blocked': 'Sign-in popup was blocked by your browser. Please allow popups and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before completing. Please try again.',
  'auth/cancelled-popup-request': 'The authentication process was canceled. Please try again.',
  'auth/unauthorized-domain': 'This domain is not authorized for this authentication method.',
  
  // Configuration errors
  'auth/api-key-not-valid': 'There\'s an issue with the application configuration. Please contact support.',
  'auth/app-deleted': 'The authentication service is unavailable. Please try again later.',
  'auth/app-not-authorized': 'This application is not authorized to use Firebase authentication.',
  'auth/argument-error': 'There was an error with your request. Please try again.',
  'auth/invalid-api-key': 'The application is misconfigured. Please contact support for assistance.',
  'auth/invalid-tenant-id': 'Invalid authentication configuration. Please contact support.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this project.',
  'auth/project-not-found': 'The application is misconfigured. Please contact support for assistance.',
  
  // Network errors
  'auth/network-request-failed': 'A network error occurred. Please check your internet connection and try again.',
  'auth/timeout': 'The operation timed out. Please try again.',
  'auth/web-storage-unsupported': 'Your browser does not support web storage or it\'s disabled. Please enable it or try a different browser.',
};

/**
 * Get a user-friendly error message from a Firebase error code
 * @param errorCode Firebase error code or message
 * @returns User-friendly error message
 */
export function getFriendlyAuthErrorMessage(errorCode: string): string {
  // Normalize error code - extract code part if it's a full error message
  let code = errorCode;
  
  // Handle Firebase errors which often come as "Firebase: Error (auth/error-code)"
  if (errorCode.includes('auth/')) {
    const match = errorCode.match(/auth\/[a-z-]+/);
    if (match) {
      code = match[0];
    }
  }
  
  // Return matching friendly message or a generic one
  return authErrorMessages[code] || 
    'Something went wrong with authentication. Please try again or contact support.';
}

/**
 * Process any error and return a user-friendly message
 * @param error Error object or message
 * @returns User-friendly error message
 */
export function processAuthError(error: unknown): string {
  if (!error) {
    return 'An unknown error occurred';
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message || '';
    
    // Check for Firebase auth errors
    if (message.includes('Firebase') || message.includes('auth/')) {
      return getFriendlyAuthErrorMessage(message);
    }
    
    // Return the error message directly
    return message;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    if (error.includes('Firebase') || error.includes('auth/')) {
      return getFriendlyAuthErrorMessage(error);
    }
    return error;
  }
  
  // Handle unknown error types
  return 'An unexpected error occurred. Please try again.';
} 