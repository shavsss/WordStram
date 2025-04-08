import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge and normalize tailwind classes with clsx
 * Used for conditionally joining tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize text by removing diacritics and special characters across all languages
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Convert to lowercase
  const lowerCase = text.toLowerCase();
  
  // Remove diacritics (accents, etc.)
  const withoutDiacritics = lowerCase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove special characters, keeping only alphanumeric characters
  return withoutDiacritics.replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Calculate the Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
 
/**
 * Calculate similarity ratio between two strings
 * Returns a value between 0 and 1, where 1 is a perfect match
 */
export function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  
  if (maxLength === 0) return 1.0; // Both strings are empty
  
  return 1.0 - distance / maxLength;
}

/**
 * Shuffle an array using the Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
} 