import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Timer, Star, Zap, Volume2, Trophy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface CombinedTestProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

// Question types for the different game modes
enum QuestionType {
  FLASH_CARD = 'flash-card',
  MULTIPLE_CHOICE = 'multiple-choice',
  FILL_IN_BLANK = 'fill-in-blank',
  WORD_SCRAMBLE = 'word-scramble'
}

interface BaseQuestion {
  type: QuestionType;
  word: string;
  translation: string;
  context?: string;
  userAnswer?: string;
  isCorrect?: boolean;
  points: number;
}

interface FlashCardQuestion extends BaseQuestion {
  type: QuestionType.FLASH_CARD;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: QuestionType.MULTIPLE_CHOICE;
  options: string[];
  correctIndex: number;
}

interface FillInBlankQuestion extends BaseQuestion {
  type: QuestionType.FILL_IN_BLANK;
  answer: string;
}

interface WordScrambleQuestion extends BaseQuestion {
  type: QuestionType.WORD_SCRAMBLE;
  scrambledWord: string;
  answer: string;
}

type Question = FlashCardQuestion | MultipleChoiceQuestion | FillInBlankQuestion | WordScrambleQuestion;

interface GameStats {
  bestPercentage: number;
  totalGames: number;
  lastPlayed: string;
}

