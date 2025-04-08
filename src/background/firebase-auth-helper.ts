/**
 * Firebase Authentication Helper for Background Script
 */
import { 
  getAuth, 
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
  Auth,
  getIdToken
} from 'firebase/auth';
import { FirebaseApp } from 'firebase/app';

// Keep a reference to auth
let auth: Auth | null = null;

// Token refresh interval
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize Firebase Auth and set up token refresh
 */
export async function initializeFirebaseAuth(app: FirebaseApp): Promise<Auth> {
  try {
    console.log('WordStream: Initializing Firebase Auth in background');
    
    // Get Auth instance
    auth = getAuth(app);
    
    // Configure persistence
    await setPersistence(auth, browserLocalPersistence);
    console.log('WordStream: Auth persistence set to browserLocalPersistence');
    
    // Set up auth state listener
    setupAuthStateListener();
    
    // Set up token refresh
    setupTokenRefresh();
    
    return auth;
  } catch (error) {
    console.error('WordStream: Error initializing Firebase Auth:', error);
    throw error;
  }
}

/**
 * Set up authentication state listener
 */
function setupAuthStateListener(): void {
  if (!auth) {
    console.error('WordStream: Cannot set up auth listener - auth not initialized');
    return;
  }
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('WordStream: User authenticated:', user.email);
      
      // Save minimal user info to storage
      await saveUserInfoToStorage(user);
      
      // Ensure token refresh is set up
      setupTokenRefresh();
      
      // Notify all tabs about authentication
      broadcastAuthState(true, getUserInfo(user));
    } else {
      console.log('WordStream: User logged out');
      
      // Clear user info from storage
      await clearUserInfoFromStorage();
      
      // Clear token refresh
      clearTokenRefresh();
      
      // Notify all tabs
      broadcastAuthState(false, null);
    }
  });
}

/**
 * Set up token refresh on regular intervals 
 */
function setupTokenRefresh(): void {
  if (!auth || !auth.currentUser) {
    console.log('WordStream: Not setting up token refresh - no authenticated user');
    return;
  }
  
  // Clear any existing interval
  clearTokenRefresh();
  
  // Set up new interval - refresh token every 50 minutes (before 60 minute expiration)
  tokenRefreshInterval = setInterval(async () => {
    try {
      if (auth && auth.currentUser) {
        // Force token refresh
        const token = await getIdToken(auth.currentUser, true);
        console.log('WordStream: Token refreshed successfully');
        
        // Update token timestamp in storage
        await chrome.storage.local.set({
          'wordstream_token_refresh_time': Date.now()
        });
        
        // Notify tabs that token has been refreshed
        broadcastTokenRefresh(token);
      } else {
        console.log('WordStream: Token refresh skipped - no user');
        clearTokenRefresh();
      }
    } catch (error) {
      console.error('WordStream: Token refresh failed:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes
  
  console.log('WordStream: Token refresh timer set up');
}

/**
 * Clear token refresh interval
 */
function clearTokenRefresh(): void {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log('WordStream: Token refresh timer cleared');
  }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth ? auth.currentUser : null;
}

/**
 * Check if a user is authenticated
 */
export function isUserAuthenticated(): boolean {
  return !!(auth && auth.currentUser);
}

/**
 * Get a clean user info object without sensitive data
 */
function getUserInfo(user: User): Record<string, any> {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    emailVerified: user.emailVerified
  };
}

/**
 * Save user info to storage
 */
async function saveUserInfoToStorage(user: User): Promise<void> {
  try {
    const userInfo = getUserInfo(user);
    
    await chrome.storage.local.set({
      'wordstream_auth_state': 'authenticated',
      'wordstream_user_info': userInfo,
      'wordstream_auth_timestamp': Date.now()
    });
    
    console.log('WordStream: User info saved to storage');
  } catch (error) {
    console.error('WordStream: Failed to save user info to storage:', error);
  }
}

/**
 * Clear user info from storage
 */
async function clearUserInfoFromStorage(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      'wordstream_auth_state',
      'wordstream_user_info',
      'wordstream_auth_timestamp',
      'wordstream_token_refresh_time'
    ]);
    
    console.log('WordStream: User info cleared from storage');
  } catch (error) {
    console.error('WordStream: Failed to clear user info from storage:', error);
  }
}

/**
 * Broadcast authentication state change to all tabs
 */
async function broadcastAuthState(isAuthenticated: boolean, userInfo: Record<string, any> | null): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'AUTH_STATE_CHANGED',
            isAuthenticated,
            userInfo
          }).catch(() => {
            // Ignore errors for tabs that don't have listeners
          });
        } catch (error) {
          // Ignore errors for individual tabs
        }
      }
    }
    
    console.log(`WordStream: Auth state broadcast to ${tabs.length} tabs`);
  } catch (error) {
    console.error('WordStream: Failed to broadcast auth state:', error);
  }
}

