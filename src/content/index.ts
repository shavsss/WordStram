/**
 * Content Script Entry Point
 * This file serves as the main entry point for the WordStream content scripts.
 * It imports the required authentication module and initializes it.
 */

// ייבוא מודול האימות
import { subscribeToAuthChanges } from '../core/firebase/auth';

// Log initialization
console.log('WordStream content script loaded');

// קבועים לטיפול באימות
const MAX_AUTH_RETRIES = 3;
const RETRY_DELAY = 2000;
// סמן אם יש התאוששות בתהליך
let recoveryInProgress = false;

// הגדרת האזנה להודעות מרכיב הרקע
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // בדיקה אם זו הודעת שינוי סטטוס אימות
  if (message.action === 'AUTH_STATE_CHANGED') {
    console.log('WordStream: Received auth state change from background:', 
      message.isAuthenticated ? 'Authenticated' : 'Not authenticated');
    
    // כאן נוכל לטפל באירוע ולשלוח אירוע מותאם לשאר המרכיבים
    const authEvent = new CustomEvent('wordstream:auth_changed', {
      detail: {
        isAuthenticated: message.isAuthenticated,
        userInfo: message.userInfo || null
      }
    });
    document.dispatchEvent(authEvent);
    
    // אם החיבור הצליח, נאפס את מצב ההתאוששות
    if (message.isAuthenticated) {
      recoveryInProgress = false;
    }
    
    // שליחת אישור קבלה
    if (sendResponse) {
      sendResponse({ received: true });
    }
  }
  
  // בדיקה אם זו הודעת רענון טוקן
  if (message.action === 'TOKEN_REFRESHED') {
    console.log('WordStream: Token refreshed at', new Date(message.timestamp).toLocaleTimeString());
    
    // שליחת אירוע רענון טוקן למרכיבים שצריכים לדעת על זה
    const tokenEvent = new CustomEvent('wordstream:token_refreshed', {
      detail: { 
        timestamp: message.timestamp
      }
    });
    document.dispatchEvent(tokenEvent);
    
    if (sendResponse) {
      sendResponse({ received: true });
    }
  }
  
  // בדיקה אם זו הודעת צורך בהתחברות מחדש - AUTH_RELOGIN_REQUIRED
  if (message.action === 'AUTH_RELOGIN_REQUIRED') {
    console.warn('WordStream: Session expired, relogin required. Reason:', message.reason || 'unknown');
    
    // שליחת אירוע למרכיבי ממשק המשתמש שצריכים להציג מסך התחברות מחדש
    const reloginEvent = new CustomEvent('wordstream:relogin_required', {
      detail: {
        reason: message.reason || 'session_expired',
        timestamp: message.timestamp || Date.now()
      }
    });
    document.dispatchEvent(reloginEvent);
    
    // שליחת התראת דפדפן למשתמש (אם מותר)
    try {
      if (Notification && Notification.permission === 'granted') {
        new Notification('WordStream', {
          body: 'יש צורך בהתחברות מחדש כדי להמשיך להשתמש ב-WordStream.',
          icon: chrome.runtime.getURL('icons/icon128.png')
        });
      }
    } catch (notificationError) {
      console.error('WordStream: Error showing notification:', notificationError);
    }
    
    if (sendResponse) {
      sendResponse({ received: true });
    }
  }
  
  // חשוב להחזיר true כדי לאפשר תשובה אסינכרונית
  return true;
});

// אתחול האזנה לשינויי אימות מקומיים
subscribeToAuthChanges((user) => {
  console.log('WordStream: Auth state changed in content script:', user ? 'Authenticated' : 'Not authenticated');
  
  // שליחת אירוע למרכיבים שצריכים לדעת על שינויי אימות
  const authEvent = new CustomEvent('wordstream:auth_changed', {
    detail: {
      isAuthenticated: !!user,
      userInfo: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null
    }
  });
  document.dispatchEvent(authEvent);
  
  // אם המשתמש מחובר, אפשר לאפס את מצב ההתאוששות
  if (user) {
    recoveryInProgress = false;
  }
});

/**
 * פונקציה לניסיון אתחול מחדש של האימות
 */
