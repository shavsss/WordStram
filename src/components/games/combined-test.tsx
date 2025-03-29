import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, Star, Volume2, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

import { shuffleArray, normalizeText } from '@/lib/utils';
import { 
  cleanContext, 
  playAudio, 
  triggerConfetti, 
  formatTime, 
  checkTextSimilarity 
} from '@/lib/game-utils';

// Props interface
interface CombinedTestProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

// Question types for the different game styles
enum QuestionType {
  FLASH_CARD = 'flash_card',
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_BLANK = 'fill_in_blank',
  WORD_SCRAMBLE = 'word_scramble'
}

interface Question {
  type: QuestionType;
  word: string;
  translation: string;
  context?: string;
  options?: string[];
  correctIndex?: number;
  scrambledWord?: string;
  isAnswered: boolean;
  isCorrect: boolean;
  userAnswer?: string;
}

// Tracking game completion and stats
interface GameResults {
  totalCorrect: number;
  totalQuestions: number;
  completed: boolean;
}

/**
 * CombinedTest component that randomly mixes different question types into one sequence
 */
export function CombinedTest({ words, onBack }: CombinedTestProps) {
  // Game state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [gameComplete, setGameComplete] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState<number>(0);
  const [lastResponse, setLastResponse] = useState<'correct' | 'incorrect' | null>(null);
  
  // Input and interaction states
  const [userInput, setUserInput] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  
  // Initialize timer when game starts
  useEffect(() => {
    if (gameStarted && !gameComplete) {
      const id = window.setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      setIntervalId(id);
      return () => clearInterval(id);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameStarted, gameComplete]);

  // Initialize questions when game starts
  useEffect(() => {
    if (gameStarted && questions.length === 0) {
      initializeQuestions(wordCount);
      setTimerRunning(true);
    }
  }, [gameStarted]);
  
  // Voice synthesis function
  const playAudioText = (text: string) => {
    playAudio(text);
  };

  // Function to initialize questions
  function initializeQuestions(selectedWordCount: number) {
    if (words.length === 0) return [];
    
    // Limit selected count to available words
    const count = Math.min(selectedWordCount, words.length);
    
    // Shuffle words and take the requested number
    const selectedWords = shuffleArray([...words]).slice(0, count);
    
    // Create a pool of all translations for multiple choice options
    const allTranslations = words.map(word => word.translation);
    
    // Generate one question of each type for each selected word
    const newQuestions: Question[] = [];
    
    selectedWords.forEach((wordObj: { word: string; translation: string; context?: string }) => {
      // Randomly assign a question type to this word
      const questionTypes = [
        QuestionType.FLASH_CARD,
        QuestionType.MULTIPLE_CHOICE,
        QuestionType.FILL_IN_BLANK,
        QuestionType.WORD_SCRAMBLE
      ];
      
      // Shuffle the question types to randomize
      const randomType = shuffleArray(questionTypes)[0];
      
      let questionObj: Question = {
        type: randomType,
        word: wordObj.word,
        translation: wordObj.translation,
        context: cleanContext(wordObj.context),
        isAnswered: false,
        isCorrect: false
      };
      
      // Add type-specific properties
      switch (randomType) {
        case QuestionType.MULTIPLE_CHOICE:
          const { options, correctIndex } = generateOptions(wordObj.translation, allTranslations);
          questionObj.options = options;
          questionObj.correctIndex = correctIndex;
          break;
          
        case QuestionType.WORD_SCRAMBLE:
          questionObj.scrambledWord = scrambleWord(wordObj.word);
          break;
      }
      
      newQuestions.push(questionObj);
    });
    
    // Shuffle the final set of questions
    return shuffleArray(newQuestions);
  }
  
  // Function to generate multiple choice options
  const generateOptions = (correctAnswer: string, allTranslations: string[]): { options: string[], correctIndex: number } => {
    // Filter out the correct answer from the pool of possible options
    const otherOptions = allTranslations.filter(translation => 
      translation && correctAnswer && 
      normalizeText(translation) !== normalizeText(correctAnswer)
    );
    
    // Shuffle and pick 3 random options (or less if not enough)
    const randomOptions = shuffleArray(otherOptions).slice(0, 3);
    
    // Add the correct answer and shuffle all options
    const allOptions = [...randomOptions, correctAnswer];
    const shuffledOptions = shuffleArray(allOptions);
    
    // Find the index of the correct answer in the shuffled options
    const correctIndex = shuffledOptions.findIndex(option => 
      option && correctAnswer && 
      normalizeText(option) === normalizeText(correctAnswer)
    );
    
    return { options: shuffledOptions, correctIndex };
  };
  
  // Calculate progress percentage
  const calculateProgress = () => {
    if (questions.length === 0) return 0;
    return ((currentQuestionIndex) / questions.length) * 100;
  };
  
  // Format time display - use the shared function
  const formattedTime = formatTime(timeElapsed);
  
  // Trigger confetti animation for correct answers
  const triggerConfettiAnimation = () => {
    triggerConfetti();
  };

  // Handle flash card response
  const handleFlashCardResponse = (knew: boolean) => {
    if (!isFlipped) {
      setIsFlipped(true);
      return;
    }

    // Mark question as answered
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      isAnswered: true,
      isCorrect: knew
    };
    
    // Update stats
    if (knew) {
      setScore(prev => prev + 1);
      setConsecutiveCorrect(prev => prev + 1);
      setLastResponse('correct');
      
      // Trigger confetti for streak
      if (consecutiveCorrect >= 2) {
        triggerConfettiAnimation();
      }
    } else {
      setLastResponse('incorrect');
      setConsecutiveCorrect(0);
    }
    
    setQuestions(updatedQuestions);
    
    // Move to next question after a short delay
    setTimeout(() => {
      moveToNextQuestion();
    }, 1000);
  };
  
  // Handle multiple choice selection
  const handleMultipleChoiceAnswer = (selectedIndex: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    
    setSelectedOption(selectedIndex);
    
    // Update the question
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      isAnswered: true,
      isCorrect,
      userAnswer: currentQuestion.options?.[selectedIndex] || ''
    };
    
    // Update stats
      if (isCorrect) {
      setScore(prev => prev + 1);
      setConsecutiveCorrect(prev => prev + 1);
      setLastResponse('correct');
      
      // Trigger confetti for streak
      if (consecutiveCorrect >= 2) {
        triggerConfettiAnimation();
      }
    } else {
      setConsecutiveCorrect(0);
      setLastResponse('incorrect');
    }
    
    setQuestions(updatedQuestions);
    
    // Move to next question after a short delay
        setTimeout(() => {
      moveToNextQuestion();
        }, 1500);
  };
  
  // Handle text input answers (fill-in-blank and word scramble)
  const handleTextAnswer = () => {
    if (!userInput.trim()) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    
    // For Fill in Blank, compare with translation
    if (currentQuestion.type === QuestionType.FILL_IN_BLANK) {
      const normalizedUserInput = userInput.trim();
      const normalizedTranslation = currentQuestion.translation;
      
      isCorrect = checkTextSimilarity(normalizedUserInput, normalizedTranslation);
    }
    // For Word Scramble, compare with the original word
    else if (currentQuestion.type === QuestionType.WORD_SCRAMBLE) {
      const normalizedUserInput = userInput.trim();
      const normalizedWord = currentQuestion.word;
      
      isCorrect = checkTextSimilarity(normalizedUserInput, normalizedWord);
    }
    
    // Update the question
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      isAnswered: true,
      isCorrect,
      userAnswer: userInput
    };
    
    // Update stats
    if (isCorrect) {
      setScore(prev => prev + 1);
      setConsecutiveCorrect(prev => prev + 1);
      setLastResponse('correct');
      
      // Trigger confetti for streak
      if (consecutiveCorrect >= 2) {
        triggerConfettiAnimation();
      }
    } else {
      setConsecutiveCorrect(0);
      setLastResponse('incorrect');
    }
    
    setQuestions(updatedQuestions);
    
    // Move to next question after showing feedback
    setTimeout(() => {
      moveToNextQuestion();
    }, 1500);
  };
  
  // Scramble a word for the word scramble questions
  const scrambleWord = (word: string): string => {
    const characters = word.split('');
    let scrambled = '';
    
    while (characters.length > 0) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      scrambled += characters[randomIndex];
      characters.splice(randomIndex, 1);
    }
    
    // If the scrambled word is the same as the original, scramble again
    return scrambled === word ? scrambleWord(word) : scrambled;
  };

  // Move to the next question or end the game
  const moveToNextQuestion = () => {
    // Reset input states
    setUserInput('');
    setSelectedOption(null);
    setIsFlipped(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // End the game
      setGameComplete(true);
      setTimerRunning(false);
    }
  };
  
  // Handle skipping current question
  const handleSkip = () => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      isAnswered: true,
      isCorrect: false
    };
    
    setQuestions(updatedQuestions);
    moveToNextQuestion();
  };
  
  // Handle word count input change
  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(1, parseInt(e.target.value) || 1), 20);
    setWordCount(value);
  };
  
  // Start game function
  function handleStartGame() {
    const newQuestions = initializeQuestions(wordCount);
    setQuestions(newQuestions);
    setGameStarted(true);
    setCurrentQuestionIndex(0);
    setTimeElapsed(0);
    setScore(0);
  }
  
  // Initial selection screen
  if (!gameStarted) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="bg-white/10 backdrop-blur-sm border border-white/20"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Combined Challenge</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>
          
          <Card className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8 relative overflow-hidden border border-white/20 shadow-lg">
            <div className="text-center mb-8">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500/80 to-indigo-600/80 shadow-xl">
                  <span className="text-4xl" role="img" aria-label="Combined Challenge">🏆</span>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent mb-2">Combined Challenge</h2>
              <p className="text-white/70 text-lg mb-8">
                How many words do you want to practice?
              </p>
            </div>
            
            <div className="grid grid-cols-5 gap-3 mb-6">
              {[1, 5, 10, 15, 20].map(num => (
                <Button
                  key={num}
                  variant={wordCount === num ? "default" : "outline"}
                  onClick={() => setWordCount(num)}
                  disabled={num > words.length}
                  className={`
                    h-14 text-lg font-semibold 
                    ${wordCount === num 
                      ? 'bg-gradient-to-br from-blue-500/80 to-indigo-600/80' 
                      : 'bg-white/10 backdrop-blur-sm border border-white/20'}
                  `}
                >
                  {num}
                </Button>
              ))}
            </div>
            
            <div className="text-center mb-4">
              <span className="text-sm text-white/70">
                {wordCount === 1 
                  ? 'Practice 1 word' 
                  : `Practice ${wordCount} words`
                }
              </span>
            </div>
            
            <Button
              onClick={handleStartGame}
              className="w-full py-6 text-lg font-medium bg-gradient-to-br from-blue-500/80 to-indigo-600/80 hover:from-blue-600/80 hover:to-indigo-700/80"
              disabled={words.length === 0}
            >
              Start Challenge
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // If game complete, show summary
  if (gameComplete) {
    const successRate = questions.length > 0 
      ? Math.round((score / questions.length) * 100) 
      : 0;
    
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="bg-white/10 backdrop-blur-sm border border-white/20"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Challenge Complete!</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>
          
          <div className="w-full max-w-lg mx-auto">
            <h2 className="text-5xl font-bold text-amber-300 text-center mb-12">
              Challenge Complete!
              </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center shadow-lg border border-white/20">
                <div className="text-4xl font-bold text-amber-300 mb-2">{score}</div>
                <div className="text-sm text-white/80">Total Score</div>
            </div>
            
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center shadow-lg border border-white/20">
                <div className="text-4xl font-bold text-amber-300 mb-2">
                  {questions.length}
                        </div>
                <div className="text-sm text-white/80">Questions</div>
                        </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center shadow-lg border border-white/20">
                <div className="text-4xl font-bold text-amber-300 mb-2">
                  {formattedTime}
                      </div>
                <div className="text-sm text-white/80">Time</div>
                    </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center shadow-lg border border-white/20">
                <div className="text-4xl font-bold text-amber-300 mb-2">{successRate}%</div>
                <div className="text-sm text-white/80">Accuracy</div>
                </div>
              </div>
              
            <div className="grid grid-cols-2 gap-6">
                <Button 
                  onClick={() => {
                    setGameComplete(false);
                    setGameStarted(false);
                  setQuestions([]);
                  setCurrentQuestionIndex(0);
                  setTimeElapsed(0);
                  setScore(0);
                  }}
                className="bg-gradient-to-br from-indigo-500/80 to-purple-600/80 hover:from-indigo-600/80 hover:to-purple-700/80 text-lg py-4 font-medium"
                >
                  Play Again
                </Button>
              
              <Button
                onClick={onBack}
                variant="outline"
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-lg py-4 font-medium"
              >
                Exit
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game in progress - render the current question
  if (questions.length > 0 && currentQuestionIndex < questions.length) {
    const currentQuestion = questions[currentQuestionIndex];
    
  return (
    <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
      
      <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
              className="bg-white/10 backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft size={24} />
          </Button>
            <div className="flex-1 mx-4">
              <Progress value={calculateProgress()} className="w-full" />
          </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
                <Star size={16} className="text-yellow-400 mr-1.5" />
              <span>{score}</span>
            </div>
              <span className="text-sm">
                {currentQuestionIndex + 1}/{questions.length}
              </span>
              <div className="ml-2 text-sm font-medium">
                {formattedTime}
            </div>
          </div>
          </header>
          
          {/* FLASH CARD QUESTION */}
              {currentQuestion.type === QuestionType.FLASH_CARD && (
            <Card className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8 relative overflow-hidden border border-white/20 shadow-lg">
              <div className="flex flex-col items-center">
                <div className="w-full max-w-lg mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-8 mb-6 shadow-lg border border-white/20">
                  <div className="text-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                      {isFlipped ? currentQuestion.translation : currentQuestion.word}
                          </h3>
                    
                          <Button
                            variant="ghost"
                            size="sm"
                      onClick={() => playAudioText(isFlipped ? currentQuestion.translation : currentQuestion.word)}
                      className="bg-white/10 backdrop-blur-sm w-10 h-10 rounded-full p-0 flex items-center justify-center mb-2 border border-white/20"
                          >
                            <Volume2 size={20} />
                          </Button>
                    
                          {currentQuestion.context && (
                      <p className="text-white/80 text-sm mt-4 text-center italic">
                        "{currentQuestion.context}"
                            </p>
                          )}
                        </div>
                        </div>
                
                {isFlipped ? (
                  <div className="w-full max-w-md">
                    <div className="grid grid-cols-2 gap-4">
                      <Button 
                        variant="outline" 
                        onClick={() => handleFlashCardResponse(false)}
                        className="flex items-center justify-center gap-2 h-12 border-white/20 bg-white/10 backdrop-blur-sm"
                      >
                        <X className="w-4 h-4 text-rose-500" />
                        <span>Didn't Know</span>
                      </Button>
                          <Button
                        onClick={() => handleFlashCardResponse(true)}
                        className="flex items-center justify-center gap-2 h-12 bg-gradient-to-br from-indigo-500/80 to-purple-600/80"
                      >
                        <Check className="w-4 h-4 text-green-300" />
                        <span>Knew It</span>
                          </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md">
                            <Button
                      variant="default" 
                      className="w-full py-6 text-lg font-medium bg-gradient-to-br from-indigo-500/80 to-purple-600/80 hover:from-indigo-600/80 hover:to-purple-700/80 shadow-lg"
                      onClick={() => setIsFlipped(true)}
                    >
                      Show Translation
                            </Button>
                    <div className="flex justify-center mt-4">
                            <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkip}
                        className="text-white/60 hover:text-white text-sm"
                      >
                        Skip
                            </Button>
                          </div>
                  </div>
                          )}
                        </div>
                      </Card>
              )}
              
          {/* MULTIPLE CHOICE QUESTION */}
              {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && (
            <Card className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8 relative overflow-hidden border border-white/20 shadow-lg">
              <div className="text-center mb-8">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {currentQuestion.word}
                </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => playAudioText(currentQuestion.word)}
                  className="bg-white/10 backdrop-blur-sm w-10 h-10 rounded-full p-0 flex items-center justify-center mb-2 border border-white/20"
                        >
                          <Volume2 size={20} />
                        </Button>
                
                      {currentQuestion.context && (
                  <p className="text-white/80 text-sm mt-2 italic">
                          "{currentQuestion.context}"
                        </p>
                      )}
                    </div>
              
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrectOption = idx === currentQuestion.correctIndex;
                  const showResult = currentQuestion.isAnswered;
                  
                  let buttonVariant: "default" | "outline" | "ghost" = "outline";
                  
                  if (showResult) {
                    if (isCorrectOption) {
                      buttonVariant = "default";
                    } else if (isSelected) {
                      buttonVariant = "ghost";
                    }
                  }
                      
                      return (
                        <Button
                      key={idx}
                      variant={buttonVariant}
                      onClick={() => !currentQuestion.isAnswered && handleMultipleChoiceAnswer(idx)}
                      disabled={currentQuestion.isAnswered}
                      className={`w-full p-4 text-left h-auto justify-start backdrop-blur-sm ${
                        showResult && isCorrectOption 
                          ? "bg-green-500/20 border-green-500/40 text-green-300" 
                          : showResult && isSelected && !isCorrectOption
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                          : "bg-white/10 border-white/20 hover:bg-white/20"
                      }`}
                    >
                      {option}
                      {showResult && isCorrectOption && (
                        <Check className="ml-auto w-5 h-5 text-green-500" />
                      )}
                      {showResult && isSelected && !isCorrectOption && (
                        <X className="ml-auto w-5 h-5 text-rose-500" />
                      )}
                        </Button>
                      );
                    })}
                  </div>
                  
              {!currentQuestion.isAnswered && (
                <div className="flex justify-center mt-4">
                    <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    Skip
                    </Button>
                </div>
              )}
            </Card>
              )}
              
          {/* FILL IN BLANK QUESTION */}
              {currentQuestion.type === QuestionType.FILL_IN_BLANK && (
            <Card className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8 relative overflow-hidden border border-white/20 shadow-lg">
              <div className="text-center mb-6">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                        {currentQuestion.word}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playAudioText(currentQuestion.word)}
                  className="bg-white/10 backdrop-blur-sm w-10 h-10 rounded-full p-0 flex items-center justify-center mb-2 border border-white/20"
                      >
                  <Volume2 size={20} />
                      </Button>
                
                      {currentQuestion.context && (
                  <p className="text-white/80 text-sm mt-2 italic">
                          "{currentQuestion.context}"
                        </p>
                      )}
                    </div>
                    
              <div className="flex flex-col">
                <div className="mb-4">
                      <Input
                        type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type the translation..."
                    disabled={currentQuestion.isAnswered}
                    className="w-full p-4 text-lg border-white/20 bg-white/10 backdrop-blur-sm focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && userInput.trim() && !currentQuestion.isAnswered) {
                        handleTextAnswer();
                      }
                    }}
                      />
                    </div>
                    
                {!currentQuestion.isAnswered ? (
                  <div className="flex flex-col gap-3">
                      <Button
                      onClick={handleTextAnswer}
                      disabled={!userInput.trim()}
                      className="w-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80 hover:from-indigo-600/80 hover:to-purple-700/80"
                      >
                        Check Answer
                      </Button>
                    <div className="flex justify-center">
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={handleSkip}
                        className="text-white/60 hover:text-white text-sm"
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl bg-white/10 backdrop-blur-sm border ${
                            currentQuestion.isCorrect
                      ? "border-green-500/40 text-green-300" 
                      : "border-rose-500/40 text-rose-300"
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {currentQuestion.isCorrect ? 'Correct!' : 'Incorrect'}
                      </p>
                            {currentQuestion.isCorrect ? (
                        <Check className="w-5 h-5 text-green-500" />
                            ) : (
                        <X className="w-5 h-5 text-rose-500" />
                            )}
                    </div>
                          {!currentQuestion.isCorrect && (
                      <p className="text-sm mt-1">
                        Correct answer: {currentQuestion.translation}
                            </p>
                          )}
                      </div>
                    )}
                  </div>
            </Card>
              )}
              
          {/* WORD SCRAMBLE QUESTION */}
              {currentQuestion.type === QuestionType.WORD_SCRAMBLE && (
            <Card className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8 relative overflow-hidden border border-white/20 shadow-lg">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-2xl md:text-3xl font-bold text-white">
                          {currentQuestion.scrambledWord}
                  </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                    onClick={() => playAudioText(currentQuestion.word)}
                    className="bg-white/10 backdrop-blur-sm w-10 h-10 rounded-full p-0 flex items-center justify-center border border-white/20"
                        >
                    <Volume2 size={20} />
                        </Button>
                </div>
                
                <p className="text-lg mb-4">What's the unscrambled word?</p>
                <p className="text-md text-white/80">Translation: <strong>{currentQuestion.translation}</strong></p>
                
                      {currentQuestion.context && (
                  <p className="text-white/80 text-sm mt-4 italic">
                          "{currentQuestion.context}"
                        </p>
                      )}
                    </div>

              <div className="flex flex-col">
                <div className="mb-4">
                        <Input
                          type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type the unscrambled word..."
                    disabled={currentQuestion.isAnswered}
                    className="w-full p-4 text-lg border-white/20 bg-white/10 backdrop-blur-sm focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && userInput.trim() && !currentQuestion.isAnswered) {
                        handleTextAnswer();
                      }
                    }}
                        />
                      </div>
                      
                {!currentQuestion.isAnswered ? (
                  <div className="flex flex-col gap-3">
                          <Button
                      onClick={handleTextAnswer}
                      disabled={!userInput.trim()}
                      className="w-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80 hover:from-indigo-600/80 hover:to-purple-700/80"
                          >
                            Check Answer
                          </Button>
                    <div className="flex justify-center">
                          <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkip}
                        className="text-white/60 hover:text-white text-sm"
                      >
                        Skip
                          </Button>
                        </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl bg-white/10 backdrop-blur-sm border ${
                    currentQuestion.isCorrect 
                      ? "border-green-500/40 text-green-300" 
                      : "border-rose-500/40 text-rose-300"
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {currentQuestion.isCorrect ? 'Correct!' : 'Incorrect'}
                      </p>
                      {currentQuestion.isCorrect ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <X className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    {!currentQuestion.isCorrect && (
                      <p className="text-sm mt-1">
                        Correct answer: {currentQuestion.word}
                      </p>
                    )}
                </div>
              )}
          </div>
            </Card>
        )}
      </div>
    </div>
  );
  }
  
  return <div>Loading...</div>;
} 