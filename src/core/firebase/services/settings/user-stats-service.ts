/**
 * User Statistics Service
 * Handles user statistics operations with Firestore
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '../../config';
import { checkFirestoreConnection } from '../../utils/connection-utils';
import { createStatsPath } from '../../utils/path-utils';
import { broadcastMessage } from '../../sync/broadcast';
import { UserStats } from '../../types/user';
import { getCurrentUser } from '../../auth/auth-service';

/**
 * Default user stats
 */
const DEFAULT_STATS: UserStats = {
  totalWords: 0,
  totalChats: 0,
  totalNotes: 0,
  totalVideos: 0,
  lastActive: new Date().toISOString(),
  lastChatTime: '',
  lastWordTime: '',
  lastNoteTime: '',
  lastUpdated: new Date().toISOString()
};

/**
 * Get user statistics
 * @returns User statistics
 */
export async function getUserStats(): Promise<UserStats> {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      console.warn('WordStream: Cannot get stats - no connection');
      return getStatsFromLocalStorage();
    }
    
    const user = getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot get stats - no authenticated user');
      return getStatsFromLocalStorage();
    }
    
    const userId = user.uid;
    
    // Create path to stats document
    const statsPath = createStatsPath(userId);
    const statsRef = doc(firestore, statsPath);
    
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      const statsData = statsDoc.data() as UserStats;
      
      // Save to local storage for offline access
      updateLocalStats(statsData);
      
      return statsData;
    } else {
      // No stats yet, create default ones
      await setDoc(statsRef, {
        ...DEFAULT_STATS,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Save to local storage
      updateLocalStats(DEFAULT_STATS);
      
      return DEFAULT_STATS;
    }
  } catch (error) {
    console.error('WordStream: Error getting user stats:', error);
    return getStatsFromLocalStorage();
  }
}

/**
 * Get stats from local storage
 * @returns User stats
 */
function getStatsFromLocalStorage(): Promise<UserStats> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], result => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error getting stats from local storage:', chrome.runtime.lastError);
        resolve(DEFAULT_STATS);
        return;
      }
      
      const stats = result.stats || DEFAULT_STATS;
      resolve(stats as UserStats);
    });
  });
}

/**
 * Save user statistics to Firestore
 * @param stats Statistics to save
 * @returns Whether the save was successful
 */
export async function saveUserStats(stats: Partial<UserStats>): Promise<boolean> {
  try {
    const isConnected = await checkFirestoreConnection();
    if (!isConnected) {
      console.warn('WordStream: Cannot save stats - not connected');
      updateLocalStats(stats);
      return false;
    }
    
    const user = getCurrentUser();
    if (!user) {
      console.warn('WordStream: Cannot save stats - no authenticated user');
      updateLocalStats(stats);
      return false;
    }
    
    const userId = user.uid;
    
    // Get current stats first
    const currentStats = await getUserStats();
    
    // Merge with new stats
    const updatedStats = {
      ...currentStats,
      ...stats,
      lastUpdated: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    
    // Create path to stats document
    const statsPath = createStatsPath(userId);
    const statsRef = doc(firestore, statsPath);
    
    await setDoc(statsRef, updatedStats, { merge: true });
    
    // Update local storage
    updateLocalStats(updatedStats);
    
    // Broadcast update
    broadcastMessage({
      action: 'STATS_UPDATED',
      stats: updatedStats,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('WordStream: Error saving user stats:', error);
    return false;
  }
}

/**
 * Update local storage with stats
 * @param stats Stats to save
 */
function updateLocalStats(stats: Partial<UserStats>): void {
  chrome.storage.sync.get(['stats'], result => {
    if (chrome.runtime.lastError) {
      console.error('WordStream: Error getting stats from local storage:', chrome.runtime.lastError);
      return;
    }
    
    const currentStats = result.stats || DEFAULT_STATS;
    const updatedStats = { ...currentStats, ...stats };
    
    chrome.storage.sync.set({ stats: updatedStats }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error saving stats to local storage:', chrome.runtime.lastError);
      }
    });
  });
} 