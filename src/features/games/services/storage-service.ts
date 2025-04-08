/**
 * Game Storage Service
 * 
 * שירות מאוחד לאחסון נתוני משחקים
 * מאפשר עבודה גם עם chrome.storage וגם עם Firestore
 */

import { AllGameStats, GameStats } from '../types';
import { FirestoreService } from '@/core/firebase/firestore';

// Interface for storage providers
interface StorageProvider {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Chrome Storage Provider
class ChromeStorageProvider implements StorageProvider {
  private storage: chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea;
  
  constructor(useSync: boolean = true) {
    this.storage = useSync ? chrome.storage.sync : chrome.storage.local;
  }
  
  async getItem<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      this.storage.get(key, (result) => {
        resolve(result[key] || null);
      });
    });
  }
  
  async setItem<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      this.storage.set({ [key]: value }, () => {
        resolve();
      });
    });
  }
  
  async removeItem(key: string): Promise<void> {
    return new Promise((resolve) => {
      this.storage.remove(key, () => {
        resolve();
      });
    });
  }
}

// Firestore Storage Provider
class FirestoreStorageProvider implements StorageProvider {
  private firestoreService: FirestoreService;
  private userId: string;
  
  constructor(userId: string, collectionName: string = 'game-progress') {
    this.firestoreService = new FirestoreService(collectionName);
    this.userId = userId;
  }
  
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const doc = await this.firestoreService.getDocument(`${this.userId}_${key}`);
      return doc?.data as T || null;
    } catch (error) {
      console.error(`Error getting item ${key} from Firestore:`, error);
      return null;
    }
  }
  
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await this.firestoreService.setDocument(`${this.userId}_${key}`, {
        userId: this.userId,
        key,
        data: value,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error(`Error setting item ${key} in Firestore:`, error);
      throw error;
    }
  }
  
  async removeItem(key: string): Promise<void> {
    try {
      await this.firestoreService.deleteDocument(`${this.userId}_${key}`);
    } catch (error) {
      console.error(`Error removing item ${key} from Firestore:`, error);
      throw error;
    }
  }
}

/**
 * Unified Game Storage Service
 */
export class GameStorageService {
  private provider: StorageProvider;
  private isChromeExtension: boolean;
  
  constructor(userId: string | null = null) {
    // Check if we're in a Chrome extension environment
    this.isChromeExtension = typeof chrome !== 'undefined' && chrome.storage !== undefined;
    
    // Choose the appropriate provider
    if (this.isChromeExtension) {
      this.provider = new ChromeStorageProvider(true);
    } else if (userId) {
      this.provider = new FirestoreStorageProvider(userId);
    } else {
      throw new Error('User ID is required for Firestore storage provider');
    }
  }
  
  /**
   * Switch to a different provider
   */
  setProvider(provider: 'chrome-sync' | 'chrome-local' | 'firestore', userId?: string): void {
    if (provider.startsWith('chrome-') && !this.isChromeExtension) {
      throw new Error('Chrome storage is not available in this environment');
    }
    
    if (provider === 'chrome-sync') {
      this.provider = new ChromeStorageProvider(true);
    } else if (provider === 'chrome-local') {
      this.provider = new ChromeStorageProvider(false);
    } else if (provider === 'firestore') {
      if (!userId) {
        throw new Error('User ID is required for Firestore storage provider');
      }
      this.provider = new FirestoreStorageProvider(userId);
    }
  }
  
  /**
   * Get game progress
   */
  async getGameProgress<T>(gameId: string): Promise<T | null> {
    return this.provider.getItem<T>(`game_progress_${gameId}`);
  }
  
  /**
   * Save game progress
   */
  async saveGameProgress<T>(gameId: string, data: T): Promise<void> {
    return this.provider.setItem<T>(`game_progress_${gameId}`, data);
  }
  
  /**
   * Delete game progress
   */
  async deleteGameProgress(gameId: string): Promise<void> {
    return this.provider.removeItem(`game_progress_${gameId}`);
  }
  
  /**
   * Get game statistics for a specific game
   */
  async getGameStats(gameId: string): Promise<GameStats | null> {
    const allStats = await this.getAllGameStats();
    return allStats ? allStats[gameId] : null;
  }
  
  /**
   * Get all game statistics
   */
  async getAllGameStats(): Promise<AllGameStats | null> {
    return this.provider.getItem<AllGameStats>(`game_stats`);
  }
  
  /**
   * Update game statistics
   */
  async updateGameStats(gameId: string, stats: Partial<GameStats>): Promise<GameStats> {
    const allStats = await this.getAllGameStats() || {};
    
    // Get current stats or create default
    const currentStats = allStats[gameId] || {
      bestScore: 0,
      totalGames: 0,
      recentScores: [],
    };
    
    // Create updated stats
    const updatedStats: GameStats = {
      ...currentStats,
      ...stats,
      totalGames: (currentStats.totalGames || 0) + 1,
      recentScores: [
        ...(stats.bestScore ? [stats.bestScore] : []),
        ...(currentStats.recentScores || []),
      ].slice(0, 10),
    };
    
    // If the new score is better, update the best score
    if (stats.bestScore && (stats.bestScore > currentStats.bestScore)) {
      updatedStats.bestScore = stats.bestScore;
    }
    
    // Save the updated stats
    await this.provider.setItem<AllGameStats>(`game_stats`, {
      ...allStats,
      [gameId]: updatedStats,
    });
    
    return updatedStats;
  }
}

// Export singleton instance
export const createGameStorageService = (userId: string | null = null): GameStorageService => {
  return new GameStorageService(userId);
}; 