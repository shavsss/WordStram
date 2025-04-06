/**
 * Words Service
 * 
 * Provides functions for managing vocabulary words in Firestore and local storage.
 * Includes functionality for saving, retrieving, and deleting words, with proper
 * error handling and offline support.
 */

import { doc, getDoc, setDoc, deleteDoc, collection, query, getDocs } from 'firebase/firestore';
import { firestore as db } from '../../config';
import { getCurrentUser } from '../../auth/auth-service';
import { checkFirestoreConnection } from '../../utils/connection-utils';
import { broadcastMessage } from '../../sync/broadcast';
import { queueOperation } from '../../sync/offline-queue';
import { Word } from '../../types';

/**
 * Save a word to Firestore
 * @param word Word to save
 * @returns Promise with the word ID
 */
export async function saveWord(word: Partial<Word>): Promise<string> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.uid;

    // Generate an ID if one doesn't exist
    const wordId = word.id || Date.now().toString();
    const wordData: Word = {
      id: wordId,
      originalWord: word.originalWord || '',
      targetWord: word.targetWord || '',
      sourceLanguage: word.sourceLanguage || 'en',
      targetLanguage: word.targetLanguage || 'en',
      userId: userId,
      timestamp: new Date().toISOString(),
      createdAt: word.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(word as any), // Include any additional properties from the input word
    };

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Save to Firestore
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await setDoc(wordRef, wordData);
      console.log(`WordStream: Word saved to Firestore: ${wordId}`);
    } else {
      // Queue the operation for later
      console.log(`WordStream: Offline - Queuing word save operation`);
      queueOperation('saveWord', wordData);
    }

    // Save to local storage
    saveWordToLocalStorage(wordData);

    // Broadcast to other windows/tabs
    broadcastMessage({ 
      action: 'WORD_ADDED', 
      word: wordData,
      timestamp: new Date().toISOString()
    });

    return wordId;
  } catch (error) {
    console.error('WordStream: Error saving word:', error);
    throw error;
  }
}

/**
 * Get all words for the current user
 * @returns Promise with array of words
 */
export async function getWords(): Promise<Word[]> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Get from Firestore
      const wordsCollection = collection(db, `users/${userId}/words`);
      const wordsQuery = query(wordsCollection);
      const wordsSnapshot = await getDocs(wordsQuery);
      
      const words = wordsSnapshot.docs.map(doc => doc.data() as Word);
      console.log(`WordStream: Retrieved ${words.length} words from Firestore`);
      
      // Update local storage with the latest data
      updateLocalWords(words);
      
      return words;
    } else {
      // Fall back to local storage
      console.log(`WordStream: Offline - Reading words from local storage`);
      return getWordsFromLocalStorage();
    }
  } catch (error) {
    console.error('WordStream: Error getting words:', error);
    // Fall back to local storage on error
    return getWordsFromLocalStorage();
  }
}

/**
 * Delete a word from Firestore and local storage
 * @param wordId ID of the word to delete
 * @returns Promise resolving to boolean indicating success
 */
export async function deleteWord(wordId: string): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Delete from Firestore
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await deleteDoc(wordRef);
      console.log(`WordStream: Word deleted from Firestore: ${wordId}`);
    } else {
      // Queue the delete operation for later
      console.log(`WordStream: Offline - Queuing word delete operation`);
      queueOperation('deleteWord', { id: wordId, userId });
    }

    // Delete from local storage
    deleteWordFromLocalStorage(wordId);

    // Broadcast to other windows/tabs
    broadcastMessage({ 
      action: 'WORD_DELETED', 
      wordId,
      timestamp: new Date().toISOString() 
    });

    return true;
  } catch (error) {
    console.error(`WordStream: Error deleting word ${wordId}:`, error);
    return false;
  }
}

// Local Storage Helpers

/**
 * Save a word to local storage
 * @param word Word to save
 */
function saveWordToLocalStorage(word: Word): void {
  try {
    // Get existing words
    const words = getWordsFromLocalStorage();
    
    // Find index of existing word or -1 if not found
    const existingIndex = words.findIndex(w => w.id === word.id);
    
    if (existingIndex >= 0) {
      // Update existing word
      words[existingIndex] = word;
    } else {
      // Add new word
      words.push(word);
    }
    
    // Save updated words list
    chrome.storage.sync.set({ words }, () => {
      console.log(`WordStream: Word saved to local storage: ${word.id}`);
    });
  } catch (error) {
    console.error('WordStream: Error saving word to local storage:', error);
  }
}

/**
 * Get all words from local storage
 * @returns Array of words
 */
function getWordsFromLocalStorage(): Word[] {
  try {
    // Use chrome.storage.sync.get synchronously with a callback
    let result: Word[] = [];
    
    // Since chrome.storage is async but we need to return synchronously,
    // we'll return the cached value and update it in the background
    chrome.storage.sync.get('words', (data) => {
      if (data.words && Array.isArray(data.words)) {
        result = data.words;
      }
    });
    
    return result;
  } catch (error) {
    console.error('WordStream: Error getting words from local storage:', error);
    return [];
  }
}

/**
 * Update local storage with latest words
 * @param words Array of words to save
 */
function updateLocalWords(words: Word[]): void {
  try {
    chrome.storage.sync.set({ words }, () => {
      console.log(`WordStream: Updated ${words.length} words in local storage`);
    });
  } catch (error) {
    console.error('WordStream: Error updating words in local storage:', error);
  }
}

/**
 * Delete a word from local storage
 * @param wordId ID of the word to delete
 */
function deleteWordFromLocalStorage(wordId: string): void {
  try {
    // Get existing words
    const words = getWordsFromLocalStorage();
    
    // Filter out the word to delete
    const updatedWords = words.filter(word => word.id !== wordId);
    
    // Save updated words list
    chrome.storage.sync.set({ words: updatedWords }, () => {
      console.log(`WordStream: Word deleted from local storage: ${wordId}`);
    });
  } catch (error) {
    console.error(`WordStream: Error deleting word ${wordId} from local storage:`, error);
  }
} 