import { User } from 'firebase/auth';
import { auth } from '@/core/firebase/config';
import { getCurrentUser as getFirebaseCurrentUser } from '@/core/firebase/auth';
import {
  getDoc,
  doc,
  firestore,
  setDoc
} from '@/core/firebase/firestore';

// האובייקט המרכזי שינהל את האימות
const AuthManager = {
  /**
   * קבל את המשתמש הנוכחי מכל מקור אפשרי
   */
  getCurrentUser(): User | null {
    // 1. נסה להשיג מ-Firebase
    const firebaseUser = getFirebaseCurrentUser();
    if (firebaseUser) {
      this.updateAuthState(firebaseUser);
      return firebaseUser;
    }

    // 2. נסה להשיג מהאובייקט הגלובלי
    if (typeof window !== 'undefined' && window.WordStream?.currentUser) {
      return window.WordStream.currentUser as User;
    }

    // 3. נסה להשיג מאחסון מקומי (אסינכרוני, אבל מחזיר null בינתיים)
    this.checkStorageAuth();
    
    return null;
  },

  /**
   * בדוק אם המשתמש מאומת
   */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },

  /**
   * עדכן את מצב האימות בכל המקומות הרלוונטיים
   */
  updateAuthState(user: User | null): void {
    // עדכן את האובייקט הגלובלי
    if (typeof window !== 'undefined') {
      if (!window.WordStream) {
        window.WordStream = {};
      }
      
      if (user) {
        // שמור מידע מינימלי נדרש
        window.WordStream.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        window.WordStream.isAuthenticated = true;
      } else {
        window.WordStream.currentUser = undefined;
        window.WordStream.isAuthenticated = false;
      }
    }

    // שמור באחסון מקומי
    this.saveToStorage(user);
  },

  /**
   * שמור מידע אימות באחסון מקומי
   */
  saveToStorage(user: User | null): void {
    try {
      // שמור ב-localStorage
      if (typeof localStorage !== 'undefined') {
        if (user) {
          localStorage.setItem('wordstream_auth_state', 'authenticated');
          localStorage.setItem('wordstream_user_info', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          }));
        } else {
          localStorage.removeItem('wordstream_auth_state');
          localStorage.removeItem('wordstream_user_info');
        }
      }

      // שמור ב-chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const data = user ? {
          isAuthenticated: true,
          userInfo: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          },
          lastAuthCheck: new Date().toISOString()
        } : {
          isAuthenticated: false,
          userInfo: null,
          lastAuthCheck: new Date().toISOString()
        };

        chrome.storage.local.set(data);
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error saving auth state:', error);
    }
  },

  /**
   * בדוק אימות באחסון ועדכן את המצב הגלובלי אם נמצא
   */
  async checkStorageAuth(): Promise<User | null> {
    try {
      // נסה להשיג מ-chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await new Promise<{isAuthenticated?: boolean, userInfo?: any}>((resolve) => {
          chrome.storage.local.get(['isAuthenticated', 'userInfo'], (data) => {
            resolve(data);
          });
        });
        
        if (result.isAuthenticated && result.userInfo) {
          // עדכן את האובייקט הגלובלי
          if (typeof window !== 'undefined') {
            if (!window.WordStream) {
              window.WordStream = {};
            }
            window.WordStream.currentUser = result.userInfo;
            window.WordStream.isAuthenticated = true;
          }
          
          return result.userInfo as User;
        }
      }
      
      // נסה להשיג מ-localStorage
      if (typeof localStorage !== 'undefined') {
        const authState = localStorage.getItem('wordstream_auth_state');
        const userInfo = localStorage.getItem('wordstream_user_info');
        
        if (authState === 'authenticated' && userInfo) {
          const user = JSON.parse(userInfo);
          
          // עדכן את האובייקט הגלובלי
          if (typeof window !== 'undefined') {
            if (!window.WordStream) {
              window.WordStream = {};
            }
            window.WordStream.currentUser = user;
            window.WordStream.isAuthenticated = true;
          }
          
          return user as User;
        }
      }
    } catch (error) {
      console.warn('WordStream AuthManager: Error checking storage auth:', error);
    }
    
    return null;
  },

  /**
   * Verify token validity and refresh if needed
   * @returns Promise resolving to whether the token is valid
   */
  async verifyTokenAndRefresh(): Promise<boolean> {
    try {
      // Check if there's a current user
      const user = this.getCurrentUser();
      if (!user) {
        console.warn('WordStream AuthManager: No user to refresh token');
        return false;
      }

      // More aggressive approach - try to reload the user if possible
      if (auth.currentUser) {
        try {
          console.log('WordStream AuthManager: Reload existing user');
          await auth.currentUser.reload();
          
          // After reload, double-check currentUser still exists
          if (!auth.currentUser) {
            console.warn('WordStream AuthManager: User disappeared after reload');
            return false;
          }
        } catch (reloadError) {
          console.warn('WordStream AuthManager: Error reloading user:', reloadError);
          // Continue with token refresh attempt despite reload failure
        }
      } else {
        // Critical warning if no auth.currentUser
        console.warn('WordStream AuthManager: No Firebase auth.currentUser available for token refresh');
      }

      // Force token refresh and wait to ensure it propagates
      let token: string | undefined;
      
      // First try with currentUser (most reliable)
      if (auth.currentUser && typeof auth.currentUser.getIdToken === 'function') {
        try {
          console.log('WordStream AuthManager: Forcing token refresh via Firebase auth');
          token = await auth.currentUser.getIdToken(true);
        } catch (firebaseTokenError) {
          console.warn('WordStream AuthManager: Firebase token refresh failed:', firebaseTokenError);
          // Continue with backup method
        }
      }
      
      // Backup: try with our cached user object
      if (!token && typeof user.getIdToken === 'function') {
        try {
          console.log('WordStream AuthManager: Forcing token refresh via cached user');
          token = await user.getIdToken(true);
        } catch (userTokenError) {
          console.warn('WordStream AuthManager: Cached user token refresh failed:', userTokenError);
          return false;
        }
      }
      
      if (!token) {
        console.warn('WordStream AuthManager: Failed to obtain fresh token');
        return false;
      }
      
      // Wait longer for the token to propagate through Firebase systems
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update auth state with refreshed user
      const refreshedUser = auth.currentUser || user;
      this.updateAuthState(refreshedUser);
      
      console.log('WordStream AuthManager: Token refreshed successfully');
      return true;
    } catch (error) {
      console.warn('WordStream AuthManager: Token refresh failed:', error);
      return false;
    }
  },

  /**
   * Check user permissions for accessing Firestore data
   * @returns Promise resolving to whether the user has valid permissions
   */
  async checkPermissions(): Promise<boolean> {
    try {
      // בדוק אם המשתמש מחובר
      if (!this.isAuthenticated()) {
        console.warn('WordStream AuthManager: Cannot check permissions - user not authenticated');
        return false;
      }
      
      const user = this.getCurrentUser();
      if (!user || !user.uid) {
        console.warn('WordStream AuthManager: Cannot check permissions - no valid user ID');
        return false;
      }
      
      // נסה לבצע פעולת קריאה בסיסית מ-Firestore כבדיקת הרשאות
      try {
        console.log('WordStream AuthManager: Testing permissions with basic document read');
        // לרוב הרשאות קריאה לפרופיל המשתמש עצמו הן המינימליות ביותר
        await getUserProfileDocument();
        // אם הצלחנו לקרוא, יש לנו הרשאות תקינות
        console.log('WordStream AuthManager: Permissions check passed');
        return true;
      } catch (permError: any) {
        // אם נתקלנו בשגיאת הרשאות, ננסה לעדכן את הטוקן ולנסות שוב
        if (permError?.code === 'permission-denied') {
          console.warn('WordStream AuthManager: Permission denied, attempting aggressive token refresh');
          
          // נסה לאתחל מחדש את כל המשתמש
          try {
            // 1. נסה לרענן את הטוקן
            const tokenRefreshed = await this.verifyTokenAndRefresh();
            
            // 2. אם הצלחנו, נסה שוב
            if (tokenRefreshed) {
              try {
                await getUserProfileDocument();
                console.log('WordStream AuthManager: Permissions check passed after token refresh');
                return true;
              } catch (secondError) {
                console.warn('WordStream AuthManager: Still no permissions after token refresh');
              }
            }
          } catch (refreshError) {
            console.warn('WordStream AuthManager: Error during permissions retry:', refreshError);
          }
        }
        
        console.warn('WordStream AuthManager: Permission check failed:', permError?.code || permError);
        return false;
      }
    } catch (error: any) {
      console.warn('WordStream AuthManager: Error during permission check:', error);
      return false;
    }
  },

  /**
   * Try to reauthenticate automatically if needed
   * @returns Promise resolving to whether reauthentication was successful
   */
  async reauthenticateIfNeeded(): Promise<boolean> {
    try {
      console.log('WordStream: Starting reauthentication process');
      
      // Check if we have a user and if permissions are valid
      const initialPermissions = await this.checkPermissions();
      
      if (initialPermissions) {
        console.log('WordStream: User already has valid permissions');
        return true;
      }
      
      // Get the current user from all possible sources
      const user = this.getCurrentUser();
      if (!user) {
        console.warn('WordStream: No user found for reauthentication');
        return false;
      }
      
      console.log('WordStream: Found user for reauthentication:', user.uid);
      
      // Try multiple reauthentication strategies
      let success = false;
      
      // Strategy 1: Try to reload Firebase user
      if (typeof auth.currentUser?.reload === 'function') {
        try {
          console.log('WordStream: Attempting to reload Firebase user');
          await auth.currentUser.reload();
          
          // Force token refresh
          if (typeof auth.currentUser.getIdToken === 'function') {
            await auth.currentUser.getIdToken(true);
          }
          
          // Check if reload worked
          const checkAfterReload = await this.checkPermissions();
          if (checkAfterReload) {
            console.log('WordStream: User reload reauthentication succeeded');
            return true;
          }
        } catch (reloadError) {
          console.warn('WordStream: Error reloading Firebase user:', reloadError);
        }
      }
      
      // Strategy 2: Try to access the token directly if available on the user object
      if (typeof user.getIdToken === 'function') {
        try {
          console.log('WordStream: Attempting direct token refresh');
          await user.getIdToken(true);
          
          // Check if token refresh worked
          const checkAfterTokenRefresh = await this.checkPermissions();
          if (checkAfterTokenRefresh) {
            console.log('WordStream: Direct token refresh succeeded');
            return true;
          }
        } catch (tokenError) {
          console.warn('WordStream: Error refreshing token directly:', tokenError);
        }
      }
      
      // Strategy 3: Try Chrome-specific reauthentication if in extension context
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        try {
          console.log('WordStream: Attempting Chrome extension-specific authentication');
          
          // Clear and update local storage
          localStorage.removeItem('wordstream_auth_state');
          localStorage.setItem('wordstream_auth_state', 'refreshing');
          
          // Use chrome.identity if available (in extensions)
          if (chrome.identity && typeof chrome.identity.getAuthToken === 'function') {
            await new Promise<void>((resolve, reject) => {
              chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime.lastError) {
                  console.warn('WordStream: Chrome identity error:', chrome.runtime.lastError);
                  reject(chrome.runtime.lastError);
                } else if (token) {
                  console.log('WordStream: Got new Chrome identity token');
                  resolve();
                } else {
                  reject(new Error('No token returned'));
                }
              });
            });
          }
          
          // Save updated user to storage
          this.saveToStorage(user);
          
          // Check if Chrome reauthentication worked
          const checkAfterChromeAuth = await this.checkPermissions();
          if (checkAfterChromeAuth) {
            console.log('WordStream: Chrome-specific reauthentication succeeded');
            return true;
          }
        } catch (chromeError) {
          console.warn('WordStream: Error in Chrome-specific reauthentication:', chromeError);
        }
      }
      
      // Final check
      const finalCheck = await this.checkPermissions();
      if (finalCheck) {
        console.log('WordStream: Reauthentication eventually succeeded');
        return true;
      }
      
      console.warn('WordStream: All reauthentication attempts failed, user interaction may be needed');
      return false;
    } catch (error) {
      console.warn('WordStream: Unhandled error during reauthentication:', error);
      return false;
    }
  }
};

export default AuthManager;

async function getUserProfileDocument() {
  try {
    const user = AuthManager.getCurrentUser();
    if (!user) return null;
    
    // Use the new approach with direct Firestore functions
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    } else {
      // Create the user document if it doesn't exist
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date()
      };
      
      await setDoc(userDocRef, userData);
      return userData;
    }
  } catch (error) {
    console.error('Error getting user profile document:', error);
    return null;
  }
} 