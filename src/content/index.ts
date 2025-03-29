import { startDetection, getCurrentDetector } from './modules/captions/detector';
import { createGeminiPanel, createFloatingControls, togglePanelVisibility } from './modules/panels/panel-manager';
import { translateToHebrew, translateToEnglish, detectTextLanguage } from './modules/utils/translation-handler';

/**
 * הגדרות גלובליות של התוסף
 * -----------------------------
 * מנגנון אימות מחוזק ועמיד יותר מבוסס על המלצות עבור תוספי Chrome
 */

// הגדרת מבנה מצב האימות
interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  displayName: string | null;
  userId: string | null;
  timestamp: number;
}

// המצב הנוכחי בצד content script
let currentAuthState: AuthState = {
  isAuthenticated: false,
  email: null,
  displayName: null,
  userId: null,
  timestamp: Date.now()
};

// Add global type declarations at the top
declare global {
  interface Window {
    WordStream?: {
      auth?: {
        isAuthenticated: boolean;
        email?: string | null;
        displayName?: string | null;
        userId?: string | null;
        [key: string]: any;
      };
      [key: string]: any;
    };
  }
}

/**
 * בדיקת אימות מקיפה עם שלושה רבדים
 * 1. בדיקה מהירה מהחלון הגלובלי
 * 2. בדיקה מול background script (סמכותית)
 * 3. אופציונלית - בדיקה מול Firebase ישירות
 * 
 * החזרת הבטחה עם תוצאת האימות
 */
async function checkAuthentication(): Promise<boolean> {
  // 1. בדיקה מהירה מהחלון הגלובלי (הכי מהירה)
  const quickCheck = (window as any).WordStream?.local?.isAuthenticated || false;
  if (quickCheck) {
    console.log('WordStream: Quick auth check passed via window object');
    return true;
  }
  
  // 2. בדיקה מול ה-background script (האמינה ביותר)
  try {
    console.log('WordStream: Performing background script auth check');
    const response = await chrome.runtime.sendMessage({ action: 'IS_AUTHENTICATED' });
    
    if (response?.isAuthenticated) {
      // עדכון האובייקט הגלובלי כדי לזרז בדיקות עתידיות
      console.log('WordStream: Authentication confirmed by background script');
      
      // עדכון החלון הגלובלי
      const scriptContent = `
        if (window.WordStream && window.WordStream.local) {
          window.WordStream.local.isAuthenticated = true;
          window.WordStream.local.userEmail = "${response.authDetails?.email || ''}";
          window.WordStream.local.userDisplayName = "${response.authDetails?.displayName || ''}";
          window.WordStream.local.authTimestamp = ${Date.now()};
        }
      `;
      
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      script.remove();
      
      return true;
    }
  } catch (error) {
    console.error('WordStream: Error checking auth from background:', error);
  }
  
  // 3. בדיקה מול Firebase ישירות (גיבוי)
  try {
    const hasFirebase = typeof (window as any).firebase !== 'undefined';
    if (hasFirebase && 
        (window as any).firebase.auth && 
        (window as any).firebase.auth().currentUser) {
      console.log('WordStream: Auth confirmed via direct Firebase check');
      return true;
    }
  } catch (error) {
    console.error('WordStream: Error checking auth from Firebase:', error);
  }
  
  // אם הגענו לכאן, המשתמש אינו מאומת בשום דרך
  console.log('WordStream: User is not authenticated');
  return false;
}

/**
 * מזריק סקריפט שמגדיר אובייקט גלובלי לבדיקת אימות מיידית
 * שפרנו את ההזרקה כדי להבטיח תאימות עם מודלים של אבטחה בדפדפן
 */
function injectAuthDetection() {
  try {
    const script = document.createElement('script');
    script.textContent = `
      // יצירת אובייקט גלובלי לשימוש בקוד הדף
      window.WordStream = window.WordStream || {};
      window.WordStream.local = window.WordStream.local || {};
      
      // קביעת מצב האימות הראשוני
      window.WordStream.local.isAuthenticated = false;
      window.WordStream.local.userEmail = null;
      window.WordStream.local.userDisplayName = null;
      window.WordStream.local.authTimestamp = ${Date.now()};
      
      // אירוע מותאם אישית לעדכוני אימות
      document.addEventListener('WORDSTREAM_AUTH_UPDATED', (e) => {
        const detail = e.detail || {};
        window.WordStream.local.isAuthenticated = !!detail.isAuthenticated;
        window.WordStream.local.userEmail = detail.email || null;
        window.WordStream.local.userDisplayName = detail.displayName || null;
        window.WordStream.local.authTimestamp = detail.timestamp || Date.now();
        
        console.log('WordStream: Auth state updated in page context', window.WordStream.local);
        
        // לצורך דיבוג - להראות שהעדכון אכן עובד
        if (detail.isAuthenticated) {
          console.log('WordStream: User is authenticated as:', detail.email);
        } else {
          console.log('WordStream: User is not authenticated');
        }
      });
      
      // מוסיף תכונת בדיקה מהירה
      window.WordStream.isAuthenticated = function() {
        return !!window.WordStream.local.isAuthenticated;
      };
    `;
    
    document.head.appendChild(script);
    script.remove();
    console.log('WordStream: Auth detection code injected successfully');
  } catch (error) {
    console.error('WordStream: Failed to inject auth detection code:', error);
  }
}

