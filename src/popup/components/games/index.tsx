import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MemoryGame } from './memory-game';
import { MultipleChoice } from './multiple-choice';
import { FillInBlank } from './fill-in-blank';
import { WordScramble } from './word-scramble';
import { FlashCards } from './flash-cards';
import { CombinedTest } from './combined-test';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

// Add Firebase type definition
declare global {
  interface Window {
    firebase?: {
      auth: () => {
        currentUser: {
          getIdToken: (forceRefresh: boolean) => Promise<string>;
        } | null;
      };
    };
  }
}

interface GamesProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

export function Games({ words, onBack }: GamesProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(false);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuthentication = async () => {
      setIsAuthChecking(true);
      try {
        console.log('WordStream Games: Starting authentication check');
        
        // Use dynamic import to avoid circular dependencies
        try {
          // Import auth-manager dynamically
          const authManager = await import('@/auth/auth-manager');
          
          // פישוט התהליך באופן משמעותי - רק מוודא שיש משתמש מחובר
          // אם יש משתמש, נאפשר את השימוש במשחקים גם אם הטוקן אינו מעודכן
          const isUserAuthenticated = await authManager.isAuthenticated();
          if (!isUserAuthenticated) {
            console.warn('WordStream Games: No authenticated user found');
            setAuthError('לא נמצא משתמש מחובר. אנא התחבר כדי לשחק במשחקים.');
            setIsAuthChecking(false);
            return;
          }
          
          console.log('WordStream Games: User is authenticated, proceeding to games');
          
          // מנסה לרענן את הטוקן, אבל לא עוצר את התהליך אם זה נכשל
          try {
            const refreshResult = await authManager.verifyTokenAndRefresh();
            if (!refreshResult) {
              console.warn('WordStream Games: Token refresh failed, but continuing anyway');
            }
          } catch (refreshError) {
            console.warn('WordStream Games: Token refresh error, but continuing anyway:', refreshError);
          }
          
          // מבטל את הבדיקות המחמירות של הרשאות - היות ומשחקים הם מקומיים
          setAuthError(null);
        } catch (importError) {
          console.error('WordStream Games: Error importing auth-manager:', importError);
          // Fallback to messaging if import fails
          const authResponse = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
              if (chrome.runtime.lastError || !response) {
                resolve({ isAuthenticated: false });
                return;
              }
              resolve(response);
            });
          });
          
          if (!authResponse.isAuthenticated) {
            setAuthError('לא נמצא משתמש מחובר. אנא התחבר כדי לשחק במשחקים.');
            setIsAuthChecking(false);
            return;
          }
          
          setAuthError(null);
        }
      } catch (error) {
        console.error('WordStream Games: Unhandled error during auth check:', error);
        // אפילו במקרה של שגיאה, נאפשר משחק כל עוד יש משתמש מחובר
        try {
          const authManager = await import('@/auth/auth-manager');
          const currentUser = await authManager.getCurrentUser();
          if (currentUser) {
            setAuthError(null);
          } else {
            setAuthError('שגיאה לא צפויה בבדיקת האימות. אנא נסה להתחבר מחדש.');
          }
        } catch (getUserError) {
          setAuthError('שגיאה לא צפויה בבדיקת האימות. אנא נסה להתחבר מחדש.');
        }
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuthentication();
  }, []);

  // Transform words to include ID for MemoryGame
  const wordsWithId = words.map((word, index) => ({
    ...word,
    id: `word-${index}`
  }));

  // Constants for minimum word requirements
  const MIN_WORDS_REQUIRED = 4;

  const games = [
    {
      id: 'flash-cards',
      title: 'Flash Cards',
      description: 'Practice with interactive flash cards',
      component: FlashCards,
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/10',
      emoji: '🎴'
    },
    {
      id: 'multiple-choice',
      title: 'Multiple Choice',
      description: 'Test your knowledge with various types of questions',
      component: MultipleChoice,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10',
      emoji: '✍️'
    },
    {
      id: 'memory',
      title: 'Memory Game',
      description: 'Match pairs of words and translations',
      component: MemoryGame,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10',
      emoji: '🧩'
    },
    {
      id: 'fill-in-blank',
      title: 'Fill in the Blank',
      description: 'Practice writing translations from memory',
      component: FillInBlank,
      color: 'from-cyan-500 to-sky-600',
      bgColor: 'bg-cyan-500/10',
      emoji: '📝'
    },
    {
      id: 'word-scramble',
      title: 'Word Scramble',
      description: 'Unscramble letters to find the correct word',
      component: WordScramble,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10',
      emoji: '🔤'
    },
    {
      id: 'combined-test',
      title: 'Language Test',
      description: 'Challenge yourself with all types of games in one test',
      component: CombinedTest,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10',
      emoji: '🏆'
    }
  ];

  // Authentication error state
  if (authError) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 dark:bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center justify-center bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft size={20} />
              <span className="ml-1">Back</span>
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8 bg-red-500/10 border border-red-300 dark:border-red-700 rounded-xl">
            <div className="text-5xl mb-4 text-red-500"><AlertTriangle size={64} /></div>
            <h3 className="text-xl font-bold mb-2 text-center text-red-600 dark:text-red-400">Authentication Error</h3>
            <p className="text-center text-black dark:text-white mb-6">
              {authError}
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while checking authentication
  if (isAuthChecking) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 dark:bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center justify-center bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft size={20} />
              <span className="ml-1">Back</span>
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <h3 className="text-xl font-bold mb-2 text-center text-black dark:text-white">Checking Permissions</h3>
            <p className="text-center text-black/70 dark:text-white/70 mb-6">
              Verifying your authentication status...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have enough words to play games
  if (words.length === 0) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 dark:bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center justify-center bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft size={20} />
              <span className="ml-1">Back</span>
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8 bg-yellow-500/10 border border-yellow-300 dark:border-yellow-700 rounded-xl">
            <div className="text-5xl mb-4 text-yellow-500">⚠️</div>
            <h3 className="text-xl font-bold mb-2 text-center text-yellow-600 dark:text-yellow-400">No Words Available</h3>
            <p className="text-center text-black dark:text-white mb-6">
              You need to add words to your collection before you can play games.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have enough words for games
  if (words.length < MIN_WORDS_REQUIRED) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 dark:bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center justify-center bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft size={20} />
              <span className="ml-1">Back</span>
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8 bg-yellow-500/10 border border-yellow-300 dark:border-yellow-700 rounded-xl">
            <div className="text-5xl mb-4 text-yellow-500">⚠️</div>
            <h3 className="text-xl font-bold mb-2 text-center text-yellow-600 dark:text-yellow-400">Not Enough Words</h3>
            <p className="text-center text-black dark:text-white mb-6">
              You need at least {MIN_WORDS_REQUIRED} words to play games. You currently have {words.length}.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If a game is selected, render that game
  if (selectedGame) {
    const selectedGameData = games.find(game => game.id === selectedGame);
    if (!selectedGameData) {
      return null;
    }

    const GameComponent = selectedGameData.component;
    return <GameComponent words={wordsWithId} onBack={() => setSelectedGame(null)} />;
  }

  // Render game selection menu
  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg z-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 dark:bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center justify-center bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft size={20} />
            <span className="ml-1">Back</span>
          </Button>
          <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        <p className="text-center text-lg mb-6 text-black dark:text-white">
          Choose a game to practice your vocabulary
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className="w-full text-left focus:outline-none"
              aria-label={`Play ${game.title}`}
            >
              <Card className={`h-full overflow-hidden shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 ${game.bgColor} border border-white/20`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-col">
                      <h3 className="text-xl font-bold text-black dark:text-white">{game.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{game.description}</p>
                    </div>
                    <div className="text-3xl">{game.emoji}</div>
                  </div>
                  <div className="mt-4">
                    <span className={`inline-flex items-center justify-center px-4 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${game.color} text-white`}>
                      Play Now
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 