import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trophy, Star, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import '../styles.css';

import { shuffleArray } from '../../shared/utils/array';
import { MessageType } from '../../shared/message-types';

interface MultipleChoiceProps {
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

// Represents stored game statistics
interface GameStats {
  bestScore: number; // Percentage score
  totalGames: number;
  lastPlayed: string;
}

// Represents a question in the game
interface GameQuestion {
  word: string;
  translation: string;
  context?: string;
  options: string[];
  correctIndex: number;
}

export function MultipleChoice({ words, onBack }: MultipleChoiceProps) {
  const [isStartScreen, setIsStartScreen] = useState(true);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<GameStats | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  
  // Load high score on mount
  useEffect(() => {
    loadHighScore();
  }, []);
  
  // Load high score from storage
  const loadHighScore = async () => {
    try {
      const stats = await chrome.runtime.sendMessage({
        type: MessageType.GAME_STATS_GET,
        payload: { gameType: 'multiple-choice' }
      });
      
      if (stats && stats.data) {
        setHighScore(stats.data);
      }
    } catch (err) {
      console.error('Error loading high score:', err);
    }
  };
  
  // Clean context string
  const cleanContext = (context?: string): string | undefined => {
    if (!context) return undefined;
    // Remove timestamps and other non-text elements
    return context.replace(/\[\d+:\d+\]/g, '').trim();
  };
  
  // Play text-to-speech for a word
  const playAudio = (text: string) => {
    chrome.runtime.sendMessage({
      type: MessageType.TRANSLATE_TEXT,
      payload: { text }
    });
  };
  
  // Save high score to storage
  const saveHighScore = (finalScore: number, totalQuestions: number) => {
    const percentage = Math.round((finalScore / totalQuestions) * 100);
    
    const newStats: GameStats = {
      bestScore: highScore ? Math.max(highScore.bestScore, percentage) : percentage,
      totalGames: highScore ? highScore.totalGames + 1 : 1,
      lastPlayed: new Date().toISOString()
    };
    
    chrome.runtime.sendMessage({
      type: MessageType.GAME_STATS_UPDATE,
      payload: {
        gameType: 'multiple-choice',
        stats: newStats
      }
    });
    
    setHighScore(newStats);
  };
  
  // Handle question count change
  const handleQuestionCountChange = (count: number) => {
    setQuestionCount(Math.min(Math.max(1, count), words.length));
  };
  
  // Handle input change for question count
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      handleQuestionCountChange(value);
    }
  };
  
  // Trigger confetti animation for winning
  const triggerConfetti = () => {
    if (gameAreaRef.current) {
      const rect = gameAreaRef.current.getBoundingClientRect();
      
      // Run animation for 2 seconds
      (function frame() {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 1 },
          zIndex: 1000,
        });
        
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 1 },
          zIndex: 1000,
        });
        
        if (!gameOver) setTimeout(frame, 40);
      }());
    }
  };
  
  // Generate questions from available words
  const generateQuestions = () => {
    if (words.length < 4) {
      alert("You need at least 4 saved words to play this game");
      return false;
    }
    
    const shuffledWords = shuffleArray([...words]).slice(0, questionCount);
    
    const generatedQuestions: GameQuestion[] = shuffledWords.map(wordObj => {
      // Get 3 wrong answers
      const otherTranslations = words
        .filter(w => w.id !== wordObj.id && w.translation !== wordObj.translation)
        .map(w => w.translation);
      
      // Shuffle and take first 3
      const wrongOptions = shuffleArray(otherTranslations).slice(0, 3);
      
      // Create all options with correct one
      const allOptions = [wordObj.translation, ...wrongOptions];
      
      // Shuffle options
      const shuffledOptions = shuffleArray(allOptions);
      
      // Find index of correct answer
      const correctIndex = shuffledOptions.indexOf(wordObj.translation);
      
      return {
        word: wordObj.word,
        translation: wordObj.translation,
        context: cleanContext(wordObj.context),
        options: shuffledOptions,
        correctIndex
      };
    });
    
    setQuestions(generatedQuestions);
    return true;
  };
  
  // Handle option selection
  const handleOptionSelect = (index: number) => {
    if (selectedOption !== null) return; // Already selected
    
    setSelectedOption(index);
    const currentQuestion = questions[currentQuestionIndex];
    const correct = index === currentQuestion.correctIndex;
    setIsCorrect(correct);
    
    if (correct) {
      setScore(prev => prev + 1);
    }
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsCorrect(null);
      } else {
        // Game over
        setGameOver(true);
        setEndTime(Date.now());
        saveHighScore(correct ? score + 1 : score, questions.length);
        triggerConfetti();
      }
    }, 1500);
  };
  
  // Start game
  const startGame = () => {
    if (generateQuestions()) {
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedOption(null);
      setIsCorrect(null);
      setIsStartScreen(false);
      setGameActive(true);
      setGameOver(false);
      setStartTime(Date.now());
    }
  };
  
  // If no words available
  if (words.length === 0) {
    return (
      <div className="glass-card game-container">
        <div className="game-empty">
          <h3>No Words Available</h3>
          <p>Save some words while watching videos to use in games!</p>
          <button className="glass-button" onClick={onBack}>
            Back to Games
          </button>
        </div>
      </div>
    );
  }
  
  // Not enough words
  if (words.length < 4) {
    return (
      <div className="glass-card game-container">
        <div className="game-empty">
          <h3>Not Enough Words</h3>
          <p>You need at least 4 saved words to play Multiple Choice.</p>
          <p>You currently have {words.length} word{words.length !== 1 ? 's' : ''}.</p>
          <button className="glass-button" onClick={onBack}>
            Back to Games
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="glass-card game-container" ref={gameAreaRef}>
      {/* Game header with back button */}
      <div className="game-header">
        <button 
          className="back-button"
          onClick={isStartScreen ? onBack : () => setIsStartScreen(true)}
        >
          <ArrowLeft size={20} />
          {isStartScreen ? 'Games' : 'Menu'}
        </button>
        <div className="game-title-container">
          <h2>Multiple Choice</h2>
          {highScore && (
            <div className="high-score">
              <Trophy size={16} />
              <span>Best: {highScore.bestScore}%</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Start screen */}
      {isStartScreen && (
        <div className="game-start">
          <div className="game-instructions">
            <h3>Test your vocabulary!</h3>
            <p>Select the correct translation for each word.</p>
          </div>
          
          <div className="game-options">
            <div className="option-group">
              <label>
                <span>Words:</span>
                <div className="number-input-container">
                  <button 
                    onClick={() => handleQuestionCountChange(questionCount - 1)}
                    disabled={questionCount <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={words.length}
                    value={questionCount}
                    onChange={handleInputChange}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="text-white bg-transparent border-0 text-center focus:ring-0 focus:outline-none"
                    style={{ 
                      WebkitAppearance: 'none', 
                      MozAppearance: 'textfield',
                      width: '40px' 
                    }}
                  />
                  <button 
                    onClick={() => handleQuestionCountChange(questionCount + 1)}
                    disabled={questionCount >= words.length}
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
            
            <button className="glass-button start-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>
      )}
      
      {/* Active game */}
      {gameActive && !gameOver && (
        <div className="game-content">
          {/* Progress bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
          
          {/* Current question */}
          <div className="question-container">
            <div className="question-word">
              <h3>{questions[currentQuestionIndex].word}</h3>
              <button 
                className="audio-button"
                onClick={() => playAudio(questions[currentQuestionIndex].word)}
              >
                <Volume2 size={20} />
              </button>
            </div>
            
            {questions[currentQuestionIndex].context && (
              <div className="question-context">
                "{questions[currentQuestionIndex].context}"
              </div>
            )}
            
            {/* Options */}
            <div className="options-container">
              {questions[currentQuestionIndex].options.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${
                    selectedOption === index 
                      ? index === questions[currentQuestionIndex].correctIndex 
                        ? "correct" 
                        : "incorrect" 
                      : ""
                  } ${
                    selectedOption !== null && 
                    index === questions[currentQuestionIndex].correctIndex && 
                    "correct-highlight"
                  }`}
                  onClick={() => handleOptionSelect(index)}
                  disabled={selectedOption !== null}
                >
                  {option}
                </button>
              ))}
            </div>
            
            {/* Feedback */}
            {selectedOption !== null && (
              <div className={`feedback ${isCorrect ? "correct-feedback" : "incorrect-feedback"}`}>
                {isCorrect ? (
                  <span>Correct! <Star className="inline" size={18} /></span>
                ) : (
                  <span>Incorrect</span>
                )}
              </div>
            )}
          </div>
          
          {/* Score */}
          <div className="score-container">
            Score: {score}
          </div>
        </div>
      )}
      
      {/* Game over */}
      {gameOver && (
        <div className="game-over">
          <h3>Game Complete!</h3>
          
          <div className="game-stats">
            <div className="stat">
              <div className="stat-label">Final Score</div>
              <div className="stat-value">{score} / {questions.length}</div>
            </div>
            
            <div className="stat">
              <div className="stat-label">Accuracy</div>
              <div className="stat-value">{Math.round((score / questions.length) * 100)}%</div>
            </div>
            
            <div className="stat">
              <div className="stat-label">Time</div>
              <div className="stat-value">{Math.round((endTime - startTime) / 1000)}s</div>
            </div>
          </div>
          
          <div className="game-actions">
            <button className="glass-button" onClick={startGame}>
              Play Again
            </button>
            <button className="glass-button secondary" onClick={() => setIsStartScreen(true)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 