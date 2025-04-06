/**
 * Settings Service
 * Handles user settings operations with Firestore
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '../../config';
import { checkFirestoreConnection } from '../../auth/auth-service';
import { createSettingsPath } from '../../utils/path-utils';
import { broadcastMessage } from '../../sync/broadcast';
import { UserSettings } from '../../types/user';

/**
 * Default user settings
 */
const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  defaultSourceLanguage: 'auto',
  defaultTargetLanguage: 'en',
  notifications: true,
  autoSync: true
};

/**
 * Get user settings
 * @returns User settings
 */
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot get settings - ${connectionStatus.error}`);
      return getSettingsFromLocalStorage();
    }
    
    const userId = connectionStatus.userId as string;
    
    // Create path to settings document
    const settingsPath = createSettingsPath(userId);
    const settingsRef = doc(firestore, settingsPath);
    
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      const settingsData = settingsDoc.data() as UserSettings;
      
      // Save to local storage for offline access
      updateLocalSettings(settingsData);
      
      return settingsData;
    } else {
      // No settings yet, create default ones
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Save to local storage
      updateLocalSettings(DEFAULT_SETTINGS);
      
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    console.error('WordStream: Error getting user settings:', error);
    return getSettingsFromLocalStorage();
  }
}

/**
 * Get settings from local storage
 * @returns User settings
 */
function getSettingsFromLocalStorage(): Promise<UserSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], result => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error getting settings from local storage:', chrome.runtime.lastError);
        resolve(DEFAULT_SETTINGS);
        return;
      }
      
      const settings = result.settings || DEFAULT_SETTINGS;
      resolve(settings as UserSettings);
    });
  });
}

/**
 * Update user settings
 * @param settings New settings
 * @returns Whether the update was successful
 */
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<boolean> {
  try {
    const connectionStatus = await checkFirestoreConnection();
    if (!connectionStatus.connected) {
      console.warn(`WordStream: Cannot update settings - ${connectionStatus.error}`);
      updateLocalSettings(settings);
      return false;
    }
    
    const userId = connectionStatus.userId as string;
    
    // Get current settings first
    const currentSettings = await getUserSettings();
    
    // Merge with new settings
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: serverTimestamp()
    };
    
    // Create path to settings document
    const settingsPath = createSettingsPath(userId);
    const settingsRef = doc(firestore, settingsPath);
    
    await setDoc(settingsRef, updatedSettings, { merge: true });
    
    // Update local storage
    updateLocalSettings(updatedSettings);
    
    // Broadcast update
    broadcastMessage({
      action: 'SETTINGS_UPDATED',
      settings: updatedSettings,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error updating user settings:', error);
    return false;
  }
}

/**
 * Update local storage with settings
 * @param settings Settings to save
 */
function updateLocalSettings(settings: Partial<UserSettings>): void {
  chrome.storage.sync.get(['settings'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting settings from local storage:', chrome.runtime.lastError);
      return;
    }
    
    const currentSettings = result.settings || DEFAULT_SETTINGS;
    const updatedSettings = { ...currentSettings, ...settings };
    
    chrome.storage.sync.set({ settings: updatedSettings }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving settings to local storage:', chrome.runtime.lastError);
      }
    });
  });
} 