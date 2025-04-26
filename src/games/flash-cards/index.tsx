import React, { useState, useEffect } from 'react';
import { sendMessage } from '../../shared/utils/messaging';
import { MessageType } from '../../shared/message-types';
import './styles.css';

// Define Word type
interface Word {
  id: string;
  text: string;
  translation: string | null;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  context?: string;
}

interface FlashCardsProps {
  words: Word[];
  onExit: () => void;
}

interface GameStats {
  reviewed: number;
  remembered: number;
  forgotten: number;
  totalCards: number;
  startTime: number;
  endTime: number | null;
}

const FlashCards: React.FC<FlashCardsProps> = ({ words, onExit }) => {
  const [availableWords, setAvailableWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats>({
    reviewed: 0,
    remembered: 0,
    forgotten: 0,
    totalCards: 0,
    startTime: Date.now(),
    endTime: null,
  });

  // Initialize available words
  useEffect(() => {
    const wordsWithTranslation = words.filter(w => w.translation);
    // Shuffle the words
    const shuffled = [...wordsWithTranslation].sort(() => Math.random() - 0.5);
    setAvailableWords(shuffled);
    setGameStats(prev => ({
      ...prev,
      totalCards: shuffled.length
    }));
  }, [words]);

  // Save game stats when game is over
  useEffect(() => {
    if (gameOver && gameStats.endTime) {
      sendMessage({
        type: MessageType.SAVE_GAME_STATS,
        data: {
          gameType: 'flashCards',
          stats: {
            cardsReviewed: gameStats.reviewed,
            remembered: gameStats.remembered,
            forgotten: gameStats.forgotten,
            totalCards: gameStats.totalCards,
            timeSpent: Math.floor((gameStats.endTime - gameStats.startTime) / 1000),
            date: new Date().toISOString(),
          }
        }
      });
    }
  }, [gameOver, gameStats]);

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRemembered = () => {
    setGameStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      remembered: prev.remembered + 1,
    }));
    nextCard();
  };

  const handleForgotten = () => {
    setGameStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      forgotten: prev.forgotten + 1,
    }));
    nextCard();
  };

  const nextCard = () => {
    if (currentIndex >= availableWords.length - 1) {
      // End of game
      setGameOver(true);
      setGameStats(prev => ({
        ...prev,
        endTime: Date.now(),
      }));
    } else {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handleRestart = () => {
    // Reshuffle the words
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    setAvailableWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setGameOver(false);
    setGameStats({
      reviewed: 0,
      remembered: 0,
      forgotten: 0,
      totalCards: shuffled.length,
      startTime: Date.now(),
      endTime: null,
    });
  };

  const formatTime = (timeInMs: number) => {
    const seconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle the case where there are no words with translations
  if (availableWords.length === 0) {
    return (
      <div className="flash-cards-container">
        <div className="no-words-message">
          <h3>No cards available</h3>
          <p>You need to save some words with translations before playing this game.</p>
          <button className="exit-button" onClick={onExit}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render game completion screen
  if (gameOver) {
    const timeSpent = gameStats.endTime ? gameStats.endTime - gameStats.startTime : 0;
    const accuracyPercentage = gameStats.reviewed > 0 
      ? Math.round((gameStats.remembered / gameStats.reviewed) * 100) 
      : 0;
    
    return (
      <div className="flash-cards-container">
        <div className="game-completion">
          <h2>Review Completed!</h2>
          
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Cards Reviewed</span>
              <span className="stat-value">{gameStats.reviewed} / {gameStats.totalCards}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Time</span>
              <span className="stat-value">{formatTime(timeSpent)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Remembered</span>
              <span className="stat-value">{gameStats.remembered}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Success Rate</span>
              <span className="stat-value">{accuracyPercentage}%</span>
            </div>
          </div>
          
          <div className="game-completion-buttons">
            <button className="play-again-button" onClick={handleRestart}>
              Review Again
            </button>
            <button className="exit-button" onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Current card
  const currentWord = availableWords[currentIndex];

  // Render main game UI
  return (
    <div className="flash-cards-container">
      <div className="flash-cards-header">
        <div className="progress">
          <div className="progress-text">
            {currentIndex + 1} / {availableWords.length}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentIndex + 1) / availableWords.length) * 100}%` }}
            ></div>
          </div>
        </div>
        
        <div className="stats">
          <div className="stat">
            <span className="stat-icon remembered">✓</span>
            <span className="stat-count">{gameStats.remembered}</span>
          </div>
          <div className="stat">
            <span className="stat-icon forgotten">✗</span>
            <span className="stat-count">{gameStats.forgotten}</span>
          </div>
        </div>
      </div>
      
      <div className="flash-card-container">
        <div 
          className={`flash-card ${isFlipped ? 'flipped' : ''}`} 
          onClick={handleCardClick}
        >
          <div className="flash-card-front">
            <div className="card-content">
              <div className="language-indicator">{currentWord.targetLang}</div>
              <div className="word">{currentWord.translation}</div>
              <div className="card-instructions">Tap to flip</div>
            </div>
          </div>
          <div className="flash-card-back">
            <div className="card-content">
              <div className="language-indicator">{currentWord.sourceLang}</div>
              <div className="word">{currentWord.text}</div>
              {currentWord.context && (
                <div className="context">"{currentWord.context}"</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flash-card-actions">
        <div className="action-buttons">
          <button 
            className="remembered-button"
            onClick={handleRemembered}
            disabled={!isFlipped}
          >
            I Remembered
          </button>
          <button 
            className="forgotten-button"
            onClick={handleForgotten}
            disabled={!isFlipped}
          >
            I Forgot
          </button>
        </div>
        <button className="exit-game-button" onClick={onExit}>
          Exit Game
        </button>
      </div>
    </div>
  );
};

export default FlashCards; 