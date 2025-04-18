/**
 * Token Manager
 * Centralizes token management functions across the extension
 */

import { refreshAuthToken } from './hybrid-auth';
import { forceRefreshAuthToken } from './firebase-init';

// Constants for token management
export const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
export const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if a token timestamp indicates an expired token
 * @param timestamp Token timestamp to check
 * @returns Boolean indicating if token is expired
 */
export function isTokenExpired(timestamp: number): boolean {
  if (!timestamp) return true;
  
  const now = Date.now();
  return now - timestamp > TOKEN_REFRESH_INTERVAL;
}

/**
 * Refresh authentication token using multiple methods
 * @returns Promise resolving to boolean indicating success
 */
export async function refreshToken(): Promise<boolean> {
  try {
    // Try Chrome Identity API first (most reliable for extensions)
    const chromeToken = await refreshAuthToken();
    if (chromeToken) {
      console.log('Token Manager: Token refreshed via Chrome Identity');
      return true;
    }
    
    // Fallback to Firebase
    const firebaseRefresh = await forceRefreshAuthToken();
    if (firebaseRefresh) {
      console.log('Token Manager: Token refreshed via Firebase');
      return true;
    }
    
    console.warn('Token Manager: Failed to refresh token via any method');
    return false;
  } catch (error) {
    console.error('Token Manager: Error refreshing token:', error);
    return false;
  }
}

/**
 * Get current authentication data from storage
 * @returns Promise resolving to auth data or null
 */
export async function getStoredAuthData(): Promise<any> {
  try {
    const data = await chrome.storage.local.get(['wordstream_user_info', 'wordstream_auth_state']);
    return {
      user: data.wordstream_user_info || null,
      state: data.wordstream_auth_state || null
    };
  } catch (error) {
    console.error('Token Manager: Error getting stored auth data:', error);
    return { user: null, state: null };
  }
}

/**
 * Store authentication data to local storage
 * @param user User data to store
 * @returns Promise resolving to boolean indicating success
 */
export async function storeAuthData(user: any): Promise<boolean> {
  try {
    await chrome.storage.local.set({
      'wordstream_user_info': {
        ...user,
        lastAuthenticated: Date.now(),
        tokenRefreshTime: Date.now()
      },
      'wordstream_auth_state': {
        isAuthenticated: true,
        lastChecked: Date.now()
      }
    });
    return true;
  } catch (error) {
    console.error('Token Manager: Error storing auth data:', error);
    return false;
  }
}

/**
 * Clear authentication data from storage
 * @returns Promise resolving to boolean indicating success
 */
export async function clearAuthData(): Promise<boolean> {
  try {
    await chrome.storage.local.remove(['wordstream_user_info', 'wordstream_auth_state']);
    return true;
  } catch (error) {
    console.error('Token Manager: Error clearing auth data:', error);
    return false;
  }
} 