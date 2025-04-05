import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  Clock, 
  Medal, 
  BarChart2, 
  Trophy,
  CheckCircle,
  Flame,
  Target,
  Zap,
  Star,
  TrendingUp
} from 'lucide-react';
import { getLanguageName, LanguageCode } from '../../config/supported-languages';
import { safeDate, safeFormatDate } from '@/utils/date-utils';

// Simple Tabs components since we don't have @/components/ui/tabs
interface TabsProps {
  defaultValue: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

function Tabs({ defaultValue, onValueChange, children }: TabsProps) {
  const [value, setValue] = useState(defaultValue);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    onValueChange(newValue);
  };

  // Pass the current value to all children
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { parentValue: value } as any);
    }
    return child;
  });

  return <div>{childrenWithProps}</div>;
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

function TabsList({ className, children }: TabsListProps) {
  return (
    <div className={`flex space-x-1 rounded-lg bg-muted p-1 ${className || ''}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  parentValue?: string;
}

function TabsTrigger({ 
  value, 
  className, 
  children, 
  onValueChange, 
  parentValue 
}: TabsTriggerProps) {
  const isActive = parentValue === value;

  return (
    <button
      className={`
        ${isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${className || ''}
      `}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  parentValue?: string;
}

function TabsContent({ 
  value, 
  className, 
  children,
  parentValue 
}: TabsContentProps) {
  if (parentValue !== value) {
    return null;
  }

  return (
    <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ''}`}>
      {children}
    </div>
  );
}

// Game statistics interfaces
interface GameStats {
  bestScore: number;           // Percentage or time-based score depending on game
  totalGames: number;          // Total number of games played
  lastPlayed: string;          // ISO timestamp of last played game
  recentScores?: number[];     // Store recent scores for tracking improvement
  highestStreak?: number;      // For games that track streaks
  totalCorrect?: number;       // Track total correct answers
  totalAttempted?: number;     // Track total attempted questions
}

interface AllGameStats {
  flashCards?: GameStats;
  multipleChoice?: GameStats;
  wordScramble?: GameStats;
  fillInBlank?: GameStats;
  combinedTest?: GameStats;
  memory?: GameStats;
}

interface PerformanceStats {
  mostPlayedGame: string;
  mostSuccessfulGame: string;
  totalGamesPlayed: number;
  averageScore: number;
  improvementRate: number; // Percentage improvement over time
  learningStreak: number; // Days in a row with activity
  totalLearningDays: number;
  wordsLearned: number;
  wordsLearnedToday: number;
  lastActiveDate: string;
}

interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  expires: string;
  completed: boolean;
  reward: string;
}

interface StatisticsPageProps {
  onBack: () => void;
  showGames: () => void;
}

interface Stats {
  totalWords: number;
  todayWords: number;
  streak: number;
  lastActive: string;
}

interface Word {
  id: string;
  original: string;
  translation: string;
  timestamp: string;
  language?: string;
}

