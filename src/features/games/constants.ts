/**
 * Game Constants
 * 
 * קבועים משותפים למשחקים
 */

/**
 * Minimum number of words required for games
 */
export const MIN_WORDS_FOR_GAMES = 4;

/**
 * Default number of questions/cards for each game
 */
export const DEFAULT_QUESTION_COUNT = 10;

/**
 * Maximum number of questions allowed
 */
export const MAX_QUESTION_COUNT = 50;

/**
 * Timeout durations
 */
export const GAME_TIMEOUTS = {
  FEEDBACK: 1500, // ms to show correct/incorrect feedback
  CONFETTI: 3000, // ms to show confetti animation
  AUTO_CONTINUE: 2000, // ms before auto-continuing
};

/**
 * Points for different actions
 */
export const GAME_POINTS = {
  CORRECT_ANSWER: 10,
  QUICK_ANSWER_BONUS: 5, // Additional points for quick answers
  STREAK_BONUS: 2, // Multiplier for consecutive correct answers
};

/**
 * Game IDs
 */
export const GAME_IDS = {
  MEMORY: 'memory',
  FILL_IN_BLANK: 'fill-in-blank',
  MULTIPLE_CHOICE: 'multiple-choice',
  WORD_SCRAMBLE: 'word-scramble',
  FLASH_CARDS: 'flash-cards',
  COMBINED_TEST: 'combined-test',
};

/**
 * Default settings for game timer
 */
export const DEFAULT_TIMER_SETTINGS = {
  MAX_TIME: 180, // seconds
  COUNTDOWN: false,
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  GAME_STATS: 'wordstream-game-stats',
  LAST_PLAYED: 'wordstream-last-played-game',
  GAME_SETTINGS: 'wordstream-game-settings',
}; 