export function CombinedTest({ words, onBack }: CombinedTestProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [progress, setProgress] = useState<number>(0);
  const [wordCount, setWordCount] = useState<number>(Math.min(20, words.length));
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [gameComplete, setGameComplete] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<'correct' | 'incorrect' | null>(null);
  const [gameStats, setGameStats] = useState<GameStats>({
    bestPercentage: 0,
    totalGames: 0,
    lastPlayed: new Date().toISOString()
  });

  // Add global styles for card flipping
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .perspective-1000 {
        perspective: 1000px;
      }
      
      .card-3d-wrapper {
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.6s;
      }
      
      .card-3d-wrapper.is-flipped {
        transform: rotateY(180deg);
      }
      
      .front-card, .back-card {
        position: absolute;
        width: 100%;
        height: 100%;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
      
      .front-card {
        transform: rotateY(0deg);
      }
      
      .back-card {
        transform: rotateY(180deg);
      }
    `;
    document.head.appendChild(style);
    
    // Cleanup function to remove the style when component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  // Clean context to remove "From youtube" mentions
  const cleanContext = (context?: string): string | undefined => {
    if (!context) return undefined;
    
    // Remove any variation of "From youtube" text
    return context
      .replace(/["']?From youtube["']?/gi, '')
      .replace(/["']?From YouTube["']?/gi, '')
      .trim();
  };

  // Load high score on mount
  useEffect(() => {
    chrome.storage.sync.get('combinedTestStats', (result) => {
      if (result.combinedTestStats) {
        console.log('Loaded stats:', result.combinedTestStats);
        setGameStats(result.combinedTestStats);
      }
    });
  }, []);

  // Initialize game when gameStarted becomes true
  useEffect(() => {
    if (gameStarted) {
      initializeGame();
    }
  }, [gameStarted]);

  useEffect(() => {
    if (gameStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeUp();
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameStarted, timeLeft]);

  // Voice synthesis function
  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; 
    window.speechSynthesis.speak(utterance);
  };

  // Scramble a word for the word scramble questions
  const scrambleWord = (word: string): string => {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join('');
    return scrambled === word ? scrambleWord(word) : scrambled;
  };

  // Generate questions of all four types
  const initializeGame = () => {
    const shuffledWords = [...words].sort(() => Math.random() - 0.5).slice(0, wordCount);
    // Calculate how many questions of each type to create, ensuring at least 1 of each type when possible
    const baseQuestionsPerType = Math.floor(wordCount / 4);
    const remainingQuestions = wordCount % 4;
    
    // Distribute the questions evenly across types
    const questionCounts = [
      baseQuestionsPerType + (remainingQuestions > 0 ? 1 : 0),
      baseQuestionsPerType + (remainingQuestions > 1 ? 1 : 0),
      baseQuestionsPerType + (remainingQuestions > 2 ? 1 : 0),
      baseQuestionsPerType
    ];
    
    const allQuestions: Question[] = [];
    let wordIndex = 0;

    // 1. Create Flash Card questions
    for (let i = 0; i < questionCounts[0] && wordIndex < shuffledWords.length; i++) {
      const word = shuffledWords[wordIndex++];
      allQuestions.push({
        type: QuestionType.FLASH_CARD,
        word: word.word,
        translation: word.translation,
        context: cleanContext(word.context),
        points: 10
      });
    }

    // 2. Create Multiple Choice questions
    for (let i = 0; i < questionCounts[1] && wordIndex < shuffledWords.length; i++) {
      const word = shuffledWords[wordIndex++];
      // Get 3 random incorrect options
      const incorrectOptions = words
        .filter(w => w.translation !== word.translation)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.translation);
      
      // Add all options with correct answer
      const allOptions = [...incorrectOptions, word.translation];
      
      // Randomize the order of options
      const shuffledOptions = [...allOptions].sort(() => Math.random() - 0.5);
      
      // Find the index of the correct answer in shuffled options
      const correctIndex = shuffledOptions.findIndex(option => option === word.translation);

      allQuestions.push({
        type: QuestionType.MULTIPLE_CHOICE,
        word: word.word,
        translation: word.translation,
        context: cleanContext(word.context),
        options: shuffledOptions,
        correctIndex: correctIndex,
        points: 10
      });
    }

    // 3. Create Fill in the Blank questions
    for (let i = 0; i < questionCounts[2] && wordIndex < shuffledWords.length; i++) {
      const word = shuffledWords[wordIndex++];
      allQuestions.push({
        type: QuestionType.FILL_IN_BLANK,
        word: word.word,
        translation: word.translation,
        answer: word.translation,
        context: cleanContext(word.context),
        points: 10
      });
    }

    // 4. Create Word Scramble questions
    for (let i = 0; i < questionCounts[3] && wordIndex < shuffledWords.length; i++) {
      const word = shuffledWords[wordIndex++];
      allQuestions.push({
        type: QuestionType.WORD_SCRAMBLE,
        word: word.translation, // Show translation as hint
        translation: word.translation,
        scrambledWord: scrambleWord(word.word),
        answer: word.word,
        context: cleanContext(word.context),
        points: 10
      });
    }

    console.log('Generated questions by type:', {
      flashCards: allQuestions.filter(q => q.type === QuestionType.FLASH_CARD).length,
      multipleChoice: allQuestions.filter(q => q.type === QuestionType.MULTIPLE_CHOICE).length,
      fillInBlank: allQuestions.filter(q => q.type === QuestionType.FILL_IN_BLANK).length,
      wordScramble: allQuestions.filter(q => q.type === QuestionType.WORD_SCRAMBLE).length,
      total: allQuestions.length
    });

    // Final shuffle to mix question types
    const finalQuestions = [...allQuestions].sort(() => Math.random() - 0.5);
    
    setQuestions(finalQuestions);
    setCurrentQuestionIndex(0);
    setCurrentAnswer('');
    setSelectedOption(null);
    setScore(0);
    setCorrectAnswers(0);
    setProgress(0);
    setTimeLeft(30); // Reset timer
    setIsFlipped(false);
    setShowHint(false);
    setLastResponse(null);
  };

  // Save high score when game ends
  const saveHighScore = () => {
    // Count correct answers from the questions array to ensure accuracy
    const correctCount = questions.filter(q => q.isCorrect).length;
    
    // Calculate percentage based on correct answers out of total questions
    const percentage = Math.round((correctCount / questions.length) * 100);
    
    const newStats: GameStats = {
      bestPercentage: Math.max(gameStats.bestPercentage || 0, percentage),
      totalGames: (gameStats.totalGames || 0) + 1,
      lastPlayed: new Date().toISOString()
    };

    console.log('Game completed with success rate:', percentage + '%', 'Correct answers:', correctCount, 'Total questions:', questions.length);

    chrome.storage.sync.set({ combinedTestStats: newStats }, () => {
      console.log('Saved new stats:', newStats);
      setGameStats(newStats);
    });
  };

  const handleTimeUp = () => {
    const currentQuestion = questions[currentQuestionIndex];

    // If it's a flash card, consider it viewed
    if (currentQuestion.type === QuestionType.FLASH_CARD && !isFlipped) {
      setIsFlipped(true);
      setTimeLeft(10);
      return;
    }

    // For other questions, mark as incorrect
    checkAnswer(true);
  };

  // Function to handle checking answers for all question types
  const checkAnswer = (isTimeUp: boolean = false) => {
    if (currentQuestion) {
      let isCorrect = false;
      
      switch (currentQuestion.type) {
        case QuestionType.FLASH_CARD:
          // Consider the last response for Flash Cards
          isCorrect = lastResponse === 'correct';
          break;
          
        case QuestionType.MULTIPLE_CHOICE:
          isCorrect = selectedOption === currentQuestion.correctIndex;
          break;
          
        case QuestionType.FILL_IN_BLANK:
          // Check if the answer is close enough using Levenshtein distance
          const userAnswer = currentAnswer.trim().toLowerCase();
          const correctAnswer = currentQuestion.answer.toLowerCase();
          
          if (userAnswer === correctAnswer) {
            isCorrect = true;
          } else {
            // Check for minor typos (allow small Levenshtein distance)
            const distance = levenshteinDistance(userAnswer, correctAnswer);
            isCorrect = distance <= Math.min(2, Math.floor(correctAnswer.length / 5));
          }
          break;
          
        case QuestionType.WORD_SCRAMBLE:
          isCorrect = currentAnswer.trim().toLowerCase() === currentQuestion.answer.toLowerCase();
          break;
      }
      
      // Update the question with user's response
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = {
        ...currentQuestion,
        userAnswer: currentQuestion.type === QuestionType.FLASH_CARD 
          ? (lastResponse === 'correct' ? 'knew' : 'didn\'t know')
          : currentAnswer,
        isCorrect
      };
      
      setQuestions(updatedQuestions);
      
      // Update score & progress
      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
        setScore(prev => prev + currentQuestion.points);
      }
      
      // For Word Scramble, delay moving to next question to show feedback
      if (currentQuestion.type === QuestionType.WORD_SCRAMBLE && !isTimeUp) {
        // Don't proceed immediately - allow time to see the feedback
        setTimeout(() => {
          proceedToNextQuestion();
        }, 1500);
      } else {
        // For other question types, proceed immediately
        proceedToNextQuestion();
      }
    }
  };

  // Helper function to proceed to next question
  const proceedToNextQuestion = () => {
    // Reset for next question
    setCurrentAnswer('');
    setSelectedOption(null);
    setShowHint(false);
    setIsFlipped(false);
    setLastResponse(null);
    
    // Move to next question or end
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setProgress(((currentQuestionIndex + 1) / questions.length) * 100);
      
      // Reset timer for next question
      setTimeLeft(30);
    } else {
      // Game completed
      saveHighScore();
      setGameComplete(true);
    }
  };

  // Levenshtein distance calculation for typo tolerance
  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  };

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(1, parseInt(e.target.value) || 1), words.length);
    setWordCount(value);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF7E5F', '#FEB47B', '#FF3366', '#FFAF40']
    });
  };

  const getCurrentQuestion = (): Question | null => {
    if (questions.length === 0 || currentQuestionIndex >= questions.length) {
      return null;
    }
    return questions[currentQuestionIndex];
  };

  // Current success rate calculation
  const calculateSuccessRate = (): number => {
    if (currentQuestionIndex === 0) return 0;
    return Math.round((correctAnswers / currentQuestionIndex) * 100);
  };

  const currentQuestion = getCurrentQuestion();
  
  // Handle flipping the card
  const handleFlip = () => {
    setIsFlipped(prev => !prev);
  };

  // Handle the next button for flash cards
  const handleFlashCardNext = () => {
    if (isFlipped) {
      // If user has already selected "Knew It" or "Didn't Know"
      if (lastResponse !== null) {
        checkAnswer();
      }
    } else {
      setIsFlipped(true);
    }
  };

  const handleFlashCardResponse = (knew: boolean) => {
    if (!isFlipped) return;
    
    // Set the response (correct if the user knew it, incorrect if they didn't)
    setLastResponse(knew ? 'correct' : 'incorrect');
    
    // Update the question first to ensure it's marked correctly
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...questions[currentQuestionIndex],
      userAnswer: knew ? 'knew' : 'didn\'t know',
      isCorrect: knew // Explicitly mark as correct if they knew it
    };
    
    setQuestions(updatedQuestions);
    
    // Update score & correct answers count if the user knew it
    if (knew) {
      setCorrectAnswers(prev => prev + 1);
      setScore(prev => prev + questions[currentQuestionIndex].points);
    }
    
    // Small delay before moving to next question
    setTimeout(() => {
      proceedToNextQuestion();
    }, 800);
  };

  // Render game start screen
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
                  Language Test
                </h2>
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
              
              <div className="glass-card p-4 rounded-xl text-center w-full mb-6">
                <p className="text-3xl font-bold gradient-text floating">
                  {gameStats.bestPercentage || 0}%
                </p>
                <p className="text-sm opacity-80">Best Score</p>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-white/80 mb-2">Number of words to practice:</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center glass-card border-white/20 flex-1 p-1 rounded-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWordCount(Math.max(1, wordCount - 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={words.length}
                        value={wordCount}
                        onChange={handleWordCountChange}
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
                        onClick={() => setWordCount(Math.min(words.length, wordCount + 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20"
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-sm text-white whitespace-nowrap">of {words.length}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant={wordCount === words.length ? "default" : "outline"}
                      onClick={() => setWordCount(words.length)}
                      className={`${
                        wordCount === words.length 
                          ? "bg-white/20 text-white" 
                          : "bg-transparent text-white/80 border-white/20"
                      } hover:bg-white/20 transition-colors`}
                    >
                      All
                    </Button>
                    {[5, 10, 15].map(count => (
                      <Button
                        key={count}
                        variant={wordCount === count ? "default" : "outline"}
                        onClick={() => setWordCount(Math.min(count, words.length))}
                        disabled={count > words.length}
                        className={`${
                          wordCount === count 
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
                onClick={() => setGameStarted(true)}
                className="w-full py-6 glass-button gradient-border font-bold"
              >
                Start Test
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Render game complete screen
  if (gameComplete) {
    // Count correct answers directly from questions array
    const correctCount = questions.filter(q => q.isCorrect).length;
    const successRate = Math.round((correctCount / questions.length) * 100);
    const isNewBest = successRate > (gameStats.bestPercentage || 0);
    
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="glass-button"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Test Results</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>
          
          <div className="glass-card gradient-border p-6 md:p-8 rounded-xl shadow-xl mb-6">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <Trophy size={60} className="text-yellow-400" />
                {isNewBest && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    NEW!
                  </span>
                )}
              </div>
              
              <h2 className="text-4xl font-bold mb-2 gradient-text">
                {successRate}%
              </h2>
              <p className="text-white/80 text-lg">Success Rate</p>
              
              <div className="flex items-center gap-2 mt-4">
                <CheckCircle2 size={20} className="text-green-400" />
                <span>
                  {correctCount} of {questions.length} correct
                </span>
              </div>
            </div>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold mb-4 text-center">Question Summary</h3>
                <div className="glass-card p-4 rounded-xl max-h-60 overflow-y-auto">
                  {questions.map((q, idx) => (
                    <div key={idx} className={`flex items-center gap-2 p-2 ${idx % 2 === 0 ? 'bg-white/5' : ''} rounded`}>
                      <span className={q.isCorrect ? 'text-green-400' : 'text-red-400'}>
                        {q.isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {q.type === QuestionType.FLASH_CARD && 'Flash Card: '}
                          {q.type === QuestionType.MULTIPLE_CHOICE && 'Multiple Choice: '}
                          {q.type === QuestionType.FILL_IN_BLANK && 'Fill in Blank: '}
                          {q.type === QuestionType.WORD_SCRAMBLE && 'Word Scramble: '}
                          {q.word}
                        </div>
                        <div className="text-xs text-white/60">
                          <span className="font-medium">Correct:</span> {q.translation}
                          {q.userAnswer && q.userAnswer !== q.translation && (
                            <span className="ml-2 font-medium">Your answer:</span>
                          )} 
                          {q.userAnswer && q.userAnswer !== q.translation && q.userAnswer}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={onBack}
                  className="glass-button flex-1 py-6"
                >
                  Back to Games
                </Button>
                <Button 
                  onClick={() => {
                    setGameComplete(false);
                    setGameStarted(false);
                  }}
                  className="gradient-button flex-1 py-6"
                >
                  Play Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game is in progress
  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="glass-button"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Language Test</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>
        
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-32 md:w-48" />
            <span className="text-sm font-medium">
              {currentQuestionIndex + 1}/{questions.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center glass-card px-3 py-1 rounded-lg">
              <Star size={18} className="text-yellow-400 mr-1" />
              <span>{score}</span>
            </div>
            
            <div className="flex items-center justify-center glass-card px-3 py-1 rounded-lg">
              <Timer size={18} className="text-blue-400 mr-1" />
              <span>{timeLeft}s</span>
            </div>
          </div>
        </div>
        
        {currentQuestion && (
          <div className="flex-grow mb-6">
            <Card className="glass-card p-6 rounded-xl relative overflow-hidden">
              {/* Display question type */}
              <div className="absolute right-3 top-3 text-xs font-medium px-2 py-1 bg-indigo-600/70 rounded-full">
                {currentQuestion.type === QuestionType.FLASH_CARD && 'Flash Card'}
                {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && 'Multiple Choice'}
                {currentQuestion.type === QuestionType.FILL_IN_BLANK && 'Fill in Blank'}
                {currentQuestion.type === QuestionType.WORD_SCRAMBLE && 'Word Scramble'}
              </div>
              
              {/* Flash Card Question */}
              {currentQuestion.type === QuestionType.FLASH_CARD && (
                <div className="relative flex flex-col items-center justify-center">
                  <div className="w-full perspective-1000">
                    <div 
                      className={`w-full relative card-3d-wrapper ${isFlipped ? 'is-flipped' : ''}`}
                      style={{ 
                        transformStyle: "preserve-3d", 
                        transition: "transform 0.6s",
                        transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
                      }}
                    >
                      {/* Front card - original word */}
                      <Card 
                        className="w-full max-w-lg aspect-[4/3] glass-card border-0 p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer rounded-xl relative hover:shadow-xl transition-all duration-300 gradient-border animated-bg overflow-hidden front-card"
                        onClick={handleFlip}
                        style={{ 
                          backfaceVisibility: "hidden",
                          position: isFlipped ? "absolute" : "relative", 
                          top: 0, 
                          left: 0 
                        }}
                      >
                        <div className="absolute inset-0 opacity-20 animated-gradient-bg blur-sm"></div>
                        <div className="absolute inset-0 bg-black/10"></div>
                        <div className="text-center relative w-full flex flex-col items-center">
                          <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-wide break-words gradient-text">
                            {currentQuestion.word}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio(currentQuestion.word);
                            }}
                            className="glass-button w-10 h-10 rounded-full p-0 flex items-center justify-center mb-4"
                          >
                            <Volume2 size={20} />
                          </Button>
                          {currentQuestion.context && (
                            <p className="text-white text-sm mt-4 px-4 break-words max-h-20 overflow-y-auto">
                              {currentQuestion.context}
                            </p>
                          )}
                        </div>
                        <div className="absolute bottom-4 text-center w-full text-white/70">
                          Click to flip card
                        </div>
                      </Card>

                      {/* Back card - translation */}
                      <Card 
                        className={`w-full max-w-lg aspect-[4/3] glass-card border-0 p-4 sm:p-6 flex flex-col items-center justify-center rounded-xl relative hover:shadow-xl transition-all duration-300 ${
                          lastResponse === 'correct' ? 'gradient-border-success bg-emerald-500/20' :
                          lastResponse === 'incorrect' ? 'gradient-border-error bg-rose-500/20' :
                          'gradient-border'
                        } animated-bg overflow-hidden back-card`}
                        style={{ 
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                          position: !isFlipped ? "absolute" : "relative", 
                          top: 0, 
                          left: 0 
                        }}
                      >
                        <div className="absolute inset-0 opacity-20 animated-gradient-bg blur-sm"></div>
                        <div className="absolute inset-0 bg-black/10"></div>
                        <div className="text-center relative w-full flex flex-col items-center">
                          <h3 className={`text-3xl md:text-4xl font-bold mb-4 tracking-wide break-words ${
                            lastResponse === 'correct' ? 'text-emerald-400' :
                            lastResponse === 'incorrect' ? 'text-rose-400' :
                            'gradient-text'
                          }`}>
                            {currentQuestion.translation}
                          </h3>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio(currentQuestion.translation);
                            }}
                            className="glass-button w-10 h-10 rounded-full p-0 flex items-center justify-center mb-8"
                          >
                            <Volume2 size={20} />
                          </Button>
                          
                          {/* Response buttons inside the flipped card */}
                          <div className="flex gap-4 justify-center mt-4 mb-2">
                            <Button
                              onClick={() => handleFlashCardResponse(false)}
                              className={`px-6 py-3 rounded-xl font-medium ${
                                lastResponse === 'incorrect' 
                                  ? 'bg-rose-500/20 border-rose-400 text-rose-400 gradient-border-error' 
                                  : 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-300/30' 
                              }`}
                            >
                              Didn't Know
                            </Button>
                            <Button
                              onClick={() => handleFlashCardResponse(true)}
                              className={`px-6 py-3 rounded-xl font-medium ${
                                lastResponse === 'correct'
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 gradient-border-success'
                                  : 'choice-button-correct'
                              }`}
                            >
                              Knew It
                            </Button>
                          </div>
                          
                          {currentQuestion.context && (
                            <p className="text-white text-sm mt-4 px-4 break-words max-h-20 overflow-y-auto">
                              {currentQuestion.context}
                            </p>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Multiple Choice Question */}
              {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                <div className="flex-1 flex flex-col items-center overflow-hidden">
                  <Card className="w-full max-w-lg glass-card border-0 p-4 sm:p-6 mb-4 sm:mb-6 rounded-xl">
                    <div className="text-center">
                      <div className="flex justify-center mb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playAudio(currentQuestion.word)}
                          className="glass-button w-10 h-10 rounded-full p-0 flex items-center justify-center"
                        >
                          <Volume2 size={20} />
                        </Button>
                      </div>
                      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 gradient-text tracking-wide break-words">
                        {currentQuestion.word}
                      </h3>
                      {currentQuestion.context && (
                        <p className="text-white text-xs sm:text-sm mt-2 italic px-2 break-words max-h-20 overflow-y-auto">
                          "{currentQuestion.context}"
                        </p>
                      )}
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 gap-3 w-full max-w-lg overflow-y-auto pb-4">
                    {currentQuestion.options.map((option, index) => {
                      const isCorrectOption = index === currentQuestion.correctIndex;
                      const isSelected = selectedOption === index;
                      
                      return (
                        <Button
                          key={index}
                          onClick={() => setSelectedOption(index)}
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
                  
                  {selectedOption !== null && (
                    <Button
                      onClick={() => checkAnswer()}
                      className="gradient-button w-full mt-4"
                    >
                      Next
                    </Button>
                  )}
                </div>
              )}
              
              {/* Fill in Blank Question */}
              {currentQuestion.type === QuestionType.FILL_IN_BLANK && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="space-y-8 w-full max-w-lg">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold mb-4 gradient-text flex items-center justify-center gap-2">
                        {currentQuestion.word}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playAudio(currentQuestion.word)}
                        className="h-10 w-10 rounded-full flex items-center justify-center p-0 bg-purple-900 mx-auto mb-2"
                      >
                        <Volume2 size={18} className="text-white" />
                      </Button>
                      {currentQuestion.context && (
                        <p className="text-white/80 text-base italic text-center mb-6 mt-2">
                          "{currentQuestion.context}"
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-center justify-center">
                      <Input
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && currentAnswer.trim() && !currentQuestion.userAnswer) {
                            // Check answer without moving to next question
                            const userAnswer = currentAnswer.trim().toLowerCase();
                            const correctAnswer = currentQuestion.answer.toLowerCase();
                            
                            let isCorrect = false;
                            if (userAnswer === correctAnswer) {
                              isCorrect = true;
                            } else {
                              // Check for minor typos
                              const distance = levenshteinDistance(userAnswer, correctAnswer);
                              isCorrect = distance <= Math.min(2, Math.floor(correctAnswer.length / 5));
                            }
                            
                            // Update the question with user's response
                            const updatedQuestions = [...questions];
                            updatedQuestions[currentQuestionIndex] = {
                              ...currentQuestion,
                              userAnswer: currentAnswer,
                              isCorrect
                            };
                            
                            setQuestions(updatedQuestions);
                            
                            // Update score if correct
                            if (isCorrect) {
                              setCorrectAnswers(prev => prev + 1);
                              setScore(prev => prev + currentQuestion.points);
                            }
                          }
                        }}
                        placeholder="Type the translation..."
                        disabled={currentQuestion.userAnswer !== undefined}
                        className="glass-input text-center text-xl py-6 mb-4 w-full max-w-md"
                        autoFocus
                      />
                    </div>
                    
                    {!currentQuestion.userAnswer ? (
                      <Button
                        onClick={() => {
                          if (currentAnswer.trim()) {
                            // Check answer without moving to next question
                            const userAnswer = currentAnswer.trim().toLowerCase();
                            const correctAnswer = currentQuestion.answer.toLowerCase();
                            
                            let isCorrect = false;
                            if (userAnswer === correctAnswer) {
                              isCorrect = true;
                            } else {
                              // Check for minor typos
                              const distance = levenshteinDistance(userAnswer, correctAnswer);
                              isCorrect = distance <= Math.min(2, Math.floor(correctAnswer.length / 5));
                            }
                            
                            // Update the question with user's response
                            const updatedQuestions = [...questions];
                            updatedQuestions[currentQuestionIndex] = {
                              ...currentQuestion,
                              userAnswer: currentAnswer,
                              isCorrect
                            };
                            
                            setQuestions(updatedQuestions);
                            
                            // Update score if correct
                            if (isCorrect) {
                              setCorrectAnswers(prev => prev + 1);
                              setScore(prev => prev + currentQuestion.points);
                            }
                          }
                        }}
                        className="gradient-button w-full"
                        disabled={!currentAnswer.trim()}
                      >
                        Check Answer
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-lg ${
                            currentQuestion.isCorrect
                              ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 gradient-border-success'
                              : 'bg-red-500/30 border border-red-400 text-red-200 gradient-border-error'
                          }`}
                        >
                          <p className="font-medium flex items-center gap-2">
                            {currentQuestion.isCorrect ? (
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
                          {!currentQuestion.isCorrect && (
                            <p className="text-sm opacity-90 ml-7">
                              Correct answer: {currentQuestion.answer}
                            </p>
                          )}
                        </motion.div>
                        
                        <Button 
                          onClick={() => checkAnswer()}
                          className="gradient-button w-full"
                        >
                          Next Question
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Word Scramble Question */}
              {currentQuestion.type === QuestionType.WORD_SCRAMBLE && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="space-y-8 w-full max-w-lg">
                    <div>
                      <h3 className="text-2xl font-bold mb-4 flex items-center justify-center gap-3">
                        <span className="gradient-text text-4xl tracking-wide">
                          {currentQuestion.scrambledWord}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playAudio(currentQuestion.answer)}
                          className="h-10 w-10 rounded-full flex items-center justify-center p-0 bg-purple-900"
                        >
                          <Volume2 size={18} className="text-white" />
                        </Button>
                      </h3>
                      {currentQuestion.context && (
                        <p className="text-white/80 text-lg italic text-center">
                          "{currentQuestion.context}"
                        </p>
                      )}
                      <p className="text-center font-medium text-xl mb-2">Translation:</p>
                      <p className="text-white text-xl text-center font-bold mb-4">
                        {currentQuestion.word}
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
                          disabled={currentQuestion.userAnswer !== undefined}
                          className="w-full p-4 text-lg glass-card border-white/20 text-white placeholder-white/50 text-center"
                        />
                      </div>
                      
                      {currentQuestion.userAnswer && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-lg ${
                            currentQuestion.isCorrect
                              ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-200 gradient-border-success'
                              : 'bg-red-500/30 border border-red-400 text-red-200 gradient-border-error'
                          }`}
                        >
                          <p className="font-medium text-center flex items-center justify-center gap-2">
                            {currentQuestion.isCorrect ? (
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
                          {!currentQuestion.isCorrect && (
                            <p className="text-sm opacity-90 text-center mt-2">
                              Correct answer: <span className="font-bold text-white">{currentQuestion.answer}</span>
                            </p>
                          )}
                        </motion.div>
                      )}
                      
                      {!currentQuestion.userAnswer && (
                        <div className="flex gap-3">
                          <Button
                            onClick={() => checkAnswer()}
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
                          First letter: <span className="text-amber-300 font-bold">{currentQuestion.answer[0]}</span>
                          <br />
                          Length: <span className="text-amber-300 font-bold">{currentQuestion.answer.length}</span> characters
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 