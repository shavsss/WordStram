import { useState, useEffect, useRef } from 'react';
import { formatTime } from '@/lib/game-utils';

interface UseGameTimerOptions {
  initialTime?: number;
  autoStart?: boolean;
  onTimeEnd?: () => void;
  countUp?: boolean;
}

export function useGameTimer({
  initialTime = 30,
  autoStart = false,
  onTimeEnd,
  countUp = false
}: UseGameTimerOptions = {}) {
  const [time, setTime] = useState<number>(initialTime);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start the timer
  const startTimer = () => {
    if (!isRunning) {
      setIsRunning(true);
      if (countUp && !startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
    }
  };

  // Pause the timer
  const pauseTimer = () => {
    setIsRunning(false);
  };

  // Reset the timer
  const resetTimer = () => {
    setTime(initialTime);
    setIsRunning(false);
    setIsComplete(false);
    startTimeRef.current = null;
  };

  // Set a specific time
  const setTimerValue = (value: number) => {
    setTime(value);
  };

  // Format the time for display (mm:ss)
  const formattedTime = formatTime(time);

  // Handle timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        if (countUp) {
          // Count up from 0
          const elapsedSeconds = startTimeRef.current
            ? Math.floor((Date.now() - startTimeRef.current) / 1000) 
            : 0;
          setTime(elapsedSeconds);
        } else {
          // Count down to 0
          setTime(prevTime => {
            if (prevTime <= 1) {
              clearInterval(intervalRef.current!);
              setIsRunning(false);
              setIsComplete(true);
              if (onTimeEnd) onTimeEnd();
              return 0;
            }
            return prevTime - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, onTimeEnd, countUp]);

  return {
    time,
    formattedTime,
    isRunning,
    isComplete,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerValue
  };
} 