/**
 * מעדכן את מצב האימות בדף הנוכחי
 * שיפור ניהול שגיאות והבטחת עדכון החלון הגלובלי
 */
function updatePageAuthState(auth: AuthState) {
  try {
    // עדכון המצב המקומי
    currentAuthState = { ...auth };
    
    // הזרקת סקריפט שמשדר את האירוע ומעדכן את החלון
    const script = document.createElement('script');
    script.textContent = `
      try {
        document.dispatchEvent(new CustomEvent('WORDSTREAM_AUTH_UPDATED', { 
          detail: {
            isAuthenticated: ${auth.isAuthenticated},
            email: "${auth.email || ''}",
            displayName: "${auth.displayName || ''}",
            timestamp: ${auth.timestamp || Date.now()}
          }
        }));
        
        // עדכון ישיר של האובייקט הגלובלי כגיבוי
        if (window.WordStream && window.WordStream.local) {
          window.WordStream.local.isAuthenticated = ${auth.isAuthenticated};
          window.WordStream.local.userEmail = "${auth.email || ''}";
          window.WordStream.local.userDisplayName = "${auth.displayName || ''}";
          window.WordStream.local.authTimestamp = ${auth.timestamp || Date.now()};
        }
      } catch (e) {
        console.error('WordStream: Error in page auth update:', e);
      }
    `;
    
    document.head.appendChild(script);
    script.remove();
    console.log('WordStream: Page auth state updated successfully:', auth.isAuthenticated);
  } catch (error) {
    console.error('WordStream: Failed to update page auth state:', error);
  }
}

/**
 * בדיקה תקופתית של מצב האימות
 * פונקציה חדשה שמבטיחה סנכרון עם ה-background script
 */
function setupAuthRefresh() {
  // בדיקה כל 5 דקות
  const REFRESH_INTERVAL = 5 * 60 * 1000;
  
  setInterval(async () => {
    try {
      console.log('WordStream: Performing periodic auth check');
      const isAuthenticated = await checkAuthentication();
      
      // אם מצב האימות השתנה מהבדיקה האחרונה, עדכן את הממשק
      if (isAuthenticated !== currentAuthState.isAuthenticated) {
        console.log('WordStream: Auth state changed during periodic check');
        
        // קבל פרטים מלאים מה-background
        const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' });
        
        updatePageAuthState({
          isAuthenticated: response.isAuthenticated,
          email: response.authDetails?.email || null,
          displayName: response.authDetails?.displayName || null,
          userId: response.authDetails?.userId || null,
          timestamp: Date.now()
        });
        
        // עדכן את הממשק
        updateUIBasedOnAuthState(response.isAuthenticated);
      }
    } catch (error) {
      console.error('WordStream: Error in auth refresh:', error);
    }
  }, REFRESH_INTERVAL);
}

/**
 * בדיקת מצב האימות הראשוני בעת טעינת הדף
 * שיפור הטיפול בשגיאות וחזרה לאימות מקומי
 */
async function checkInitialAuthState() {
  try {
    console.log('WordStream: Checking initial auth state');
    const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' });
    
    if (response) {
      updatePageAuthState({
        isAuthenticated: response.isAuthenticated,
        email: response.authDetails?.email || null,
        displayName: response.authDetails?.displayName || null,
        userId: response.authDetails?.userId || null,
        timestamp: Date.now()
      });
      
      console.log('WordStream: Initial auth state retrieved:', response.isAuthenticated);
      return response.isAuthenticated;
    }
  } catch (error) {
    console.error('WordStream: Error checking initial auth state:', error);
    
    // אם נכשל, נסה לקרוא מ-storage.local
    try {
      const storageData = await chrome.storage.local.get(['authState']);
      if (storageData.authState) {
        console.log('WordStream: Recovering auth state from local storage');
        updatePageAuthState({
          isAuthenticated: !!storageData.authState.isAuthenticated,
          email: storageData.authState.userEmail || null,
          displayName: storageData.authState.userDisplayName || null,
          userId: storageData.authState.userId || null,
          timestamp: Date.now()
        });
        
        return !!storageData.authState.isAuthenticated;
      }
    } catch (storageError) {
      console.error('WordStream: Error retrieving auth from storage:', storageError);
    }
  }
  
  return false;
}