function triggerAuthRetry(): Promise<boolean> {
  console.log('WordStream: Attempting auth retry from content script');
  
  return new Promise<boolean>((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'AUTH_RETRY' }, (response) => {
        // בדיקה אם יש שגיאה בתקשורת
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error sending AUTH_RETRY:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        // בדיקת ההצלחה
        if (response && response.success) {
          console.log('WordStream: Auth retry successful');
          
          // שליחת אירוע מותאם
          const successEvent = new CustomEvent('wordstream:auth_retry_success', {
            detail: {
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(successEvent);
          
          // ביצוע בדיקת מצב אימות חדשה
          setTimeout(() => checkInitialAuthState(0), 500);
          
          resolve(true);
        } else {
          console.warn('WordStream: Auth retry failed', response?.error || 'Unknown reason');
          
          // שליחת אירוע נכשל
          const failureEvent = new CustomEvent('wordstream:auth_retry_failed', {
            detail: {
              error: response?.error || 'Unknown error',
              partialSuccess: response?.partialSuccess || false,
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(failureEvent);
          
          resolve(false);
        }
      });
    } catch (error) {
      console.error('WordStream: Error triggering auth retry:', error);
      resolve(false);
    }
  });
}

/**
 * פונקציה לריענון טוקן אגרסיבי
 */
function triggerAdvancedTokenRefresh(currentRetry = 0): void {
  console.log(`WordStream: Starting advanced token refresh (attempt ${currentRetry + 1}/${MAX_AUTH_RETRIES + 1})`);
  
  // שליחת הודעה לריענון הטוקן
  chrome.runtime.sendMessage({ 
    action: 'REFRESH_TOKEN',
    useAggressiveRecovery: true,
    attemptCount: currentRetry
  }, (refreshResponse) => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Runtime error during token refresh:', chrome.runtime.lastError);
      
      // ניסיון נוסף אם לא הגענו למקסימום
      if (currentRetry < MAX_AUTH_RETRIES) {
        console.log(`WordStream: Will retry recovery in ${RETRY_DELAY}ms...`);
        setTimeout(() => {
          triggerAdvancedTokenRefresh(currentRetry + 1);
        }, RETRY_DELAY);
      } else {
        // ניסיון אחרון - נסה את פונקציית ההתאוששות העמוקה
        triggerAuthRetry();
      }
      
      return;
    }
    
    // אם הריענון הצליח, בודקים מחדש את מצב האימות
    if (refreshResponse && refreshResponse.success) {
      console.log('WordStream: Token refreshed successfully, rechecking auth state');
      
      // המתנה לפני בדיקה מחדש
      setTimeout(() => {
        // בדיקה מחדש של מצב האימות
        chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (authCheckResponse) => {
          if (authCheckResponse && authCheckResponse.isAuthenticated) {
            console.log('WordStream: Authentication recovery successful!');
            recoveryInProgress = false;
          } else {
            console.warn('WordStream: Token refreshed but still not authenticated');
            
            // אם לא הגענו למקסימום ניסיונות, ננסה את התאוששות העמוקה
            if (currentRetry < MAX_AUTH_RETRIES) {
              triggerAuthRetry();
            } else {
              recoveryInProgress = false;
            }
          }
        });
      }, 1000);
    } else {
      // ריענון נכשל, נסה את ההתאוששות העמוקה
      console.warn('WordStream: Token refresh failed, trying deep recovery');
      triggerAuthRetry();
    }
  });
}

/**
 * האזנה לאירועי שגיאת אימות
 */
document.addEventListener('wordstream:auth_error', (event: Event) => {
  const customEvent = event as CustomEvent;
  const error = customEvent.detail?.error || '';
  
  if (error.includes('expired') || error.includes('authentication')) {
    console.log('WordStream: Auth error detected, triggering auth retry');
    
    // אם אין תהליך התאוששות פעיל, התחל אחד
    if (!recoveryInProgress) {
      recoveryInProgress = true;
      triggerAuthRetry();
    }
  }
});

/**
 * בדיקת מצב אימות התחלתי
 */
function checkInitialAuthState(retryCount = 0): void {
  // בדיקה אם יש צורך באתחול אוטומטי בשל שגיאת אימות קודמת
  chrome.storage.local.get(['wordstream_auth_state', 'wordstream_last_auth_error'], async (result) => {
    if (result.wordstream_auth_state === 'requires_reauth' || 
        (result.wordstream_last_auth_error && 
         Date.now() - result.wordstream_last_auth_error.timestamp < 24 * 60 * 60 * 1000)) {
      console.log('WordStream: Found previous auth error, attempting recovery on load');
      
      const retry = await triggerAuthRetry();
      if (retry) {
        console.log('WordStream: Automatic auth recovery on load successful');
        return;
      }
    }
    
    // בדיקה רגילה של מצב האימות
    console.log(`WordStream: Checking initial auth state (attempt ${retryCount + 1}/${MAX_AUTH_RETRIES + 1})`);
    
    try {
      chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error checking auth state:', chrome.runtime.lastError);
          
          // ניסיון חוזר אם לא הגענו למקסימום ניסיונות
          if (retryCount < MAX_AUTH_RETRIES) {
            setTimeout(() => checkInitialAuthState(retryCount + 1), RETRY_DELAY);
          }
          return;
        }
        
        if (response && response.isAuthenticated !== undefined) {
          console.log('WordStream: Initial auth state -', 
            response.isAuthenticated ? 'Authenticated' : 'Not authenticated');
          
          // שליחת אירוע למרכיבים שצריכים לדעת על מצב האימות
          const authEvent = new CustomEvent('wordstream:auth_changed', {
            detail: {
              isAuthenticated: response.isAuthenticated,
              userInfo: response.userInfo || null
            }
          });
          document.dispatchEvent(authEvent);
          
          // אם לא מאומת, נבדוק אם יש צורך בחידוש
          if (!response.isAuthenticated && !recoveryInProgress) {
            recoveryInProgress = true;
            setTimeout(() => triggerAdvancedTokenRefresh(0), 500);
          }
        } else if (response && response.error) {
          console.error('WordStream: Auth check error:', response.error);
          
          // שליחת אירוע שגיאת אימות
          const errorEvent = new CustomEvent('wordstream:auth_error', {
            detail: {
              error: response.error,
              recoverable: response.error.includes('expired')
            }
          });
          document.dispatchEvent(errorEvent);
          
          // אם השגיאה היא פג תוקף ואין תהליך התאוששות, ננסה לרענן
          if (response.error.includes('expired') && !recoveryInProgress) {
            recoveryInProgress = true;
            triggerAdvancedTokenRefresh(0);
          }
        } else if (retryCount < MAX_AUTH_RETRIES) {
          // תשובה לא תקינה, ננסה שוב
          setTimeout(() => checkInitialAuthState(retryCount + 1), RETRY_DELAY);
        }
      });
    } catch (error) {
      console.error('WordStream: Error checking initial auth state:', error);
    }
  });
}

// קריאה לבדיקת מצב אימות התחלתי
checkInitialAuthState(0);

// Export a minimal API to satisfy the build process
export {}; 