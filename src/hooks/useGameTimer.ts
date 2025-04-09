import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook לניהול טיימר למשחקים
 * @param initialTime זמן התחלתי בשניות
 * @param onTimeEnd פונקציה שתופעל כשהזמן מסתיים
 * @param autoStart האם להתחיל את הטיימר אוטומטית
 */
export default function useGameTimer(
  initialTime: number = 60,
  onTimeEnd?: () => void,
  autoStart: boolean = false
) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(onTimeEnd);

  // עדכון הקולבק כשהוא משתנה
  useEffect(() => {
    callbackRef.current = onTimeEnd;
  }, [onTimeEnd]);

  // התחלת הטיימר
  const startTimer = useCallback(() => {
    setIsRunning(true);
    setIsFinished(false);
  }, []);

  // עצירת הטיימר
  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  // איפוס הטיימר
  const resetTimer = useCallback((newTime?: number) => {
    setTimeLeft(newTime !== undefined ? newTime : initialTime);
    setIsFinished(false);
    setIsRunning(false);
  }, [initialTime]);

  // הוספת זמן לטיימר
  const addTime = useCallback((seconds: number) => {
    setTimeLeft(prevTime => prevTime + seconds);
  }, []);

  // ניקוי הטיימר בעת סיום או החלפת קומפוננטה
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // לוגיקת הטיימר
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            setIsRunning(false);
            setIsFinished(true);
            
            // קריאה לפונקציית הקולבק
            if (callbackRef.current) {
              callbackRef.current();
            }
            
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // פורמוט הזמן ל-MM:SS
  const formattedTime = useCallback(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  // חישוב אחוז הזמן שנותר
  const percentageLeft = useCallback(() => {
    return (timeLeft / initialTime) * 100;
  }, [timeLeft, initialTime]);

  return {
    timeLeft,
    isRunning,
    isFinished,
    startTimer,
    pauseTimer,
    resetTimer,
    addTime,
    formattedTime,
    percentageLeft
  };
} 