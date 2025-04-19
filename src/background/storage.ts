/**
 * Local storage utilities for the background service
 */

import { AUTH_STORAGE_KEY } from './constants';

/**
 * Save data to local storage
 * @param key Storage key
 * @param data Data to save
 */
export async function saveToLocalStorage(key: string, data: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, resolve);
  });
}

/**
 * Get data from local storage
 * @param key Storage key
 * @returns The stored data or null if not found
 */
export async function getFromLocalStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] || null);
    });
  });
}

/**
 * Remove data from local storage
 * @param key Storage key
 */
export async function removeFromLocalStorage(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

/**
 * Save user auth data to local storage
 * @param user User data to save
 */
export async function saveAuthLocal(user: { 
  uid: string; 
  email?: string | null;
  refreshToken: string;
  displayName?: string | null;
}): Promise<void> {
  return saveToLocalStorage(AUTH_STORAGE_KEY, user);
}

/**
 * Get user auth data from local storage
 * @returns User auth data or null if not found
 */
export async function getAuthLocal() {
  return getFromLocalStorage(AUTH_STORAGE_KEY);
}

// Re-export constants for use in other modules
export { AUTH_STORAGE_KEY }; 