'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Word } from '../types';
import { LANGUAGE_MAP } from '@/services/caption-detectors/shared/language-map';
import { safeFormatDate } from '@/utils/date-utils';

interface WordCardProps {
  word: Word;
  onEdit: (word: Word) => void;
  onDelete: (word: Word) => void;
}

/**
 * קומפוננטה להצגת כרטיס מילה
 */
export function WordCard({ word, onEdit, onDelete }: WordCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWord, setEditedWord] = useState<Word>({ ...word });

  /**
   * שמירת שינויים
   */
  const handleSave = () => {
    onEdit(editedWord);
    setIsEditing(false);
  };

  /**
   * ביטול עריכה
   */
  const handleCancel = () => {
    setEditedWord({ ...word });
    setIsEditing(false);
  };

  /**
   * עדכון שפת המקור
   */
  const handleLanguageChange = (value: string) => {
    setEditedWord({
      ...editedWord,
      language: value,
      context: editedWord.context ? {
        ...editedWord.context,
        captionsLanguage: value
      } : undefined
    });
  };

  // תצוגת מצב עריכה
  if (isEditing) {
    return (
      <Card className="p-4 mb-4 bg-white dark:bg-slate-800 shadow-sm border rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <Input
            type="text"
            value={editedWord.word}
            onChange={(e) => setEditedWord({ ...editedWord, word: e.target.value })}
            className="flex-1 mr-2"
            placeholder="מילה מקורית"
          />
          <div className="flex space-x-2">
            <Button onClick={handleSave} size="sm" variant="default">שמור</Button>
            <Button onClick={handleCancel} size="sm" variant="outline">בטל</Button>
          </div>
        </div>
        <Input
          type="text"
          value={editedWord.translation}
          onChange={(e) => setEditedWord({ ...editedWord, translation: e.target.value })}
          className="mb-2"
          placeholder="תרגום"
        />
        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <select 
            value={editedWord.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="form-select text-sm p-1 border rounded"
          >
            {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <span>
            {word.timestamp ? safeFormatDate(word.timestamp, 'MMM d, yyyy') : 'נוסף זה עתה'}
          </span>
        </div>
      </Card>
    );
  }

  // תצוגת מצב רגיל
  return (
    <Card className="p-4 mb-4 bg-white dark:bg-slate-800 shadow-sm border rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-medium text-lg">{word.word}</h3>
        <div className="flex space-x-2">
          <Button onClick={() => setIsEditing(true)} size="sm" variant="ghost" className="p-1 h-auto">
            <Pencil size={16} />
          </Button>
          <Button onClick={() => onDelete(word)} size="sm" variant="ghost" className="p-1 h-auto text-red-500">
            &times;
          </Button>
        </div>
      </div>
      <p className="text-base mb-2">{word.translation}</p>
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>
          {LANGUAGE_MAP[word.language as keyof typeof LANGUAGE_MAP] || word.language}
        </span>
        <span>
          {word.timestamp ? safeFormatDate(word.timestamp, 'MMM d, yyyy') : 'נוסף זה עתה'}
        </span>
      </div>
    </Card>
  );
} 