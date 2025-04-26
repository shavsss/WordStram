import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStats } from '../../shared/hooks/useStorage';
import GameResult from '../components/GameResult';
import '../styles.css';
import './styles.css';

interface MemoryCard {
  id: string;
  content: string;
  type: 'word' | 'translation';
  matchId: string;
  flipped: boolean;
  matched: boolean;
}

interface MemoryMatchProps {
  words: any[];
  onExit: () => void;
}

const MemoryMatch: React.FC<MemoryMatchProps> = ({ words, onExit }) => {
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [pairCount, setPairCount] = useState(8); // Default number of pairs
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { stats: gameStats, updateStats } = useGameStats('memory');
  
  // Initialize game
  useEffect(() => {
    if (words.length > 0) {
      setLoading(false);
    }
  }, [words]);

  // Shuffle and prepare cards
  const initializeGame = useCallback(() => {
    if (words.length < pairCount) {
      // Not enough words, use all available words
      setPairCount(Math.floor(words.length));
    }
    
    // Select random words
    const shuffledWords = [...words].sort(() => 0.5 - Math.random()).slice(0, pairCount);
    
    // Create pairs (word + translation)
    const cardPairs: MemoryCard[] = [];
    shuffledWords.forEach(word => {
      // Word card
      cardPairs.push({
        id: `word-${word.id}`,
        content: word.originalWord,
        type: 'word',
        matchId: word.id,
        flipped: false,
        matched: false
      });
      
      // Translation card
      cardPairs.push({
        id: `translation-${word.id}`,
        content: word.targetWord,
        type: 'translation',
        matchId: word.id,
        flipped: false,
        matched: false
      });
    });
    
    // Shuffle cards
    const shuffledCards = [...cardPairs].sort(() => 0.5 - Math.random());
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setGameComplete(false);
    setGameStarted(true);
    setStartTime(Date.now());
  }, [words, pairCount]);

  // Handle card click
  const handleCardClick = (index: number) => {
    // Ignore if already matched or more than 2 cards flipped or already flipped
    if (
      cards[index].matched || 
      flippedCards.length >= 2 || 
      flippedCards.includes(index)
    ) {
      return;
    }
    
    // Flip card
    const newFlippedCards = [...flippedCards, index];
    setFlippedCards(newFlippedCards);
    
    // Check for match if 2 cards are flipped
    if (newFlippedCards.length === 2) {
      setMoves(prevMoves => prevMoves + 1);
      
      const card1 = cards[newFlippedCards[0]];
      const card2 = cards[newFlippedCards[1]];
      
      if (card1.matchId === card2.matchId) {
        // Match found
        setTimeout(() => {
          const newCards = [...cards];
          newCards[newFlippedCards[0]].matched = true;
          newCards[newFlippedCards[1]].matched = true;
          setCards(newCards);
          setFlippedCards([]);
          setMatchedPairs(prevMatches => {
            const newMatchCount = prevMatches + 1;
            // Check if game is complete
            if (newMatchCount === pairCount) {
              const endTimeValue = Date.now();
              setEndTime(endTimeValue);
              setGameComplete(true);
              
              // Save game stats
              if (gameStats) {
                const timeTaken = Math.floor((endTimeValue - startTime) / 1000);
                const newStats = {
                  ...gameStats,
                  totalPlayed: gameStats.totalPlayed + 1,
                  lastPlayed: new Date().toISOString(),
                  history: [
                    ...gameStats.history,
                    { date: new Date().toISOString(), score: Math.max(100 - moves + pairCount, 0) }
                  ],
                  bestScore: Math.min(moves, gameStats.bestScore || Infinity),
                  averageScore: Math.floor(
                    (gameStats.averageScore * gameStats.totalPlayed + moves) / 
                    (gameStats.totalPlayed + 1)
                  )
                };
                updateStats(newStats);
              }
            }
            return newMatchCount;
          });
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  // Start a new game
  const startGame = () => {
    initializeGame();
  };

  // Play again
  const playAgain = () => {
    initializeGame();
  };

  // Handle pair count change
  const handlePairCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value);
    
    // Ensure value is within bounds
    if (isNaN(value) || value < 2) value = 2;
    if (value > Math.floor(words.length)) value = Math.floor(words.length);
    
    setPairCount(value);
  };

  if (loading) {
    return (
      <div className="memory-loading">
        <p>Loading game...</p>
      </div>
    );
  }

  if (words.length < 2) {
    return (
      <div className="memory-empty">
        <h3>Not enough words!</h3>
        <p>You need at least 2 saved words to play Memory Match.</p>
        <button className="exit-button" onClick={onExit}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="memory-container">
      {!gameStarted ? (
        <div className="memory-start">
          <h2>Memory Match</h2>
          <p>Match words with their translations. Find all pairs in the fewest moves!</p>
          
          <div className="memory-settings">
            <label>
              Number of pairs:
              <input
                type="number"
                min="2"
                max={Math.min(12, Math.floor(words.length))}
                value={pairCount}
                onChange={handlePairCountChange}
              />
            </label>
          </div>
          
          <button className="start-button" onClick={startGame}>
            Start Game
          </button>
          <button className="exit-button" onClick={onExit}>
            Go Back
          </button>
        </div>
      ) : gameComplete ? (
        <GameResult
          score={Math.max(100 - moves + pairCount, 0)}
          maxScore={100}
          correctAnswers={pairCount}
          totalQuestions={pairCount}
          timeTaken={Math.floor((endTime - startTime) / 1000)}
          onPlayAgain={playAgain}
          onExit={onExit}
        />
      ) : (
        <div className="memory-game">
          <div className="memory-header">
            <div className="memory-stats">
              <div className="memory-stat">
                <span className="stat-label">Pairs:</span>
                <span className="stat-value">{matchedPairs}/{pairCount}</span>
              </div>
              <div className="memory-stat">
                <span className="stat-label">Moves:</span>
                <span className="stat-value">{moves}</span>
              </div>
            </div>
            <button className="exit-game-button" onClick={onExit}>
              Exit Game
            </button>
          </div>
          
          <div className="memory-board" style={{ 
            gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(cards.length)), 6)}, 1fr)`
          }}>
            {cards.map((card, index) => (
              <div
                key={card.id}
                className={`memory-card ${flippedCards.includes(index) ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
                onClick={() => handleCardClick(index)}
              >
                <div className="card-inner">
                  <div className="card-front">
                    <span>?</span>
                  </div>
                  <div className="card-back">
                    <span>{card.content}</span>
                    <small className={`card-type ${card.type}`}>
                      {card.type === 'word' ? 'Word' : 'Translation'}
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryMatch; 