/**
 * Broadcast token refresh to all tabs
 */
async function broadcastTokenRefresh(token: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'TOKEN_REFRESHED',
            timestamp: Date.now()
          }).catch(() => {
            // Ignore errors for tabs that don't have listeners
          });
        } catch (error) {
          // Ignore errors for individual tabs
        }
      }
    }
    
    console.log(`WordStream: Token refresh broadcast to ${tabs.length} tabs`);
  } catch (error) {
    console.error('WordStream: Failed to broadcast token refresh:', error);
  }
}

/**
 * Manually trigger a token refresh
 * Useful when errors occur suggesting token expiration
 */
export async function triggerTokenRefresh(): Promise<boolean> {
  try {
    console.log('WordStream: Starting aggressive token refresh');
    
    // Step 1: Try standard refresh if user is already authenticated
    if (auth && auth.currentUser) {
      try {
        // Force token refresh
        const token = await getIdToken(auth.currentUser, true);
        console.log('WordStream: Standard token refresh successful');
        
        // Update timestamp
        await chrome.storage.local.set({
          'wordstream_token_refresh_time': Date.now()
        });
        
        return true;
      } catch (refreshError) {
        console.warn('WordStream: Standard refresh failed, trying recovery methods:', refreshError);
        // Continue to recovery methods
      }
    } else {
      console.warn('WordStream: No authenticated user for standard refresh');
    }
    
    // Step 2: Try to recover from storage and force re-authentication
    console.log('WordStream: Attempting auth recovery from storage');
    
    try {
      // Get stored user info
      const userInfoResult = await chrome.storage.local.get([
        'wordstream_user_info', 
        'wordstream_auth_state'
      ]);
      
      const userInfo = userInfoResult.wordstream_user_info;
      const authState = userInfoResult.wordstream_auth_state;
      
      if (authState === 'authenticated' && userInfo && userInfo.uid) {
        console.log('WordStream: Found stored user info, attempting reauth');
        
        // Step 3: Force a new authentication instance - ליצור מופע auth חדש במקום להשתמש בגלובלי
        try {
          // Re-initialize the auth context
          const localAuth = getAuth();
            
          if (typeof localAuth.updateCurrentUser === 'function') {
            // Set persistence directly on the local instance
            await setPersistence(localAuth, browserLocalPersistence);
              
            // We succeeded at least in re-configuring auth
            console.log('WordStream: Auth instance refreshed');
            
            // Wait for auth state change
            await new Promise<void>(resolve => {
              // Set up a temporary listener
              const unsubscribe = onAuthStateChanged(localAuth, (user) => {
                if (user) {
                  console.log('WordStream: Auth state restored');
                  unsubscribe();
                  resolve();
                }
              });
              
              // Set a timeout in case auth state doesn't change
              setTimeout(() => {
                unsubscribe();
                resolve();
              }, 2000);
            });
            
            // Wait a moment for Firebase to stabilize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if we now have a user
            if (localAuth.currentUser) {
              try {
                // Force token refresh one more time
                await getIdToken(localAuth.currentUser, true);
                console.log('WordStream: Recovery successful, token refreshed');
                
                // Update our global auth reference with the new one
                auth = localAuth;
                
                // Update timestamp
                await chrome.storage.local.set({
                  'wordstream_token_refresh_time': Date.now()
                });
                
                return true;
              } catch (finalRefreshError) {
                console.error('WordStream: Final token refresh failed:', finalRefreshError);
              }
            }
          }
        } catch (authUpdateError) {
          console.error('WordStream: Auth update failed:', authUpdateError);
        }
        
        // Step 4: As a desperate measure, reset authentication and let user re-authenticate
        console.warn('WordStream: Recovery failed, requiring manual re-authentication');
        
        // Reset auth state but keep user info to help with re-auth
        await chrome.storage.local.set({
          'wordstream_auth_state': 'requires_reauth',
          'wordstream_last_auth_error': {
            message: 'Session expired, please re-authenticate',
            timestamp: Date.now()
          }
        });
        
        // Broadcast that re-auth is required
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'AUTH_RELOGIN_REQUIRED',
                reason: 'token_refresh_failed',
                timestamp: Date.now()
              }).catch(() => {
                // Ignore errors for inactive tabs
              });
            }
          }
        } catch (broadcastError) {
          console.error('WordStream: Error broadcasting reauth requirement:', broadcastError);
        }
      } else {
        console.warn('WordStream: No valid stored auth data for recovery');
      }
    } catch (storageError) {
      console.error('WordStream: Error accessing stored auth data:', storageError);
    }
    
    // If we got here, all recovery methods failed
    return false;
  } catch (error) {
    console.error('WordStream: Critical error in token refresh:', error);
    return false;
  }
} 