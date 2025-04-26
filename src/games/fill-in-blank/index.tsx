import React, { useState, useEffect, useRef } from 'react';
import { sendMessage } from '../../shared/utils/messaging';
import { MessageType } from '../../shared/message-types';
import './styles.css';

// Define Word type if it's not exported from shared/types
interface Word {
  id: string;
  text: string;
  translation: string | null;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  context?: string;
}

interface FillInBlankProps {
  words: Word[];
  onExit: () => void;
}

interface GameStats {
  correct: number;
  incorrect: number;
  skipped: number;
  streak: number;
  bestStreak: number;
  totalQuestions: number;
  startTime: number;
  endTime: number | null;
}

const FillInBlank: React.FC<FillInBlankProps> = ({ words, onExit }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameStats, setGameStats] = useState<GameStats>({
    correct: 0,
    incorrect: 0,
    skipped: 0,
    streak: 0,
    bestStreak: 0,
    totalQuestions: words.length,
    startTime: Date.now(),
    endTime: null,
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const availableWords = words.filter(w => w.translation);
  const currentWord = availableWords[currentWordIndex];
  
  useEffect(() => {
    // Focus input when component mounts or current word changes
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWordIndex]);

  useEffect(() => {
    // Save game stats when game is over
    if (gameOver && gameStats.endTime) {
      sendMessage({
        type: MessageType.SAVE_GAME_STATS,
        data: {
          gameType: 'fillInBlank',
          stats: {
            correctAnswers: gameStats.correct,
            incorrectAnswers: gameStats.incorrect,
            skippedQuestions: gameStats.skipped,
            bestStreak: gameStats.bestStreak,
            totalQuestions: gameStats.totalQuestions,
            timeSpent: Math.floor((gameStats.endTime - gameStats.startTime) / 1000),
            date: new Date().toISOString(),
          }
        }
      });
    }
  }, [gameOver, gameStats]);

  const checkAnswer = () => {
    if (!currentWord) return;
    
    const normalizedUserAnswer = userAnswer.trim().toLowerCase();
    const normalizedCorrectAnswer = currentWord.text.trim().toLowerCase();
    
    // Check if the answer is correct
    const isAnswerCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    setIsCorrect(isAnswerCorrect);
    
    if (isAnswerCorrect) {
      setFeedback('Correct! 🎉');
      
      // Update stats for correct answer
      const newStreak = gameStats.streak + 1;
      const newBestStreak = Math.max(gameStats.bestStreak, newStreak);
      
      setGameStats({
        ...gameStats,
        correct: gameStats.correct + 1,
        streak: newStreak,
        bestStreak: newBestStreak,
      });
      
      // Move to next word after delay
      setTimeout(() => {
        goToNextWord();
      }, 1500);
    } else {
      setFeedback(`Not quite. The answer is "${currentWord.text}".`);
      
      // Update stats for incorrect answer
      setGameStats({
        ...gameStats,
        incorrect: gameStats.incorrect + 1,
        streak: 0,
      });
      
      // Move to next word after a longer delay
      setTimeout(() => {
        goToNextWord();
      }, 3000);
    }
  };

  const skipWord = () => {
    setFeedback(`Skipped. The answer is "${currentWord.text}".`);
    setIsCorrect(null);
    
    // Update stats for skipped question
    setGameStats({
      ...gameStats,
      skipped: gameStats.skipped + 1,
      streak: 0,
    });
    
    // Move to next word after delay
    setTimeout(() => {
      goToNextWord();
    }, 2000);
  };

  const showHintHandler = () => {
    setShowHint(true);
  };

  const goToNextWord = () => {
    // Check if we've gone through all words
    if (currentWordIndex >= availableWords.length - 1) {
      // Game over
      setGameOver(true);
      setGameStats({
        ...gameStats,
        endTime: Date.now(),
      });
    } else {
      // Move to next word
      setCurrentWordIndex(currentWordIndex + 1);
      setUserAnswer('');
      setFeedback('');
      setShowHint(false);
      setIsCorrect(null);
    }
  };

  const playAgain = () => {
    // Reset game state
    setCurrentWordIndex(0);
    setUserAnswer('');
    setFeedback('');
    setShowHint(false);
    setIsCorrect(null);
    setGameOver(false);
    setGameStats({
      correct: 0,
      incorrect: 0,
      skipped: 0,
      streak: 0,
      bestStreak: 0,
      totalQuestions: availableWords.length,
      startTime: Date.now(),
      endTime: null,
    });
  };

  const calculateAccuracy = () => {
    const totalAttempted = gameStats.correct + gameStats.incorrect;
    if (totalAttempted === 0) return 0;
    return Math.round((gameStats.correct / totalAttempted) * 100);
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
      <div className="fill-in-blank-container">
        <div className="no-words-message">
          <h3>No words available</h3>
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
    
    return (
      <div className="fill-in-blank-container">
        <div className="game-completion">
          <h2>Game Completed!</h2>
          
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Score</span>
              <span className="stat-value">{gameStats.correct} / {gameStats.totalQuestions}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Time</span>
              <span className="stat-value">{formatTime(timeSpent)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Best Streak</span>
              <span className="stat-value">{gameStats.bestStreak}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{calculateAccuracy()}%</span>
            </div>
          </div>
          
          <div className="game-completion-buttons">
            <button className="play-again-button" onClick={playAgain}>
              Play Again
            </button>
            <button className="exit-button" onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render main game UI
  return (
    <div className="fill-in-blank-container">
      <div className="game-header">
        <div className="progress">
          <div className="progress-text">
            {currentWordIndex + 1} / {availableWords.length}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentWordIndex + 1) / availableWords.length) * 100}%` }}
            ></div>
          </div>
        </div>
        
        <div className="stats">
          <div className="stat">
            <span className="stat-icon correct">✓</span>
            <span className="stat-count">{gameStats.correct}</span>
          </div>
          <div className="stat">
            <span className="stat-icon incorrect">✗</span>
            <span className="stat-count">{gameStats.incorrect}</span>
          </div>
          <div className="stat">
            <span className="stat-icon skipped">↷</span>
            <span className="stat-count">{gameStats.skipped}</span>
          </div>
          <div className="stat streak">
            <span className="stat-label">Streak</span>
            <span className="stat-count">{gameStats.streak}</span>
          </div>
        </div>
      </div>
      
      <div className="game-content">
        <div className={`question-container ${isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : ''}`}>
          <h3>What is this word in {currentWord.sourceLang}?</h3>
          
          <div className="translation-text">
            {currentWord.translation}
          </div>
          
          {showHint && (
            <div className="hint">
              <p>First letter: {currentWord.text.charAt(0)}</p>
              <p>Length: {currentWord.text.length} characters</p>
            </div>
          )}
        </div>
        
        <div className="answer-container">
          <input
            ref={inputRef}
            type="text"
            className="answer-input"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer..."
            disabled={!!feedback}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !feedback) {
                checkAnswer();
              }
            }}
          />
          
          {feedback ? (
            <div className={`feedback ${isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : ''}`}>
              {feedback}
            </div>
          ) : (
            <div className="answer-buttons">
              <button 
                className="check-button" 
                onClick={checkAnswer}
                disabled={!userAnswer.trim()}
              >
                Check
              </button>
              
              <button className="hint-button" onClick={showHintHandler} disabled={showHint}>
                Show Hint
              </button>
              
              <button className="skip-button" onClick={skipWord}>
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
      
      <button className="exit-game-button" onClick={onExit}>
        Exit Game
      </button>
    </div>
  );
};

export default FillInBlank; 