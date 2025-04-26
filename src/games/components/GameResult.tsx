import React from 'react';

interface GameResultProps {
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTaken: number; // in seconds
  bestStreak?: number; // optional
  onPlayAgain: () => void;
  onExit: () => void;
}

/**
 * Shared component for displaying game results after completion
 */
const GameResult: React.FC<GameResultProps> = ({
  score,
  maxScore,
  correctAnswers,
  totalQuestions,
  timeTaken,
  bestStreak,
  onPlayAgain,
  onExit
}) => {
  // Calculate accuracy percentage
  const accuracyPercentage = Math.round((correctAnswers / totalQuestions) * 100);
  
  // Format time taken in MM:SS format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="game-result-container">
      <h2 className="game-result-title">Game Completed!</h2>
      
      <div className="game-result-stats">
        <div className="result-stat">
          <div className="stat-label">Final Score</div>
          <div className="stat-value">{score} / {maxScore}</div>
        </div>
        
        <div className="result-stat">
          <div className="stat-label">Time Taken</div>
          <div className="stat-value">{formatTime(timeTaken)}</div>
        </div>
        
        {bestStreak !== undefined && (
          <div className="result-stat">
            <div className="stat-label">Best Streak</div>
            <div className="stat-value">{bestStreak}</div>
          </div>
        )}
        
        <div className="result-stat">
          <div className="stat-label">Accuracy</div>
          <div className="stat-value">{accuracyPercentage}%</div>
        </div>
      </div>
      
      <div className="game-result-actions">
        <button 
          className="play-again-button"
          onClick={onPlayAgain}
          aria-label="Play Again"
        >
          Play Again
        </button>
        <button 
          className="exit-button"
          onClick={onExit}
          aria-label="Exit"
        >
          Exit
        </button>
      </div>
    </div>
  );
};

export default GameResult; 