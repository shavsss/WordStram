/**
 * Games Module Type Definitions
 */

/**
 * Word type for games
 */
export interface GameWord {
  word: string;
  translation: string;
  context?: string;
  id?: string;
}

/**
 * Base game props
 */
export interface GameProps {
  words: GameWord[];
  onBack: () => void;
  onComplete: (score: number) => void;
}

/**
 * Game statistics interfaces
 */
export interface GameStats {
  bestScore: number;
  totalGames: number;
  recentScores: number[];
}

/**
 * Collection of game statistics
 */
export interface AllGameStats {
  [gameId: string]: GameStats;
}

export interface MemoryGameProps extends GameProps {
  words: (GameWord & { id: string })[];
} 