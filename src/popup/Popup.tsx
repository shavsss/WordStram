'use client';

/**
 * ==============================================
 * IMPORTS
 * ==============================================
 */

// React וספריות בסיס
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

// ספריות תאריכים
import { 
  format, differenceInDays, isSameDay, isAfter, parseISO, 
  subDays, subMonths, addMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, getDay, addDays, isSameMonth, isToday 
} from 'date-fns';

// ייבוא אייקונים
import { 
  Settings, Moon, Sun, Calendar as CalendarIcon, Pencil, Brain, 
  Flame, Globe, BookOpen, Gamepad, BarChart, X, ChevronDown, 
  ChevronLeft, ChevronRight, RefreshCw, FileText, MessageSquare, 
  Download, LogOut, User 
} from 'lucide-react';

// תצורות וקונפיגורציה
import { LANGUAGE_MAP, normalizeLanguageCode } from '@/services/caption-detectors/shared/language-map';

// קומפוננטות UI
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// קומפוננטות אפליקציה
import { Games } from '@/components/games';
import { StatisticsPage } from '@/components/statistics/StatisticsPage';
import { NotesAndSummaries } from '@/content/modules/notes/NotesAndSummaries';
import { SavedChats } from '@/components/chats/SavedChats';

// שירותים וטיפוסים
import { Word } from '@/types/word';
import { useAuth } from '@/hooks/useAuth';
import * as BackgroundMessaging from '@/utils/background-messaging';
import { safeDate, safeFormatDate } from '@/utils/date-utils';

// ספריות חיצוניות
import * as XLSX from 'xlsx';

/**
 * ==============================================
 * INTERFACES & TYPES
 * ==============================================
 */

interface Stats {
  totalWords: number;
  todayWords: number;
  streak: number;
  lastActive: string;
}

interface Settings {
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  targetLanguage: string;
}

/**
 * Storage data interface for Chrome storage
 */
interface StorageData {
  settings?: Settings;
  words?: Word[];
  stats?: {
    totalWords: number;
    todayWords: number;
    streak: number;
    lastActive: string;
  };
  words_metadata?: any;
  words_groups?: any;
}

/**
 * Props for the DatePicker component
 */
interface DatePickerProps {
  selectedDate: string;
  onChange: (date: string) => void;
  onClose: () => void;
}

/**
 * Props for the WordCard component
 */
interface WordCardProps {
  word: Word;
  onEdit: (word: Word) => void;
  onDelete: () => void;
}

/**
 * ==============================================
 * CONSTANTS
 * ==============================================
 */

// Constants for Chrome API initialization
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

/**
 * ==============================================
 * HELPER FUNCTIONS
 * ==============================================
 */

/**
 * Helper function to wait for Chrome API to be available
 * @param retries - Number of retry attempts
 * @returns Promise resolving to boolean indicating if Chrome API is available
 */
