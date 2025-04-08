'use client';

import React from 'react';
import { WordCard } from './WordCard';
import { Word } from '../types';
import { LoadingSpinner } from '@/shared/components/loading-spinner';

interface WordsListProps {
  words: Word[] | Record<string, Word[]>;
  isGrouped?: boolean;
  isLoading: boolean;
  onEditWord: (word: Word) => void;
  onDeleteWord: (word: Word) => void;
}

/**
 * הצגת רשימת מילים
 */
export function WordsList({ words, isGrouped = false, isLoading, onEditWord, onDeleteWord }: WordsListProps) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // בדיקה אם אין מילים להצגה
  const isEmpty = isGrouped 
    ? Object.keys(words as Record<string, Word[]>).length === 0 
    : (words as Word[]).length === 0;

  if (isEmpty) {
    return (
      <div className="text-center p-8 text-slate-500 dark:text-slate-400">
        <p>אין מילים להצגה</p>
        <p className="text-sm mt-2">נסה להוסיף מילים חדשות או לשנות את הפילטרים</p>
      </div>
    );
  }

  // הצגה מקובצת לפי שפה
  if (isGrouped) {
    const groupedWords = words as Record<string, Word[]>;
    return (
      <div className="space-y-6">
        {Object.entries(groupedWords).map(([language, languageWords]) => (
          languageWords.length > 0 && (
            <div key={language} className="language-group">
              <h2 className="text-lg font-medium mb-3 pb-1 border-b">{language}</h2>
              <div className="space-y-2">
                {languageWords.map((word) => (
                  <WordCard
                    key={`${word.language}-${word.word}-${word.targetLanguage}`}
                    word={word}
                    onEdit={onEditWord}
                    onDelete={onDeleteWord}
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    );
  }
  
  // הצגה רגילה כרשימה
  return (
    <div className="space-y-2">
      {(words as Word[]).map((word) => (
        <WordCard
          key={`${word.language}-${word.word}-${word.targetLanguage}`}
          word={word}
          onEdit={onEditWord}
          onDelete={onDeleteWord}
        />
      ))}
    </div>
  );
} 