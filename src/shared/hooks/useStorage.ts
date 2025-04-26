import { useState, useEffect, useCallback } from 'react';
import storageService from '../../services/storage/storage-service';
import type { Word, Settings, GameStats } from '../types';

/**
 * Hook for words management
 */
export function useWords() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load words
  const loadWords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allWords = await storageService.getAllWords();
      setWords(allWords);
    } catch (err) {
      setError('Failed to load words');
      console.error('Error loading words:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Add or update word
  const saveWord = useCallback(async (word: Word) => {
    try {
      await storageService.saveWord(word);
      await loadWords(); // Reload words after saving
      return true;
    } catch (err) {
      console.error('Error saving word:', err);
      return false;
    }
  }, [loadWords]);
  
  // Delete word
  const deleteWord = useCallback(async (wordId: string) => {
    try {
      await storageService.deleteWord(wordId);
      await loadWords(); // Reload words after deleting
      return true;
    } catch (err) {
      console.error('Error deleting word:', err);
      return false;
    }
  }, [loadWords]);
  
  // Load words on mount
  useEffect(() => {
    loadWords();
    
    // Listen for word changes from other contexts
    const handleMessage = (message: any) => {
      if (message.type === 'WORD_UPDATED' || message.type === 'WORD_DELETED') {
        loadWords();
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadWords]);
  
  return { words, loading, error, saveWord, deleteWord, refreshWords: loadWords };
}

/**
 * Hook for settings management
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const savedSettings = await storageService.getSettings();
      setSettings(savedSettings);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateSettings = useCallback(async (newSettings: Settings) => {
    try {
      await storageService.saveSettings(newSettings);
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    }
  }, []);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
    
    // Listen for settings changes from other contexts
    const handleMessage = (message: any) => {
      if (message.type === 'SETTINGS_UPDATED') {
        setSettings(message.settings);
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadSettings]);
  
  return { settings, loading, updateSettings };
}

/**
 * Hook for game stats
 */
export function useGameStats(gameType: string) {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const gameStats = await storageService.getGameStats(gameType);
      setStats(gameStats);
    } catch (err) {
      console.error(`Error loading ${gameType} stats:`, err);
    } finally {
      setLoading(false);
    }
  }, [gameType]);
  
  const updateStats = useCallback(async (newStats: GameStats) => {
    try {
      await storageService.saveGameStats(gameType, newStats);
      setStats(newStats);
      return true;
    } catch (err) {
      console.error(`Error saving ${gameType} stats:`, err);
      return false;
    }
  }, [gameType]);
  
  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);
  
  return { stats, loading, updateStats };
} 