import React from 'react';

interface GameProgressProps {
  progress: number;
  className?: string;
}

export function GameProgress({ progress, className = '' }: GameProgressProps) {
  // Ensure progress is between 0 and 100
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className={`w-full h-2 bg-slate-800/50 rounded-full overflow-hidden ${className}`}>
      <div 
        className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300 ease-out"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
}

export default GameProgress; 