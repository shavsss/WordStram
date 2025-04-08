/**
 * Hook for Game Storage
 * 
 * הוק לניהול אחסון וטעינה של נתוני משחק, תומך הן באחסון מקומי והן בענן
 */

import { useState, useEffect, useCallback } from 'react';
import { GameStats } from '../types';
import { createGameStorageService } from '../services/storage-service';

interface UseGameStorageProps {
  gameId: string;
  userId: string | null;
  disableAutoLoad?: boolean; // אפשרות לבטל טעינה אוטומטית
}

interface UseGameStorageResult<T> {
  progress: T | null;
  stats: GameStats | null;
  isLoading: boolean;
  error: Error | null;
  saveProgress: (data: T) => Promise<void>;
  updateStats: (stats: Partial<GameStats>) => Promise<GameStats>;
  resetProgress: () => Promise<void>;
  loadProgress: () => Promise<T | null>; // פונקציה מפורשת לטעינת נתונים
  importData: (data: T) => Promise<void>; // ייבוא נתונים חיצוניים
  exportData: () => T | null; // ייצוא נתונים
}

/**
 * Hook for managing game storage operations
 * 
 * @template T סוג הנתונים שנשמרים
 * @param gameId מזהה המשחק
 * @param userId מזהה המשתמש (לא חובה בסביבת תוסף כרום)
 * @param disableAutoLoad האם לבטל טעינה אוטומטית של הנתונים
 * @returns פונקציות ומצב לניהול אחסון המשחק
 */
export function useGameStorage<T>({ 
  gameId, 
  userId,
  disableAutoLoad = false
}: UseGameStorageProps): UseGameStorageResult<T> {
  const [progress, setProgress] = useState<T | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!disableAutoLoad);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize storage service
  const storageService = createGameStorageService(userId);
  
  // Load progress and stats on mount (unless disabled)
  useEffect(() => {
    if (!disableAutoLoad) {
      loadData();
    }
  }, [gameId, userId, disableAutoLoad]);
  
  // טעינת נתונים מהאחסון
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load progress
      const savedProgress = await storageService.getGameProgress<T>(gameId);
      setProgress(savedProgress);
      
      // Load stats
      const gameStats = await storageService.getGameStats(gameId);
      setStats(gameStats);
      
      return savedProgress;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load game data');
      console.error('Error loading game data:', error);
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save progress
  const saveProgress = useCallback(async (data: T) => {
    try {
      setError(null);
      setIsLoading(true);
      await storageService.saveGameProgress<T>(gameId, data);
      setProgress(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save game progress');
      console.error('Error saving game progress:', error);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [gameId, storageService]);
  
  // Update stats
  const updateStats = useCallback(async (newStats: Partial<GameStats>) => {
    try {
      setError(null);
      setIsLoading(true);
      const updatedStats = await storageService.updateGameStats(gameId, newStats);
      setStats(updatedStats);
      return updatedStats;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update game stats');
      console.error('Error updating game stats:', error);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [gameId, storageService]);
  
  // Reset progress
  const resetProgress = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      await storageService.deleteGameProgress(gameId);
      setProgress(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reset game progress');
      console.error('Error resetting game progress:', error);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [gameId, storageService]);
  
  // Import data from external source
  const importData = useCallback(async (data: T) => {
    try {
      setError(null);
      setProgress(data);
      await saveProgress(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to import data');
      console.error('Error importing data:', error);
      setError(error);
      throw error;
    }
  }, [saveProgress]);
  
  // Export current data
  const exportData = useCallback((): T | null => {
    return progress;
  }, [progress]);
  
  // פונקציה מפורשת לטעינת נתונים
  const loadProgress = useCallback(async () => {
    return loadData();
  }, [gameId, userId, storageService]);
  
  return {
    progress,
    stats,
    isLoading,
    error,
    saveProgress,
    updateStats,
    resetProgress,
    loadProgress,
    importData,
    exportData
  };
} 