// Global variables
let isExtensionActive = false;

/**
 * מאזין לאירועים מה-background script
 * שיפור הטיפול בהודעות וההתאוששות משגיאות
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('WordStream: Content script received message:', message?.action || 'unknown');
  
  try {
    // האזנה לעדכוני אימות מהרקע
    if (message?.action === 'AUTH_STATE_CHANGED') {
      updatePageAuthState({
        isAuthenticated: !!message.isAuthenticated,
        email: message.authDetails?.email || null,
        displayName: message.authDetails?.displayName || null,
        userId: message.authDetails?.userId || null,
        timestamp: message.authDetails?.timestamp || Date.now()
      });
      
      // עדכון ממשק המשתמש בהתאם למצב האימות
      updateUIBasedOnAuthState(!!message.isAuthenticated);
      sendResponse({ success: true });
      return true;
    }
    
    if (message?.action === 'START_DETECTION') {
      start();
      sendResponse({ success: true });
    } else if (message?.action === 'STOP_DETECTION') {
      stop();
      sendResponse({ success: true });
    } else if (message?.action === 'IS_ACTIVE') {
      sendResponse({ isActive: isExtensionActive });
    } else if (message?.action === 'TOGGLE_PANEL') {
      togglePanelVisibility();
      sendResponse({ success: true });
    } else if (message?.action === 'TRANSLATE') {
      handleTranslationRequest(message.data).then(result => sendResponse(result));
      return true; // Async response
    }
  } catch (error) {
    console.error('WordStream: Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }
});

/**
 * עדכון ממשק המשתמש בהתאם למצב האימות
 * הרחבה לטיפול בממשק משתמש מלא
 */
