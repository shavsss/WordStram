import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Timer, Star, Zap, Volume2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface WordScrambleProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

interface Question {
  word: string;
  scrambledWord: string;
  answer: string;
  context?: string;
  userAnswer?: string;
  isCorrect?: boolean;
  points: number;
}

export function WordScramble({ words, onBack }: WordScrambleProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [streak, setStreak] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(10);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [bestPercentage, setBestPercentage] = useState<number | null>(null);
  const gameStartTime = useRef<number | null>(null);
  const [totalTime, setTotalTime] = useState<number>(0);

  useEffect(() => {
    // Load best percentage from Chrome storage
    chrome.storage.sync.get('wordScrambleStats', (result) => {
      if (result.wordScrambleStats) {
        setBestPercentage(result.wordScrambleStats.bestPercentage || null);
      }
    });

    if (gameStarted) {
      initializeGame();
    }
  }, [gameStarted, words]);

  useEffect(() => {
    if (gameStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            checkAnswer();
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameStarted, timeLeft]);

  const scrambleWord = (word: string): string => {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join('');
    return scrambled === word ? scrambleWord(word) : scrambled;
  };

  // Clean context to remove "From youtube" mentions
  const cleanContext = (context?: string): string | undefined => {
    if (!context) return undefined;
    
    // Remove any variation of "From youtube" text
    return context
      .replace(/["']?From youtube["']?/gi, '')
      .replace(/["']?From YouTube["']?/gi, '')
      .trim();
  };

  const initializeGame = () => {
    const shuffledWords = [...words]
      .sort(() => Math.random() - 0.5)
      .slice(0, wordCount)
      .map(word => ({
        word: word.translation,
        scrambledWord: scrambleWord(word.word),
        answer: word.word,
        context: cleanContext(word.context),
        points: 10
      }));

    setQuestions(shuffledWords);
    setCurrentQuestionIndex(0);
    setCurrentAnswer('');
    setScore(0);
    setStreak(0);
    setProgress(0);
    setTimeLeft(30);
    setComboMultiplier(1);
    setShowHint(false);
    setCorrectAnswers(0);

    // Start tracking game time
    gameStartTime.current = Date.now();
  };

  const checkAnswer = () => {
    if (!questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    const normalizedUserAnswer = currentAnswer.trim().toLowerCase();
    const normalizedCorrectAnswer = currentQuestion.answer.trim().toLowerCase();
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    if (isCorrect) {
      const timeBonus = Math.floor(timeLeft / 3);
      const points = (currentQuestion.points + timeBonus) * comboMultiplier;
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setComboMultiplier(prev => Math.min(prev + 0.5, 3));
      setCorrectAnswers(prev => prev + 1);
      if (streak === 4) {
        triggerConfetti();
      }
    } else {
      setStreak(0);
      setComboMultiplier(1);
    }

    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...currentQuestion,
      userAnswer: currentAnswer,
      isCorrect
    };

    setQuestions(updatedQuestions);
    updateProgress();

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        nextQuestion();
      } else {
        const gameTime = Math.floor((Date.now() - (gameStartTime.current || 0)) / 1000);
        setTotalTime(gameTime);
        const percentageCorrect = Math.round((correctAnswers + (isCorrect ? 1 : 0)) / questions.length * 100);
        saveScore(percentageCorrect);
      }
    }, 1500);
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    setCurrentAnswer('');
    setTimeLeft(30);
    setShowHint(false);
  };

  const updateProgress = () => {
    const newProgress = ((currentQuestionIndex + 1) / questions.length) * 100;
    setProgress(newProgress);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const isGameComplete = currentQuestionIndex === questions.length - 1 && 
    questions[currentQuestionIndex]?.userAnswer !== undefined;

  const saveScore = (percentageCorrect: number) => {
    console.log('Saving score:', percentageCorrect);
    
    chrome.storage.sync.get('wordScrambleStats', (result) => {
      const currentStats = result.wordScrambleStats || {
        bestScore: 0,
        totalGames: 0,
        lastPlayed: new Date().toISOString(),
        recentScores: [],
        totalCorrect: 0,
        totalAttempted: 0
      };
      
      // Store recent scores (up to 10)
      const recentScores = currentStats.recentScores || [];
      recentScores.unshift(percentageCorrect);
      if (recentScores.length > 10) {
        recentScores.pop();
      }
      
      const newStats = {
        bestScore: Math.max(currentStats.bestScore || 0, percentageCorrect),
        totalGames: (currentStats.totalGames || 0) + 1,
        lastPlayed: new Date().toISOString(),
        recentScores,
        totalCorrect: (currentStats.totalCorrect || 0) + correctAnswers,
        totalAttempted: (currentStats.totalAttempted || 0) + questions.length
      };
      
      chrome.storage.sync.set({ wordScrambleStats: newStats }, () => {
        console.log('Word Scramble stats saved:', newStats);
      });
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Word count options
  const wordCountOptions = [5, 10, 15, 20];

  return (
    <div className="fixed inset-0 animated-gradient-bg text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
        {gameStarted && (
          <header className="flex items-center justify-between mb-8 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-3 px-4 rounded-xl">
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
                <Star className="text-amber-400" size={20} />
                <span className="font-bold text-lg vibrant-text">{score}</span>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
                  <Zap className="text-amber-400" size={20} />
                  <span className="font-medium vibrant-text">{streak}x</span>
                </div>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 flex flex-col gap-6">
          {gameStarted && (
            <div className="flex items-center gap-4">
              <Progress 
                value={progress} 
                className="flex-1 h-3 glass-card" 
              />
              <div className="flex items-center gap-2 glass-card px-3 py-1 rounded-full text-sm">
                <Timer size={16} />
                {timeLeft}s
              </div>
            </div>
          )}

          <motion.div
            layout
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {!gameStarted ? (
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
                      Word Scramble
                    </h2>
                    <div className="w-10"></div> {/* Spacer for alignment */}
                  </div>
                  
                  <div className="glass-card p-4 rounded-xl text-center w-full mb-6">
                    <p className="text-3xl font-bold gradient-text floating">
                      {bestPercentage !== null ? `${bestPercentage}%` : "0%"}
                    </p>
                    <p className="text-sm text-white/80">Best Score</p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm text-white/80 mb-2">Number of words:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {wordCountOptions.map(count => (
                        <Button
                          key={count}
                          variant={wordCount === count ? "default" : "outline"}
                          onClick={() => setWordCount(count)}
                          className={`${
                            wordCount === count 
                              ? "bg-white/20 text-white" 
                              : "bg-transparent text-white/80 border-white/20"
                          } hover:bg-white/20 transition-colors`}
                        >
                          {count}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setGameStarted(true)}
                    className="w-full py-6 glass-button gradient-border font-bold"
                  >
                    Start Game
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <Card className="flex-1 glass-card border-0 p-8">
                {questions[currentQuestionIndex] && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-2xl font-bold mb-4 flex items-center justify-center gap-3">
                        <span className="gradient-text text-4xl tracking-wide">
                          {questions[currentQuestionIndex].scrambledWord}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playAudio(questions[currentQuestionIndex].answer)}
                          className="h-10 w-10 rounded-full flex items-center justify-center p-0 bg-purple-900"
                        >
                          <Volume2 size={18} className="text-white" />
                        </Button>
                      </h3>
                      {questions[currentQuestionIndex].context && (
                        <p className="text-white/80 text-lg italic text-center">
                          "{questions[currentQuestionIndex].context}"
                        </p>
                      )}
                      <p className="text-center font-medium text-xl mb-2">Translation:</p>
                      <p className="text-white text-xl text-center font-bold mb-4">
                        {questions[currentQuestionIndex].word}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <Input
                          type="text"
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                          placeholder="Unscramble the word..."
                          disabled={questions[currentQuestionIndex].userAnswer !== undefined}
                          className="w-full p-4 text-lg glass-card border-white/20 text-white placeholder-white/50 text-center"
                        />
                      </div>

                      {questions[currentQuestionIndex].userAnswer && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-lg ${
                            questions[currentQuestionIndex].isCorrect
                              ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 gradient-border-success'
                              : 'bg-red-500/30 border border-red-400 text-red-200 gradient-border-error'
                          }`}
                        >
                          <p className="font-medium text-center flex items-center justify-center gap-2">
                            {questions[currentQuestionIndex].isCorrect ? (
                              <>
                                <span className="inline-block w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white">✓</span>
                                <span className="text-emerald-200">Correct!</span>
                              </>
                            ) : (
                              <>
                                <span className="inline-block w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">✗</span>
                                <span className="text-red-200">Incorrect!</span>
                              </>
                            )}
                          </p>
                          {!questions[currentQuestionIndex].isCorrect && (
                            <p className="text-sm opacity-90 text-center mt-2">
                              Correct answer: <span className="font-bold text-white">{questions[currentQuestionIndex].answer}</span>
                            </p>
                          )}
                        </motion.div>
                      )}

                      {!questions[currentQuestionIndex].userAnswer && (
                        <div className="flex gap-3">
                          <Button
                            onClick={checkAnswer}
                            disabled={!currentAnswer.trim()}
                            className="flex-1 glass-button"
                          >
                            Check Answer
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowHint(true)}
                            disabled={showHint}
                            className="flex-1 glass-button"
                          >
                            Show Hint
                          </Button>
                        </div>
                      )}

                      {showHint && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-white/70 text-center glass-card p-3 rounded-lg"
                        >
                          First letter: <span className="text-amber-300 font-bold">{questions[currentQuestionIndex].answer[0]}</span>
                          <br />
                          Length: <span className="text-amber-300 font-bold">{questions[currentQuestionIndex].answer.length}</span> characters
                        </motion.p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </motion.div>
        </main>

        <AnimatePresence>
          {isGameComplete && (
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
                <h3 className="text-3xl font-bold text-center game-header-text mb-6">
                  Challenge Complete!
                </h3>
                <div className="grid grid-cols-2 gap-6 text-center mb-6">
                  <div className="glass-card p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{score}</p>
                    <p className="text-sm text-white/80">Score</p>
                  </div>
                  <div className="glass-card p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{formatTime(totalTime)}</p>
                    <p className="text-sm text-white/80">Time</p>
                  </div>
                  <div className="glass-card p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{streak}</p>
                    <p className="text-sm text-white/80">Best Streak</p>
                  </div>
                  <div className="glass-card p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">
                      {Math.round((correctAnswers / questions.length) * 100)}%
                    </p>
                    <p className="text-sm text-white/80">Accuracy</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 
