import { translateText } from './google-translate';
import type { TranslationContext } from '@/types';

// Function to store word in local storage
function storeWordLocally(word: string, translation: string, context: TranslationContext): void {
  try {
    // Get existing saved words or initialize an empty array
    const savedWordsJSON = localStorage.getItem('savedWords') || '[]';
    const savedWords = JSON.parse(savedWordsJSON);
    
    // Add the new word
    savedWords.push({
      word,
      translation,
      context,
      timestamp: new Date().toISOString(),
    });
    
    // Save back to localStorage
    localStorage.setItem('savedWords', JSON.stringify(savedWords));
  } catch (error) {
    console.error('Error storing word locally:', error);
  }
}

export async function translateAndStore(
  word: string,
  context: TranslationContext
): Promise<void> {
  try {
    const translation = await translateText(word);
    // Store the word in local storage instead of Firestore
    storeWordLocally(word, translation, context);
  } catch (error) {
    console.error('Translation error:', error);
  }
} 