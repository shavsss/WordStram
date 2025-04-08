/**
 * Game Progress Service
 * 
 * שירות לניהול התקדמות והישגים במשחקים
 */

import { FirestoreService } from '@/core/firebase/firestore';
import { GameStats, AllGameStats } from '../types';

interface GameProgress {
  gameId: string;
  currentState: any;
  timestamp: number;
}

export class GameProgressService extends FirestoreService {
  private static AUTOSAVE_INTERVAL = 30000; // 30 seconds
  private autoSaveTimer: number | null = null;
  
  constructor() {
    super('game-progress');
  }
  
  /**
   * Save game progress
   */
  async saveProgress(gameId: string, state: any): Promise<void> {
    const progress: GameProgress = {
      gameId,
      currentState: state,
      timestamp: Date.now()
    };
    
    await this.setDocument(gameId, progress);
  }
  
  /**
   * Load game progress
   */
  async loadProgress(gameId: string): Promise<any | null> {
    const doc = await this.getDocument(gameId);
    return doc?.currentState || null;
  }
  
  /**
   * Start auto-save for a game
   */
  startAutoSave(gameId: string, getState: () => any): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = window.setInterval(() => {
      const currentState = getState();
      this.saveProgress(gameId, currentState)
        .catch(error => console.error('Auto-save failed:', error));
    }, GameProgressService.AUTOSAVE_INTERVAL);
  }
  
  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  /**
   * Update game statistics
   */
  async updateStats(gameId: string, stats: Partial<GameStats>): Promise<void> {
    const doc = await this.getDocument('stats');
    const currentStats: AllGameStats = doc?.stats || {};
    
    const updatedStats = {
      ...currentStats[gameId as keyof AllGameStats],
      ...stats,
      lastPlayed: new Date().toISOString()
    };
    
    await this.setDocument('stats', {
      stats: {
        ...currentStats,
        [gameId]: updatedStats
      }
    });
  }
  
  /**
   * Get game statistics
   */
  async getStats(): Promise<AllGameStats> {
    const doc = await this.getDocument('stats');
    return doc?.stats || {};
  }
  
  /**
   * Clear game progress
   */
  async clearProgress(gameId: string): Promise<void> {
    await this.deleteDocument(gameId);
  }
}

// Export singleton instance
export const gameProgressService = new GameProgressService(); 