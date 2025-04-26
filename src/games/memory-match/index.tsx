import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { shuffleArray } from '../../shared/utils/array';

// Components
import GameProgress from '../components/GameProgress';
import GameResult from '../components/GameResult';
import '../styles.css';

// Types
interface MemoryMatchProps {
  words: Array<{
    id: string;
    word: string;
    translation: string;
    context?: string;
    timestamp: number;
    targetLanguage: string;
  }>;
  onBack: () => void;
}

// Game stats type
interface GameStats {
  bestMoves: number;
  totalGames: number;
  lastPlayed: string;
}

// Card item type
interface CardItem {
  id: string;
  type: 'word' | 'translation';
  content: string;
  originalWord: string;
  matched: boolean;
  flipped: boolean;
}

export function MemoryMatch({ words, onBack }: MemoryMatchProps) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [pairCount, setPairCount] = useState<number>(6);
  const [bestMoves, setBestMoves] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number | null>(null);

  // Load best score on mount
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('memoryMatchStats');
      if (savedStats) {
        const stats = JSON.parse(savedStats) as GameStats;
        setBestMoves(stats.bestMoves);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const saveHighScore = (finalMoves: number, pairs: number) => {
    try {
      // Only save if it's better than the previous best (lower moves is better)
      // or if there's no previous best
      if (bestMoves === null || finalMoves < bestMoves) {
        const newBestMoves = finalMoves;
        setBestMoves(newBestMoves);
        
        const stats: GameStats = {
          bestMoves: newBestMoves,
          totalGames: 1,
          lastPlayed: new Date().toISOString()
        };
        
        // Try to update existing stats
        try {
          const savedStats = localStorage.getItem('memoryMatchStats');
          if (savedStats) {
            const oldStats = JSON.parse(savedStats) as GameStats;
            stats.totalGames = oldStats.totalGames + 1;
          }
        } catch (e) {
          console.error('Error reading existing stats', e);
        }
        
        localStorage.setItem('memoryMatchStats', JSON.stringify(stats));
      }
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 3 && value <= 10) {
      setPairCount(value);
    }
  };

  useEffect(() => {
    // Check if game is complete (all pairs matched)
    if (matchedPairs > 0 && matchedPairs === pairCount) {
      setGameCompleted(true);
      setEndTime(Date.now());
      
      // Save the high score
      saveHighScore(moves, pairCount);
      
      // Trigger confetti
      triggerConfetti();
    }
  }, [matchedPairs, pairCount]);

  // Flipped cards should automatically flip back if no match
  useEffect(() => {
    if (flippedIndices.length === 2) {
      const firstIndex = flippedIndices[0];
      const secondIndex = flippedIndices[1];
      
      if (
        cards[firstIndex].originalWord === cards[secondIndex].originalWord &&
        cards[firstIndex].type !== cards[secondIndex].type
      ) {
        // Match found
        setCards(prevCards => 
          prevCards.map((card, idx) => 
            idx === firstIndex || idx === secondIndex
              ? { ...card, matched: true }
              : card
          )
        );
        setMatchedPairs(prev => prev + 1);
        setFlippedIndices([]);
      } else {
        // No match, flip back after delay
        const timer = setTimeout(() => {
          setFlippedIndices([]);
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [flippedIndices, cards]);

  const handleCardClick = (index: number) => {
    // Prevent clicking if already two cards flipped or card is already matched/flipped
    if (flippedIndices.length === 2 || 
        cards[index].matched || 
        flippedIndices.includes(index)) {
      return;
    }
    
    // Flip the card
    setCards(prevCards => 
      prevCards.map((card, idx) => 
        idx === index ? { ...card, flipped: true } : card
      )
    );
    
    // Add to flipped indices
    setFlippedIndices(prev => [...prev, index]);
    
    // Increment moves counter if this is the second card
    if (flippedIndices.length === 1) {
      setMoves(prev => prev + 1);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    
    (function frame() {
      // Launch a few confetti from the left edge
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 }
      });
      
      // And launch a few from the right edge
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 }
      });
      
      // Keep going until we are out of time
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  };

  const startGame = () => {
    if (words.length < pairCount) {
      alert(`You need at least ${pairCount} words to play with ${pairCount} pairs!`);
      return;
    }
    
    // Randomly select words for the game
    const selectedWords = shuffleArray(words).slice(0, pairCount);
    
    // Create pairs of cards (word + translation)
    const cardPairs: CardItem[] = [];
    
    selectedWords.forEach((word) => {
      // Word card
      cardPairs.push({
        id: `word-${word.id}`,
        type: 'word',
        content: word.word,
        originalWord: word.word,
        matched: false,
        flipped: false
      });
      
      // Translation card
      cardPairs.push({
        id: `translation-${word.id}`,
        type: 'translation',
        content: word.translation,
        originalWord: word.word,
        matched: false,
        flipped: false
      });
    });
    
    // Shuffle the cards
    setCards(shuffleArray(cardPairs));
    setFlippedIndices([]);
    setMatchedPairs(0);
    setMoves(0);
    setGameStarted(true);
    setGameCompleted(false);
    setStartTime(Date.now());
    setEndTime(null);
  };

  // Calculate progress percentage
  const progressPercentage = Math.min(100, (matchedPairs / pairCount) * 100);

  if (!gameStarted) {
    return (
      <div className="game-container memory-match-container">
        <div className="game-header">
          <h2>Memory Match</h2>
          <p>Match words with their translations</p>
        </div>
        
        <div className="game-settings">
          <label>
            Number of pairs:
            <input 
              type="number" 
              min="3" 
              max="10"
              value={pairCount}
              onChange={handleInputChange}
            />
          </label>
          
          <p className="word-count-info">
            {words.length < pairCount ? (
              <span className="error">
                Not enough words! You need at least {pairCount} words.
                (You have {words.length})
              </span>
            ) : (
              <span>
                You have {words.length} words available.
              </span>
            )}
          </p>
        </div>
        
        <div className="game-actions">
          <button 
            className="start-button"
            onClick={startGame}
            disabled={words.length < pairCount}
          >
            Start Game
          </button>
          
          <button 
            className="exit-button"
            onClick={onBack}
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  if (gameCompleted) {
    const timeTaken = endTime && startTime ? Math.floor((endTime - startTime) / 1000) : 0;
    
    return (
      <GameResult
        score={matchedPairs}
        maxScore={pairCount}
        correctAnswers={matchedPairs}
        totalQuestions={pairCount}
        timeTaken={timeTaken}
        bestStreak={bestMoves ? pairCount / bestMoves * 100 : undefined}
        onPlayAgain={() => {
          setGameStarted(false);
        }}
        onExit={onBack}
      />
    );
  }

  return (
    <div className="game-container memory-match-container">
      <div className="game-header">
        <div className="header-top">
          <button 
            className="back-button"
            onClick={() => setGameStarted(false)}
          >
            Back
          </button>
          <h2>Memory Match</h2>
        </div>
        
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Pairs:</span>
            <span className="stat-value">{matchedPairs}/{pairCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Moves:</span>
            <span className="stat-value">{moves}</span>
          </div>
          {bestMoves && (
            <div className="stat">
              <span className="stat-label">Best:</span>
              <span className="stat-value">{bestMoves}</span>
            </div>
          )}
        </div>
        
        <GameProgress progress={progressPercentage} />
      </div>
      
      <div className="memory-board">
        {cards.map((card, index) => (
          <div 
            key={card.id}
            className={`memory-card ${card.flipped || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
            onClick={() => handleCardClick(index)}
          >
            <div className="card-inner">
              <div className="card-front"></div>
              <div className="card-back">
                <span>{card.content}</span>
                <div className={`card-type ${card.type}`}>
                  {card.type}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 