async function waitForChromeAPI(retries = MAX_RETRIES): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.sync) {
      return true;
    }
    console.log(`WordStream: Waiting for Chrome API (attempt ${i + 1}/${retries})...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  return false;
}

/**
 * ==============================================
 * SUB-COMPONENTS
 * ==============================================
 */

/**
 * DatePicker Component
 * 
 * תצוגה גרפית של לוח שנה לבחירת תאריך
 */
function DatePicker({ selectedDate, onChange, onClose }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = addDays(monthStart, -getDay(monthStart));
    const endDate = addDays(monthEnd, 6 - getDay(monthEnd));
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);
  
  /**
   * מעבר לחודש הקודם
   */
  const handlePrevMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, -1));
  };
  
  /**
   * מעבר לחודש הבא
   */
  const handleNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };
  
  /**
   * בחירת תאריך ספציפי
   */
  const handleSelectDate = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    onClose();
  };
  
  return (
    <div className="date-picker-calendar">
      <div className="date-picker-header">
        <div className="date-picker-month-year">
          {format(currentMonth, 'MMMM yyyy')}
        </div>
        <div className="date-picker-nav">
          <button onClick={handlePrevMonth} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleNextMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="date-picker-days">
        {dayNames.map(day => (
          <div key={day} className="date-picker-day-name">{day}</div>
        ))}
        
        {calendarDays.map(day => (
          <div
            key={day.toISOString()}
            className={`date-picker-day ${
              !isSameMonth(day, currentMonth) ? 'outside-month' : ''
            } ${isToday(day) ? 'today' : ''} ${
              selectedDate && isSameDay(day, new Date(selectedDate)) ? 'selected' : ''
            }`}
            onClick={() => handleSelectDate(day)}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ==============================================
 * MAIN COMPONENT
 * ==============================================
 */

/**
 * Popup Component
 * 
 * הקומפוננטה הראשית של חלון הפופאפ של התוסף.
 * מנהלת את התצוגה של המילים, המשחקים, הסטטיסטיקות והגדרות.
 */
export default function Popup() {
  const { isAuthenticated, currentUser, signOut } = useAuth();
  
  // State management
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWords: 0,
    todayWords: 0,
    streak: 0,
    lastActive: new Date().toISOString().split('T')[0]
  });
  const [settings, setSettings] = useState<Settings>({
    autoTranslate: true,
    notifications: true,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    targetLanguage: 'en'
  });
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: string | null;
    to: string | null;
  }>({
    from: null,
    to: null
  });
  
  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [groupByLanguage, setGroupByLanguage] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  // View state
  const [showGames, setShowGames] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showStatsPage, setShowStatsPage] = useState(false);
  const [currentActiveView, setCurrentActiveView] = useState<string>("home");
  const [isThemeDark, setIsThemeDark] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'stats' | 'games' | 'notes' | 'chats'>('home');

  // New state for showing login dialog
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // New ref for games container
  const gamesContainer = useRef<HTMLDivElement>(null);

  /**
   * ==============================================
   * UTILITY FUNCTIONS
   * ==============================================
   */

  /**
   * פונקציית עזר להמרת מחרוזת תאריך לאובייקט Date
   */
  const parseDate = (dateString: string): Date | null => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  /**
   * פונקציית עזר לפורמט תאריך לקלט
   */
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    try {
      return format(date, "yyyy-MM-dd");
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  /**
   * ==============================================
   * EVENT HANDLERS
   * ==============================================
   */

  /**
   * טיפול בשינוי הגדרות
   */
  const handleSettingsChange = async (key: keyof Settings, value: boolean | string) => {
    if (!settings) return;

    console.log(`WordStream: Changing setting ${key} to`, value);

    // עדכון הגדרות מקומי
    const updatedSettings: Settings = {
      ...settings,
      [key]: value,
    };

    // שמירת ההגדרות בדפדן
    setSettings(updatedSettings);
    localStorage.setItem('wordstream_settings', JSON.stringify(updatedSettings));

    // שליחת הגדרות שפה לתסריט רקע אם צריך
    if (key === 'targetLanguage') {
      if (chrome?.runtime?.sendMessage) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'updateLanguageSettings',
            settings: {
              targetLanguage: value
            }
          });

          console.log('WordStream: Language settings update response:', response);
        } catch (error) {
          console.error('WordStream: Failed to update language settings:', error);
        }
      }
    }
  };

  /**
   * הוספת או עריכת מילה
   */
  const handleAddWord = async (newWord: Word) => {
    try {
      if (!await waitForChromeAPI()) {
        console.error('Chrome API not available');
        return;
      }

      console.log('Adding/editing word:', newWord);

      // Make sure the word has a targetLanguage - use settings.targetLanguage if not provided
      const wordWithTarget = {
        ...newWord,
        targetLanguage: newWord.targetLanguage || settings.targetLanguage
      };

      // Check if word already exists with same original word, source language AND target language (translation language)
      const existingWordIndex = words.findIndex(w => 
        w.originalWord.trim().toLowerCase() === wordWithTarget.originalWord.trim().toLowerCase() && 
        w.sourceLanguage === wordWithTarget.sourceLanguage &&
        w.targetLanguage === wordWithTarget.targetLanguage
      );

      if (existingWordIndex >= 0) {
        console.log('Word already exists, updating existing word:', existingWordIndex, words[existingWordIndex]);
      } else {
        console.log('Adding new word, no duplicate found');
      }

      let updatedWords = [...words];
      const now = new Date().toISOString();

      if (existingWordIndex >= 0) {
        // Update existing word
        updatedWords[existingWordIndex] = {
          ...wordWithTarget,
          timestamp: now
        };
      } else {
        // Add new word
        updatedWords.push({
          ...wordWithTarget,
          timestamp: now
        });
      }

      // Sort words by language and then alphabetically
      updatedWords.sort((a: Word, b: Word) => {
        if (a.sourceLanguage === b.sourceLanguage) {
          return a.originalWord.localeCompare(b.originalWord);
        }
        return a.sourceLanguage.localeCompare(b.sourceLanguage);
      });

      // Update stats
      const newStats = {
        ...stats,
        totalWords: updatedWords.length,
        lastActive: now
      };

      // Update state and storage
      setWords(updatedWords);
      setStats(newStats);

      chrome.storage.sync.set({ 
        words: updatedWords, 
        stats: newStats 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving to storage:', chrome.runtime.lastError);
          setWords(words);
          setStats(stats);
        }
      });

    } catch (error) {
      console.error('Error in handleAddWord:', error);
      setWords(words);
      setStats(stats);
    }
  };

  // Filter words by selected language
  const filteredWords = useMemo(() => {
    let filtered = [...words];
    
    // Filtrar por idioma
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(word => word.sourceLanguage === selectedLanguage);
    }
    
    // Filtrar por data
    if (dateFilter !== 'all' && filtered.length > 0) {
      const today = new Date();
      // Normalize today to local midnight
      const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // Parse word date and normalize to local midnight
            const wordTimestamp = safeDate(word.timestamp);
            const wordDateNormalized = new Date(
              wordTimestamp.getFullYear(),
              wordTimestamp.getMonth(),
              wordTimestamp.getDate()
            );
            
            // Compare the normalized dates (convert to numbers for exact comparison)
            return +wordDateNormalized === +todayNormalized;
          });
          break;
        case 'week':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // Calculate start of week (Sunday) normalized to local midnight
            const startOfWeek = new Date(todayNormalized);
            startOfWeek.setDate(todayNormalized.getDate() - todayNormalized.getDay());
            
            // Parse word date and normalize to local midnight
            const wordTimestamp = safeDate(word.timestamp);
            const wordDateNormalized = new Date(
              wordTimestamp.getFullYear(),
              wordTimestamp.getMonth(),
              wordTimestamp.getDate()
            );
            
            // Compare the normalized dates
            return +wordDateNormalized >= +startOfWeek;
          });
          break;
        case 'month':
          filtered = filtered.filter(word => {
            if (!word.timestamp) return false;
            
            // Parse word date
            const wordTimestamp = safeDate(word.timestamp);
            
            // Compare month and year directly
            return (
              wordTimestamp.getMonth() === today.getMonth() &&
              wordTimestamp.getFullYear() === today.getFullYear()
            );
          });
          break;
        case 'custom':
          if (customDate) {
            filtered = filtered.filter(word => {
              if (!word.timestamp) return false;
              
              // Normalize custom date to local midnight
              const customDateParts = customDate.split('-').map(Number);
              const selectedDate = new Date(customDateParts[0], customDateParts[1] - 1, customDateParts[2]);
              
              // Parse word date and normalize to local midnight
              const wordTimestamp = safeDate(word.timestamp);
              const wordDateNormalized = new Date(
                wordTimestamp.getFullYear(),
                wordTimestamp.getMonth(),
                wordTimestamp.getDate()
              );
              
              // Compare the normalized dates
              return +wordDateNormalized >= +selectedDate;
            });
          }
          break;
      }
    }
    
    return filtered;
  }, [words, selectedLanguage, dateFilter, customDate]);

  // Group words by source language
  const groupedWords = useMemo(() => {
    if (!groupByLanguage) return { all: filteredWords };
    
    return filteredWords.reduce((acc, word) => {
      const lang = normalizeLanguageCode(word.sourceLanguage);
      if (!acc[lang]) {
        acc[lang] = [];
      }
      acc[lang].push(word);
      acc[lang].sort((a, b) => a.originalWord.localeCompare(b.originalWord));
      return acc;
    }, {} as Record<string, Word[]>);
  }, [filteredWords, groupByLanguage]);

  // Get unique languages from words
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    words.forEach(word => {
      if (word.sourceLanguage) {
        languages.add(word.sourceLanguage);
      }
    });
    return Array.from(languages);
  }, [words]);

  // Convert LANGUAGE_MAP to array of options for Select component
  const languageOptions = Object.entries(LANGUAGE_MAP)
    .filter(([code]) => code !== 'auto') // Remove 'auto' from target language options
    .map(([code, name]) => ({
      value: code,
      label: name
    }));

  // Load saved data when popup opens
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Wait for Chrome API to be available
        if (!await waitForChromeAPI()) {
          setError('Chrome API not available. Please try reloading the extension.');
          setIsLoading(false);
          return;
        }

        // Load saved settings
        const result = await new Promise<StorageData>((resolve, reject) => {
          chrome.storage.sync.get(['settings', 'words', 'stats', 'words_metadata', 'words_groups'], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });

        const savedSettings = result.settings || {
          targetLanguage: 'en',
          autoTranslate: true,
          notifications: true,
          darkMode: false
        };

        setSettings(savedSettings);
        
        // Apply dark mode from saved settings
        document.documentElement.classList.toggle('dark', savedSettings.darkMode);

        // Initialize Firestore data sync for real-time updates
        if (isAuthenticated) {
          console.log('WordStream Popup: User is authenticated, initializing data sync');
          
          // Start data synchronization with Firestore
          const cleanup = await BackgroundMessaging.initializeDataSync();
          
          // Set up broadcast listener for real-time updates
          const broadcastCleanup = BackgroundMessaging.setupBroadcastListener(handleBroadcastMessage);
          
          // Return a cleanup function for when the popup is closed
          return () => {
            console.log('WordStream Popup: Cleaning up data sync');
            cleanup();
            broadcastCleanup();
          };
        } else {
          console.log('WordStream Popup: User is not authenticated, loading from local storage only');
        }
        
        // Load words from either new format or old format
        let allWords: any[] = [];
        
        if (result.words_metadata && result.words_groups && Array.isArray(result.words_groups)) {
          console.log('WordStream: Loading words in new grouped format');
          
          // Fetch all word groups
          const wordGroups = await new Promise<any>((resolve, reject) => {
            chrome.storage.sync.get(result.words_groups, (groupsResult) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(groupsResult);
              }
            });
          });
          
          // Combine all groups into one array
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
        
        // If we have words to process
        if (allWords.length > 0) {
          // Remove duplicate words based on originalWord, sourceLanguage and targetLanguage
          const wordsMap = new Map();
          console.log(`Checking ${allWords.length} words for duplicates...`);
          
          const uniqueWords = allWords.filter(word => {
            // Skip words without proper fields (might be from older versions)
            if (!word.originalWord || !word.sourceLanguage) return true;
            
            // Normalize the word for comparison (trim whitespace and convert to lowercase)
            const normalizedWord = word.originalWord.trim().toLowerCase();
            const key = `${normalizedWord}-${word.sourceLanguage}-${word.targetLanguage || ''}`;
            
            if (wordsMap.has(key)) {
              // If duplicate exists, keep the newer one
              const existingWord = wordsMap.get(key);
              const existingTime = safeDate(existingWord.timestamp).getTime();
              const currentTime = safeDate(word.timestamp).getTime();
              
              console.log(`Found duplicate: "${word.originalWord}" (${word.sourceLanguage}/${word.targetLanguage})`);
              
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
          
          // Update local state
          setWords(uniqueWords);
          
          // Process stats and ensure they're accurate
        if (result.stats) {
          // Ensure lastActive is a valid date
          const lastActive = result.stats.lastActive && !isNaN(safeDate(result.stats.lastActive).getTime()) ? 
            result.stats.lastActive : 
            new Date().toISOString();
          
            // Update local state with correct word count
          setStats({
              totalWords: uniqueWords.length,
            todayWords: result.stats.todayWords || 0,
            streak: result.stats.streak || 0,
            lastActive
          });
            
            // If word count in storage doesn't match actual count, update it
            if (result.stats.totalWords !== uniqueWords.length) {
              console.log(`Updating word count in storage from ${result.stats.totalWords} to ${uniqueWords.length}`);
              
              // Update storage with correct word count
              chrome.storage.sync.set({ 
                stats: {
                  ...result.stats,
                  totalWords: uniqueWords.length
                }
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error updating word count in storage:', chrome.runtime.lastError);
                } else {
                  console.log('Word count updated successfully in storage');
                }
              });
            }
          }
        } else {
          // No words found
          setWords([]);
          
          if (result.stats) {
            // Ensure lastActive is a valid date
            const lastActive = result.stats.lastActive && !isNaN(safeDate(result.stats.lastActive).getTime()) ? 
              result.stats.lastActive : 
              new Date().toISOString();
            
            // Update stats with zero words
            setStats({
              totalWords: 0,
              todayWords: result.stats.todayWords || 0,
              streak: result.stats.streak || 0,
              lastActive
            });
            
            // If word count in storage is not zero, update it
            if (result.stats.totalWords !== 0) {
              console.log(`Updating word count in storage from ${result.stats.totalWords} to 0`);
              
              // Update storage with zero words count
              chrome.storage.sync.set({ 
                stats: {
                  ...result.stats,
                  totalWords: 0
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('WordStream: Error loading data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    // Load data and get cleanup function
    const cleanupPromise = loadData();
    
    // Return cleanup function
    return () => {
      cleanupPromise.then(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [isAuthenticated]); // Re-run when authentication state changes

  // Add broadcast message handler
  const handleBroadcastMessage = useCallback((message: any) => {
    console.log('WordStream Popup: Received broadcast message:', message);
    
    if (message.action === 'WORDS_UPDATED' && Array.isArray(message.words)) {
      console.log(`WordStream Popup: Updating words from broadcast (${message.words.length} words)`);
      setWords(message.words);
    }
    
    if (message.action === 'STATS_UPDATED' && message.stats) {
      console.log('WordStream Popup: Updating stats from broadcast');
      setStats(message.stats);
    }
    
    // Handle other message types as needed
  }, []);

  // Update the streak based on last active date
  useEffect(() => {
    const updateStreak = async () => {
      try {
        // Wait for Chrome API to be available
        if (!await waitForChromeAPI()) {
          return;
        }

        // Get the current stats
        const result = await new Promise<StorageData>((resolve, reject) => {
          chrome.storage.sync.get(['stats'], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });

        if (!result.stats) return;

        // Use the same streak calculation logic as in StatisticsPage
        const calculateStreak = (stats: any): number => {
          if (!stats || !stats.lastActive) return 0;
          
          const today = new Date();
          const lastActive = safeDate(stats.lastActive);
          
          // Reset time parts to compare just the dates
          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const lastActiveDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
          
          // Calculate difference in days
          const diffTime = Math.abs(todayDate.getTime() - lastActiveDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
          // If last active was today, maintain streak
          if (diffDays === 0) {
            return stats.streak || 1; // Ensure streak is at least 1 if active today
        }
        
        // If last active was yesterday, increment streak
          if (diffDays === 1 && lastActiveDate < todayDate) {
            return (stats.streak || 0) + 1;
          }
          
          // If last active was more than 1 day ago, reset streak to 1
          if (diffDays > 1) {
            return 1; // Reset to 1 (not 0) since opening popup counts as activity for today
          }
          
          // Default case - return existing streak or start at 1
          return stats.streak || 1;
        };

        const currentDate = new Date();
        const newStreak = calculateStreak(result.stats);
        
        // Update todayWords - reset if it's a new day
        const lastActiveDate = safeDate(result.stats.lastActive);
        const todayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        
        // תיקון: יוצר תאריך חדש במקום להעביר פרמטרים בנפרד
        const lastActiveNormalized = new Date(
          lastActiveDate.getFullYear(), 
          lastActiveDate.getMonth(), 
          lastActiveDate.getDate()
        );
        
        // If it's a new day, reset today's words count
        let todayWords = result.stats.todayWords || 0;
        if (todayDate.getTime() !== lastActiveNormalized.getTime()) {
          todayWords = 0;
        }
        
        // Update stats
        const updatedStats = {
          ...result.stats,
          streak: newStreak,
          todayWords,
          lastActive: currentDate.toISOString()
        };
        
        // Update state and storage
        setStats(updatedStats);
        
        chrome.storage.sync.set({ stats: updatedStats }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving streak to storage:', chrome.runtime.lastError);
          }
        });
      } catch (error) {
        console.error('Error updating streak:', error);
      }
    };

    updateStreak();
  }, []);

  // Handle back to main from statistics or games
  const handleBackToMain = () => {
    setCurrentView('home');
  };

  // Handle showing games
  const handleShowGames = () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    setCurrentView('games');
  };

  // Handle showing games from statistics (we'll keep this to avoid breaking existing references)
  const handleShowGamesFromStats = () => {
    handleShowGames();
  };

  // Function to refresh statistics data from storage
  const refreshStatistics = async () => {
    try {
      if (!await waitForChromeAPI()) {
        console.error('Chrome API not available');
        return;
      }

      // Try to get stats from Firestore first if the user is authenticated
      if (currentUser) {
        try {
          const firestoreStats = await BackgroundMessaging.getUserStats();
          if (firestoreStats) {
            console.log('WordStream: Successfully loaded stats from Firestore');
            setStats(firestoreStats);
            
            // Update local storage with Firestore stats
            chrome.storage.sync.set({ stats: firestoreStats }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error saving Firestore stats to local storage:', chrome.runtime.lastError);
              } else {
                console.log('WordStream: Successfully synced Firestore stats to local storage');
              }
            });
            
            return; // Exit early since we got stats from Firestore
          }
        } catch (firestoreError) {
          console.error('WordStream: Error loading stats from Firestore:', firestoreError);
          // Continue to load from local storage as fallback
        }
      }

      // Load the most up-to-date statistics from local storage
      const result = await new Promise<StorageData>((resolve, reject) => {
        chrome.storage.sync.get(['stats', 'words_metadata', 'words_groups', 'words'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message || 'Error accessing storage');
          } else {
            resolve(result);
          }
        });
      });

      // If we have stats, update them
      if (result.stats) {
        setStats({
          totalWords: result.stats.totalWords || 0,
          todayWords: result.stats.todayWords || 0,
          streak: result.stats.streak || 0,
          lastActive: result.stats.lastActive || new Date().toISOString()
        });
      }

      // Get the actual word count to ensure totalWords is accurate
      let actualWordCount = 0;

      // First try to get count from new format metadata
      if (result.words_metadata && result.words_metadata.totalWords !== undefined) {
        actualWordCount = result.words_metadata.totalWords;
      } 
      // If not available, count words from all sources
      else {
        // From new format
        if (result.words_groups && Array.isArray(result.words_groups) && result.words_groups.length > 0) {
          const wordGroups = await new Promise<any>((resolve, reject) => {
            chrome.storage.sync.get(result.words_groups, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message || 'Error loading word groups');
              } else {
                resolve(result);
              }
            });
          });

          for (const groupKey of result.words_groups) {
            if (wordGroups[groupKey] && Array.isArray(wordGroups[groupKey])) {
              actualWordCount += wordGroups[groupKey].length;
            }
          }
        }
        // From old format
        else if (result.words && Array.isArray(result.words)) {
          actualWordCount = result.words.length;
        }
      }

      // Update stats with accurate word count if different
      if (actualWordCount > 0 && (!result.stats || result.stats.totalWords !== actualWordCount)) {
        const updatedStats = {
          totalWords: actualWordCount,
          todayWords: result.stats?.todayWords || 0,
          streak: result.stats?.streak || 0,
          lastActive: result.stats?.lastActive || new Date().toISOString()
        };
        
        setStats(prevStats => ({
          ...prevStats,
          totalWords: actualWordCount
        }));

        // Update storage with corrected stats
        chrome.storage.sync.set({ stats: updatedStats }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving updated stats to storage:', chrome.runtime.lastError);
          } else {
            // Save updated stats to Firestore if user is authenticated
            if (currentUser) {
              BackgroundMessaging.saveUserStats(updatedStats).catch(err => {
                console.error('WordStream: Error saving stats to Firestore:', err);
              });
            }
          }
        });
      } else if (currentUser && result.stats) {
        // Even if no changes needed, save to Firestore for consistency
        BackgroundMessaging.saveUserStats(result.stats).catch(err => {
          console.error('WordStream: Error saving existing stats to Firestore:', err);
        });
      }
      
      console.log('Statistics refreshed successfully');
    } catch (error) {
      console.error('Error refreshing statistics:', error);
    }
  };

  // Effect for updating showStatsPage when showStats changes
  useEffect(() => {
    if (showStats) {
      // Refresh statistics before showing stats page
      refreshStatistics().then(() => {
      // Set showStatsPage to true and reset other flags
      setCurrentView('stats');
      setShowStats(false);
      setShowGames(false);
      });
    }
  }, [showStats]);

  // Define handleDeleteWord function
  const handleDeleteWord = async (wordId: string) => {
    try {
      // Filter out the deleted word from our local array
      const newWords = words.filter(w => w.id !== wordId);
      setWords(newWords);
      
      // Update local stats
      setStats({
        ...stats,
        totalWords: newWords.length,
        todayWords: stats.todayWords > 0 ? stats.todayWords - 1 : 0
      });
      
      // Load metadata to check if we're using the new format
      const metadata = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['words_metadata', 'words_groups'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message || 'Error accessing storage');
          } else {
            resolve(result);
          }
        });
      });

      // Check if we need to update the new format or old format
      if (metadata.words_metadata && Array.isArray(metadata.words_groups)) {
        console.log('Updating groups format after word deletion');
        
        try {
          // We need to reorganize all words after deletion
          // First, get all current word groups
          const wordGroups = await new Promise<any>((resolve, reject) => {
            chrome.storage.sync.get(metadata.words_groups, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message || 'Error loading word groups');
              } else {
                resolve(result);
              }
            });
          });
          
          // Get all words from groups excluding the deleted one
          let allWords: any[] = [];
          for (const groupKey of metadata.words_groups) {
            if (wordGroups[groupKey] && Array.isArray(wordGroups[groupKey])) {
              // Filter out the deleted word from each group
              const filteredGroup = wordGroups[groupKey].filter((w: any) => w.id !== wordId);
              allWords.push(...filteredGroup);
            }
          }
          
          // Create new groups with updated words
          const GROUP_SIZE = 10;
          const wordsByGroup: { [key: string]: any[] } = {};
          
          // Split words into groups
          allWords.forEach((word, index) => {
            const groupIndex = Math.floor(index / GROUP_SIZE);
            const groupKey = `words_group_${groupIndex}`;
            
            if (!wordsByGroup[groupKey]) {
              wordsByGroup[groupKey] = [];
            }
            
            wordsByGroup[groupKey].push(word);
          });
          
          // Batch our operations to reduce the number of write operations
          const updates: { [key: string]: any } = {};
          
          // Add metadata to updates
          updates.words_metadata = {
            totalGroups: Object.keys(wordsByGroup).length,
            totalWords: allWords.length,
            lastUpdated: new Date().toISOString()
          };
          
          // Add stats to updates
          updates.stats = {
            totalWords: allWords.length,
            todayWords: stats.todayWords > 0 ? stats.todayWords - 1 : 0,
            streak: stats.streak,
            lastActive: stats.lastActive
          };
          
          // Add groups list to updates
          updates.words_groups = Object.keys(wordsByGroup);
          
          // Add each group to updates
          for (const [groupKey, groupWords] of Object.entries(wordsByGroup)) {
            updates[groupKey] = groupWords;
          }
          
          // Calculate the keys to remove
          const keysToRemove = metadata.words_groups.filter(
            (key: string) => !Object.keys(wordsByGroup).includes(key)
          );
          
          // Remove unused groups first if we need to
          if (keysToRemove.length > 0) {
            await new Promise<void>((resolve, reject) => {
              chrome.storage.sync.remove(keysToRemove, () => {
                if (chrome.runtime.lastError) {
                  console.warn('Warning removing unused groups:', chrome.runtime.lastError.message);
                }
                resolve();
              });
            });
          }
          
          // Now apply all updates in a single operation
          await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.set(updates, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message || 'Error updating storage');
              } else {
                resolve();
              }
            });
          });
          
          // Save updated stats to Firestore if user is authenticated
          if (currentUser) {
            const statsForFirestore = {
              totalWords: allWords.length,
              todayWords: stats.todayWords > 0 ? stats.todayWords - 1 : 0,
              streak: stats.streak,
              lastActive: stats.lastActive
            };
            
            await BackgroundMessaging.saveUserStats(statsForFirestore);
          }
        } catch (error) {
          console.error('Error updating storage after word deletion:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting word:', error);
    }
  };

  // Export words to Excel file
  const exportWordsToExcel = async () => {
    try {
      // Use filtered words based on current filters
      const wordsToExport = filteredWords.length > 0 ? filteredWords : words;
      
      if (wordsToExport.length === 0) {
        alert('No words available to export.');
        return;
      }

      // Create worksheet data
      const wsData = wordsToExport.map((word) => ({
        'Original Word': word.originalWord,
        'Translation': word.targetWord,
        'Source Language': LANGUAGE_MAP[word.sourceLanguage as keyof typeof LANGUAGE_MAP] || word.sourceLanguage,
        'Target Language': LANGUAGE_MAP[word.targetLanguage as keyof typeof LANGUAGE_MAP] || word.targetLanguage,
        'Added Date': word.timestamp ? safeFormatDate(word.timestamp, 'yyyy-MM-dd HH:mm:ss') : 'Unknown',
        'Context': word.context ? `${word.context.videoTitle} (${word.context.source})` : 'No context',
        'URL': word.context?.url || 'Not available'
      }));

      // Create workbook and add worksheet
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Words List');

      // Auto-size columns
      const colWidths = [
        { wch: 20 }, // Original Word
        { wch: 20 }, // Translation
        { wch: 15 }, // Source Language
        { wch: 15 }, // Target Language
        { wch: 20 }, // Added Date
        { wch: 40 }, // Context
        { wch: 50 }  // URL
      ];
      ws['!cols'] = colWidths;

      // Generate Excel file
      const fileName = `wordstream_vocabulary_${safeFormatDate(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      console.log(`WordStream: Exported ${wordsToExport.length} words to Excel`);
    } catch (error) {
      console.error('Error exporting words to Excel:', error);
      alert('Failed to export words. Please try again.');
    }
  };

  // Define renderStatistics function
  const renderStatistics = () => {
    return (
      <div className="stats-section mb-6">
        <div className="flex items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2">
          <BarChart size={18} className="text-primary" />
          <span>Statistics</span>
        </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            title="Refresh Statistics"
            onClick={() => refreshStatistics()}
          >
            <RefreshCw size={16} className="text-slate-500" />
          </Button>
        </div>
        
        <div className="cards-container grid grid-cols-2 gap-4 mt-2">
          <Card className="col-span-1 flex flex-col glass-card p-4 cursor-pointer hover:ring-2 hover:ring-indigo-500/50" onClick={() => {
            refreshStatistics().then(() => setCurrentView('stats'));
          }}>
            <div className="flex items-center justify-center h-full gap-3">
              <div className="stats-icon">
                <Brain size={32} className="text-indigo-400" />
              </div>
              <div className="stats-details flex flex-col">
                <span className="text-base font-semibold">Total Words</span>
                <span className="text-2xl font-bold">{stats.totalWords || 0}</span>
              </div>
            </div>
          </Card>
          
          <Card className="col-span-1 flex flex-col glass-card p-4 cursor-pointer hover:ring-2 hover:ring-indigo-500/50" onClick={() => {
            refreshStatistics().then(() => setCurrentView('stats'));
          }}>
            <div className="flex items-center justify-center h-full gap-3">
              <div className="stats-icon">
                <Flame size={32} className="text-orange-400" />
              </div>
              <div className="stats-details flex flex-col">
                <span className="text-base font-semibold">Daily Streak</span>
                <span className="text-2xl font-bold">{stats.streak || 0}</span>
              </div>
            </div>
          </Card>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full mt-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-xl shadow-lg transform transition duration-200 hover:scale-105"
          onClick={() => {
            refreshStatistics().then(() => setCurrentView('stats'));
          }}
        >
          <span className="mr-2">📊</span>
          View Detailed Statistics
        </Button>
      </div>
    );
  };

  // Define renderFilters function
  const renderFilters = () => {
    return (
      <div className="filter-container">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium">Filters</h3>
          {(selectedLanguage !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedLanguage('all');
                setDateFilter('all');
                setCustomDate('');
                setShowDatePicker(false);
              }}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              aria-label="Reset filters"
            >
              <X size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
        
        <div className="filters space-y-4">
          <div className="filter-group">
            <label htmlFor="language-filter" className="filter-label mb-1.5">
              Source Language
            </label>
            <div className="relative">
              <select
                id="language-filter"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="select-input pr-8 appearance-none w-full"
              >
                <option value="all">All Languages</option>
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP] || lang}
                  </option>
                ))}
              </select>
              <Globe size={16} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          
          <div className="filter-group">
            <label htmlFor="date-filter" className="filter-label mb-1.5">
              Date Added
            </label>
            <div className="relative">
              <select
                id="date-filter"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomDate('');
                    setShowDatePicker(false);
                  }
                }}
                className="select-input pr-8 appearance-none w-full"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Date</option>
              </select>
              <CalendarIcon size={16} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="filter-group">
              <label htmlFor="custom-date" className="filter-label mb-1.5">
                Select Date
              </label>
              <div className="date-picker-container" ref={datePickerRef}>
                <div className="relative">
                  <input
                    type="text"
                    id="custom-date"
                    value={customDate}
                    readOnly
                    placeholder="YYYY-MM-DD"
                    className="date-input pr-8 w-full cursor-pointer"
                    onClick={() => setShowDatePicker(!showDatePicker)}
                  />
                  <CalendarIcon 
                    size={16} 
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" 
                  />
                </div>
                
                {showDatePicker && (
                  <DatePicker
                    selectedDate={customDate}
                    onChange={setCustomDate}
                    onClose={() => setShowDatePicker(false)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="filter-stats mt-2 text-sm text-muted-foreground">
          Showing {filteredWords.length} of {words.length} words
        </div>
      </div>
    );
  };

  // Add effect for date picker outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle back from Notes & Summaries view
  const handleBackFromNotes = () => {
    setCurrentView('home');
  };

  // Determine content based on current view
  let content;
  
  if (currentView === 'stats') {
    // Statistics view
    content = (
      <StatisticsPage 
        onBack={handleBackToMain}
        showGames={handleShowGamesFromStats}
      />
    );
  } else if (currentView === 'games') {
    // Games view - עטיפת המשחקים ב-div עם קלאס חדש שיטפל בבעיות התצוגה
    content = (
      <div className="fixed inset-0 flex justify-center items-center w-screen h-screen z-[9999]">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[9999]"></div>
        <div className="relative w-full h-full z-[10000]">
          <Games
            words={filteredWords.map(w => ({ 
              word: w.originalWord, 
              translation: w.targetWord, 
              context: w.context?.source ? `From ${w.context.source}` : undefined 
            }))} 
            onBack={handleBackToMain}
          />
        </div>
      </div>
    );
  } else if (currentView === 'notes') {
    // Notes & Summaries view
    content = (
      <NotesAndSummaries 
        onBack={handleBackFromNotes} 
      />
    );
  } else if (currentView === 'chats') {
    // Saved Chats view with the new component
    content = (
      <SavedChats 
        onBack={handleBackToMain} 
      />
    );
  } else {
    // Home view (default)
    content = (
      <div className="popup-container">
        <header className="popup-header">
          <div className="flex items-center">
            <img src="/icons/icon48.png" alt="Logo" className="logo" />
            <h1 className="title">WordStream</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => settings.darkMode ? handleSettingsChange('darkMode', false) : handleSettingsChange('darkMode', true)}
              className="icon-button"
              aria-label="Toggle theme"
            >
              {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="icon-button"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="popup-content">
          {showSettings ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
              <div 
                className="z-50 w-[320px] bg-background shadow-lg rounded-lg border border-border"
                style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translateX(-50%)' }}
              >
                <div className="flex items-center justify-between p-3 border-b">
                  <h2 className="text-lg font-bold">Settings</h2>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                    }}
                    className="icon-button text-muted-foreground hover:text-foreground"
                    aria-label="Close settings"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="flex flex-col h-[270px] justify-between py-3 px-4">
                  <div>
                    <div className="mb-4 pb-3 border-b">
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="target-language" className="text-sm font-medium">
                          Target Language
                        </label>
                      </div>
                      <select
                        id="target-language"
                        value={settings.targetLanguage}
                        onChange={(e) => handleSettingsChange('targetLanguage', e.target.value)}
                        className="select-input w-full text-sm"
                      >
                        {languageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="setting-item">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="dark-mode" className="text-sm font-medium">
                            Dark Theme
                          </label>
                          <div className="switch-wrapper">
                            <input
                              type="checkbox"
                              id="dark-mode"
                              checked={settings.darkMode}
                              onChange={() => handleSettingsChange('darkMode', !settings.darkMode)}
                              className="hidden"
                            />
                            <div 
                              onClick={() => handleSettingsChange('darkMode', !settings.darkMode)}
                              className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-colors ${settings.darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${settings.darkMode ? 'translate-x-5' : 'translate-x-1'}`}></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Switch between light and dark themes
                        </p>
                      </div>

                      <div className="setting-item">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="auto-translate" className="text-sm font-medium">
                            Auto-translate
                          </label>
                          <div className="switch-wrapper">
                            <input
                              type="checkbox"
                              id="auto-translate"
                              checked={settings.autoTranslate}
                              onChange={() => handleSettingsChange('autoTranslate', !settings.autoTranslate)}
                              className="hidden"
                            />
                            <div 
                              onClick={() => handleSettingsChange('autoTranslate', !settings.autoTranslate)}
                              className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-colors ${settings.autoTranslate ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${settings.autoTranslate ? 'translate-x-5' : 'translate-x-1'}`}></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Automatically translate subtitles
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="pt-3 mt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Logged in as:</p>
                      <p className="text-sm font-medium mb-2 truncate">{currentUser?.email}</p>
                      
                      <button
                        onClick={signOut}
                        className="w-full py-1.5 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentUser && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-5">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {currentUser.email}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            
              {renderStatistics()}
              
              <div className="practice-section">
                <h2 className="section-title flex items-center gap-2 mb-3">
                  <Gamepad size={18} className="text-primary" />
                  <span>Practice</span>
                </h2>
                
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-xl shadow-lg transform transition duration-200 hover:scale-105 mb-3"
                  onClick={() => handleShowGames()}
                  disabled={words.length < 4}
                  title={words.length < 4 ? "Need at least 4 words to practice with games" : ""}
                >
                  <span className="mr-2">🎮</span>
                  Practice Games
                  {words.length > 0 && words.length < 4 && (
                    <span className="ml-2 text-xs opacity-80">(Need at least 4 words)</span>
                  )}
                </Button>
                
                <Button 
                  className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-xl shadow-lg transform transition duration-200 hover:scale-105"
                  onClick={() => setCurrentView('stats')}
                >
                  <span className="mr-2">📊</span>
                  View Statistics
                </Button>
              </div>
              
              <div className="notes-section mt-6 mb-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-title flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    <span>Notes & Resources</span>
                  </h2>
                </div>
                
                <div className="mt-2 space-y-3">
                  <Card 
                    className="hover:shadow-md cursor-pointer transition-all p-4 bg-white dark:bg-slate-800" 
                    onClick={() => setCurrentView('notes')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h3 className="font-medium">Video Notes</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            View and manage your saved notes
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-400" />
                    </div>
                  </Card>
                  
                  <Card 
                    className="hover:shadow-md cursor-pointer transition-all p-4 bg-white dark:bg-slate-800" 
                    onClick={() => setCurrentView('chats')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500">
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <h3 className="font-medium">Saved Chats</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Review and export meaningful conversations
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-400" />
                    </div>
                  </Card>
                </div>
              </div>
              
              <div className="words-section mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-title flex items-center gap-2">
                    <BookOpen size={18} className="text-primary" />
                    <span>Words</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    {words.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30"
                        onClick={exportWordsToExcel}
                      >
                        <Download size={14} />
                        <span>Export to Excel</span>
                      </Button>
                    )}
                  <div className="text-sm text-muted-foreground">
                    Total: {words.length}
                    </div>
                  </div>
                </div>
                
                {renderFilters()}
                
                <div className="words-grid mt-6 space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="spinner mb-2"></div>
                      <p className="text-muted-foreground">Loading words...</p>
                    </div>
                  ) : filteredWords.length === 0 ? (
                    <div className="empty-state text-center py-8">
                      <div className="mb-4">{words.length === 0 ? '📚' : '🔍'}</div>
                      <h3 className="text-lg font-semibold mb-2">
                        {words.length === 0 ? 'No words yet' : 'No words match your filters'}
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                        {words.length === 0 
                          ? 'Words you save while watching videos will appear here.'
                          : 'Try changing your language or date filters to see more words.'}
                      </p>
                    </div>
                  ) : groupByLanguage && selectedLanguage === 'all' ? (
                    Object.entries(groupedWords).map(([lang, langWords]) => (
                      <div key={lang} className="language-group mb-6">
                        <div className="language-header mb-2 pb-1 border-b border-border">
                          <h3 className="font-medium">
                            {LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP] || lang}{' '}
                            <span className="text-muted-foreground text-sm">({langWords.length})</span>
                          </h3>
                        </div>
                        {langWords.map((word) => (
                          <WordCard
                            key={word.id}
                            word={word}
                            onEdit={handleAddWord}
                            onDelete={() => handleDeleteWord(word.id)}
                          />
                        ))}
                      </div>
                    ))
                  ) : (
                    filteredWords.map((word) => (
                      <WordCard
                        key={word.id}
                        word={word}
                        onEdit={handleAddWord}
                        onDelete={() => handleDeleteWord(word.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </main>
        
        <footer className="popup-footer">
          <p className="text-xs text-muted-foreground text-center">
            Last active: {stats.lastActive ? safeFormatDate(stats.lastActive, 'PPP') : 'Never'}
          </p>
        </footer>
      </div>
    );
  }

  /**
   * ==============================================
   * SIDE EFFECTS
   * ==============================================
   */

  /**
   * התאמת תימה כהה/בהירה באלמנט HTML
   */
  useEffect(() => {
    const html = document.documentElement;
    if (settings.darkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
  }, [settings.darkMode]);

  /**
   * הגדרת שפת מסמך ל-en-US עבור בוחרי תאריכים
   */
  useEffect(() => {
    document.documentElement.lang = 'en-US';
  }, []);

  return (
    <>
      {content}
    </>
  );
}

/**
 * ==============================================
 * WORD CARD COMPONENT
 * ==============================================
 * 
 * קומפוננטה להצגת כרטיס מילה בודד, עם אפשרויות עריכה ומחיקה
 */
function WordCard({ word, onEdit, onDelete }: WordCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWord, setEditedWord] = useState(word);

  /**
   * שמירת המילה לאחר עריכה
   */
  const handleSave = () => {
    try {
      if (!chrome?.runtime?.id) {
        console.error('Chrome API not available');
        return;
      }

      console.log('Saving edited word:', editedWord);

      chrome.storage.sync.get(['words'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error accessing storage:', chrome.runtime.lastError);
          return;
        }

        const words = result.words || [];
        
        // Remove the original word
        const updatedWords = words.filter((w: Word) => 
          !(w.originalWord.trim().toLowerCase() === word.originalWord.trim().toLowerCase() && 
            w.sourceLanguage === word.sourceLanguage && 
            w.targetLanguage === word.targetLanguage)
        );

        // Check if the edited word would create a duplicate with any other existing word
        const wouldCreateDuplicate = updatedWords.some((w: Word) => 
          w.originalWord.trim().toLowerCase() === editedWord.originalWord.trim().toLowerCase() && 
          w.sourceLanguage === editedWord.sourceLanguage &&
          w.targetLanguage === editedWord.targetLanguage
        );

        if (wouldCreateDuplicate) {
          console.warn('Edit would create a duplicate word, not saving:', editedWord);
          setIsEditing(false);
          return;
        }

        // Add the edited version
        updatedWords.push({
          ...editedWord,
          timestamp: new Date().toISOString()
        });

        // Sort words by language and then alphabetically
        updatedWords.sort((a: Word, b: Word) => {
          if (a.sourceLanguage === b.sourceLanguage) {
            return a.originalWord.localeCompare(b.originalWord);
          }
          return a.sourceLanguage.localeCompare(b.sourceLanguage);
        });

        // Save back to storage and update local state
        chrome.storage.sync.set({ 
          words: updatedWords,
          stats: {
            ...result.stats,
            totalWords: updatedWords.length
          }
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving to storage:', chrome.runtime.lastError);
            return;
          }
          onEdit(editedWord);
          setIsEditing(false);
        });
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
    }
  };

  /**
   * עדכון שפת המקור של המילה
   */
  const handleLanguageChange = (value: string) => {
    setEditedWord({
      ...editedWord,
      sourceLanguage: value,
      context: {
        ...editedWord.context,
        captionsLanguage: value
      }
    });
  };

  // תצוגת מצב עריכה
  if (isEditing) {
    return (
      <Card className="word-card">
        <div className="word-header">
          <input
            type="text"
            value={editedWord.originalWord}
            onChange={(e) => setEditedWord({ ...editedWord, originalWord: e.target.value })}
            className="input-field"
            placeholder="Original word"
          />
          <div className="actions">
            <button onClick={handleSave} className="save-button" title="Save changes">✓</button>
            <button 
              onClick={() => {
                setEditedWord(word);
                setIsEditing(false);
              }} 
              className="cancel-button" 
              title="Cancel editing"
            >
              ×
            </button>
          </div>
        </div>
        <input
          type="text"
          value={editedWord.targetWord}
          onChange={(e) => setEditedWord({ ...editedWord, targetWord: e.target.value })}
          className="input-field translated-input"
          placeholder="Translation"
        />
        <div className="word-meta">
          <Select
            value={editedWord.sourceLanguage}
            onValueChange={handleLanguageChange}
            options={Object.entries(LANGUAGE_MAP).map(([code, name]) => ({
              value: code,
              label: name
            }))}
            className="language-select"
          />
          <span className="text-xs text-muted-foreground">
            {word.timestamp ? safeFormatDate(word.timestamp, 'MMM d, yyyy') : 'Just added'}
          </span>
        </div>
      </Card>
    );
  }

  // תצוגת מצב רגיל
  return (
    <Card className="word-card">
      <div className="word-header">
        <span className="original-word">{word.originalWord}</span>
        <div className="actions">
          <button onClick={() => setIsEditing(true)} className="edit-button" title="Edit word">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="delete-button" title="Delete word">×</button>
        </div>
      </div>
      <div className="translated-word">{word.targetWord}</div>
      <div className="word-meta">
        <span className="language">
          {LANGUAGE_MAP[word.sourceLanguage as keyof typeof LANGUAGE_MAP] || word.sourceLanguage}
        </span>
        <span className="text-xs text-muted-foreground">
          {word.timestamp ? safeFormatDate(word.timestamp, 'MMM d, yyyy') : 'Just added'}
        </span>
      </div>
    </Card>
  );
} 