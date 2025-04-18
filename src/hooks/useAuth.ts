import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { useAuth as useAuthFromModule, signInWithGoogle as authSignInWithGoogle, signOut as authSignOut } from '../auth';

export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastAuthenticated: number;
}

/**
 * Hook לניהול אימות משתמשים
 */
export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use the new consolidated auth hook
  const authModule = useAuthFromModule();

  // Update our state based on the auth module state
  useEffect(() => {
    if (authModule.user) {
      setUser({
        uid: authModule.user.uid,
        email: authModule.user.email,
        displayName: authModule.user.displayName,
        photoURL: authModule.user.photoURL,
        lastAuthenticated: Date.now()
      });
    } else {
      setUser(null);
    }
    
    setLoading(authModule.loading);
    setError(authModule.error);
  }, [authModule.user, authModule.loading, authModule.error]);

  // Listen for auth state changes via message passing
  useEffect(() => {
    const authStateListener = (message: any) => {
      if (message.action === 'AUTH_STATE_CHANGED') {
        if (message.isAuthenticated && message.user) {
          setUser({
            uid: message.user.uid,
            email: message.user.email,
            displayName: message.user.displayName,
            photoURL: message.user.photoURL,
            lastAuthenticated: Date.now()
          });
          setLoading(false);
          setError(null);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // Add the listener
    chrome.runtime.onMessage.addListener(authStateListener);

    // Check for auth state from storage on mount
    const checkStoredAuth = async () => {
      try {
        const data = await chrome.storage.local.get(['wordstream_user_info']);
        if (data.wordstream_user_info) {
          // אנחנו מקלים בדרישות התוקף - מידע תקף לשבוע במקום ליום
          const lastAuth = data.wordstream_user_info.lastAuthenticated || 0;
          const now = Date.now();
          // זמן תוקף מוארך ל-7 ימים
          const isRecent = now - lastAuth < 7 * 24 * 60 * 60 * 1000; 
          
          // במקום לבדוק תוקף, פשוט נשתמש במידע המקומי
          // תמיד נחשיב את המשתמש כמחובר אם יש מידע מקומי
          const updatedUserInfo = {
            ...data.wordstream_user_info,
            lastAuthenticated: now // תמיד לעדכן את זמן האימות האחרון
          };
          
          // עדכון האחסון המקומי
          chrome.storage.local.set({ 
            wordstream_user_info: updatedUserInfo 
          }, () => {
            console.log('useAuth: Updated lastAuthenticated timestamp');
          });
          
          // עדכון מצב האימות המקומי
          setUser(updatedUserInfo);
          setLoading(false);
          
          // שידור עדכון מצב האימות
          try {
            chrome.runtime.sendMessage({
              action: "AUTH_STATE_CHANGED",
              user: updatedUserInfo,
              isAuthenticated: true,
              source: 'popup_auth_refresh'
            });
          } catch (messageErr) {
            console.error('useAuth: Error broadcasting refreshed auth state:', messageErr);
          }
          
          // רק אם המידע ממש ישן, נבדוק גם את המודול
          if (!isRecent) {
            console.log('useAuth: Stored authentication is old, checking with auth module as backup');
            // לוגיקת הגיבוי הקודמת נשארת
            if (authModule.user) {
              // עדכון מידע חדש מהמודול
              const newUserInfo = {
                uid: authModule.user.uid,
                email: authModule.user.email,
                displayName: authModule.user.displayName,
                photoURL: authModule.user.photoURL,
                lastAuthenticated: now
              };
              
              chrome.storage.local.set({ 
                wordstream_user_info: newUserInfo 
              });
            }
          }
        } else {
          // אין אימות באחסון המקומי - ממשיכים לפי מודול האימות
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking stored auth:', error);
        setLoading(false);
      }
    };

    checkStoredAuth();

    // Clean up listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(authStateListener);
    };
  }, []);

  // התחברות באמצעות Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const result = await authModule.signInWithGoogle();
      
      // עדכון מיידי של האחסון המקומי לאחר כל התחברות מוצלחת
      if (authModule.user) {
        const userInfo = {
          uid: authModule.user.uid,
          email: authModule.user.email,
          displayName: authModule.user.displayName,
          photoURL: authModule.user.photoURL,
          lastAuthenticated: Date.now()
        };
        
        await chrome.storage.local.set({ wordstream_user_info: userInfo });
        console.log('useAuth: Stored user info after Google sign-in');
      }
      
      return true;
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [authModule]);

  // התנתקות
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // קודם מנקים את האחסון המקומי - חשוב!
      await chrome.storage.local.remove(['wordstream_user_info']);
      console.log('useAuth: Removed user info from storage before logout');
      
      // אחר כך מתנתקים מהשרת
      await authModule.logout();
      
      // ריקון ה-state המקומי
      setUser(null);
      
      // שידור שינוי מצב האימות
      try {
        chrome.runtime.sendMessage({
          action: "AUTH_STATE_CHANGED",
          user: null,
          isAuthenticated: false,
          source: 'popup_logout'
        });
      } catch (messageErr) {
        console.error('useAuth: Error broadcasting logout state:', messageErr);
      }
      
      return true;
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError(error.message || 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [authModule]);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    logout
  };
} 