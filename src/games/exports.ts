// Game components
export { default as GameLauncher } from './index';
export { default as FillInBlank } from './fill-in-blank';
export { default as FlashCards } from './flash-cards';
export { MultipleChoice } from './multiple-choice';
export { MemoryMatch } from './memory-match';
export { default as WordScramble } from './word-scramble';

// Common types for games
export interface Word {
  id: string;
  word: string;
  translation: string;
  context?: string;
  timestamp: number;
  targetLanguage: string;
}

export enum GameType {
  NONE = 'none',
  FILL_IN_BLANK = 'fill-in-blank',
  FLASH_CARDS = 'flash-cards',
  MULTIPLE_CHOICE = 'multiple-choice',
  MEMORY_MATCH = 'memory-match',
  WORD_SCRAMBLE = 'word-scramble'
}

export interface GameStats {
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  bestStreak: number;
  totalQuestions: number;
  timeSpent: number;
  date: string;
}

export interface GameProps {
  words: Word[];
  onBack: () => void;
} 