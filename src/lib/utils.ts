import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * מיזוג class names בעזרת clsx ו-tailwind-merge
 * שימושי עבור קומפוננטות UI דינמיות
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * פורמוט תאריך בסיסי
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * קיצור טקסט ארוך
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * המתנה למשך זמן מוגדר
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * בדיקה אם הפונקציה רצה בצד שרת או לקוח
 */
export const isClient = typeof window !== 'undefined';
export const isServer = !isClient; 