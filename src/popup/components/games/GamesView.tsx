import React, { useState } from 'react';
import { Word } from '@/shared/types';

interface GamesViewProps {
  words: Word[];
}

type GameType = 'flashcards' | 'matching' | 'quiz' | 'hangman';

interface Game {
  id: GameType;
  title: string;
  description: string;
  icon: React.ReactNode;
  minWords: number;
}

/**
 * Games view component for vocabulary practice
 * Integrates existing games from the application
 */
export default function GamesView({ words }: GamesViewProps) {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  
  const games: Game[] = [
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Practice your vocabulary with digital flashcards',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      minWords: 5
    },
    {
      id: 'matching',
      title: 'Matching',
      description: 'Match words with their translations',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      minWords: 6
    },
    {
      id: 'quiz',
      title: 'Quiz',
      description: 'Test your knowledge with a multiple-choice quiz',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      minWords: 10
    },
    {
      id: 'hangman',
      title: 'Hangman',
      description: 'Guess the word letter by letter',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      minWords: 8
    }
  ];

  const handleStartGame = (gameId: GameType) => {
    setSelectedGame(gameId);
  };

  const handleBackToGames = () => {
    setSelectedGame(null);
  };

  const renderGameSelection = () => {
    return (
      <>
        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200">
          Games
        </h2>
        
        {words.length < 5 ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Not enough words
                </h3>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                  You need at least 5 words to play games. Add more words to unlock games.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => {
            const isDisabled = words.length < game.minWords;
            
            return (
              <div
                key={game.id}
                className={`border rounded-lg p-4 ${
                  isDisabled
                    ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
                    : 'bg-white dark:bg-gray-800 hover:shadow-md cursor-pointer'
                } transition-shadow border-gray-200 dark:border-gray-700`}
                onClick={() => !isDisabled && handleStartGame(game.id)}
              >
                <div className="flex items-center mb-2">
                  <div className="flex-shrink-0 text-blue-600 dark:text-blue-400 mr-3">
                    {game.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {game.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isDisabled 
                        ? `Need ${game.minWords} words (${game.minWords - words.length} more)` 
                        : game.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderGame = () => {
    switch (selectedGame) {
      case 'flashcards':
        return (
          <div className="text-center py-16">
            <div className="mb-4 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Flashcards Game</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This game is under development</p>
            <button
              onClick={handleBackToGames}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Games
            </button>
          </div>
        );
      case 'matching':
        return (
          <div className="text-center py-16">
            <div className="mb-4 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Matching Game</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This game is under development</p>
            <button
              onClick={handleBackToGames}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Games
            </button>
          </div>
        );
      case 'quiz':
        return (
          <div className="text-center py-16">
            <div className="mb-4 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Quiz Game</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This game is under development</p>
            <button
              onClick={handleBackToGames}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Games
            </button>
          </div>
        );
      case 'hangman':
        return (
          <div className="text-center py-16">
            <div className="mb-4 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Hangman Game</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This game is under development</p>
            <button
              onClick={handleBackToGames}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Games
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full">
      {selectedGame ? renderGame() : renderGameSelection()}
    </div>
  );
} 