'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Word, WordStats, VocabularyFilter, StorageData } from '../types';
import { safeDate, safeFormatDate } from '@/utils/date-utils';
import { normalizeLanguageCode } from '@/services/caption-detectors/shared/language-map';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * הוק לניהול אוצר מילים
 */
export function useVocabulary() {
  // State
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<WordStats>({
    totalWords: 0,
    todayWords: 0,
    streak: 0,
    lastActive: new Date().toISOString().split('T')[0]
  });
  const [filters, setFilters] = useState<VocabularyFilter>({
    language: 'all',
    dateFilter: 'all',
    groupByLanguage: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  /**
   * עזר: המתנה לזמינות ה-API של כרום
   */
  const waitForChromeAPI = useCallback(async (retries = 5): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.sync) {
        return true;
      }
      console.log(`WordStream: Waiting for Chrome API (attempt ${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
  }, []);

  /**
   * טעינת נתונים מהאחסון
   */
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!await waitForChromeAPI()) {
        throw new Error('Chrome API not available');
      }

      const result = await new Promise<StorageData>((resolve, reject) => {
        chrome.storage.sync.get(['settings', 'stats', 'words', 'words_metadata', 'words_groups'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message || 'Error accessing storage');
          } else {
            resolve(result);
          }
        });
      });

      // טיפול במילים
      let allWords: Word[] = [];

      // טעינת מילים מפורמט חדש או ישן
      if (result.words_metadata && result.words_groups && Array.isArray(result.words_groups)) {
        console.log('WordStream: Loading words in new grouped format');
        
        // Fetch all word groups
        const wordGroups = await new Promise<any>((resolve, reject) => {
          chrome.storage.sync.get(result.words_groups as string[], (groupsResult) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(groupsResult);
            }
          });
        });
        
        // הוספת מילים מכל הקבוצות
        for (const groupKey of result.words_groups) {
          if (wordGroups[groupKey] && Array.isArray(wordGroups[groupKey])) {
            allWords.push(...wordGroups[groupKey]);
          }
        }
        
        console.log(`WordStream: Loaded ${allWords.length} words from new format`);
      } else if (result.words && Array.isArray(result.words)) {
        console.log('WordStream: Loading words in old format');
        allWords = result.words;
      }
      
      // אם יש מילים, נטפל בכפילויות
      if (allWords.length > 0) {
        // הסרת מילים כפולות
        const wordsMap = new Map();
        console.log(`Checking ${allWords.length} words for duplicates...`);
        
        const uniqueWords = allWords.filter(word => {
          // דילוג על מילים ללא שדות חובה
          if (!word.word || !word.language) return true;
          
          // נירמול המילה להשוואה
          const normalizedWord = word.word.trim().toLowerCase();
          const key = `${normalizedWord}-${word.language}-${word.targetLanguage || ''}`;
          
          if (wordsMap.has(key)) {
            // אם כפילות קיימת, שומר על החדשה יותר
            const existingWord = wordsMap.get(key);
            const existingTime = existingWord.timestamp ? (typeof existingWord.timestamp === 'number' ? 
              existingWord.timestamp : new Date(existingWord.timestamp).getTime()) : 0;
            
            const currentTime = word.timestamp ? (typeof word.timestamp === 'number' ? 
              word.timestamp : new Date(word.timestamp).getTime()) : 0;
            
            console.log(`Found duplicate: "${word.word}" (${word.language}/${word.targetLanguage})`);
            
            if (currentTime > existingTime) {
              console.log(`  Keeping newer version from ${safeFormatDate(word.timestamp, 'PPP')}`);
              wordsMap.set(key, word);
              return true;
            }
            console.log(`  Keeping older version from ${safeFormatDate(existingWord.timestamp, 'PPP')}`);
            return false;
          } else {
            wordsMap.set(key, word);
            return true;
          }
        });
        
        // עדכון המצב המקומי
        setWords(uniqueWords);
        
        // עדכון הסטטיסטיקות
        const updatedStats = {
          totalWords: uniqueWords.length,
          todayWords: result.stats?.todayWords || 0,
          streak: result.stats?.streak || 0,
          lastActive: result.stats?.lastActive || new Date().toISOString()
        };
        
        setStats(updatedStats);
      } else {
        // אין מילים
        setWords([]);
        
        if (result.stats) {
          setStats({
            totalWords: 0,
            todayWords: result.stats.todayWords || 0,
            streak: result.stats.streak || 0,
            lastActive: result.stats.lastActive || new Date().toISOString()
          });
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading vocabulary data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load vocabulary data');
      setIsLoading(false);
    }
  }, [waitForChromeAPI]);
  
  /**
   * הוספה או עדכון מילה
   */
  const addOrUpdateWord = useCallback(async (newWord: Word): Promise<boolean> => {
    try {
      if (!await waitForChromeAPI()) {
        console.error('Chrome API not available');
        return false;
      }

      // וידוא שיש שפת יעד
      const wordWithDefaults = {
        ...newWord,
        // וידוא שיש חותמת זמן
        timestamp: newWord.timestamp || Date.now()
      };

      // בדיקה אם המילה כבר קיימת
      const existingWordIndex = words.findIndex(w => 
        w.word.trim().toLowerCase() === wordWithDefaults.word.trim().toLowerCase() && 
        w.language === wordWithDefaults.language &&
        w.targetLanguage === wordWithDefaults.targetLanguage
      );

      let updatedWords = [...words];

      if (existingWordIndex >= 0) {
        // עדכון מילה קיימת
        updatedWords[existingWordIndex] = {
          ...wordWithDefaults,
          timestamp: Date.now() // עדכון חותמת הזמן
        };
      } else {
        // הוספת מילה חדשה
        updatedWords.push({
          ...wordWithDefaults,
          timestamp: Date.now()
        });
      }

      // מיון מילים לפי שפה ואלפבית
      updatedWords.sort((a, b) => {
        if (a.language === b.language) {
          return a.word.localeCompare(b.word);
        }
        return a.language.localeCompare(b.language);
      });

      // עדכון סטטיסטיקות
      const now = new Date().toISOString();
      const newStats = {
        ...stats,
        totalWords: updatedWords.length,
        lastActive: now
      };

      // עדכון המצב ואחסון
      setWords(updatedWords);
      setStats(newStats);

      // שמירה באחסון
      await new Promise<void>((resolve, reject) => {
        chrome.storage.sync.set({ 
          words: updatedWords, 
          stats: newStats 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message || 'Error saving to storage');
          } else {
            resolve();
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error adding/updating word:', error);
      // שחזור המצב הקודם במקרה של שגיאה
      await loadData();
      return false;
    }
  }, [words, stats, waitForChromeAPI, loadData]);

  /**
   * מחיקת מילה
   */
  const deleteWord = useCallback(async (wordToDelete: Word): Promise<boolean> => {
    try {
      if (!await waitForChromeAPI()) {
        console.error('Chrome API not available');
        return false;
      }

      // הסרת המילה מהמערך
      const updatedWords = words.filter(w => 
        !(w.word.trim().toLowerCase() === wordToDelete.word.trim().toLowerCase() && 
          w.language === wordToDelete.language && 
          w.targetLanguage === wordToDelete.targetLanguage)
      );

      if (updatedWords.length === words.length) {
        console.log('Word not found, nothing to delete.');
        return false;
      }

      // עדכון סטטיסטיקות
      const newStats = {
        ...stats,
        totalWords: updatedWords.length,
        todayWords: stats.todayWords > 0 ? stats.todayWords - 1 : 0,
      };

      // עדכון מצב
      setWords(updatedWords);
      setStats(newStats);

      // שמירה באחסון
      await new Promise<void>((resolve, reject) => {
        chrome.storage.sync.set({ 
          words: updatedWords, 
          stats: newStats 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message || 'Error saving to storage');
          } else {
            resolve();
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Error deleting word:', error);
      // שחזור המצב הקודם במקרה של שגיאה
      await loadData();
      return false;
    }
  }, [words, stats, waitForChromeAPI, loadData]);

  /**
   * עדכון פילטרים
   */
  const updateFilters = useCallback((newFilters: Partial<VocabularyFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * מילים מסוננות לפי הפילטרים הנוכחיים
   */
  const filteredWords = useMemo(() => {
    let filtered = [...words];
    
    // סינון לפי שפה
    if (filters.language !== 'all') {
      filtered = filtered.filter(word => word.language === filters.language);
    }
    
    // סינון לפי תאריך
    if (filters.dateFilter !== 'all' && filtered.length > 0) {
      const today = new Date();
      // נירמול היום לחצות מקומית
      const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      switch (filters.dateFilter) {
        case 'today':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // פירוק תאריך המילה ונירמול לחצות מקומית
            const wordTimestamp = safeDate(word.timestamp);
            if (!wordTimestamp) return false;
            
            const wordDateNormalized = new Date(
              wordTimestamp.getFullYear(),
              wordTimestamp.getMonth(),
              wordTimestamp.getDate()
            );
            
            // השוואת התאריכים המנורמלים
            return +wordDateNormalized === +todayNormalized;
          });
          break;
        case 'week':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // חישוב תחילת השבוע
            const startOfWeek = new Date(todayNormalized);
            startOfWeek.setDate(todayNormalized.getDate() - todayNormalized.getDay());
            
            // פירוק תאריך המילה ונירמול לחצות מקומית
            const wordTimestamp = safeDate(word.timestamp);
            if (!wordTimestamp) return false;
            
            const wordDateNormalized = new Date(
              wordTimestamp.getFullYear(),
              wordTimestamp.getMonth(),
              wordTimestamp.getDate()
            );
            
            // השוואת התאריכים
            return +wordDateNormalized >= +startOfWeek;
          });
          break;
        case 'month':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // פירוק תאריך המילה
            const wordTimestamp = safeDate(word.timestamp);
            if (!wordTimestamp) return false;
            
            // השוואה ישירה של חודש ושנה
            return (
              wordTimestamp.getMonth() === today.getMonth() &&
              wordTimestamp.getFullYear() === today.getFullYear()
            );
          });
          break;
        case 'custom':
          if (filters.customDate) {
            filtered = filtered.filter(word => {
              if (!word.timestamp) return false;
              
              // נירמול תאריך מותאם לחצות מקומית
              const customDateParts = filters.customDate!.split('-').map(Number);
              const selectedDate = new Date(customDateParts[0], customDateParts[1] - 1, customDateParts[2]);
              
              // פירוק תאריך המילה ונירמול לחצות מקומית
              const wordTimestamp = safeDate(word.timestamp);
              if (!wordTimestamp) return false;
              
              const wordDateNormalized = new Date(
                wordTimestamp.getFullYear(),
                wordTimestamp.getMonth(),
                wordTimestamp.getDate()
              );
              
              // השוואת התאריכים
              return +wordDateNormalized >= +selectedDate;
            });
          }
          break;
      }
    }
    
    return filtered;
  }, [words, filters]);

  /**
   * מילים מקובצות לפי שפה
   */
  const groupedWords = useMemo(() => {
    if (!filters.groupByLanguage) return { all: filteredWords };
    
    return filteredWords.reduce((acc, word) => {
      const lang = normalizeLanguageCode(word.language);
      if (!acc[lang]) {
        acc[lang] = [];
      }
      acc[lang].push(word);
      acc[lang].sort((a, b) => a.word.localeCompare(b.word));
      return acc;
    }, {} as Record<string, Word[]>);
  }, [filteredWords, filters.groupByLanguage]);

  /**
   * שפות זמינות מהמילים
   */
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    words.forEach(word => {
      if (word.language) {
        languages.add(word.language);
      }
    });
    return Array.from(languages);
  }, [words]);

  /**
   * טעינת נתונים בעת אתחול
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    words,
    stats,
    filters,
    filteredWords,
    groupedWords,
    availableLanguages,
    isLoading,
    error,
    loadData,
    addOrUpdateWord,
    deleteWord,
    updateFilters,
  };
} 