function updateUIBasedOnAuthState(isAuthenticated: boolean) {
  console.log(`WordStream: Updating UI based on auth state: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
  
  // הסרת גרסה קודמת של פקדים אם צריך
  const currentDetector = getCurrentDetector();
  
  if (currentDetector) {
    // רענן את הפקדים הצפים בהתאם למצב האימות
    if (isAuthenticated) {
      // וודא שהפקדים מוצגים אם המשתמש מחובר
      currentDetector.addFloatingControls();
    } else {
      // הסר את הפקדים אם המשתמש אינו מחובר
      currentDetector.removeFloatingControls();
    }
  }
}

/**
 * מתחיל את פעולת התוסף
 * שיפור האתחול והוספת בדיקות אימות מוקדמות
 */
async function start() {
  if (isExtensionActive) return;
  
  console.log('WordStream: Starting extension...');
  isExtensionActive = true;
  
  // הזרק את קוד האימות
  injectAuthDetection();
  
  // בדוק את מצב האימות הנוכחי
  const isAuthenticated = await checkInitialAuthState();
  console.log('WordStream: Initial auth state is:', isAuthenticated);
  
  // הפעל בדיקות תקופתיות
  setupAuthRefresh();
  
  // Initialize UI elements
  createFloatingControls();
  createGeminiPanel();
  
  // Start caption detection
  await startDetection();
  
  // עדכן את הממשק בהתאם למצב האימות
  updateUIBasedOnAuthState(isAuthenticated);
  
  // Update badge
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { isActive: true } });
}

/**
 * עוצר את פעולת התוסף
 */
function stop() {
  if (!isExtensionActive) return;
  
  console.log('WordStream: Stopping extension...');
  isExtensionActive = false;
  
  // Clean up detectors
  if (getCurrentDetector()) {
    getCurrentDetector()?.stopObserving();
  }
  
  // Update badge
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { isActive: false } });
}

/**
 * מטפל בבקשת תרגום
 * בדיקת אימות לפני תרגום
 */
async function handleTranslationRequest(data: { text: string, targetLang?: string }) {
  try {
    const { text, targetLang = 'auto' } = data;
    
    // בדיקת אימות מהירה אם התרגום דורש אימות
    // ההחלטה העסקית כאן היא שתרגום זמין גם ללא אימות
    const requiresAuth = false;
    
    if (requiresAuth) {
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        return { 
          success: false, 
          error: 'Authentication required for translation' 
        };
      }
    }
    
    let result = '';
    
    if (targetLang === 'auto') {
      // Detect language and translate in the appropriate direction
      const sourceLanguage = detectTextLanguage(text);
      
      if (sourceLanguage === 'en') {
        result = await translateToHebrew(text);
      } else if (sourceLanguage === 'he') {
        result = await translateToEnglish(text);
      } else {
        // Default to translating to Hebrew
        result = await translateToHebrew(text);
      }
    } else if (targetLang === 'he') {
      result = await translateToHebrew(text);
    } else if (targetLang === 'en') {
      result = await translateToEnglish(text);
    }
    
    return { success: true, translation: result };
  } catch (error) {
    console.error('WordStream: Translation error:', error);
    return { success: false, error: 'Translation failed: ' + String(error) };
  }
}

// Auto-start when the page is loaded
window.addEventListener('load', () => {
  // Check if we should auto-start on this site
  chrome.storage.sync.get(['autoStart', 'enabledSites'], (result) => {
    const { autoStart, enabledSites = [] } = result;
    
    if (!autoStart) return;
    
    // Check if current site is in the enabled sites list
    const currentHost = window.location.hostname;
    const isEnabled = enabledSites.some((site: string) => currentHost.includes(site));
    
    if (isEnabled) {
      console.log('WordStream: Auto-starting on', currentHost);
      start();
    }
  });
});

// Listen for URL changes (for single-page applications)
let lastUrl = location.href;
  new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('WordStream: URL changed to', lastUrl);
    
    // If the extension is active, restart detection for the new page
    if (isExtensionActive) {
  startDetection();
    }
  }
}).observe(document, { subtree: true, childList: true });

// Auto-start if needed
chrome.storage.sync.get(['extensionEnabled'], (result) => {
  if (result.extensionEnabled) {
    console.log('WordStream: Extension is enabled in settings, auto-starting...');
    start();
  }
});

/**
 * Initialize global WordStream object for authentication state tracking
 */
function initializeWordStreamGlobal() {
  try {
    // Create global object if not exists
    if (!window.WordStream) {
      console.log('WordStream: Initializing global object');
      
      // Use a script tag to ensure it's accessible from page context
      const script = document.createElement('script');
      script.textContent = `
        window.WordStream = {
          auth: {
            isAuthenticated: false,
            email: null,
            displayName: null,
            userId: null,
            lastChecked: ${Date.now()}
          }
        };
      `;
      document.head.appendChild(script);
      script.remove();
    }
    
    // Initial authentication check
    checkAuthenticationWithBackground();
    
    // Listen for auth state changes from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === 'AUTH_STATE_CHANGED') {
        console.log('WordStream: Received auth state update:', message.isAuthenticated);
        
        // Update the global object in page context
        updateGlobalAuthState(message.isAuthenticated, message.authDetails);
      }
    });
    
    console.log('WordStream: Global object initialized successfully');
  } catch (error) {
    console.error('WordStream: Error initializing global object:', error);
  }
}

/**
 * Update the global WordStream auth state in page context
 */
function updateGlobalAuthState(isAuthenticated: boolean, authDetails?: any) {
  try {
    const script = document.createElement('script');
    script.textContent = `
      if (window.WordStream && window.WordStream.auth) {
        window.WordStream.auth.isAuthenticated = ${isAuthenticated};
        window.WordStream.auth.email = ${authDetails?.email ? `"${authDetails.email}"` : 'null'};
        window.WordStream.auth.displayName = ${authDetails?.displayName ? `"${authDetails.displayName}"` : 'null'};
        window.WordStream.auth.userId = ${authDetails?.userId ? `"${authDetails.userId}"` : 'null'};
        window.WordStream.auth.lastChecked = ${Date.now()};
        
        // Dispatch event for any page listeners
        window.dispatchEvent(new CustomEvent('WORDSTREAM_AUTH_UPDATED', { 
          detail: { isAuthenticated: ${isAuthenticated} }
        }));
      }
    `;
    document.head.appendChild(script);
    script.remove();
    
    console.log('WordStream: Global auth state updated:', isAuthenticated);
  } catch (error) {
    console.error('WordStream: Error updating global auth state:', error);
  }
}

/**
 * Check authentication state with background script
 */
async function checkAuthenticationWithBackground() {
  try {
    const response = await new Promise<{isAuthenticated: boolean, authDetails?: any}>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'IS_AUTHENTICATED' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Error checking auth with background:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          if (response && typeof response === 'object') {
            resolve(response);
          } else {
            reject(new Error('Invalid response from background'));
          }
        }
      );
      
      // Set a timeout in case the background doesn't respond
      setTimeout(() => {
        reject(new Error('Authentication check timed out'));
      }, 5000);
    });
    
    // Update global state
    updateGlobalAuthState(response.isAuthenticated, response.authDetails);
    
    return response.isAuthenticated;
  } catch (error) {
    console.error('WordStream: Error checking authentication:', error);
    return false;
  }
}

// Call the initialization function early in the startup process
// Add this right after detectCaptionDetector() is called
initializeWordStreamGlobal(); 