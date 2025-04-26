import React, { useState, useEffect } from 'react';
import { MessageType } from '../../shared/message-types';
import { VocabWord } from '../../shared/types';
import GameProgress from '../components/GameProgress';
import { shuffleArray } from '../../shared/utils/array';
import GameResult from '../components/GameResult';
import '../styles.css';
import './styles.css';

interface Word {
  id: string;
  word: string;
  translation: string;
  context?: string;
  timestamp: number;
  targetLanguage: string;
}

interface WordScrambleProps {
  onExit: () => void;
  words: Word[];
}

/**
 * Scrambles a word randomly
 */
function scrambleWord(word: string): string {
  if (word.length <= 1) return word;
  
  // Convert to array, shuffle, and join back
  const letters = word.split('');
  const shuffled = shuffleArray([...letters]);
  
  // Make sure the scrambled word is different from the original
  return shuffled.join('') === word ? scrambleWord(word) : shuffled.join('');
}

export const WordScramble: React.FC<WordScrambleProps> = ({ onExit, words }) => {
  const [gameWords, setGameWords] = useState<Word[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [scrambledWord, setScrambledWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackColor, setFeedbackColor] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [stats, setStats] = useState({
    correct: 0,
    incorrect: 0,
    skipped: 0,
    streak: 0,
    bestStreak: 0,
  });

  useEffect(() => {
    if (words && words.length > 0) {
      // Format the words to match our game format
      const formattedWords = words.map((word) => ({
        id: word.id,
        word: word.word,
        translation: word.translation,
        timestamp: word.timestamp,
        targetLanguage: word.targetLanguage,
      }));
      
      // Shuffle the words and set the initial game state
      setGameWords(shuffleArray(formattedWords));
    }
    startGame();
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [words]);
  
  // Start the game
  const startGame = () => {
    if (gameWords.length > 0) {
      setCurrentWordIndex(0);
      setGameOver(false);
      setTimer(0);
      setShowHint(false);
      setStats({
        correct: 0,
        incorrect: 0,
        skipped: 0,
        streak: 0,
        bestStreak: 0,
      });
      
      // Scramble the first word
      setScrambledWord(scrambleWord(gameWords[0].word));
    }
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedback !== null) return; // Don't allow changes after answer is checked
    setUserInput(e.target.value);
  };
  
  // Check the user's answer
  const checkAnswer = () => {
    if (!userInput.trim()) return;
    
    const currentWord = gameWords[currentWordIndex].word;
    const correct = userInput.trim().toLowerCase() === currentWord.toLowerCase();
    
    setFeedback(correct ? 'Correct!' : `Incorrect! The word was: ${currentWord}`);
    setFeedbackColor(correct ? 'correct' : 'incorrect');
    
    // Update stats
    setStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
    
    // Wait a bit before moving to next word
    setTimeout(() => {
      goToNextWord();
    }, 1500);
  };
  
  // Show a hint (first letter)
  const showHintHandler = () => {
    setShowHint(true);
    setUserInput(gameWords[currentWordIndex].word[0]);
  };
  
  // Skip the current word
  const skipWord = () => {
    setStats(prev => ({
      ...prev,
      skipped: prev.skipped + 1,
    }));
    
    // Go to next word immediately
    goToNextWord();
  };
  
  // Move to the next word
  const goToNextWord = () => {
    if (currentWordIndex < gameWords.length - 1) {
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setUserInput('');
      setFeedback(null);
      setFeedbackColor('');
      setShowHint(false);
      
      // Scramble the next word
      setScrambledWord(scrambleWord(gameWords[nextIndex].word));
    } else {
      // Game finished
      finishGame();
    }
  };
  
  // End the game and record stats
  const finishGame = () => {
    setGameOver(true);
    
    // Save game statistics
    chrome.runtime.sendMessage({
      type: MessageType.GAME_STATS_UPDATE,
      payload: {
        gameType: 'word-scramble',
        stats: {
          correct: stats.correct,
          incorrect: stats.incorrect,
          skipped: stats.skipped,
          streak: stats.streak,
          bestStreak: stats.bestStreak,
          lastPlayed: new Date().toISOString()
        }
      }
    });
  };
  
  // Format the time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };
  
  // Handle key press (Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && feedback === null) {
      checkAnswer();
    }
  };
  
  // If no words are available
  if (words.length === 0) {
    return (
      <div className="word-scramble-container glass-card">
        <div className="word-scramble-empty">
          <h3>No Words Available</h3>
          <p>Save some words while watching videos to use in games!</p>
          <button className="exit-button" onClick={onExit}>
            Back to Games
          </button>
        </div>
      </div>
    );
  }
  
  // Game start screen
  if (gameWords.length === 0) {
    return (
      <div className="word-scramble-container glass-card">
        <div className="word-scramble-start">
          <h2>Word Scramble</h2>
          <p>Unscramble the words to test your vocabulary!</p>
          
          <div className="word-scramble-settings">
            <p>Loading words...</p>
          </div>
          
          <button className="start-button" onClick={startGame}>
            Start Game
          </button>
          <button className="exit-button" onClick={onExit}>
            Back to Games
          </button>
        </div>
      </div>
    );
  }
  
  // Game over screen
  if (gameOver) {
    const timeTaken = Math.round(timer / 1000);
    
    return (
      <div className="word-scramble-container glass-card">
        <GameResult
          score={stats.correct}
          maxScore={gameWords.length}
          correctAnswers={stats.correct}
          totalQuestions={gameWords.length}
          timeTaken={timeTaken}
          onPlayAgain={startGame}
          onExit={onExit}
        />
      </div>
    );
  }
  
  // Active game
  return (
    <div className="word-scramble-container glass-card">
      <div className="word-scramble-header">
        <button className="exit-game-button" onClick={onExit}>
          Exit Game
        </button>
        
        <div className="progress-container">
          <div className="progress-info">
            <span>{currentWordIndex + 1} / {gameWords.length}</span>
            <span>Correct: {stats.correct}</span>
          </div>
          <GameProgress progress={(currentWordIndex / gameWords.length) * 100} />
        </div>
      </div>
      
      <div className="word-scramble-content">
        <div className="word-card">
          <div className="scrambled-word">
            {scrambledWord}
          </div>
          
          <div className="hint-container">
            {showHint && (
              <p>First letter: <strong>{gameWords[currentWordIndex].word[0]}</strong></p>
            )}
          </div>
          
          <div className="answer-container">
            <input
              type="text"
              className={`answer-input ${feedbackColor}`}
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer"
              disabled={feedback !== null}
              autoFocus
            />
            
            {feedback && (
              <div className="feedback-message">
                {feedback}
              </div>
            )}
          </div>
          
          <div className="game-actions">
            <button
              className="check-button"
              onClick={checkAnswer}
              disabled={userInput.trim() === '' || feedback !== null}
            >
              Check
            </button>
            <button
              className="hint-button"
              onClick={showHintHandler}
              disabled={showHint || feedback !== null}
            >
              Hint
            </button>
            <button
              className="skip-button"
              onClick={skipWord}
              disabled={feedback !== null}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WordScramble; 