import React, { useState, useEffect } from 'react';
import { Book, Dices, Gamepad2, Puzzle, ScanText, Layers } from 'lucide-react';
import { MessageType } from '../shared/message-types';
import { sendMessage } from '../shared/utils/messaging';
import './styles.css';

// Lazy load game components to reduce initial bundle size
const FillInBlank = React.lazy(() => import('./fill-in-blank'));
const FlashCards = React.lazy(() => import('./flash-cards'));
import { MultipleChoice } from './multiple-choice';
import { MemoryMatch } from './memory-match';
import WordScramble from './word-scramble';

// Define Word type for the games
interface Word {
  id: string;
  word: string;
  translation: string;
  context?: string;
  timestamp: number;
  targetLanguage: string;
}

// Common props interface that matches all game components
interface GameProps {
  words: Word[];
  onBack: () => void;
  onExit: () => void; // Added to match components expecting this prop
}

// Enum for game types
enum GameType {
  NONE = 'none',
  FILL_IN_BLANK = 'fill-in-blank',
  FLASH_CARDS = 'flash-cards',
  MULTIPLE_CHOICE = 'multiple-choice',
  MEMORY_MATCH = 'memory-match',
  WORD_SCRAMBLE = 'word-scramble'
}

// Game option definition with metadata
interface GameOption {
  id: GameType;
  title: string;
  description: string;
  icon: React.ReactNode;
  minWords: number;
  component: React.ComponentType<any>; // Using any here to avoid TypeScript errors with lazy loaded components
}

// Main game launcher component
export const GameLauncher: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameType>(GameType.NONE);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  // Define game options with metadata
  const gameOptions: GameOption[] = [
    {
      id: GameType.FILL_IN_BLANK,
      title: 'Fill in the Blank',
      description: 'Test your vocabulary by typing the word that matches the translation',
      icon: <ScanText size={28} />,
      minWords: 5,
      component: FillInBlank
    },
    {
      id: GameType.FLASH_CARDS,
      title: 'Flash Cards',
      description: 'Learn words and their translations with interactive flash cards',
      icon: <Layers size={28} />,
      minWords: 3,
      component: FlashCards
    },
    {
      id: GameType.MULTIPLE_CHOICE,
      title: 'Multiple Choice',
      description: 'Choose the correct translation from multiple options',
      icon: <Dices size={28} />,
      minWords: 6,
      component: MultipleChoice
    },
    {
      id: GameType.MEMORY_MATCH,
      title: 'Memory Match',
      description: 'Match words with their translations in a memory game',
      icon: <Puzzle size={28} />,
      minWords: 4,
      component: MemoryMatch
    },
    {
      id: GameType.WORD_SCRAMBLE,
      title: 'Word Scramble',
      description: 'Unscramble the letters to form the correct word',
      icon: <Gamepad2 size={28} />,
      minWords: 5,
      component: WordScramble
    }
  ];

  // Load words from storage when component mounts
  useEffect(() => {
    loadWords();
  }, []);

  // Load words using the messaging API
  const loadWords = () => {
    try {
      setLoading(true);
      // Use the sendMessage utility to communicate with the background script
      sendMessage({
        type: MessageType.GET_WORDS
      })
      .then(response => {
        if (response && response.success && response.data) {
          // Format the words to match the game's expected format
          const formattedWords = response.data.map((word: any) => ({
            id: word.id,
            word: word.text || word.originalWord,
            translation: word.translation || word.targetWord,
            context: word.context,
            timestamp: typeof word.timestamp === 'string' 
              ? new Date(word.timestamp).getTime() 
              : word.timestamp,
            targetLanguage: word.targetLanguage || word.language
          }));
          setWords(formattedWords);
        }
      })
      .catch(error => {
        console.error('Error loading words:', error);
      })
      .finally(() => {
        setLoading(false);
      });
    } catch (error) {
      console.error('Error formatting words for games:', error);
      setLoading(false);
    }
  };

  // Handle "back to games" button click
  const handleBackToGames = () => {
    setActiveGame(GameType.NONE);
    // Refresh the words list when returning to the launcher
    loadWords();
  };

  // Render the active game or the game selection screen
  const renderContent = () => {
    // If a game is selected and we have words, render that game
    if (activeGame !== GameType.NONE && words.length > 0) {
      const selectedGame = gameOptions.find(game => game.id === activeGame);
      if (selectedGame) {
        const GameComponent = selectedGame.component;
        return (
          <React.Suspense fallback={<div className="game-launcher-loading">Loading game...</div>}>
            <GameComponent 
              words={words} 
              onBack={handleBackToGames} 
              onExit={handleBackToGames} // Pass the same handler for both props
            />
          </React.Suspense>
        );
      }
    }

    // Show loading screen while fetching words
    if (loading) {
      return (
        <div className="game-launcher-loading">
          <div className="loading-spinner"></div>
          <p>Loading your vocabulary...</p>
        </div>
      );
    }

    // Show message if no words are saved
    if (words.length === 0) {
      return (
        <div className="game-launcher-empty">
          <h3>No Words Available</h3>
          <p>Save some words while watching videos with captions to start playing language games!</p>
          <Book size={64} className="text-gray-300 mt-4" />
        </div>
      );
    }

    // Render game selection grid
    return (
      <div className="animated-gradient-bg">
        <div className="game-launcher-header">
          <div className="game-header-text">
            <h2>Language Games</h2>
            <p className="game-subheader">Practice your vocabulary with fun interactive games</p>
          </div>
        </div>

        <div className="games-grid">
          {gameOptions.map((game) => {
            const hasEnoughWords = words.length >= game.minWords;
            
            return (
              <div 
                key={game.id}
                className={`game-option-card ${!hasEnoughWords ? 'disabled' : ''}`}
                onClick={() => hasEnoughWords && setActiveGame(game.id)}
              >
                <div className="game-option-icon">
                  {game.icon}
                </div>
                <div className="game-option-content">
                  <h3 className="game-option-title">{game.title}</h3>
                  <p className="game-option-description">{game.description}</p>
                  
                  {!hasEnoughWords && (
                    <div className="game-option-requirement">
                      <span className="word-counter">
                        <span className="current-words">{words.length}</span>
                        <span>/</span>
                        <span className="required-words">{game.minWords}</span>
                      </span>
                      <span> words needed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card game-launcher-container">
      {renderContent()}
    </div>
  );
};

export default GameLauncher; 