import React, { useState, useEffect } from 'react';
import { useWords } from '../../shared/hooks/useStorage';
import { useMessageBus } from '../../shared/hooks/useMessageBus';
import { Word } from '../../shared/types/index';
import { MessageType } from '../../shared/message-types';

const WordList: React.FC = () => {
  const [filter, setFilter] = useState<string>('');
  const { words, loading, refreshWords } = useWords();
  const { sendMessage } = useMessageBus(MessageType.DELETE_WORD, (message) => {
    // Handler for delete word response if needed
    if (message.success) {
      refreshWords(); // Refresh words after deletion
    }
    return null;
  });

  // Load saved words on component mount
  useEffect(() => {
    refreshWords();
  }, [refreshWords]);

  // Function to play audio of a word
  const playAudio = (word: string) => {
    chrome.runtime.sendMessage({
      type: 'PLAY_AUDIO',
      payload: { word }
    });
  };

  // Function to delete a word
  const deleteWord = (wordId: string) => {
    sendMessage({ wordId });
  };

  // Filter words based on search input
  const filteredWords = words?.filter(word => 
    word.originalWord.toLowerCase().includes(filter.toLowerCase()) || 
    word.targetWord.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  // Sort words by most recent first
  const sortedWords = [...filteredWords].sort((a, b) => {
    const timestampA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : a.timestamp;
    const timestampB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : b.timestamp;
    return timestampB - timestampA;
  });

  if (loading) {
    return <div className="loading-container">Loading your saved words...</div>;
  }

  return (
    <div className="word-list-container">
      <div className="word-list-header">
        <h2>Your Saved Words</h2>
        <input
          type="text"
          placeholder="Search words..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="word-search-input"
        />
      </div>

      {sortedWords.length === 0 ? (
        <div className="empty-word-list">
          <p>You haven't saved any words yet.</p>
          <p>Start watching videos with subtitles and click on words to save them!</p>
        </div>
      ) : (
        <ul className="word-list">
          {sortedWords.map((word) => (
            <li key={word.id} className="word-item">
              <div className="word-content">
                <div className="word-text-container">
                  <span className="word-text">{word.originalWord}</span>
                  <button 
                    className="play-audio-button" 
                    onClick={() => playAudio(word.originalWord)}
                    aria-label={`Play ${word.originalWord} audio`}
                  >
                    🔊
                  </button>
                </div>
                <div className="word-translation-container">
                  <span className="word-translation">{word.targetWord}</span>
                  <button 
                    className="play-audio-button" 
                    onClick={() => playAudio(word.targetWord)}
                    aria-label={`Play ${word.targetWord} audio`}
                  >
                    🔊
                  </button>
                </div>
                <div className="word-info">
                  <span className="word-date">
                    {new Date(parseInt(word.timestamp)).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button 
                className="delete-word-button" 
                onClick={() => deleteWord(word.id)}
                aria-label={`Delete ${word.originalWord}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WordList; 