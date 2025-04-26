import { useState, useEffect } from 'react';
import { VocabWord } from '../shared/types';
import { runtime } from '../shared/utils/browser';
import { MessageType } from '../shared/message-types';

export function useStorage() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWords = async () => {
      try {
        setLoading(true);
        const response = await runtime.sendMessage({
          type: MessageType.GET_WORDS
        });
        
        if (response.success) {
          setWords(response.data || []);
        } else {
          setError(response.error || 'Failed to fetch words');
        }
      } catch (err) {
        setError('Error fetching words from storage');
        console.error('Error fetching words:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  const saveWord = async (word: VocabWord) => {
    try {
      const response = await runtime.sendMessage({
        type: MessageType.SAVE_WORD,
        data: word
      });
      
      if (response.success) {
        setWords(prev => [...prev, word]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error saving word:', err);
      return false;
    }
  };

  const deleteWord = async (wordId: string) => {
    try {
      const response = await runtime.sendMessage({
        type: MessageType.DELETE_WORD,
        data: { id: wordId }
      });
      
      if (response.success) {
        setWords(prev => prev.filter(word => word.id !== wordId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting word:', err);
      return false;
    }
  };

  return {
    words,
    loading,
    error,
    saveWord,
    deleteWord,
    refreshWords: () => {
      setLoading(true);
      runtime.sendMessage({
        type: MessageType.GET_WORDS
      }).then(response => {
        setLoading(false);
        if (response.success) {
          setWords(response.data || []);
        } else {
          setError(response.error || 'Failed to refresh words');
        }
      }).catch(err => {
        setLoading(false);
        setError('Error refreshing words');
        console.error('Error refreshing words:', err);
      });
    }
  };
} 