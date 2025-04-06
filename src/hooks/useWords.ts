/**
 * useWords hook
 * Manages words for the current user
 */

import { useState, useEffect, useCallback } from 'react';
import { Word } from '../core/firebase/types/word';
import { useBroadcastListener } from '../core/firebase/sync/broadcast';
import { getWords, saveWord, deleteWord } from '../core/firebase/services/words';
import { handleFirestoreTimestamp } from '../core/firebase/utils/timestamp-utils';

interface UseWordsOptions {
  filterByLanguage?: string;
  sortBy?: 'createdAt' | 'originalWord';
  sortDirection?: 'asc' | 'desc';
}

interface UseWordsResult {
  words: Word[];
  isLoading: boolean;
  error: string | null;
  saveWord: (word: Partial<Word>) => Promise<string>;
  deleteWord: (wordId: string) => Promise<boolean>;
  filteredWords: (filter?: string) => Word[];
}

/**
 * Hook for working with words
 * @param options Options for the hook
 */
export function useWords(options: UseWordsOptions = {}): UseWordsResult {
  const { 
    filterByLanguage,
    sortBy = 'createdAt',
    sortDirection = 'desc' 
  } = options;
  
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load words on mount
  useEffect(() => {
    setIsLoading(true);
    
    getWords()
      .then((fetchedWords: Word[]) => {
        setWords(applyFiltersAndSort(fetchedWords));
        setIsLoading(false);
      })
      .catch((err: Error) => {
        console.error('Error loading words:', err);
        setError('Failed to load words');
        setIsLoading(false);
      });
  }, [filterByLanguage, sortBy, sortDirection]);
  
  // Apply filters and sorting
  const applyFiltersAndSort = useCallback((wordsList: Word[]): Word[] => {
    let result = [...wordsList];
    
    // Apply language filter if provided
    if (filterByLanguage) {
      result = result.filter(word => 
        word.targetLanguage === filterByLanguage || 
        word.sourceLanguage === filterByLanguage
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'originalWord') {
        return sortDirection === 'asc' 
          ? a.originalWord.localeCompare(b.originalWord)
          : b.originalWord.localeCompare(a.originalWord);
      } else {
        // Sort by createdAt timestamp
        const dateA = new Date(a.createdAt).getTime(); 
        const dateB = new Date(b.createdAt).getTime();
        return sortDirection === 'asc'
          ? dateA - dateB
          : dateB - dateA;
      }
    });
    
    return result;
  }, [filterByLanguage, sortBy, sortDirection]);
  
  // Handle broadcast messages for word updates
  useBroadcastListener(message => {
    if (message.action === 'WORD_ADDED' && message.word) {
      setWords(currentWords => {
        // Find if the word already exists
        const existingIndex = currentWords.findIndex(w => w.id === message.word.id);
        const updatedWords = [...currentWords];
        
        if (existingIndex >= 0) {
          // Update existing word
          updatedWords[existingIndex] = {
            ...updatedWords[existingIndex],
            ...message.word
          };
        } else {
          // Add new word
          updatedWords.push(message.word);
        }
        
        return applyFiltersAndSort(updatedWords);
      });
    } else if (message.action === 'WORD_DELETED' && message.wordId) {
      // Remove the deleted word
      setWords(currentWords => 
        currentWords.filter(word => word.id !== message.wordId)
      );
    } else if (message.action === 'WORDS_UPDATED' && message.words) {
      // Full refresh of words data
      setWords(applyFiltersAndSort(message.words));
    }
  });
  
  // Save a word
  const saveWordCallback = useCallback(async (word: Partial<Word>): Promise<string> => {
    try {
      const wordId = await saveWord(word);
      
      // Update local state
      setWords(currentWords => {
        const existingIndex = currentWords.findIndex(w => w.id === wordId);
        const updatedWords = [...currentWords];
        
        if (existingIndex >= 0) {
          // Update existing word
          updatedWords[existingIndex] = {
            ...updatedWords[existingIndex],
            ...word,
            id: wordId
          };
        } else {
          // Add new word with complete data from service
          const newWordWithId = {
            ...word,
            id: wordId
          } as Word;
          updatedWords.push(newWordWithId);
        }
        
        return applyFiltersAndSort(updatedWords);
      });
      
      return wordId;
    } catch (err) {
      console.error('Error saving word:', err);
      setError('Failed to save word');
      throw err;
    }
  }, [applyFiltersAndSort]);
  
  // Delete a word
  const deleteWordCallback = useCallback(async (wordId: string): Promise<boolean> => {
    try {
      const success = await deleteWord(wordId);
      
      if (success) {
        // Remove from local state
        setWords(currentWords => 
          currentWords.filter(word => word.id !== wordId)
        );
      }
      
      return success;
    } catch (err) {
      console.error('Error deleting word:', err);
      setError('Failed to delete word');
      return false;
    }
  }, []);
  
  // Filter words by search term
  const filteredWords = useCallback((filter?: string): Word[] => {
    if (!filter) return words;
    
    const searchTerm = filter.toLowerCase();
    return words.filter(word => 
      word.originalWord.toLowerCase().includes(searchTerm) ||
      word.targetWord.toLowerCase().includes(searchTerm) ||
      (word.notes && word.notes.toLowerCase().includes(searchTerm))
    );
  }, [words]);
  
  return {
    words,
    isLoading,
    error,
    saveWord: saveWordCallback,
    deleteWord: deleteWordCallback,
    filteredWords
  };
} 