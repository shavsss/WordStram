import { Word, Settings, GameStats } from '../../shared/types';

// Define storage keys
export const STORAGE_KEYS = {
  WORDS: 'wordstream_words',
  WORDS_GROUPS: 'wordstream_words_groups',
  WORDS_METADATA: 'wordstream_words_metadata',
  SETTINGS: 'wordstream_settings',
  STATS: 'wordstream_stats',
  GAME_STATS: 'wordstream_game_stats',
  AUTH: 'wordstream_auth'
};

// Constants
const GROUP_SIZE = 10; // Number of words per group

class StorageService {
  // Initialize storage service
  async init(): Promise<void> {
    try {
      // Check if storage is accessible
      await chrome.storage.sync.get('test');
      console.log('Storage service initialized');
    } catch (error) {
      console.error('Error initializing storage service:', error);
      throw error;
    }
  }

  // Get settings with defaults
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      return result[STORAGE_KEYS.SETTINGS] || {
        targetLanguage: 'en',
        autoTranslate: true,
        notifications: true,
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        showTranslations: true
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }
  
  // Save settings
  async saveSettings(settings: Settings): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
      
      // Broadcast settings change to other contexts
      chrome.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        settings
      }).catch(err => console.warn('Error broadcasting settings update:', err));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
  
  // Get all words with improved handling for larger datasets
  async getAllWords(): Promise<Word[]> {
    try {
      // First check if we're using the grouped format
      const metadata = await chrome.storage.sync.get([
        STORAGE_KEYS.WORDS_METADATA,
        STORAGE_KEYS.WORDS_GROUPS
      ]);
      
      // If we have metadata and groups, use the new format
      if (metadata[STORAGE_KEYS.WORDS_METADATA] && 
          Array.isArray(metadata[STORAGE_KEYS.WORDS_GROUPS])) {
        
        console.log('Using grouped words format');
        
        // Get all word groups
        const groups = await chrome.storage.sync.get(
          metadata[STORAGE_KEYS.WORDS_GROUPS]
        );
        
        // Combine all groups
        let allWords: Word[] = [];
        for (const groupKey of metadata[STORAGE_KEYS.WORDS_GROUPS]) {
          if (groups[groupKey] && Array.isArray(groups[groupKey])) {
            allWords = [...allWords, ...groups[groupKey]];
          }
        }
        
        return allWords;
      }
      
      // Fallback to old format
      const result = await chrome.storage.sync.get(STORAGE_KEYS.WORDS);
      return result[STORAGE_KEYS.WORDS] || [];
    } catch (error) {
      console.error('Error getting words:', error);
      throw error;
    }
  }
  
  // Save a word with automatic grouping for larger datasets
  async saveWord(word: Word): Promise<void> {
    try {
      // Get all existing words first
      const allWords = await this.getAllWords();
      
      // Check if this word already exists (same original word, source and target language)
      const existingIndex = allWords.findIndex(w => 
        w.originalWord.trim().toLowerCase() === word.originalWord.trim().toLowerCase() && 
        w.sourceLanguage === word.sourceLanguage &&
        w.targetLanguage === word.targetLanguage
      );
      
      // If word exists, update it
      if (existingIndex >= 0) {
        allWords[existingIndex] = {
          ...word,
          timestamp: new Date().toISOString()
        };
      } else {
        // Otherwise add new word
        allWords.push({
          ...word,
          id: word.id || `word_${Date.now()}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Use the grouped format for storage to handle larger datasets
      // Organize words into groups of GROUP_SIZE
      const wordsByGroup: Record<string, Word[]> = {};
      
      allWords.forEach((word, index) => {
        const groupIndex = Math.floor(index / GROUP_SIZE);
        const groupKey = `words_group_${groupIndex}`;
        
        if (!wordsByGroup[groupKey]) {
          wordsByGroup[groupKey] = [];
        }
        
        wordsByGroup[groupKey].push(word);
      });
      
      // Create metadata
      const wordsMetadata = {
        totalGroups: Object.keys(wordsByGroup).length,
        totalWords: allWords.length,
        lastUpdated: new Date().toISOString()
      };
      
      // Create data to save
      const dataToSave: Record<string, any> = {
        [STORAGE_KEYS.WORDS_METADATA]: wordsMetadata,
        [STORAGE_KEYS.WORDS_GROUPS]: Object.keys(wordsByGroup)
      };
      
      // Add each group to the data
      for (const [groupKey, groupWords] of Object.entries(wordsByGroup)) {
        dataToSave[groupKey] = groupWords;
      }
      
      // Save everything in one operation
      await chrome.storage.sync.set(dataToSave);
      
      // Update stats
      await this.updateStats({
        totalWords: allWords.length,
        lastSaved: new Date().toISOString()
      });
      
      // Notify about word added/updated
      chrome.runtime.sendMessage({
        type: 'WORD_UPDATED',
        word
      }).catch(err => console.warn('Error broadcasting word update:', err));
    } catch (error) {
      console.error('Error saving word:', error);
      throw error;
    }
  }
  
  // Delete a word
  async deleteWord(wordId: string): Promise<void> {
    try {
      const allWords = await this.getAllWords();
      
      // Filter out the word to delete
      const updatedWords = allWords.filter(word => word.id !== wordId);
      
      // Use the grouped format for storage
      const wordsByGroup: Record<string, Word[]> = {};
      
      updatedWords.forEach((word, index) => {
        const groupIndex = Math.floor(index / GROUP_SIZE);
        const groupKey = `words_group_${groupIndex}`;
        
        if (!wordsByGroup[groupKey]) {
          wordsByGroup[groupKey] = [];
        }
        
        wordsByGroup[groupKey].push(word);
      });
      
      // Create metadata
      const wordsMetadata = {
        totalGroups: Object.keys(wordsByGroup).length,
        totalWords: updatedWords.length,
        lastUpdated: new Date().toISOString()
      };
      
      // Create data to save
      const dataToSave: Record<string, any> = {
        [STORAGE_KEYS.WORDS_METADATA]: wordsMetadata,
        [STORAGE_KEYS.WORDS_GROUPS]: Object.keys(wordsByGroup)
      };
      
      // Add each group to the data
      for (const [groupKey, groupWords] of Object.entries(wordsByGroup)) {
        dataToSave[groupKey] = groupWords;
      }
      
      // Save everything in one operation
      await chrome.storage.sync.set(dataToSave);
      
      // Update stats
      await this.updateStats({
        totalWords: updatedWords.length,
        lastSaved: new Date().toISOString()
      });
      
      // Notify about word deleted
      chrome.runtime.sendMessage({
        type: 'WORD_DELETED',
        wordId
      }).catch(err => console.warn('Error broadcasting word deletion:', err));
    } catch (error) {
      console.error('Error deleting word:', error);
      throw error;
    }
  }
  
  // Get stats
  async getStats(): Promise<any> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.STATS);
      return result[STORAGE_KEYS.STATS] || {
        totalWords: 0,
        todayWords: 0,
        streak: 0,
        lastActive: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
  
  // Update stats
  async updateStats(statsUpdate: Partial<any>): Promise<void> {
    try {
      // Get current stats
      const currentStats = await this.getStats();
      
      // Merge updates
      const updatedStats = {
        ...currentStats,
        ...statsUpdate
      };
      
      // Save updated stats
      await chrome.storage.sync.set({ [STORAGE_KEYS.STATS]: updatedStats });
      
      // Notify about stats update
      chrome.runtime.sendMessage({
        type: 'STATS_UPDATED',
        stats: updatedStats
      }).catch(err => console.warn('Error broadcasting stats update:', err));
    } catch (error) {
      console.error('Error updating stats:', error);
      throw error;
    }
  }
  
  // Get game stats
  async getGameStats(gameType: string): Promise<GameStats | null> {
    try {
      const result = await chrome.storage.sync.get(`${STORAGE_KEYS.GAME_STATS}_${gameType}`);
      return result[`${STORAGE_KEYS.GAME_STATS}_${gameType}`] || null;
    } catch (error) {
      console.error(`Error getting ${gameType} stats:`, error);
      throw error;
    }
  }
  
  // Save game stats
  async saveGameStats(gameType: string, stats: GameStats): Promise<void> {
    try {
      await chrome.storage.sync.set({ [`${STORAGE_KEYS.GAME_STATS}_${gameType}`]: stats });
    } catch (error) {
      console.error(`Error saving ${gameType} stats:`, error);
      throw error;
    }
  }
  
  // Update game stats
  async updateGameStats(stats: Partial<GameStats>): Promise<void> {
    try {
      // This assumes gameType is included in the stats object
      if (!stats.gameType) {
        throw new Error('Game type is required in stats object');
      }
      
      const gameType = stats.gameType;
      
      // Get current stats
      const currentStats = await this.getGameStats(gameType);
      
      // Merge updates
      const updatedStats = {
        ...currentStats,
        ...stats,
        lastUpdated: new Date().toISOString()
      };
      
      // Save updated stats
      await this.saveGameStats(gameType, updatedStats as GameStats);
    } catch (error) {
      console.error('Error updating game stats:', error);
      throw error;
    }
  }
  
  // Local storage utilities
  storage = {
    async getItem<T>(key: string): Promise<T | null> {
      return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
          resolve(result[key] || null);
        });
      });
    },
    
    async setItem(key: string, value: any): Promise<void> {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    },
    
    async removeItem(key: string): Promise<void> {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove(key, resolve);
      });
    }
  };
}

// Create a singleton instance
const storageService = new StorageService();
export default storageService; 