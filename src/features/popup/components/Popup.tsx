'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Settings as SettingsIcon, Brain, Flame, BookOpen, 
  Gamepad, BarChart, FileText, MessageSquare, Download, LogOut, User 
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { safeDate, safeFormatDate } from '@/utils/date-utils';
import { DatePicker } from './DatePicker';
import { Settings } from './Settings';
import { WordCard } from '@/features/vocabulary/components/WordCard';
import { WordsList } from '@/features/vocabulary/components/WordsList';
import { WordsFilter } from '@/features/vocabulary/components/WordsFilter';
import { ExportTools } from '@/features/vocabulary/components/ExportTools';
import { Games } from '@/features/games/components';
import { NotesAndSummaries } from '@/features/notes/components/NotesAndSummaries';
import { waitForChromeAPI, parseDate, formatDateForInput } from '../utils/date-utils';
import * as BackgroundMessaging from '@/utils/background-messaging';
import { Word } from '@/types/word';

/**
 * Define App Settings interface
 */
interface Settings {
  autoTranslate: boolean;
  notifications: boolean;
  darkMode: boolean;
  targetLanguage: string;
}

/**
 * Define statistics interface
 */
interface Stats {
  totalWords: number;
  todayWords: number;
  streak: number;
  lastActive: string;
}

/**
 * Main Popup Component
 * 
 * הקומפוננטה הראשית של חלון הפופאפ של התוסף.
 * מנהלת את התצוגה של המילים, המשחקים, הסטטיסטיקות והגדרות.
 */
export function Popup() {
  // Auth hook
  const { isAuthenticated, user, signOut } = useAuth();
  
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
  const [authError, setAuthError] = useState<string | null>(null);

  // New ref for games container
  const gamesContainer = useRef<HTMLDivElement>(null);

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

      // Check if word already exists with same word, language AND target language (translation language)
      const existingWordIndex = words.findIndex(w => 
        w.word.trim().toLowerCase() === wordWithTarget.word.trim().toLowerCase() && 
        w.language === wordWithTarget.language &&
        w.targetLanguage === wordWithTarget.targetLanguage
      );

      if (existingWordIndex >= 0) {
        console.log('Word already exists, updating existing word:', existingWordIndex, words[existingWordIndex]);
      } else {
        console.log('Adding new word, no duplicate found');
      }

      let updatedWords = [...words];
      const now = new Date().toISOString(); // Keep timestamp as string for Stats

      if (existingWordIndex >= 0) {
        // Update existing word
        updatedWords[existingWordIndex] = {
          ...wordWithTarget,
          timestamp: Date.now() // For Word, use number timestamp
        };
      } else {
        // Add new word
        updatedWords.push({
          ...wordWithTarget,
          timestamp: Date.now() // For Word, use number timestamp
        });
      }

      // Sort words by language and then alphabetically
      updatedWords.sort((a: Word, b: Word) => {
        if (a.language === b.language) {
          return a.word.localeCompare(b.word);
        }
        return a.language.localeCompare(b.language);
      });

      // Update stats
      const newStats = {
        ...stats,
        totalWords: updatedWords.length,
        lastActive: now // Use string for Stats
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

  // Filter words by selected filters
  const filteredWords = useMemo(() => {
    // Implementation of filtering logic here
    // ...
    return words;
  }, [words, selectedLanguage, dateFilter, customDate, dateRange]);

  // Handle going back to the main view from any subview
  const handleBackToMain = () => {
    setCurrentView('home');
    setShowGames(false);
    setShowStats(false);
    setShowStatsPage(false);
  };

  // Handle showing games view
  const handleShowGames = () => {
    setCurrentView('games');
    setShowGames(true);
  };

  // Handle sign out
  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
      // Clear local storage or perform other cleanup
    }
  };

  // Load data on component mount
  useEffect(() => {
    // Implementation of loading data from Chrome storage
    // ...
  }, []);

  // Main render
  return (
    <div className={`popup-container ${settings?.darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <h1>WordStream</h1>
        </div>
        <div className="header-controls">
          {isAuthenticated ? (
            <button onClick={handleSignOut} title="Sign Out" className="header-button">
              <LogOut size={18} />
            </button>
          ) : (
            <button onClick={() => setShowLoginDialog(true)} title="Sign In" className="header-button">
              <User size={18} />
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)} title="Settings" className="header-button">
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* Main content area */}
      <main className="app-content">
        {currentView === 'home' && (
          <>
            {/* Words list view */}
            <WordsFilter 
              filter={{
                language: selectedLanguage,
                dateFilter,
                dateRange: { from: dateRange.from, to: dateRange.to },
                customDate,
                groupByLanguage
              }}
              availableLanguages={[...new Set(words.map(w => w.language))]}
              onChange={() => {}}
            />
            
            <WordsList 
              words={filteredWords} 
              isGrouped={groupByLanguage}
              isLoading={isLoading}
              onEditWord={handleAddWord}
              onDeleteWord={() => {}}
            />
            
            <ExportTools words={filteredWords} loading={isLoading} />
          </>
        )}

        {currentView === 'games' && (
          <div ref={gamesContainer} className="games-container">
            <Games 
              words={filteredWords.map(w => ({ 
                word: w.word, 
                translation: w.translation, 
                context: w.context 
              }))} 
              onBack={handleBackToMain}
            />
          </div>
        )}

        {currentView === 'notes' && (
          <NotesAndSummaries onBack={handleBackToMain} />
        )}
      </main>

      {/* Footer navigation */}
      <footer className="app-footer">
        <button 
          className={`nav-button ${currentView === 'home' ? 'active' : ''}`}
          onClick={handleBackToMain}
        >
          <BookOpen size={18} />
          <span>Words</span>
        </button>
        
        <button 
          className={`nav-button ${currentView === 'games' ? 'active' : ''}`}
          onClick={handleShowGames}
        >
          <Gamepad size={18} />
          <span>Games</span>
        </button>
        
        <button 
          className={`nav-button ${currentView === 'stats' ? 'active' : ''}`}
          onClick={() => setCurrentView('stats')}
        >
          <BarChart size={18} />
          <span>Stats</span>
        </button>
        
        <button 
          className={`nav-button ${currentView === 'notes' ? 'active' : ''}`}
          onClick={() => setCurrentView('notes')}
        >
          <FileText size={18} />
          <span>Notes</span>
        </button>
        
        <button 
          className={`nav-button ${currentView === 'chats' ? 'active' : ''}`}
          onClick={() => setCurrentView('chats')}
        >
          <MessageSquare size={18} />
          <span>Chats</span>
        </button>
      </footer>

      {/* Settings panel */}
      {showSettings && (
        <Settings 
          settings={settings} 
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default Popup; 