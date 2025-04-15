import React, { useState, useEffect } from 'react';
import { Word } from '@/shared/types';

interface WordsViewProps {
  words: Word[];
  onWordUpdate: (updatedWords: Word[]) => void;
}

/**
 * Component for displaying and managing saved words
 */
const WordsView: React.FC<WordsViewProps> = ({ words, onWordUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [groupByLanguage, setGroupByLanguage] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Filter words based on search term
  const filteredWords = words.filter(word => 
    word.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (word.translation && word.translation.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Group words by language for display
  const wordsByLanguage: Record<string, Word[]> = {};
  
  if (groupByLanguage) {
    filteredWords.forEach(word => {
      const lang = word.language || 'unknown';
      if (!wordsByLanguage[lang]) {
        wordsByLanguage[lang] = [];
      }
      wordsByLanguage[lang].push(word);
    });
  } else {
    wordsByLanguage['all'] = filteredWords;
  }
  
  const handleDeleteWord = (wordId: string) => {
    const updatedWords = words.filter(word => word.id !== wordId);
    onWordUpdate(updatedWords);
  };
  
  const handleToggleFavorite = (wordId: string) => {
    const updatedWords = words.map(word => {
      if (word.id === wordId) {
        return { ...word, favorite: !word.favorite };
      }
      return word;
    });
    onWordUpdate(updatedWords);
  };
  
  const languageOptions = [
    { value: 'all', label: 'All Languages' },
    { value: 'en', label: 'English' },
    { value: 'he', label: 'Hebrew' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ru', label: 'Russian' },
  ];
  
  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'custom', label: 'Custom Date' },
  ];
  
  // Word card component
  const WordCard = ({ word }: { word: Word }) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium">{word.text}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">{word.translation}</div>
            
            {word.context && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 italic">
                "{word.context}"
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleToggleFavorite(word.id)}
              className={`p-1.5 rounded-full ${
                word.favorite 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-gray-400 hover:text-yellow-500'
              }`}
              aria-label={word.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={word.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            
            <button
              onClick={() => handleDeleteWord(word.id)}
              className="p-1.5 rounded-full text-gray-400 hover:text-red-500"
              aria-label="Delete word"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-3 flex items-center text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>{word.language || 'unknown'}</span>
          </div>
          
          {word.createdAt && (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{new Date(word.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="h-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">My Words</h2>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <input 
            type="search" 
            className="block w-full p-2 pl-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="Search words..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {filteredWords.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            {words.length === 0 
              ? "You haven't saved any words yet." 
              : "No words match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWords.map(word => (
            <div 
              key={word.id} 
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{word.text}</h3>
                <div className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full">
                  {word.language || 'unknown'}
                </div>
              </div>
              
              {word.translation && (
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {word.translation}
                </p>
              )}
              
              {word.context && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                  "{word.context}"
                </div>
              )}
              
              <div className="mt-3 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <div>
                  {new Date(word.createdAt).toLocaleDateString()}
                </div>
                
                <div className="flex space-x-2">
                  <button className="p-1 hover:text-blue-600 dark:hover:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button className="p-1 hover:text-red-600 dark:hover:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WordsView; 