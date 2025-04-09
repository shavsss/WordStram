/**
 * Utility functions for word games
 */

import confetti from 'canvas-confetti';

/**
 * ערבוב מערך בצורה אקראית (אלגוריתם Fisher-Yates)
 * @param array המערך לערבוב
 * @returns המערך המעורבב
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * בחירה אקראית של איברים ממערך
 * @param array המערך המקורי
 * @param count מספר האיברים לבחירה
 * @returns מערך חדש עם האיברים שנבחרו אקראית
 */
export function pickRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * ערבוב מחרוזת
 * @param str המחרוזת לערבוב
 * @returns המחרוזת המעורבבת
 */
export function shuffleString(str: string): string {
  return shuffleArray(str.split('')).join('');
}

/**
 * יצירת משחק מילים מעורבבות
 * @param word המילה המקורית
 * @returns המילה המעורבבת וודא שהתוצאה לא זהה למקור
 */
export function createWordScramble(word: string): string {
  if (word.length <= 1) return word;
  
  let scrambled = shuffleString(word);
  // וודא שהמילה המעורבבת שונה מהמקורית
  while (scrambled === word) {
    scrambled = shuffleString(word);
  }
  
  return scrambled;
}

/**
 * יצירת משחק השלמת מילה בטקסט
 * @param text הטקסט המלא
 * @param wordCount מספר המילים להסתרה
 * @returns אובייקט עם הטקסט עם חורים ורשימת המילים החסרות
 */
export function createFillInBlankGame(text: string, wordCount: number = 5): {
  text: string;
  missingWords: string[];
  originalPositions: number[];
} {
  const words = text.split(/\s+/);
  if (words.length <= 1) {
    return {
      text,
      missingWords: [],
      originalPositions: []
    };
  }
  
  // בחירת מילים אקראיות באורך 3 או יותר
  const candidateWords = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => word.length >= 3 && /^[a-zA-Z\u0590-\u05FF]+$/.test(word));
  
  const selectedWords = shuffleArray(candidateWords).slice(0, Math.min(wordCount, candidateWords.length));
  
  // מיון לפי המיקום המקורי כדי לשמור על סדר
  selectedWords.sort((a, b) => a.index - b.index);
  
  const missingWords = selectedWords.map(item => item.word);
  const originalPositions = selectedWords.map(item => item.index);
  
  // החלפת המילים שנבחרו ב-___
  const result = [...words];
  selectedWords.forEach(({ index }) => {
    result[index] = '_____';
  });
  
  return {
    text: result.join(' '),
    missingWords,
    originalPositions
  };
}

/**
 * הפעלת אפקט קונפטי לחגיגת ניצחון
 */
export function celebrateSuccess() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 1000,
  };
  
  function fire(particleRatio: number, opts: any) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }
  
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  
  fire(0.2, {
    spread: 60,
  });
  
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}

/**
 * חישוב ניקוד למשחקים
 * @param baseScore ניקוד בסיסי
 * @param timeBonus בונוס על זמן שנותר
 * @param difficulty רמת קושי
 * @returns הניקוד הסופי
 */
export function calculateScore(baseScore: number, timeBonus: number, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
  const difficultyMultiplier = {
    easy: 1,
    medium: 1.5,
    hard: 2
  };
  
  return Math.round((baseScore + timeBonus) * difficultyMultiplier[difficulty]);
}

/**
 * השמעת צליל
 * @param url נתיב לקובץ הצליל
 * @param volume עוצמת הקול (0-1)
 */
export function playAudio(url: string, volume: number = 1.0): void {
  try {
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.play().catch(e => console.error('Failed to play audio:', e));
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

/**
 * פורמט זמן בשניות לפורמט של דקות:שניות
 * @param seconds מספר השניות
 * @returns מחרוזת מפורמטת בתבנית mm:ss
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * ניקוי וסינון טקסט הקשר למשחקים
 * @param context טקסט ההקשר המקורי
 * @returns טקסט מנוקה ומסונן
 */
export function cleanContext(context: string): string {
  // הסרת תווים מיוחדים שיכולים להפריע למשחק
  let cleaned = context
    .replace(/[^\w\s\u0590-\u05FF.,?!'-]/g, '') // שמירה על אותיות, מספרים, רווחים, תווים עבריים וסימני פיסוק נפוצים
    .replace(/\s+/g, ' ') // החלפת רצף רווחים ברווח בודד
    .trim();
  
  // הסרת שורות ריקות וצמצום רווחים מיותרים
  cleaned = cleaned
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
  
  return cleaned;
}

/**
 * נירמול טקסט (הסרת ניקוד, המרה לאותיות קטנות וכו')
 * @param text הטקסט המקורי
 * @returns הטקסט המנורמל
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // הסרת ניקוד עברי
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // הסרת סימני פיסוק
    .trim();
} 