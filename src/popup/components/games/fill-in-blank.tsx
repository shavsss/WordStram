import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Timer, Star, Zap, Volume2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// ייבוא פונקציות משותפות מספריית game-utils
import { 
  cleanContext,
  playAudio,
  formatTime,
  celebrateSuccess as triggerConfetti,
  normalizeText,
  calculateScore,
  addNumericInputStyles
} from '@/lib/game-utils';

// ייבוא ההוק useGameTimer
import useGameTimer from '@/hooks/useGameTimer';

interface FillInBlankProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

interface Question {
  word: string;
  answer: string;
  context?: string;
  userAnswer?: string;
  isCorrect?: boolean;
  points: number;
}

export function FillInBlank({ words, onBack }: FillInBlankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answer, setAnswer] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [wordCount, setWordCount] = useState<number>(10);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [bestPercentage, setBestPercentage] = useState<number | null>(null);
  const lastAnswerCorrect = useRef<boolean | null>(null);
  const gameStartTime = useRef<number | null>(null);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  // שימוש בהוק הטיימר
  const timer = useGameTimer({
    initialTime: 30,
    onTimeEnd: () => checkAnswer(),
    countUp: false
  });

  // הוספת סגנונות להסתרת חצי קלט מספריים
  useEffect(() => {
    const cleanup = addNumericInputStyles();
    return cleanup;
  }, []);

  useEffect(() => {
    // Load best percentage from Chrome storage
    chrome.storage.sync.get('fillInBlankStats', (result) => {
      if (result.fillInBlankStats) {
        setBestPercentage(result.fillInBlankStats.bestPercentage || null);
        setBestStreak(result.fillInBlankStats.bestStreak || 0);
      }
    });

    if (gameStarted) {
      initializeGame();
    }
  }, [gameStarted, words]);

  const initializeGame = () => {
    const shuffledWords = [...words]
      .sort(() => Math.random() - 0.5)
      .slice(0, wordCount)
      .map(word => ({
        word: word.word,
        answer: word.translation,
        context: cleanContext(word.context),
        points: 10
      }));

    setQuestions(shuffledWords);
    setCurrentQuestionIndex(0);
    setAnswer('');
    setScore(0);
    setStreak(0);
    setShowHint(false);
    setShowAnswer(false);
    setComboMultiplier(1);
    setCorrectAnswers(0);
    
    // איפוס והפעלת הטיימר
    timer.resetTimer();
    timer.startTimer();
    
    // Start tracking game time
    gameStartTime.current = Date.now();
  };

  const checkAnswer = () => {
    if (!questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    
    // בדיקת דמיון בין התשובה של המשתמש לתשובה הנכונה
    const isCorrect = checkTextSimilarity(
      answer.trim(),
      currentQuestion.answer.trim()
    );

    if (isCorrect) {
      const timeBonus = Math.floor(timer.time / 3);
      const points = (currentQuestion.points + timeBonus) * comboMultiplier;
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setCorrectAnswers(prev => prev + 1);
      setComboMultiplier(Math.min(3, 1 + Math.floor(streak / 3)));
      if (streak === 4) {
        triggerConfetti();
      }

      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = {
        ...currentQuestion,
        userAnswer: answer,
        isCorrect
      };

      setQuestions(updatedQuestions);

      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          nextQuestion();
        } else {
          const gameTime = Math.floor((Date.now() - (gameStartTime.current || 0)) / 1000);
          setTotalTime(gameTime);
          const percentageCorrect = Math.round((correctAnswers + 1) / questions.length * 100);
          saveScore(percentageCorrect);
        }
      }, 1500);
    } else {
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = {
        ...currentQuestion,
        userAnswer: answer,
        isCorrect: false
      };
      
      setQuestions(updatedQuestions);
      setStreak(0);
      setComboMultiplier(1);
      
      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          nextQuestion();
        } else {
          const gameTime = Math.floor((Date.now() - (gameStartTime.current || 0)) / 1000);
          setTotalTime(gameTime);
          const percentageCorrect = Math.round(correctAnswers / questions.length * 100);
          saveScore(percentageCorrect);
        }
      }, 1500);
    }

    setAnswer('');
    timer.resetTimer();
    setShowHint(false);
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    setAnswer('');
    setShowHint(false);
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const isGameComplete = currentQuestionIndex === questions.length - 1 && 
    questions[currentQuestionIndex]?.userAnswer !== undefined;

  const saveScore = (percentageCorrect: number) => {
    chrome.storage.sync.get('fillInBlankStats', (result) => {
      const currentStats = result.fillInBlankStats || {
        bestStreak: 0,
        totalGames: 0,
        bestPercentage: 0,
        lastPlayed: new Date().toISOString()
      };

      const newStats = {
        bestStreak: Math.max(currentStats.bestStreak, streak),
        totalGames: currentStats.totalGames + 1,
        bestPercentage: Math.max(currentStats.bestPercentage || 0, percentageCorrect),
        lastPlayed: new Date().toISOString()
      };

      chrome.storage.sync.set({ fillInBlankStats: newStats }, () => {
        setBestPercentage(newStats.bestPercentage);
      });
    });
  };

  // Calculate progress
  const progressValue = ((currentQuestionIndex) / questions.length) * 100;

  // Word count options
  const wordCountOptions = [5, 10, 15, 20];

  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative h-full flex flex-col p-6 max-w-4xl mx-auto">
        {gameStarted && (
          <header className="flex items-center justify-between mb-8 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-3 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="bg-white/10 backdrop-blur-sm border border-white/20"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
                <Star className="text-amber-400" size={20} />
                <span className="font-bold text-lg vibrant-text">{score}</span>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
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
                value={progressValue} 
                className="flex-1 h-3 bg-white/10 backdrop-blur-sm border border-white/20" 
              />
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-sm">
                <Timer size={16} />
                {timer.time}s
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
                  className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-2xl shadow-xl max-w-md w-full"
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
                      Fill in the Blank
                    </h2>
                    <div className="w-10"></div> {/* Spacer for alignment */}
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl text-center w-full mb-6">
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
                    className="w-full py-6 bg-white/10 backdrop-blur-sm border border-white/20 font-bold"
                  >
                    Start Game
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <Card className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 p-8">
                {questions[currentQuestionIndex] && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-2xl font-bold mb-4 flex items-center gap-3 gradient-text">
                        {questions[currentQuestionIndex].word}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playAudio(questions[currentQuestionIndex].word)}
                          className="bg-white/10 backdrop-blur-sm border border-white/20 w-10 h-10 rounded-full p-0 flex items-center justify-center"
                        >
                          <Volume2 size={18} className="text-white" />
                        </Button>
                      </h3>
                      {questions[currentQuestionIndex].context && (
                        <p className="text-white/80 text-lg italic">
                          "{questions[currentQuestionIndex].context}"
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <Input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                          placeholder="Type the translation..."
                          disabled={questions[currentQuestionIndex].userAnswer !== undefined}
                          className="w-full p-4 text-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/50"
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
                          <p className="font-medium flex items-center gap-2">
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
                          <p className="text-sm opacity-90 ml-7">
                            Correct answer: {questions[currentQuestionIndex].answer}
                          </p>
                        </motion.div>
                      )}

                      {!questions[currentQuestionIndex].userAnswer && (
                        <div className="flex gap-3">
                          <Button
                            onClick={checkAnswer}
                            disabled={!answer.trim()}
                            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20"
                          >
                            Check Answer
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowHint(true)}
                            disabled={showHint}
                            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20"
                          >
                            Show Hint
                          </Button>
                        </div>
                      )}

                      {showHint && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-white/70 text-center bg-white/10 backdrop-blur-sm border border-white/20 p-3 rounded-lg"
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
                className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-2xl shadow-xl max-w-md w-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="text-3xl font-bold text-center game-header-text mb-6">
                  Challenge Complete!
                </h3>
                <div className="grid grid-cols-2 gap-6 text-center mb-6">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{score}</p>
                    <p className="text-sm text-white/80">Score</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{formatTime(totalTime)}</p>
                    <p className="text-sm text-white/80">Time</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">{streak}</p>
                    <p className="text-sm text-white/80">Best Streak</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl">
                    <p className="text-3xl font-bold gradient-text floating">
                      {Math.round((correctAnswers / questions.length) * 100)}%
                    </p>
                    <p className="text-sm text-white/80">Accuracy</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={initializeGame}
                    className="w-1/2 bg-white/10 backdrop-blur-sm border border-white/20 font-medium"
                  >
                    Play Again
                  </Button>
                  <Button
                    onClick={onBack}
                    className="w-1/2 bg-white/10 backdrop-blur-sm border border-white/20 font-medium"
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

// פונקציית עזר זמנית לבדיקת דמיון טקסט
function checkTextSimilarity(text1: string, text2: string): boolean {
  if (!text1 || !text2) return false;
  const normalized1 = normalizeText(text1.toLowerCase().trim());
  const normalized2 = normalizeText(text2.toLowerCase().trim());
  return normalized1 === normalized2 || normalized1.includes(normalized2) || normalized2.includes(normalized1);
} 
