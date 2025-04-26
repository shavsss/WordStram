import { useState, useEffect, useRef, useCallback } from 'react';
import { Word } from '../../shared/types/index';
import { useGameStats } from '../../shared/hooks/useStorage';

interface GameOptions {
  gameType: string;
  timeLimit?: number; // in seconds
  maxQuestions?: number;
  saveProgress?: boolean;
}

/**
 * Custom hook for managing game state across different games
 */
export function useGameState(words: Word[], options: GameOptions) {
  const { gameType, timeLimit, maxQuestions, saveProgress = true } = options;
  
  // Game state
  const [score, setScore] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const [timeTaken, setTimeTaken] = useState(0);
  const gameStartTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get and update game stats from storage
  const { stats, updateStats } = useGameStats(gameType);

  // Set up available questions
  const totalGameWords = maxQuestions && maxQuestions < words.length 
    ? words.slice(0, maxQuestions) 
    : words;
  
  // Game control functions
  const startGame = useCallback(() => {
    // Reset game state
    setScore(0);
    setCurrentQuestionIndex(0);
    setGameStarted(true);
    setGameCompleted(false);
    setCorrectAnswers(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTimeTaken(0);
    
    // Record start time
    gameStartTimeRef.current = Date.now();
    
    // Set up timer if there's a time limit
    if (timeLimit) {
      setTimeRemaining(timeLimit);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // Time's up, end game
            endGame();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
  }, [timeLimit]);
  
  // End game and save stats
  const endGame = useCallback(() => {
    // Calculate final time taken
    if (gameStartTimeRef.current) {
      const endTime = Date.now();
      const totalTimeTaken = Math.floor((endTime - gameStartTimeRef.current) / 1000);
      setTimeTaken(totalTimeTaken);
    }
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Set game state
    setGameCompleted(true);
    setGameStarted(false);
    
    // Save stats if enabled
    if (saveProgress && stats) {
      const now = new Date().toISOString();
      const updatedStats = {
        ...stats,
        lastPlayed: now,
        totalPlayed: stats.totalPlayed + 1,
        highScore: Math.max(stats.highScore, score),
        averageScore: ((stats.averageScore * stats.totalPlayed) + score) / (stats.totalPlayed + 1),
        history: [
          ...stats.history, 
          { date: now, score }
        ]
      };
      
      updateStats(updatedStats);
    }
  }, [score, stats, updateStats, saveProgress]);
  
  // Handle correct answer
  const handleCorrectAnswer = useCallback((points = 1) => {
    setScore(prev => prev + points);
    setCorrectAnswers(prev => prev + 1);
    setCurrentStreak(prev => {
      const newStreak = prev + 1;
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }
      return newStreak;
    });
  }, [bestStreak]);
  
  // Handle incorrect answer
  const handleIncorrectAnswer = useCallback(() => {
    setCurrentStreak(0);
  }, []);
  
  // Move to next question
  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < totalGameWords.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Last question completed
      endGame();
    }
  }, [currentQuestionIndex, totalGameWords.length, endGame]);
  
  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    // State
    score,
    currentQuestionIndex,
    gameStarted,
    gameCompleted,
    correctAnswers,
    currentStreak,
    bestStreak,
    timeRemaining,
    timeTaken,
    totalGameWords,
    currentWord: totalGameWords[currentQuestionIndex],
    
    // Game control functions
    startGame,
    endGame,
    handleCorrectAnswer,
    handleIncorrectAnswer,
    nextQuestion,
    
    // Game stats
    gameStats: stats
  };
}

export default useGameState; 