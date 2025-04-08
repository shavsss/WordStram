'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { VocabularyFilter } from '../types';
import { LANGUAGE_MAP } from '@/services/caption-detectors/shared/language-map';

interface WordsFilterProps {
  filter: VocabularyFilter;
  availableLanguages: string[];
  onChange: (newFilter: Partial<VocabularyFilter>) => void;
}

/**
 * קומפוננטת פילטרים למילים
 */
export function WordsFilter({ filter, availableLanguages, onChange }: WordsFilterProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  /**
   * עדכון שפה
   */
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ language: e.target.value });
  };
  
  /**
   * עדכון פילטר תאריך
   */
  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as VocabularyFilter['dateFilter'];
    onChange({ dateFilter: value });
    
    if (value === 'custom') {
      setShowDatePicker(true);
    }
  };
  
  /**
   * עדכון תאריך מותאם
   */
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ customDate: e.target.value });
  };
  
  /**
   * שינוי הקיבוץ לפי שפה
   */
  const handleGroupingChange = () => {
    onChange({ groupByLanguage: !filter.groupByLanguage });
  };
  
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border mb-4">
      <div className="flex items-center mb-3">
        <Filter size={18} className="mr-2 text-primary" />
        <h2 className="text-lg font-medium">פילטרים</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* שפה */}
        <div>
          <label htmlFor="language-filter" className="block text-sm font-medium mb-1">
            שפה
          </label>
          <select
            id="language-filter"
            value={filter.language}
            onChange={handleLanguageChange}
            className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600"
          >
            <option value="all">כל השפות</option>
            {availableLanguages.map(lang => (
              <option key={lang} value={lang}>
                {LANGUAGE_MAP[lang as keyof typeof LANGUAGE_MAP] || lang}
              </option>
            ))}
          </select>
        </div>
        
        {/* פילטר תאריך */}
        <div>
          <label htmlFor="date-filter" className="block text-sm font-medium mb-1">
            תאריך
          </label>
          <select
            id="date-filter"
            value={filter.dateFilter}
            onChange={handleDateFilterChange}
            className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600"
          >
            <option value="all">כל התאריכים</option>
            <option value="today">היום</option>
            <option value="week">השבוע האחרון</option>
            <option value="month">החודש האחרון</option>
            <option value="custom">תאריך מותאם</option>
          </select>
        </div>
      </div>
      
      {/* תאריך מותאם */}
      {filter.dateFilter === 'custom' && (
        <div className="mt-3">
          <label htmlFor="custom-date" className="block text-sm font-medium mb-1">
            בחר תאריך
          </label>
          <div className="flex items-center">
            <Calendar size={16} className="mr-2 text-primary" />
            <input
              id="custom-date"
              type="date"
              value={filter.customDate || ''}
              onChange={handleCustomDateChange}
              className="p-2 rounded border dark:bg-slate-700 dark:border-slate-600"
            />
          </div>
        </div>
      )}
      
      {/* אפשרויות קיבוץ */}
      <div className="mt-4 pt-3 border-t dark:border-slate-700">
        <div className="flex items-center justify-between">
          <label htmlFor="group-by-language" className="text-sm font-medium">
            קבץ לפי שפה
          </label>
          <div className="relative inline-block w-10 align-middle select-none">
            <input 
              id="group-by-language" 
              type="checkbox"
              checked={filter.groupByLanguage}
              onChange={handleGroupingChange}
              className="sr-only"
            />
            <div className={`
              block w-10 h-6 rounded-full transition
              ${filter.groupByLanguage ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}
            `}>
              <div className={`
                dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition
                ${filter.groupByLanguage ? 'transform translate-x-4' : ''}
              `}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 