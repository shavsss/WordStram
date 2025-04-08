import confetti from 'canvas-confetti';
import { normalizeText, calculateSimilarity, levenshteinDistance } from './utils';

export { normalizeText, calculateSimilarity, levenshteinDistance };

/**
 * ניקוי טקסט הקשר - מסיר אזכורי "From YouTube" וכדומה
 */
export function cleanContext(context?: string): string | undefined {
  if (!context) return undefined;
  
  // Remove any variation of "From youtube" text
  return context
    .replace(/["']?From youtube["']?/gi, '')
    .replace(/["']?From YouTube["']?/gi, '')
    .trim();
}

/**
 * טריגר של אנימציית קונפטי לחגיגת הצלחה
 */
export function triggerConfetti() {
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#FF7E5F', '#FEB47B', '#FF3366', '#FFAF40']
  });
}

/**
 * הפעלת קריינות של הטקסט
 */
export function playAudio(text: string, lang: string = 'en-US') {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

/**
 * פורמט של זמן מספר שניות למבנה דקות:שניות
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * בדיקה אם תשובת משתמש דומה מספיק לתשובה הנכונה
 */
export function checkTextSimilarity(input: string, target: string): boolean {
  // בדיקת התאמה מדויקת
  if (normalizeText(input) === normalizeText(target)) return true;
  
  // בדיקת מרחק לבנשטיין (התאמה קרובה)
  const distance = levenshteinDistance(normalizeText(input), normalizeText(target));
  const maxAllowedDistance = Math.min(2, Math.ceil(target.length * 0.2));
  
  if (distance <= maxAllowedDistance) return true;
  
  // חישוב ציון דמיון (לטקסטים ארוכים יותר)
  const similarity = calculateSimilarity(normalizeText(input), normalizeText(target));
  if (similarity >= 0.85) return true;
  
  return false;
}

/**
 * הוספת CSS להסתרת החצים בשדות input מסוג מספר
 */
export function addNumericInputStyles() {
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
} 