import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Star, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface MemoryGameProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

interface GameStats {
  bestScore: number; // Time in seconds for quickest game
  totalGames: number;
  lastPlayed: string;
}

interface Card {
  id: number;
  word: string;
  translation: string;
  matched: boolean;
  flipped: boolean;
  type: 'word' | 'translation';
}

export function Memory({ words, onBack }: MemoryGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [wordCount, setWordCount] = useState(Math.min(8, words.length));
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [highScore, setHighScore] = useState<GameStats>({
    bestScore: 0,
    totalGames: 0,
    lastPlayed: new Date().toISOString()
  });
  const [consecutiveMatches, setConsecutiveMatches] = useState(0);

  // Play audio for a word
  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // You can adjust based on language
    window.speechSynthesis.speak(utterance);
  };

  // Load high score on mount
  useEffect(() => {
    chrome.storage.sync.get('memoryGameStats', (result) => {
      if (result.memoryGameStats) {
        console.log('Loaded stats:', result.memoryGameStats);
        setHighScore(result.memoryGameStats);
      }
    });
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else if (!isActive && interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  // Save high score when game ends
  const saveHighScore = (timeInSeconds: number) => {
    const newBestScore = highScore.bestScore === 0 
      ? timeInSeconds 
      : Math.min(highScore.bestScore, timeInSeconds);
    
    console.log('Saving new score:', timeInSeconds, 'Current best:', highScore.bestScore);
    
    const newStats: GameStats = {
      bestScore: newBestScore,
      totalGames: (highScore.totalGames || 0) + 1,
      lastPlayed: new Date().toISOString()
    };

    chrome.storage.sync.set({ memoryGameStats: newStats }, () => {
      console.log('Saved new stats:', newStats);
      setHighScore(newStats);
    });
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWordCountChange = (newCount: number) => {
    const validCount = Math.min(Math.max(4, newCount), Math.min(12, words.length));
    setWordCount(validCount);
  };

  const initializeGame = () => {
    // Get a random subset of words
    const gameWords = [...words]
      .sort(() => Math.random() - 0.5)
      .slice(0, wordCount);
    
    // Create word and translation cards
    const gameCards: Card[] = [];
    gameWords.forEach((item, index) => {
      // Word card
      gameCards.push({
        id: index * 2,
        word: item.word,
        translation: item.translation,
        matched: false,
        flipped: false,
        type: 'word'
      });
      
      // Translation card
      gameCards.push({
        id: index * 2 + 1,
        word: item.word,
        translation: item.translation,
        matched: false,
        flipped: false,
        type: 'translation'
      });
    });
    
    // Shuffle the cards
    const shuffledCards = gameCards.sort(() => Math.random() - 0.5);
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setTimer(0);
    setIsActive(true);
    setConsecutiveMatches(0);
    setGameComplete(false);
    setGameStarted(true);
  };

  const handleCardClick = (id: number) => {
    // Don't allow clicks on matched cards or if two cards are already flipped
    const clickedCard = cards.find(card => card.id === id);
    
    if (
      !clickedCard || 
      clickedCard.matched || 
      flippedCards.includes(id) || 
      flippedCards.length === 2
    ) {
      return;
    }
    
    // Flip the card
    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);
    
    // Check for match if two cards are flipped
    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards.find(card => card.id === firstId)!;
      const secondCard = cards.find(card => card.id === secondId)!;
      
      // Check if this is a matching pair (word and translation match)
      if (
        firstCard.word === secondCard.word && 
        firstCard.translation === secondCard.translation && 
        firstCard.type !== secondCard.type
      ) {
        // It's a match!
        setTimeout(() => {
          setCards(prev => 
            prev.map(card => 
              card.id === firstId || card.id === secondId
                ? { ...card, matched: true }
                : card
            )
          );
          
          setMatchedPairs(prev => {
            const newMatchedPairs = prev + 1;
            // Check if game is complete
            if (newMatchedPairs === wordCount) {
              setIsActive(false);
              setGameComplete(true);
              saveHighScore(timer);
            }
            return newMatchedPairs;
          });
          
          setFlippedCards([]);
          setConsecutiveMatches(prev => {
            const newCount = prev + 1;
            // Trigger confetti for 3 consecutive matches
            if (newCount >= 3) {
              triggerConfetti();
              return 0; // Reset after triggering
            }
            return newCount;
          });
        }, 1000);
      } else {
        // Not a match
        setTimeout(() => {
          setFlippedCards([]);
          setConsecutiveMatches(0);
        }, 1000);
      }
    }
  };

  if (!gameStarted) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[size:24px_24px] opacity-20" />
        
        <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="glass-button"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
              <Trophy className="text-amber-400" size={20} />
              <span className="font-bold gradient-text">
                {highScore.bestScore > 0 ? formatTime(highScore.bestScore) : '--:--'}
              </span>
            </div>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4 gradient-text">Memory Game</h2>
              <p className="text-lg text-muted-foreground">How many pairs would you like to match?</p>
            </div>

            <div className="w-full max-w-xs space-y-6">
              <div className="flex justify-center gap-3">
                {[4, 6, 8, 10, 12].map(count => (
                  <Button
                    key={count}
                    variant={wordCount === count ? "default" : "outline"}
                    className={`glass-button ${wordCount === count ? 'gradient-border' : ''} ${count > words.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleWordCountChange(count)}
                    disabled={count > words.length}
                  >
                    {count}
                  </Button>
                ))}
              </div>
              
              <Button
                onClick={initializeGame}
                className="w-full py-6 text-lg glass-button gradient-border"
              >
                Start Game
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[size:24px_24px] opacity-20" />
      
      <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="glass-button"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
              <Trophy className="text-amber-400" size={20} />
              <span className="font-bold gradient-text">
                {highScore.bestScore > 0 ? formatTime(highScore.bestScore) : '--:--'}
              </span>
            </div>
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
              <Star className="text-amber-400" size={20} />
              <span className="font-bold gradient-text">{formatTime(timer)}</span>
            </div>
          </div>
        </header>

        <div className="flex justify-between mb-4 glass-card px-4 py-2 rounded-full">
          <div>Pairs: {matchedPairs}/{wordCount}</div>
          <div>Moves: {moves}</div>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto py-2">
          {cards.map(card => (
            <div
              key={card.id}
              className={`aspect-[3/4] relative cursor-pointer transition-all duration-300 transform ${
                card.matched 
                  ? 'opacity-80 pointer-events-none' 
                  : flippedCards.includes(card.id)
                  ? 'scale-105'
                  : 'hover:scale-102'
              }`}
              onClick={() => handleCardClick(card.id)}
            >
              <motion.div
                className="absolute inset-0 glass-card rounded-xl shadow-lg flex items-center justify-center backface-hidden"
                initial={false}
                animate={{
                  rotateY: flippedCards.includes(card.id) || card.matched ? 180 : 0,
                  opacity: card.matched ? 0.7 : 1
                }}
                transition={{ duration: 0.6 }}
              >
                <div className="text-center p-2">
                  <span className="text-xl font-bold gradient-text">?</span>
                </div>
              </motion.div>

              <motion.div
                className={`absolute inset-0 glass-card rounded-xl shadow-lg flex items-center justify-center backface-hidden ${
                  card.matched ? 'gradient-border-success' : ''
                }`}
                initial={false}
                animate={{
                  rotateY: flippedCards.includes(card.id) || card.matched ? 0 : -180,
                  opacity: card.matched ? 0.7 : 1
                }}
                transition={{ duration: 0.6 }}
              >
                <div className="text-center p-2 relative">
                  <span className="text-lg font-bold gradient-text">
                    {card.type === 'word' ? card.word : card.translation}
                  </span>
                  <button
                    className="absolute bottom-1 right-1 glass-button w-8 h-8 rounded-full flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(card.type === 'word' ? card.word : card.translation);
                    }}
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
              </motion.div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {gameComplete && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass-card p-8 rounded-2xl shadow-xl max-w-md w-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="text-3xl font-bold text-center mb-6 gradient-text">
                  Game Complete!
                </h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold gradient-text floating">{formatTime(timer)}</p>
                    <p className="text-muted-foreground mt-1">Your Time</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-emerald-400">
                        {moves}
                      </p>
                      <p className="text-muted-foreground">Total Moves</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-amber-400">
                        {formatTime(highScore.bestScore)}
                      </p>
                      <p className="text-muted-foreground">Best Time</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => {
                        setGameStarted(false);
                      }}
                      className="glass-button gradient-border px-8 py-2"
                    >
                      New Game
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onBack}
                      className="glass-button px-8 py-2"
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