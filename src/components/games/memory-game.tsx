import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Star, Zap } from 'lucide-react';

interface MemoryGameProps {
  words: Array<{
    id?: string;
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
  points?: number;
}

interface MemoryCard {
  id: number;
  content: string;
  isFlipped: boolean;
  isMatched: boolean;
  isIncorrect: boolean;
  type: 'word' | 'translation';
  originalIndex: number;
  points: number;
}

// Custom Card component for the Memory Game
interface MemoryCardProps {
  children: React.ReactNode;
  onClick: () => void;
  isFlipped: boolean;
  isMatched: boolean;
  isIncorrect: boolean;
  className?: string;
}

const MemoryCardComponent: React.FC<MemoryCardProps> = ({
  children,
  onClick,
  isFlipped,
  isMatched,
  isIncorrect,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`memory-card cursor-pointer transition-all duration-300 transform hover-scale rounded-lg flex items-center justify-center ${
        isFlipped || isMatched 
          ? 'glass-card' 
          : 'glass-card opacity-90 hover:opacity-100'
      } ${
        isMatched ? 'gradient-border-success bg-emerald-500/20' : 
        isIncorrect ? 'gradient-border-error bg-rose-500/20' : 
        'gradient-border'
      } ${className}`}
    >
      <motion.div 
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ 
          rotateY: isFlipped || isMatched ? 0 : 180,
          opacity: isFlipped || isMatched ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        className="w-full h-full flex items-center justify-center"
      >
        <span className={`text-center p-1 text-sm font-medium overflow-hidden ${
          isMatched ? 'text-emerald-400' : 
          isIncorrect ? 'text-rose-400' : 
          'vibrant-text'
        }`}>
          {isFlipped || isMatched ? children : ''}
        </span>
      </motion.div>
    </div>
  );
};

