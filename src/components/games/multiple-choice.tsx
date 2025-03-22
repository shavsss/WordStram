import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Star, Trophy, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';

interface MultipleChoiceProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

interface GameStats {
  bestScore: number; // Percentage score
  totalGames: number;
  lastPlayed: string;
}

interface GameQuestion {
  word: string;
  translation: string;
  context?: string;
  options: string[];
  correctIndex: number;
}

export function MultipleChoice({ words, onBack }: MultipleChoiceProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [questionCount, setQuestionCount] = useState(words.length);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [highScore, setHighScore] = useState<GameStats>({
    bestScore: 0,
    totalGames: 0,
    lastPlayed: new Date().toISOString()
  });

  // Global style to hide number input spinners
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Hide number input spinners - WebKit browsers */
      input[type=number]::-webkit-inner-spin-button, 
      input[type=number]::-webkit-outer-spin-button { 
        -webkit-appearance: none;
        margin: 0; 
      }
      /* Firefox */
      input[type=number] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Process context to remove "From youtube" mentions
  const cleanContext = (context?: string): string | undefined => {
    if (!context) return undefined;
    
    // Remove any variation of "From youtube" text
    return context
      .replace(/["']?From youtube["']?/gi, '')
      .replace(/["']?From YouTube["']?/gi, '')
      .trim();
  };

  // Voice synthesis function
  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // You can adjust based on language
    window.speechSynthesis.speak(utterance);
  };

  // Load high score on mount
  useEffect(() => {
    chrome.storage.sync.get('multipleChoiceStats', (result) => {
      if (result.multipleChoiceStats) {
        console.log('Loaded stats:', result.multipleChoiceStats);
        setHighScore(result.multipleChoiceStats);
      }
    });
  }, []);

  // Save high score when game ends
  const saveHighScore = (finalScore: number, totalQuestions: number) => {
    const percentage = Math.round((finalScore / totalQuestions) * 100);
    console.log('Saving new score:', percentage, 'Current best:', highScore.bestScore);
    
    const newStats: GameStats = {
      bestScore: Math.max(highScore.bestScore || 0, percentage),
      totalGames: (highScore.totalGames || 0) + 1,
      lastPlayed: new Date().toISOString()
    };

    chrome.storage.sync.set({ multipleChoiceStats: newStats }, () => {
      console.log('Saved new stats:', newStats);
      setHighScore(newStats);
    });
  };

  const handleQuestionCountChange = (count: number) => {
    setQuestionCount(Math.min(count, words.length));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setQuestionCount(Math.min(Math.max(1, value), words.length));
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FF7E5F', '#FEB47B', '#FF3366', '#FFAF40']
    });
  };

  const generateQuestions = () => {
    const count = questionCount;
    const shuffledWords = [...words].sort(() => Math.random() - 0.5).slice(0, count);
    
    const generatedQuestions = shuffledWords.map(word => {
      // Get 3 random incorrect options
      const incorrectOptions = words
        .filter(w => w.translation !== word.translation)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.translation);
      
      // Create all 4 options with correct answer included
      const allOptions = [...incorrectOptions, word.translation];
      
      // Shuffle options
      const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
      
      // Find index of correct answer
      const correctIndex = shuffledOptions.indexOf(word.translation);
      
      return {
        word: word.word,
        translation: word.translation,
        context: cleanContext(word.context),
        options: shuffledOptions,
        correctIndex
      };
    });
    
    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setScore(0);
    setProgress(0);
    setSelectedOption(null);
    setConsecutiveCorrect(0);
    setGameComplete(false);
    setGameStarted(true);
  };

  const handleOptionSelect = (index: number) => {
    if (selectedOption !== null) return; // Already selected
    
    setSelectedOption(index);
    
    const isCorrect = index === questions[currentIndex].correctIndex;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setConsecutiveCorrect(prev => prev + 1);
      
      // Trigger confetti after 3 consecutive correct answers
      if (consecutiveCorrect >= 2) {
        triggerConfetti();
      }
    } else {
      setConsecutiveCorrect(0);
    }
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setProgress(((currentIndex + 1) / questions.length) * 100);
      } else {
        // Game complete
        saveHighScore(score + (isCorrect ? 1 : 0), questions.length);
        setGameComplete(true);
      }
    }, 1500);
  };

  const currentQuestion = questions[currentIndex];
  const successPercentage = questions.length > 0 
    ? Math.round((score / (currentIndex + (selectedOption !== null ? 1 : 0))) * 100) || 0
    : 0;

  if (!gameStarted) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
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
                  Multiple Choice
                </h2>
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
              
              <div className="glass-card p-4 rounded-xl text-center w-full mb-6">
                <p className="text-3xl font-bold gradient-text floating">
                  {highScore.bestScore || 0}%
                </p>
                <p className="text-sm text-white/80">Best Score</p>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-white/80 mb-2">Number of words to practice:</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center glass-card border-white/20 flex-1 p-1 rounded-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuestionCount(Math.max(1, questionCount - 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={words.length}
                        value={questionCount}
                        onChange={handleInputChange}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="text-white bg-transparent border-0 text-center focus:ring-0 focus:outline-none"
                        style={{ 
                          WebkitAppearance: 'none', 
                          MozAppearance: 'textfield',
                          appearance: 'textfield',
                          margin: 0 
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuestionCount(Math.min(words.length, questionCount + 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-sm text-white whitespace-nowrap">of {words.length}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant={questionCount === words.length ? "default" : "outline"}
                      onClick={() => handleQuestionCountChange(words.length)}
                      className={`${
                        questionCount === words.length 
                          ? "bg-white/20 text-white" 
                          : "bg-transparent text-white/80 border-white/20"
                      } hover:bg-white/20 transition-colors`}
                    >
                      All
                    </Button>
                    {[5, 10, 15].map(count => (
                      <Button
                        key={count}
                        variant={questionCount === count ? "default" : "outline"}
                        onClick={() => handleQuestionCountChange(count)}
                        disabled={count > words.length}
                        className={`${
                          questionCount === count 
                            ? "bg-white/20 text-white" 
                            : "bg-transparent text-white/80 border-white/20"
                        } hover:bg-white/20 transition-colors ${count > words.length ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={generateQuestions}
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

  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-3 px-4 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="glass-button"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
              <Trophy className="text-amber-400" size={20} />
              <span className="font-bold vibrant-text">{highScore.bestScore || 0}%</span>
            </div>
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
              <Star className="text-amber-400" size={20} />
              <span className="font-bold vibrant-text">{successPercentage}%</span>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-4 mb-4">
          <Progress 
            value={progress} 
            className="flex-1 h-3 glass-card" 
          />
          <div className="text-sm font-medium text-white">
            {currentIndex + 1} / {questions.length}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center overflow-hidden">
          <Card className="w-full max-w-lg glass-card border-0 p-4 sm:p-6 mb-4 sm:mb-6 rounded-xl">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => playAudio(currentQuestion?.word)}
                  className="glass-button w-10 h-10 rounded-full p-0 flex items-center justify-center"
                >
                  <Volume2 size={20} />
                </Button>
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 gradient-text tracking-wide break-words">
                {currentQuestion?.word}
              </h3>
              {currentQuestion?.context && (
                <p className="text-white text-xs sm:text-sm mt-2 italic px-2 break-words max-h-20 overflow-y-auto">
                  "{currentQuestion.context}"
                </p>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 w-full max-w-lg overflow-y-auto pb-4">
            {currentQuestion?.options.map((option, index) => {
              const isCorrectOption = index === currentQuestion.correctIndex;
              const isSelected = selectedOption === index;
              
              return (
                <Button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={selectedOption !== null}
                  className={`choice-button h-auto py-4 transition-all duration-300 break-words ${
                    selectedOption === null 
                      ? 'choice-button-neutral' 
                      : isCorrectOption
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 gradient-border-success'
                        : isSelected
                          ? 'bg-rose-500/20 border-rose-400 text-rose-400 gradient-border-error'
                          : 'opacity-60'
                  }`}
                >
                  <span className="px-2 break-words">{option}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {gameComplete && (
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass-card p-8 rounded-2xl shadow-xl max-w-md w-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="game-header-text mb-6">
                  Quiz Complete!
                </h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold gradient-text floating">
                      {Math.round((score / questions.length) * 100)}%
                    </p>
                    <p className="text-white/80 mt-1">Success Rate</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-emerald-400">
                        {score}/{questions.length}
                      </p>
                      <p className="text-white/80">Correct Answers</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-amber-400">
                        {highScore.bestScore || 0}%
                      </p>
                      <p className="text-white/80">Best Score</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => {
                        setGameStarted(false);
                      }}
                      className="glass-button gradient-border px-8 py-4 font-bold text-white"
                    >
                      New Game
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onBack}
                      className="glass-button px-8 py-4 text-white"
                    >
                      Exit
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 

