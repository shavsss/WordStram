/**
 * Environment Utilities
 * 
 * Helper functions for detecting and handling different runtime environments
 * and safe access to environment-specific objects.
 */

/**
 * Check if the runtime environment has window object available
 */
export function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if running in a service worker environment
 */
export function isServiceWorker(): boolean {
  return typeof self !== 'undefined' && 
         typeof window === 'undefined' && 
         (self as any).constructor?.name === 'ServiceWorkerGlobalScope';
}

/**
 * Check if running in a background page or service worker
 */
export function isBackground(): boolean {
  return isServiceWorker() || 
         (typeof chrome !== 'undefined' && 
          typeof chrome.runtime !== 'undefined' && 
          typeof chrome.runtime.getManifest === 'function' &&
          typeof window !== 'undefined' && 
          window.location.pathname.endsWith('background.html'));
}

/**
 * Check if running in a content script environment
 */
export function isContentScript(): boolean {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' && 
         typeof chrome.runtime.getManifest === 'function' &&
         typeof window !== 'undefined' && 
         window.location.host !== chrome.runtime.id;
}

/**
 * Check if running in extension popup/options/etc
 */
export function isExtensionPage(): boolean {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' && 
         typeof chrome.runtime.getManifest === 'function' &&
         typeof window !== 'undefined' && 
         (window.location.protocol === 'chrome-extension:' || 
          window.location.pathname.endsWith('popup.html') ||
          window.location.pathname.endsWith('options.html'));
}

/**
 * Safely get window object if available, otherwise return null
 */
export function safeWindow(): Window | null {
  return hasWindow() ? window : null;
}

/**
 * Safely get document object if available, otherwise return null
 */
export function safeDocument(): Document | null {
  return hasWindow() && window.document ? window.document : null;
}

/**
 * Safely get localStorage if available, otherwise return null
 */
export function safeLocalStorage(): Storage | null {
  try {
    return hasWindow() && window.localStorage ? window.localStorage : null;
  } catch (e) {
    // May throw in certain contexts with restricted permissions
    return null;
  }
}

/**
 * Safely get sessionStorage if available, otherwise return null
 */
export function safeSessionStorage(): Storage | null {
  try {
    return hasWindow() && window.sessionStorage ? window.sessionStorage : null;
  } catch (e) {
    // May throw in certain contexts with restricted permissions
    return null;
  }
}

/**
 * Get storage appropriate for the current environment
 * Falls back to chrome.storage.local when in a service worker
 */
export async function getStorage(key: string): Promise<any | null> {
  try {
    const localStorage = safeLocalStorage();
    if (localStorage) {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      });
    }
    return null;
  } catch (error) {
    console.error('Error accessing storage:', error);
    return null;
  }
}

/**
 * Set storage value appropriate for the current environment
 * Falls back to chrome.storage.local when in a service worker
 */
export async function setStorage(key: string, value: any): Promise<boolean> {
  try {
    const localStorage = safeLocalStorage();
    if (localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve(true);
        });
      });
    }
    return false;
  } catch (error) {
    console.error('Error setting storage:', error);
    return false;
  }
}

/**
 * Remove storage value appropriate for the current environment
 */
export async function removeStorage(key: string): Promise<boolean> {
  try {
    const localStorage = safeLocalStorage();
    if (localStorage) {
      localStorage.removeItem(key);
      return true;
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], () => {
          resolve(true);
        });
      });
    }
    return false;
  } catch (error) {
    console.error('Error removing from storage:', error);
    return false;
  }
} 