export function MemoryGame({ words, onBack, points = 0 }: MemoryGameProps) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameOver'>('start');
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [incorrectPair, setIncorrectPair] = useState<number[]>([]);
  const [score, setScore] = useState<number>(points);
  const [timer, setTimer] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const gameStartTime = useRef<number | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
  const [totalGames, setTotalGames] = useState<number>(0);
  const [bestTime, setBestTime] = useState<number | null>(null);

  useEffect(() => {
    chrome.storage.sync.get('memoryGameStats', (result) => {
      if (result.memoryGameStats) {
        setHighScore(result.memoryGameStats.bestScore || 0);
        setTotalGames(result.memoryGameStats.totalGames || 0);
        setBestTime(result.memoryGameStats.bestTime || null);
      }
    });

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, []);

  const handleGameOver = () => {
    if (timerId) {
      clearInterval(timerId);
    }
    setGameState('gameOver');
    saveScore();
  };

  const initializeGame = () => {
    // Define exactly 6 pairs (12 cards)
    const pairs = 6;
    const selectedWords = [...words]
      .sort(() => Math.random() - 0.5)
      .slice(0, pairs);

    const cardPairs: MemoryCard[] = [];

    selectedWords.forEach((wordObj, index) => {
      // Word card
      cardPairs.push({
        id: index * 2,
        content: wordObj.word,
        isFlipped: false,
        isMatched: false,
        isIncorrect: false,
        type: 'word',
        originalIndex: index,
        points: 5,
      });

      // Translation card
      cardPairs.push({
        id: index * 2 + 1,
        content: wordObj.translation,
        isFlipped: false,
        isMatched: false,
        isIncorrect: false,
        type: 'translation',
        originalIndex: index,
        points: 5,
      });
    });

    // Shuffle cards
    const shuffledCards = [...cardPairs].sort(() => Math.random() - 0.5);
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setScore(points);
    setCombo(0);
    setMaxCombo(0);
    setTimer(0);
    setGameState('playing');

    // Start timer
    gameStartTime.current = Date.now();
    const id = setInterval(() => {
      setTimer(Math.floor((Date.now() - (gameStartTime.current || 0)) / 1000));
    }, 1000);
    setTimerId(id);
  };

  const handleCardClick = (cardId: number) => {
    // Don't allow clicks during animations or if the card is already flipped or matched
    if (
      flippedCards.length >= 2 ||
      cards.find(c => c.id === cardId)?.isFlipped ||
      cards.find(c => c.id === cardId)?.isMatched
    ) {
      return;
    }

    // Flip the card
    setCards(prevCards =>
      prevCards.map(card =>
        card.id === cardId ? { ...card, isFlipped: true } : card
      )
    );

    setFlippedCards(prev => [...prev, cardId]);

    // If two cards are flipped, check for a match
    if (flippedCards.length === 1) {
      const firstCardId = flippedCards[0];
      const firstCard = cards.find(c => c.id === firstCardId);
      const secondCard = cards.find(c => c.id === cardId);

      if (firstCard && secondCard) {
        // Check if the cards form a pair (based on originalIndex)
        if (firstCard.originalIndex === secondCard.originalIndex) {
          // It's a match!
          setTimeout(() => {
            setCards(prevCards =>
              prevCards.map(card =>
                card.id === firstCardId || card.id === cardId
                  ? { ...card, isMatched: true, isFlipped: true }
                  : card
              )
            );
            setFlippedCards([]);
            setMatchedPairs(prev => prev + 1);
            setScore(prev => prev + firstCard.points + secondCard.points);
            setCombo(prev => prev + 1);
            setMaxCombo(prev => Math.max(prev, combo + 1));

            // Check if the game is over
            if (matchedPairs + 1 === cards.length / 2) {
              handleGameOver();
            }
          }, 500);
        } else {
          // Not a match
          setIncorrectPair([firstCardId, cardId]);
          setTimeout(() => {
            setCards(prevCards =>
              prevCards.map(card =>
                card.id === firstCardId || card.id === cardId
                  ? { ...card, isFlipped: false, isIncorrect: true }
                  : card
              )
            );
            setFlippedCards([]);
            setCombo(0);
            
            // Clear the incorrect pair indication
            setTimeout(() => {
              setCards(prevCards =>
                prevCards.map(card =>
                  card.id === firstCardId || card.id === cardId
                    ? { ...card, isIncorrect: false }
                    : card
                )
              );
              setIncorrectPair([]);
            }, 300);
          }, 1000);
        }
      }
    }
  };

  const saveScore = () => {
    const gameTime = Math.floor((Date.now() - (gameStartTime.current || 0)) / 1000);
    const finalScore = score;

    chrome.storage.sync.get('memoryGameStats', (result) => {
      const currentStats = result.memoryGameStats || {
        bestScore: 0,
        totalGames: 0,
        lastPlayed: new Date().toISOString(),
        bestTime: Number.MAX_SAFE_INTEGER, // Initialize with a very large number
        recentScores: []
      };

      // Store recent scores (up to 10)
      const recentScores = currentStats.recentScores || [];
      recentScores.unshift(finalScore);
      if (recentScores.length > 10) {
        recentScores.pop();
      }

      const newStats = {
        bestScore: Math.max(currentStats.bestScore, finalScore),
        totalGames: currentStats.totalGames + 1,
        lastPlayed: new Date().toISOString(),
        bestTime: currentStats.bestTime ? Math.min(currentStats.bestTime, gameTime) : gameTime,
        recentScores
      };

      chrome.storage.sync.set({ memoryGameStats: newStats }, () => {
        console.log('Memory game stats saved:', newStats);
        setHighScore(newStats.bestScore);
        setTotalGames(newStats.totalGames);
      });
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Start screen with fixed pairs (6 pairs, 12 cards)
  if (gameState === 'start') {
    return (
      <div className="fixed inset-0 animated-gradient-bg text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
          <motion.div
            className="fixed inset-0 animated-gradient-bg backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card gradient-border p-8 rounded-2xl shadow-xl max-w-md w-full"
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
                  Memory Game
                </h2>
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
              
              <div className="glass-card p-4 rounded-xl text-center w-full mb-6">
                <p className="text-3xl font-bold gradient-text floating">
                  {bestTime ? formatTime(bestTime) : "--:--"}
                </p>
                <p className="text-sm text-white/80">Best Time</p>
              </div>
              
              <Button
                onClick={initializeGame}
                className="w-full py-6 glass-button gradient-border font-bold"
              >
                Start Game
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Game over screen
  if (gameState === 'gameOver') {
    return (
      <div className="fixed inset-0 animated-gradient-bg flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="glass-card p-8 rounded-xl max-w-md w-full">
          <h2 className="text-2xl font-bold text-center game-header-text mb-6">
            Game Complete!
          </h2>
          
          <div className="grid grid-cols-2 gap-6 text-center mb-6">
            <div className="glass-card p-4 rounded-xl">
              <p className="text-3xl font-bold gradient-text floating">{score}</p>
              <p className="text-sm text-white/80">Score</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <p className="text-3xl font-bold gradient-text floating">{formatTime(timer)}</p>
              <p className="text-sm text-white/80">Time</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <p className="text-3xl font-bold gradient-text floating">{maxCombo}x</p>
              <p className="text-sm text-white/80">Max Combo</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <p className="text-3xl font-bold gradient-text floating">{bestTime ? formatTime(bestTime) : "--:--"}</p>
              <p className="text-sm text-white/80">Best Time</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button
              onClick={initializeGame}
              className="w-1/2 glass-button gradient-border font-medium"
            >
              Play Again
            </Button>
            <Button
              onClick={onBack}
              className="w-1/2 glass-button gradient-border font-medium"
            >
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  return (
    <div className="fixed inset-0 animated-gradient-bg flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative p-2 sm:p-4 flex flex-col h-full">
        <header className="flex items-center justify-between p-2 bg-indigo-900/70 backdrop-blur-lg rounded-xl mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="glass-button"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold game-header-text">Memory Game</h1>
          <div className="w-8"></div>
        </header>
        
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium vibrant-text">{formatTime(timer)}</span>
          </div>
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium vibrant-text">{score}</span>
          </div>
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium vibrant-text">{combo}x</span>
          </div>
        </div>
        
        <div className="flex-1 grid grid-cols-3 gap-1 px-1 py-1 pb-2">
          <AnimatePresence>
            {cards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="aspect-square"
              >
                <MemoryCardComponent
                  onClick={() => handleCardClick(card.id)}
                  isFlipped={card.isFlipped}
                  isMatched={card.isMatched}
                  isIncorrect={card.isIncorrect || incorrectPair.includes(card.id)}
                  className="h-full w-full"
                >
                  {card.content}
                </MemoryCardComponent>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 
