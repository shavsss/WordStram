import { User } from '../shared/types';
import { GOOGLE_CLIENT_ID } from '../shared/constants';

// Mock user storage for email/password authentication
// In a real application, you would use a more secure storage method
const USERS_STORAGE_KEY = 'wordstram_users';

interface StoredUser {
  email: string;
  password: string; // In a real app, this should be hashed
  displayName: string;
  photoURL?: string;
}

// Interface for authentication service responses
interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Authenticate a user with Google using chrome.identity API
 */
export async function signInWithGoogle(): Promise<AuthResponse> {
  try {
    // Check if chrome.identity is available
    if (!chrome.identity) {
      return {
        success: false,
        error: 'Chrome identity API not available'
      };
    }

    // Launch the auth flow to get the user's Google profile
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&scope=openid%20email%20profile`;
    
    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (responseUrl) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message || 'Authentication failed'
            });
            return;
          }

          if (!responseUrl) {
            resolve({
              success: false,
              error: 'Authentication failed - no response URL'
            });
            return;
          }

          // Parse the access token from the response URL
          const accessToken = new URLSearchParams(new URL(responseUrl).hash.substring(1)).get('access_token');
          
          if (!accessToken) {
            resolve({
              success: false,
              error: 'Failed to get access token'
            });
            return;
          }

          try {
            // Get user info with the access token
            const response = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              }
            );

            if (!response.ok) {
              throw new Error('Failed to fetch user info');
            }

            const data = await response.json();
            
            // Create user object
            const user: User = {
              uid: data.sub,
              email: data.email,
              displayName: data.name,
              photoURL: data.picture,
              providerId: 'google.com'
            };

            // Save the user in storage for persistence
            await saveUserSession(user);

            resolve({
              success: true,
              user
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error fetching user data'
            });
          }
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Google authentication'
    };
  }
}

/**
 * Sign in a user with email and password
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<AuthResponse> {
  try {
    // Get stored users
    const users = await getStoredUsers();
    
    // Find the user with the provided email
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    // Check if password matches
    if (user.password !== password) {
      return {
        success: false,
        error: 'Invalid password'
      };
    }
    
    // Create and return user object
    const authUser: User = {
      uid: btoa(user.email), // Use base64 encoded email as uid
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      providerId: 'password'
    };
    
    // Save user session
    await saveUserSession(authUser);
    
    return {
      success: true,
      user: authUser
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during email/password authentication'
    };
  }
}

/**
 * Create a new user with email and password
 */
export async function createUserWithEmailPassword(
  email: string, 
  password: string,
  displayName: string
): Promise<AuthResponse> {
  try {
    // Get stored users
    const users = await getStoredUsers();
    
    // Check if a user with this email already exists
    if (users.some(u => u.email === email)) {
      return {
        success: false,
        error: 'User with this email already exists'
      };
    }
    
    // Create new user
    const newUser: StoredUser = {
      email,
      password, // In a real app, this should be securely hashed
      displayName
    };
    
    // Add to stored users
    users.push(newUser);
    await saveStoredUsers(users);
    
    // Create and return user object
    const authUser: User = {
      uid: btoa(email), // Use base64 encoded email as uid
      email,
      displayName,
      providerId: 'password'
    };
    
    // Save user session
    await saveUserSession(authUser);
    
    return {
      success: true,
      user: authUser
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during user creation'
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    await clearUserSession();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

/**
 * Get the current authenticated user, if any
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await getUserSession();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Save the user session in chrome.storage.local
 */
async function saveUserSession(user: User): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ currentUser: user }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get the user session from chrome.storage.local
 */
async function getUserSession(): Promise<User | null> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('currentUser', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.currentUser || null);
      }
    });
  });
}

/**
 * Clear the user session from chrome.storage.local
 */
async function clearUserSession(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove('currentUser', () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get stored users from chrome.storage.local
 */
async function getStoredUsers(): Promise<StoredUser[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(USERS_STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[USERS_STORAGE_KEY] || []);
      }
    });
  });
}

/**
 * Save stored users to chrome.storage.local
 */
async function saveStoredUsers(users: StoredUser[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [USERS_STORAGE_KEY]: users }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
} 