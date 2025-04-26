/**
 * Array utility functions for WordStream
 */

/**
 * Shuffles array in place using Fisher-Yates algorithm
 * @param array Array to shuffle
 * @returns Shuffled array (same reference)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Splits an array into chunks of the specified size
 * @param array Array to split
 * @param chunkSize Maximum size of each chunk
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [array];
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Randomly selects n items from an array without repetition
 * @param array Source array
 * @param n Number of items to select
 * @returns Array of randomly selected items
 */
export function randomSample<T>(array: T[], n: number): T[] {
  if (n >= array.length) return shuffleArray(array);
  
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, n);
} 