export function StatisticsPage({ onBack, showGames }: StatisticsPageProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWords: 0,
    todayWords: 0,
    streak: 0,
    lastActive: new Date().toISOString()
  });
  
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    mostPlayedGame: "None",
    mostSuccessfulGame: "None",
    totalGamesPlayed: 0,
    averageScore: 0,
    improvementRate: 0,
    learningStreak: 0,
    totalLearningDays: 0,
    wordsLearned: 0,
    wordsLearnedToday: 0,
    lastActiveDate: new Date().toISOString()
  });
  
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallenge[]>([]);
  const [allGameStats, setAllGameStats] = useState<AllGameStats>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Add immediate refresh on mount or when navigation happens to this screen
  useEffect(() => {
    console.log('StatisticsPage component mounted - refreshing data...');
    // This will force a data refresh on component mount
    loadStats(true);
    
    // Also set up an interval for periodic refreshes
    const refreshInterval = setInterval(() => {
      loadStats(false); // Silent refresh
    }, 15000); // Refresh every 15 seconds
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Helper function to ensure streak is updated consistently
  const refreshStreak = async () => {
    try {
      // Get the current stats
      const result = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['stats'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      if (!result.stats) return;

      // Calculate current streak with our function
      const currentStreak = calculateStreak(result.stats);
      
      // If streak has changed, update storage
      if (currentStreak !== result.stats.streak) {
        console.log(`Updating streak from ${result.stats.streak} to ${currentStreak}`);
        
        const updatedStats = {
          ...result.stats,
          streak: currentStreak,
          lastActive: new Date().toISOString()
        };
        
        // Update storage with new streak
        chrome.storage.sync.set({ stats: updatedStats }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving updated streak to storage:', chrome.runtime.lastError);
          } else {
            console.log('Streak updated successfully');
            
            // Reload stats to reflect changes
            loadStats(false);
          }
        });
      }
    } catch (error) {
      console.error('Error refreshing streak:', error);
    }
  };

  // Call refreshStreak when component mounts to ensure streak is up to date
  useEffect(() => {
    refreshStreak();
  }, []);

  // Calculate the total XP for a level
  const calculateXpForLevel = (level: number): number => {
    // A simple formula that increases XP needed for each level
    return Math.floor(100 * Math.pow(1.2, level - 1));
  };

  // Calculate total XP required to reach a specific level
  const calculateTotalXpForLevel = (level: number): number => {
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += calculateXpForLevel(i);
    }
    return total;
  };

  // Normalize game stats to handle all game types correctly
  const normalizeGameStats = (stats: any, gameType: string): GameStats => {
    // Create a standard GameStats structure with all required fields
    const normalized: GameStats = {
      bestScore: 0,
      totalGames: 0,
      lastPlayed: new Date().toISOString(),
      recentScores: [],
      totalCorrect: 0,
      totalAttempted: 0
    };
    
    if (!stats) return normalized;
    
    // Handle totalGames consistently
    normalized.totalGames = typeof stats.totalGames === 'number' ? stats.totalGames : 0;
    
    // Handle lastPlayed timestamp consistently
    if (stats.lastPlayed && typeof stats.lastPlayed === 'string') {
      try {
        // Validate the date format
        const date = new Date(stats.lastPlayed);
        if (!isNaN(date.getTime())) {
          normalized.lastPlayed = stats.lastPlayed;
        }
      } catch (e) {
        console.warn(`Invalid date format for ${gameType} stats:`, stats.lastPlayed);
      }
    }

    // Special handling for Memory game (time-based score)
    if (gameType === 'memory') {
      // For memory game, lower time is better
      if (typeof stats.bestTime === 'number') {
        normalized.bestScore = stats.bestTime;
      } else if (typeof stats.bestScore === 'number') {
        normalized.bestScore = stats.bestScore;
      }
    } 
    // Handle percentage-based scores for other games
    else {
      if (typeof stats.bestScore === 'number') {
        normalized.bestScore = Math.min(100, stats.bestScore); // Cap at 100%
      } else if (typeof stats.bestPercentage === 'number') {
        normalized.bestScore = Math.min(100, stats.bestPercentage); // Cap at 100%
      } else if (typeof stats.bestStreak === 'number') {
        normalized.bestScore = stats.bestStreak;
        normalized.highestStreak = stats.bestStreak;
      }
    }

    // Store recent scores if available
    if (Array.isArray(stats.recentScores)) {
      normalized.recentScores = stats.recentScores.slice(0, 10); // Keep last 10 scores
    }
    
    // Track accuracy metrics if available
    if (typeof stats.totalCorrect === 'number') {
      normalized.totalCorrect = stats.totalCorrect;
    }
    
    if (typeof stats.totalAttempted === 'number') {
      normalized.totalAttempted = stats.totalAttempted;
    }
    
    return normalized;
  };

  // Generate weekly challenges based on user's stats
  const generateWeeklyChallenges = () => {
    // Create some dynamic challenges based on user stats
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    
    // Helper function to safely count games with totalGames > 0
    const countPlayedGames = () => {
      return Object.keys(allGameStats).filter(key => {
        const statsKey = key as keyof AllGameStats;
        const gameStats = allGameStats[statsKey];
        return gameStats && gameStats.totalGames > 0;
      }).length;
    };

    // Count played games
    const playedGamesCount = countPlayedGames();
    
    const newChallenges: WeeklyChallenge[] = [
      {
        id: '1',
        title: 'Word Master',
        description: 'Learn 20 new words this week',
        target: 20,
        current: stats.todayWords,
        expires: endOfWeek.toISOString(),
        completed: stats.todayWords >= 20,
        reward: '500 XP'
      },
      {
        id: '2',
        title: 'Game Champion',
        description: 'Play 5 different games',
        target: 5,
        current: playedGamesCount,
        expires: endOfWeek.toISOString(),
        completed: playedGamesCount >= 5,
        reward: '300 XP'
      },
      {
        id: '3',
        title: 'Perfect Score',
        description: 'Get 100% in any game',
        target: 1,
        current: Object.values(allGameStats).filter(gameStat => 
          gameStat && gameStat.bestScore === 100
        ).length,
        expires: endOfWeek.toISOString(),
        completed: Object.values(allGameStats).filter(gameStat => 
          gameStat && gameStat.bestScore === 100
        ).length > 0,
        reward: '400 XP'
      },
      {
        id: '4',
        title: 'Daily Learner',
        description: 'Maintain a 7-day learning streak',
        target: 7,
        current: stats.streak,
        expires: endOfWeek.toISOString(),
        completed: stats.streak >= 7,
        reward: '750 XP'
      }
    ];
    
    setWeeklyChallenges(newChallenges);
  };

  // Load statistics from storage
  const loadStats = async (showLoading = true) => {
    console.log('Loading statistics...');
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Wait for Chrome API to be available
      if (!chrome?.runtime?.id) {
        throw new Error('Chrome API not available');
      }
      
      const loadData = async () => {
        return new Promise<{ words: Word[], stats: any, gameStats: AllGameStats }>((resolve, reject) => {
          // Load metadata first to check if we're using the new format
          chrome.storage.sync.get(['words_metadata', 'words_groups', 'words', 'stats'], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }

            let allWords: any[] = [];
            
            // Check if we're using the new grouped format
            if (result.words_metadata && result.words_groups && Array.isArray(result.words_groups)) {
              console.log('Loading words from grouped format...');
              
              // Fetch all word groups - we need a second request
              chrome.storage.sync.get(result.words_groups, (groupsResult) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                
                // Combine all groups into one array
                for (const groupKey of result.words_groups) {
                  if (groupsResult[groupKey] && Array.isArray(groupsResult[groupKey])) {
                    allWords.push(...groupsResult[groupKey]);
                  }
                }
                
                console.log(`Loaded ${allWords.length} words from grouped format`);
                
                // Continue with loading game stats
                loadGameStats(allWords, result.stats || {});
              });
            } else if (result.words) {
              // Using old format
              console.log('Loading words from old format...');
              allWords = result.words || [];
              
              // Continue with loading game stats
              loadGameStats(allWords, result.stats || {});
            } else {
              // No words found
              console.log('No words found in storage');
              loadGameStats([], result.stats || {});
            }
          });
          
          // Helper function to load game stats after words are loaded
          function loadGameStats(words: any[], stats: any) {
            // Now load all individual game stats
            chrome.storage.sync.get([
              'memoryGameStats',         // Memory game
              'flashCardsStats',         // Flash cards
              'multipleChoiceStats',     // Multiple choice
              'combinedTestStats',       // Combined test
              'wordScrambleStats',       // Word scramble
              'fillInBlankStats'         // Fill in blank
            ], (gameResults) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              // Create fresh consolidation of game stats
              const consolidatedStats: AllGameStats = {};
              
              // Process each game type with appropriate normalization
              if (gameResults.memoryGameStats) {
                consolidatedStats.memory = normalizeGameStats(gameResults.memoryGameStats, 'memory');
              }
              
              if (gameResults.flashCardsStats) {
                consolidatedStats.flashCards = normalizeGameStats(gameResults.flashCardsStats, 'flashCards');
              }
              
              if (gameResults.multipleChoiceStats) {
                consolidatedStats.multipleChoice = normalizeGameStats(gameResults.multipleChoiceStats, 'multipleChoice');
              }
              
              if (gameResults.combinedTestStats) {
                consolidatedStats.combinedTest = normalizeGameStats(gameResults.combinedTestStats, 'combinedTest');
              }
              
              if (gameResults.wordScrambleStats) {
                consolidatedStats.wordScramble = normalizeGameStats(gameResults.wordScrambleStats, 'wordScramble');
              }
              
              if (gameResults.fillInBlankStats) {
                consolidatedStats.fillInBlank = normalizeGameStats(gameResults.fillInBlankStats, 'fillInBlank');
              }
              
              // Logs to help debug data retrieval issues
              console.log('Game stats loaded successfully:', {
                memory: consolidatedStats.memory?.totalGames || 0,
                flashCards: consolidatedStats.flashCards?.totalGames || 0,
                multipleChoice: consolidatedStats.multipleChoice?.totalGames || 0,
                combinedTest: consolidatedStats.combinedTest?.totalGames || 0,
                wordScramble: consolidatedStats.wordScramble?.totalGames || 0,
                fillInBlank: consolidatedStats.fillInBlank?.totalGames || 0,
              });
              
              // Save the consolidated stats back to storage
              chrome.storage.sync.set({ gameStats: consolidatedStats }, () => {
                console.log('Saved consolidated game stats to storage');
              });
              
              // Ensure stats has all required fields
              const completeStats = {
                totalWords: words.length,
                todayWords: stats.todayWords || 0,
                streak: stats.streak || 0,
                lastActive: stats.lastActive || new Date().toISOString(),
                ...stats
              };
              
              // Update stats with correct word count if different
              if (completeStats.totalWords !== words.length) {
                console.log(`Updating totalWords from ${completeStats.totalWords} to ${words.length}`);
                completeStats.totalWords = words.length;
                
                // Save the corrected stats back to storage
                chrome.storage.sync.set({ stats: completeStats }, () => {
                  console.log('Saved corrected stats to storage');
                });
              }
              
              // Resolve with words, stats, and consolidated game stats
              resolve({ 
                words: words, 
                stats: completeStats,
                gameStats: consolidatedStats
              });
            });
          }
        });
      };

      // Load the data
      const data = await loadData();
      
      // Set the words state - transform to expected format if needed
      const transformedWords = data.words.map(word => {
        // Check if the word has a property called 'originalWord' (legacy format)
        if (typeof word === 'object' && word !== null && 'originalWord' in word) {
          const legacyWord = word as any; // Use any for the transformation
          return {
            id: legacyWord.id || String(Math.random()),
            original: legacyWord.originalWord || legacyWord.original || '',
            translation: legacyWord.targetWord || legacyWord.translation || '',
            timestamp: legacyWord.timestamp || new Date().toISOString(),
            language: legacyWord.sourceLanguage || legacyWord.language || 'unknown'
          } as Word;
        }
        return word as Word;
      });
      
      // Remove duplicates (consistent with Popup.tsx handling)
      const wordsMap = new Map();
      
      // Filter duplicates the same way as in Popup.tsx
      const uniqueWords = transformedWords.filter(word => {
        if (!word.original || !word.language) return true;
        
        const normalizedWord = word.original.trim().toLowerCase();
        const key = `${normalizedWord}-${word.language || 'unknown'}`;
        
        if (wordsMap.has(key)) {
          const existingWord = wordsMap.get(key);
          const existingTime = safeDate(existingWord.timestamp).getTime();
          const currentTime = safeDate(word.timestamp).getTime();
          
          if (currentTime > existingTime) {
            wordsMap.set(key, word);
            return true;
          }
          return false;
        } else {
          wordsMap.set(key, word);
          return true;
        }
      });
      
      // Calculate today's words
      const todayWords = getWordsLearnedToday(uniqueWords);
      
      // Calculate current streak
      const currentStreak = calculateStreak(data.stats);
      
      // Set the stats state with validated data
      setStats({
        totalWords: uniqueWords.length,
        todayWords: todayWords || data.stats.todayWords || 0,
        streak: currentStreak || data.stats.streak || 0,
        lastActive: data.stats.lastActive || new Date().toISOString()
      });
      
      // Ensure stats in storage match our computed values
      if (data.stats.totalWords !== uniqueWords.length) {
        console.log(`Updating totalWords in storage from ${data.stats.totalWords} to ${uniqueWords.length}`);
        chrome.storage.sync.set({
          stats: {
            ...data.stats,
            totalWords: uniqueWords.length
          }
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error updating totalWords in storage:', chrome.runtime.lastError);
          } else {
            console.log('Updated totalWords in storage successfully');
          }
        });
      }
      
      // Calculate improved performance statistics
      const totalGamesPlayed = getTotalGamesPlayed(data.gameStats);
      const avgScore = getAverageScore(data.gameStats);
      
      setPerformanceStats({
        mostPlayedGame: getMostPlayedGame(data.gameStats),
        mostSuccessfulGame: getMostSuccessfulGame(data.gameStats),
        totalGamesPlayed: totalGamesPlayed,
        averageScore: avgScore,
        improvementRate: calculateImprovementRate(data.gameStats),
        learningStreak: currentStreak || data.stats.streak || 0,
        totalLearningDays: data.stats.totalDays || 0,
        wordsLearned: transformedWords.length,
        wordsLearnedToday: todayWords,
        lastActiveDate: data.stats.lastActive || new Date().toISOString()
      });
      
      // Update game statistics state with the normalized data
      setAllGameStats(data.gameStats);
      
      // Generate weekly challenges based on the loaded stats
      generateWeeklyChallenges();
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      setError('Failed to load statistics. Please try again.');
      setLoading(false);
      setAllGameStats({});
    }
  };

  // Calculate streak based on last active date
  const calculateStreak = (stats: any): number => {
    try {
      if (!stats || !stats.lastActive) return 0;
      
      // Get today's date without time part
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get the last active date without time part
      const lastActive = safeDate(stats.lastActive);
      lastActive.setHours(0, 0, 0, 0);
      
      // If last active is today, maintain the current streak
      if (lastActive.getTime() === today.getTime()) {
        return stats.streak || 0;
      }
      
      // Check if last active was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastActive.getTime() === yesterday.getTime()) {
        // Last active was yesterday, increment streak
        return (stats.streak || 0) + 1;
      } else {
        // Last active was before yesterday, reset streak
        return 0;
      }
    } catch (error) {
      console.warn('WordStream: Error calculating streak:', error);
      return 0;
    }
  };

  // Get most played game
  const getMostPlayedGame = (stats: AllGameStats): string => {
    if (!stats || Object.keys(stats).length === 0) {
      return 'None';
    }
    
    let maxGames = 0;
    let mostPlayedGame = 'None';
    
    Object.entries(stats).forEach(([gameKey, gameStat]) => {
      if (gameStat && gameStat.totalGames > maxGames) {
        maxGames = gameStat.totalGames;
        mostPlayedGame = formatGameName(gameKey);
      }
    });
    
    return mostPlayedGame;
  };

  // Get most successful game
  const getMostSuccessfulGame = (stats: AllGameStats): string => {
    if (!stats || Object.keys(stats).length === 0) {
      return 'None';
    }
    
    // Exclude memory game from this calculation as its score is time-based (lower is better)
    // and not comparable to percentage-based scores
    let maxScore = 0;
    let mostSuccessfulGame = 'None';
    
    Object.entries(stats).forEach(([gameKey, gameStat]) => {
      if (gameKey !== 'memory' && gameStat && gameStat.bestScore > maxScore) {
        maxScore = gameStat.bestScore;
        mostSuccessfulGame = formatGameName(gameKey);
      }
    });
    
    // Special handling for memory game (if it's the only game played)
    if (mostSuccessfulGame === 'None' && stats.memory && stats.memory.totalGames > 0) {
      mostSuccessfulGame = 'Memory';
    }
    
    return mostSuccessfulGame;
  };

  // Get total games played
  const getTotalGamesPlayed = (stats: AllGameStats): number => {
    if (!stats) return 0;
    
    return Object.values(stats).reduce((total, gameStat) => 
      total + (gameStat && typeof gameStat.totalGames === 'number' ? gameStat.totalGames : 0), 0);
  };

  // Get average score across all games
  const getAverageScore = (stats: AllGameStats): number => {
    if (!stats || Object.keys(stats).length === 0) return 0;
    
    let totalValidScores = 0;
    let validGamesCount = 0;
    
    // Process each game type, but skip memory game since it uses time-based scoring
    Object.entries(stats).forEach(([gameKey, gameStat]) => {
      // Skip memory game with time-based scores
      if (gameKey === 'memory' || !gameStat) return;
      
      // Only consider games that have been played
      if (gameStat.totalGames > 0 && typeof gameStat.bestScore === 'number') {
        // Cap score at 100%
        const cappedScore = Math.min(100, gameStat.bestScore);
        totalValidScores += cappedScore;
        validGamesCount++;
      }
    });
    
    // Calculate average only if we have valid games
    if (validGamesCount === 0) return 0;
    
    const average = totalValidScores / validGamesCount;
    return Math.round(Math.max(0, Math.min(100, average)));
  };

  // Calculate improvement rate
  const calculateImprovementRate = (stats: AllGameStats): number => {
    // If there are no game stats, return 0
    if (!stats || Object.keys(stats).length === 0) {
      return 0;
    }
    
    const totalGames = getTotalGamesPlayed(stats);
    
    // Need at least 2 games to calculate improvement
    if (totalGames < 2) {
      return 0;
    }
    
    // Calculate the average score across percentage-based games
    const avgScore = getAverageScore(stats);
    
    // Calculate improvement rate based on total games played and average score
    // More games played = more practice = more improvement potential
    let improvementFactor = Math.min(totalGames / 20, 1) * 0.6; // 60% weight from games played
    let scoreFactor = (avgScore / 100) * 0.4; // 40% weight from score quality
    
    // Calculate improvement rate (0-100)
    const rate = Math.round((improvementFactor + scoreFactor) * 100);
    
    // Ensure the rate is between 0-100
    return Math.max(0, Math.min(100, rate));
  };

  // Count words learned today
  const getWordsLearnedToday = (words: Word[]): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return words.filter(word => {
      if (!word.timestamp) return false;
      
      const wordDate = safeDate(word.timestamp);
      wordDate.setHours(0, 0, 0, 0);
      
      return wordDate.getTime() === today.getTime();
    }).length;
  };

  // Format game name for display
  const formatGameName = (gameKey: string): string => {
    switch(gameKey) {
      case 'flashCards': return 'Flash Cards';
      case 'multipleChoice': return 'Multiple Choice';
      case 'wordScramble': return 'Word Scramble';
      case 'fillInBlank': return 'Fill in Blank';
      case 'combinedTest': return 'Language Test';
      case 'memory': return 'Memory Game';
      default: return gameKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
  };

  return (
    <div className="p-5 overflow-y-auto max-h-[85vh] bg-white dark:bg-[#121827] text-slate-800 dark:text-white">
      {/* Header with simplified look */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-white/80 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
          <span>Back</span>
        </button>
        
        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white">Statistics</h2>
        
        <button
          onClick={() => loadStats(true)}
          className="flex items-center gap-1.5 text-sm font-medium bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-md text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
          title="Refresh Statistics"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw animate-pulse">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-100 border border-red-200 rounded-md text-center shadow-sm dark:bg-red-900/30 dark:border-red-800/50">
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button 
            onClick={() => loadStats(true)} 
            className="mt-2 px-4 py-1.5 bg-red-100 hover:bg-red-200 rounded-md transition-colors dark:bg-red-900/30 dark:hover:bg-red-800/40"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Statistics Cards - simplified square style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Words */}
            <div className="bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700/30 rounded-md p-4 flex flex-col items-center text-center shadow-sm">
              <div className="text-sm font-medium text-slate-600 dark:text-white/70 mb-2">Total Words</div>
              <div className="p-2 mb-1">
                <div className="rounded-full h-11 w-11 flex items-center justify-center bg-blue-100 dark:bg-opacity-20" style={{background: 'rgba(88, 101, 242, 0.12)', backdropFilter: 'blur(4px)'}}>
                  <BarChart2 size={24} className="text-blue-600 dark:text-[#8a96ff]" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stats.totalWords}</div>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-white/60 flex items-center">
                <Zap size={14} className="mr-1 text-blue-500 dark:text-blue-400" />
                {stats.todayWords} today
              </div>
            </div>
            
            {/* Games Played */}
            <div className="bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700/30 rounded-md p-4 flex flex-col items-center text-center shadow-sm">
              <div className="text-sm font-medium text-slate-600 dark:text-white/70 mb-2">Games Played</div>
              <div className="p-2 mb-1">
                <div className="rounded-full h-11 w-11 flex items-center justify-center bg-purple-100 dark:bg-opacity-20" style={{background: 'rgba(157, 78, 221, 0.12)', backdropFilter: 'blur(4px)'}}>
                  <Medal size={24} className="text-purple-600 dark:text-[#9d4edd]" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{performanceStats.totalGamesPlayed}</div>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-white/60 flex items-center">
                <Star size={14} className="mr-1 text-purple-500 dark:text-purple-400" />
                {performanceStats.mostPlayedGame}
              </div>
            </div>
            
            {/* Daily Streak */}
            <div className="bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700/30 rounded-md p-4 flex flex-col items-center text-center shadow-sm">
              <div className="text-sm font-medium text-slate-600 dark:text-white/70 mb-2">Daily Streak</div>
              <div className="p-2 mb-1">
                <div className="rounded-full h-11 w-11 flex items-center justify-center bg-orange-100 dark:bg-opacity-20" style={{background: 'rgba(255, 151, 71, 0.12)', backdropFilter: 'blur(4px)'}}>
                  <Flame size={24} className="text-orange-500 dark:text-[#ff9747]" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stats.streak}</div>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-white/60 flex items-center">
                <Calendar size={14} className="mr-1 text-orange-500 dark:text-orange-400" />
                {safeFormatDate(stats.lastActive, 'PP')}
              </div>
            </div>
          </div>
          
          {/* Game Performance - simplified */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white/90 mb-4">Game Performance</h3>
            
            <div className="space-y-3">
              {Object.entries(allGameStats).length > 0 ? (
                Object.entries(allGameStats).map(([gameKey, stats]) => {
                  if (!stats) return null;
                  
                  // Get appropriate colors for each game type
                  const getIconColors = (key: string) => {
                    switch (key) {
                      case 'memory': return { 
                        bg: 'bg-blue-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(88, 101, 242, 0.12)',
                        color: 'text-blue-600 dark:text-[#8a96ff]' 
                      };
                      case 'flashCards': return { 
                        bg: 'bg-green-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(87, 227, 137, 0.12)',
                        color: 'text-green-500 dark:text-[#57e389]' 
                      };
                      case 'multipleChoice': return { 
                        bg: 'bg-yellow-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(255, 202, 40, 0.12)',
                        color: 'text-yellow-600 dark:text-[#ffca28]' 
                      };
                      case 'wordScramble': return { 
                        bg: 'bg-purple-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(186, 104, 200, 0.12)',
                        color: 'text-purple-600 dark:text-[#ba68c8]' 
                      };
                      case 'fillInBlank': return { 
                        bg: 'bg-pink-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(236, 64, 122, 0.12)',
                        color: 'text-pink-600 dark:text-[#ec407a]' 
                      };
                      case 'combinedTest': return { 
                        bg: 'bg-orange-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(255, 151, 71, 0.12)',
                        color: 'text-orange-500 dark:text-[#ff9747]' 
                      };
                      default: return { 
                        bg: 'bg-gray-100 dark:bg-opacity-20', 
                        styleBg: 'rgba(255, 255, 255, 0.12)',
                        color: 'text-gray-600 dark:text-white' 
                      };
                    }
                  };
                  
                  const colors = getIconColors(gameKey);
                  
                  return (
                    <div key={gameKey} className="bg-white dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700/30 rounded-md p-3 hover:shadow-md dark:hover:bg-[#1e2941] transition-all duration-300">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full h-9 w-9 flex items-center justify-center ${colors.bg}`} style={{background: colors.styleBg, backdropFilter: 'blur(4px)'}}>
                            {gameKey === 'memory' && <Clock size={18} className={colors.color} />}
                            {gameKey === 'flashCards' && <Zap size={18} className={colors.color} />}
                            {gameKey === 'multipleChoice' && <CheckCircle size={18} className={colors.color} />}
                            {gameKey === 'wordScramble' && <Star size={18} className={colors.color} />}
                            {gameKey === 'fillInBlank' && <Target size={18} className={colors.color} />}
                            {gameKey === 'combinedTest' && <Medal size={18} className={colors.color} />}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 dark:text-white">{formatGameName(gameKey)}</div>
                            <div className="text-xs text-slate-500 dark:text-white/60">
                              Played {stats.totalGames} time{stats.totalGames !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-800 dark:text-white">
                            {gameKey === 'memory' 
                              ? (stats.bestScore ? `${Math.floor(stats.bestScore / 60)}:${(stats.bestScore % 60).toString().padStart(2, '0')}` : '-') 
                              : `${stats.bestScore || 0}%`
                            }
                          </div>
                          <div className="text-xs text-slate-500 dark:text-white/60">Best Score</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white dark:bg-[#1a2236] border border-slate-200 dark:border-slate-700/30 rounded-md text-center py-6 px-4 shadow-sm">
                  <p className="text-slate-500 dark:text-white/60 mb-4">No game statistics available yet</p>
                  <button 
                    onClick={showGames} 
                    className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-white transition-colors shadow"
                  >
                    Start Playing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mt-6 text-center text-slate-400 dark:text-white/40 text-xs">
        Last updated: {format(lastRefresh, 'HH:mm:ss')}
      </div>
    </div>
  );
} 