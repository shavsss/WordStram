import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Star, Trophy, Volume2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// ייבוא פונקציות משותפות מספריית game-utils
import { 
  cleanContext,
  playAudio,
  triggerConfetti,
  formatTime,
  addNumericInputStyles
} from '@/lib/game-utils';

// ייבוא ההוק useGameTimer אם יש צורך בטיימר
import { useGameTimer } from '@/hooks/useGameTimer';

interface FlashCardsProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

interface GameStats {
  bestScore: number; // This will now store percentage
  totalGames: number;
  lastPlayed: string;
}

export function FlashCards({ words, onBack }: FlashCardsProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [wordCount, setWordCount] = useState(words.length);
  const [cards, setCards] = useState<typeof words>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [knownWords, setKnownWords] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [lastResponse, setLastResponse] = useState<'correct' | 'incorrect' | null>(null);
  const [highScore, setHighScore] = useState<GameStats>({
    bestScore: 0,
    totalGames: 0,
    lastPlayed: new Date().toISOString()
  });

  // השתמש בפונקציה המשותפת להוספת סגנונות קלט מספרי
  useEffect(() => {
    const cleanup = addNumericInputStyles();
    return cleanup;
  }, []);

  // Global style to hide number input spinners
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Hide number input spinners - WebKit browsers */
      input[type=number]::-webkit-inner-spin-button, 
      input[type=number]::-webkit-outer-spin-button { 
        -webkit-appearance: none;
        margin: 0; 
      }
      /* Firefox */
      input[type=number] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load high score on mount
  useEffect(() => {
    chrome.storage.sync.get('flashCardsStats', (result) => {
      if (result.flashCardsStats) {
        console.log('Loaded stats:', result.flashCardsStats);
        setHighScore(result.flashCardsStats);
      }
    });
  }, []);

  // Calculate current success rate
  const getCurrentSuccessRate = (currentScore: number, totalCards: number) => {
    return totalCards > 0 ? Math.round((currentScore / totalCards) * 100) : 0;
  };

  // Save high score when game ends
  const saveHighScore = (finalScore: number) => {
    const successRate = getCurrentSuccessRate(finalScore, cards.length);
    console.log('Saving new score:', successRate, 'Current best:', highScore.bestScore);
    
    // Get current stats or initialize if not exists
    chrome.storage.sync.get('flashCardsStats', (result) => {
      const currentStats = result.flashCardsStats || {
        bestScore: 0,
        totalGames: 0,
        lastPlayed: new Date().toISOString(),
        recentScores: [],
        totalCorrect: 0,
        totalAttempted: 0
      };
      
      // Store recent scores (up to 10)
      const recentScores = currentStats.recentScores || [];
      recentScores.unshift(successRate);
      if (recentScores.length > 10) {
        recentScores.pop();
      }
      
      const newStats = {
        bestScore: Math.max(currentStats.bestScore || 0, successRate),
        totalGames: (currentStats.totalGames || 0) + 1,
        lastPlayed: new Date().toISOString(),
        recentScores,
        totalCorrect: (currentStats.totalCorrect || 0) + finalScore,
        totalAttempted: (currentStats.totalAttempted || 0) + cards.length
      };
  
      chrome.storage.sync.set({ flashCardsStats: newStats }, () => {
        console.log('Saved new flash cards stats:', newStats);
        setHighScore(newStats);
      });
    });
  };

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(1, parseInt(e.target.value) || 1), words.length);
    setWordCount(value);
  };

  const initializeGame = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, wordCount);
    
    // Process all contexts to remove "From youtube" mentions using the shared function
    const processedCards = shuffled.map(card => ({
      ...card,
      context: cleanContext(card.context)
    }));
    
    setCards(processedCards);
    setCurrentIndex(0);
    setScore(0);
    setKnownWords([]);
    setProgress(0);
    setIsFlipped(false);
    setGameComplete(false);
    setConsecutiveCorrect(0);
    setLastResponse(null);
    setGameStarted(true);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleResponse = (knew: boolean) => {
    if (!isFlipped) {
      setIsFlipped(true);
      return;
    }
    
    // Set the response status for visual feedback
    setLastResponse(knew ? 'correct' : 'incorrect');
    
    if (knew && !knownWords.includes(currentIndex)) {
      setKnownWords([...knownWords, currentIndex]);
      setScore(prev => prev + 1);
      setConsecutiveCorrect(prev => prev + 1);
      
      // Trigger confetti for 3 consecutive correct answers
      if (consecutiveCorrect >= 2) {
        triggerConfetti();
      }
    } else if (!knew) {
      setConsecutiveCorrect(0);
    }
    
    // Add a short delay before moving to the next card to show the success/failure state
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setLastResponse(null);
        setProgress(((currentIndex + 1) / cards.length) * 100);
      } else {
        // Last card was answered, now we can complete the game
        const finalScore = score + (knew && !knownWords.includes(currentIndex) ? 1 : 0);
        saveHighScore(finalScore);
        setGameComplete(true);
      }
    }, 800);
  };

  const currentCard = cards[currentIndex];
  const currentSuccessRate = getCurrentSuccessRate(score, currentIndex + (isFlipped ? 1 : 0));

  if (!gameStarted) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
          <motion.div
            className="fixed inset-0 animated-gradient-bg backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-2xl shadow-xl max-w-md w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft size={24} />
                </Button>
                <h2 className="text-3xl font-bold text-center game-header-text">
                  Flash Cards
                </h2>
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl text-center w-full mb-6">
                <p className="text-3xl font-bold gradient-text floating">
                  {highScore.bestScore || 0}%
                </p>
                <p className="text-sm text-white/80">Best Score</p>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-white/80 mb-2">Number of words to practice:</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/10 backdrop-blur-sm border border-white/20 flex-1 p-1 rounded-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWordCount(Math.max(1, wordCount - 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={words.length}
                        value={wordCount}
                        onChange={handleWordCountChange}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="text-white bg-transparent border-0 text-center focus:ring-0 focus:outline-none"
                        style={{ 
                          WebkitAppearance: 'none', 
                          MozAppearance: 'textfield',
                          appearance: 'textfield',
                          margin: 0 
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWordCount(Math.min(words.length, wordCount + 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-sm text-white whitespace-nowrap">of {words.length}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant={wordCount === words.length ? "default" : "outline"}
                      onClick={() => setWordCount(words.length)}
                      className={`${
                        wordCount === words.length 
                          ? "bg-white/20 text-white" 
                          : "bg-transparent text-white/80 border-white/20"
                      } hover:bg-white/20 transition-colors`}
                    >
                      All
                    </Button>
                    {[5, 10, 15].map(count => (
                      <Button
                        key={count}
                        variant={wordCount === count ? "default" : "outline"}
                        onClick={() => setWordCount(Math.min(count, words.length))}
                        disabled={count > words.length}
                        className={`${
                          wordCount === count 
                            ? "bg-white/20 text-white" 
                            : "bg-transparent text-white/80 border-white/20"
                        } hover:bg-white/20 transition-colors ${count > words.length ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={initializeGame}
                className="w-full py-6 bg-white/10 backdrop-blur-sm border border-white/20 font-bold"
              >
                Start Game
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-3 px-4 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="bg-white/10 backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
              <Trophy className="text-amber-400" size={20} />
              <span className="font-bold vibrant-text">{highScore.bestScore || 0}%</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
              <Star className="text-amber-400" size={20} />
              <span className="font-bold vibrant-text">{currentSuccessRate}%</span>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-4 mb-4">
          <Progress 
            value={progress} 
            className="flex-1 h-3 bg-white/10 backdrop-blur-sm border border-white/20" 
          />
          <div className="text-sm font-medium text-white">
            {currentIndex + 1} / {cards.length}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <Card 
            className={`w-full max-w-lg aspect-[4/3] bg-white/10 backdrop-blur-sm border border-white/20 p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer rounded-xl relative hover:shadow-xl transition-all duration-300 ${
              lastResponse === 'correct' ? 'gradient-border-success bg-emerald-500/20' :
              lastResponse === 'incorrect' ? 'gradient-border-error bg-rose-500/20' :
              'gradient-border'
            }`}
            onClick={handleFlip}
          >
            <div className="text-center relative w-full">
              <h3 className={`text-3xl md:text-4xl font-bold mb-4 tracking-wide break-words ${
                lastResponse === 'correct' ? 'text-emerald-400' :
                lastResponse === 'incorrect' ? 'text-rose-400' :
                'gradient-text'
              }`}>
                {isFlipped ? currentCard?.translation : currentCard?.word}
              </h3>
              {currentCard?.context && (
                <p className="text-white text-sm mt-4 px-4 break-words max-h-20 overflow-y-auto">
                  {currentCard.context}
                </p>
              )}
            </div>
            <div className="absolute bottom-12 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(isFlipped ? currentCard?.translation : currentCard?.word);
                }}
                className="bg-white/10 backdrop-blur-sm border border-white/20 w-10 h-10 rounded-full p-0 flex items-center justify-center"
              >
                <Volume2 size={20} />
              </Button>
            </div>
            <div className="absolute bottom-4 text-center w-full text-white/70">
              {isFlipped ? 'Click to see next card' : 'Click to flip card'}
            </div>
          </Card>

          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => handleResponse(false)}
              className={`bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-4 rounded-xl font-medium text-lg ${
                isFlipped 
                  ? lastResponse === 'incorrect' 
                    ? 'bg-rose-500/20 border-rose-400 text-rose-400 gradient-border-error' 
                    : 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-300/30' 
                  : 'choice-button-neutral'
              }`}
            >
              {isFlipped ? "Didn't Know" : "Show Translation"}
            </Button>
            {isFlipped && (
              <Button
                onClick={() => handleResponse(true)}
                className={`px-8 py-4 rounded-xl font-medium text-lg ${
                  lastResponse === 'correct'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 gradient-border-success'
                    : 'choice-button-correct'
                }`}
              >
                Knew It
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {gameComplete && (
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-2xl shadow-xl max-w-md w-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="game-header-text mb-6">
                  Practice Complete!
                </h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold gradient-text floating">{currentSuccessRate}%</p>
                    <p className="text-white/80 mt-1">Success Rate</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-emerald-400">
                        {score}
                      </p>
                      <p className="text-white/80">Words Known</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-amber-400">
                        {highScore.bestScore || 0}%
                      </p>
                      <p className="text-white/80">Best Score</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => {
                        setGameStarted(false);
                      }}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-4 font-bold text-white"
                    >
                      New Game
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onBack}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-4 text-white"
                    >
                      Exit
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 