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
import AuthManager from '@/core/auth-manager';

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
        
        // פישוט התהליך באופן משמעותי - רק מוודא שיש משתמש מחובר
        // אם יש משתמש, נאפשר את השימוש במשחקים גם אם הטוקן אינו מעודכן
        if (!AuthManager.isAuthenticated()) {
          console.warn('WordStream Games: No authenticated user found');
          setAuthError('לא נמצא משתמש מחובר. אנא התחבר כדי לשחק במשחקים.');
          setIsAuthChecking(false);
          return;
        }
        
        console.log('WordStream Games: User is authenticated, proceeding to games');
        
        // מנסה לרענן את הטוקן, אבל לא עוצר את התהליך אם זה נכשל
        try {
          AuthManager.verifyTokenAndRefresh()
            .then(result => {
              if (!result) {
                console.warn('WordStream Games: Token refresh failed, but continuing anyway');
              }
            })
            .catch(error => {
              console.warn('WordStream Games: Token refresh error, but continuing anyway:', error);
            });
        } catch (refreshError) {
          console.warn('WordStream Games: Token refresh attempt failed, but continuing anyway:', refreshError);
        }
        
        // מבטל את הבדיקות המחמירות של הרשאות - היות ומשחקים הם מקומיים
        setAuthError(null);
      } catch (error) {
        console.error('WordStream Games: Unhandled error during auth check:', error);
        // אפילו במקרה של שגיאה, נאפשר משחק כל עוד יש משתמש מחובר
        if (AuthManager.getCurrentUser()) {
          setAuthError(null);
        } else {
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

          <div className="flex flex-col items-center justify-center h-64 p-8">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2 text-center text-black dark:text-white">No Words to Practice</h3>
            <p className="text-center text-black/70 dark:text-white/70 mb-6">
              Your current filter doesn't include any words. Try changing your filter to see more words.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              Back to Words
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Check if we have the minimum required words
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

          <div className="flex flex-col items-center justify-center h-64 p-8">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2 text-center text-black dark:text-white">Not Enough Words</h3>
            <p className="text-center text-black/70 dark:text-white/70 mb-6">
              You need at least {MIN_WORDS_REQUIRED} words to play games. Try changing your filter to include more words.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="bg-white/20 text-black dark:text-white border-white/30 hover:bg-white/40 hover:text-black dark:hover:text-white"
            >
              Back to Words
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedGame) {
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
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Choose Game</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 pb-10 overflow-y-auto max-h-[calc(100vh-120px)]">
            {games.map((game) => (
              <Card
                key={game.id}
                className="group relative overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 hover:shadow-xl transition-all duration-300 rounded-xl hover:scale-[1.02] cursor-pointer"
                onClick={() => setSelectedGame(game.id)}
              >
                <div className={`absolute inset-0 ${game.bgColor} opacity-10 group-hover:opacity-20 transition-opacity duration-500 ease-out rounded-xl`} />
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 ease-out rounded-xl"
                     style={{
                       background: `radial-gradient(circle at center, ${game.color.split(' ')[0]} 0%, transparent 70%)`
                     }}
                />
                <div className="relative z-10 p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl" role="img" aria-label={game.title}>
                      {game.emoji}
                    </span>
                    <h3 className={`text-2xl font-bold bg-gradient-to-r ${game.color} bg-clip-text text-transparent`}>
                      {game.title}
                    </h3>
                  </div>
                  <p className="text-white/80 dark:text-white/80 group-hover:text-white dark:group-hover:text-white transition-colors duration-300 font-medium">
                    {game.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const GameComponent = games.find((game) => game.id === selectedGame)?.component;

  if (!GameComponent) {
    return null;
  }

  // Pass the appropriate props based on the game component
  if (selectedGame === 'memory') {
    return <GameComponent words={wordsWithId} onBack={() => setSelectedGame(null)} points={0} />;
  }

  return (
    <GameComponent
      words={words}
      onBack={() => setSelectedGame(null)}
    />
  );
} 