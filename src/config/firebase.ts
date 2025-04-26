/**
 * Firebase configuration
 * The configuration is primarily loaded from environment variables for security.
 * In production, these should be set through the build process and not committed to source control.
 */

// Function to securely load Firebase config
function getFirebaseConfig() {
  // Config keys are derived from environment variables in production builds
  return {
    apiKey: process.env.FIREBASE_API_KEY || 
      (process.env.NODE_ENV === 'production' ? '' : "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4"),
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "vidlearn-ai.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "vidlearn-ai",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "vidlearn-ai.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1097713470067",
    appId: process.env.FIREBASE_APP_ID || "1:1097713470067:web:821f08db03951f83363806",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-PQDV30TTX1"
  };
}

// Export the config, not the raw values
export const FIREBASE_CONFIG = getFirebaseConfig();

// Export OAuth client ID separately for authentication flows
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 
  (process.env.NODE_ENV === 'production' ? '' : "1097713470067-4o18jnj4sgujpu4f9o4kogen53e2bknj.apps.googleusercontent.com"); 