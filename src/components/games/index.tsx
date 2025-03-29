import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MemoryGame } from './memory-game';
import { MultipleChoice } from './multiple-choice';
import { FillInBlank } from './fill-in-blank';
import { WordScramble } from './word-scramble';
import { FlashCards } from './flash-cards';
import { CombinedTest } from './combined-test';
import { ArrowLeft } from 'lucide-react';

interface GamesProps {
  words: Array<{
    word: string;
    translation: string;
    context?: string;
  }>;
  onBack: () => void;
}

export function Games({ words, onBack }: GamesProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  // Transform words to include ID for MemoryGame
  const wordsWithId = words.map((word, index) => ({
    ...word,
    id: `word-${index}`
  }));

  // Constants for minimum word requirements
  const MIN_WORDS_REQUIRED = 4;

  // Check if we have enough words to play games
  if (words.length === 0) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="glass-button"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2 text-center">No words to practice with</h3>
            <p className="text-center text-white/70 mb-6">
              Your current filter doesn't include any words. Try changing your filters to see more words.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="glass-button"
            >
              Back to Words
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Check if we have the minimum required words
  if (words.length < MIN_WORDS_REQUIRED) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="glass-button"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Games</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="flex flex-col items-center justify-center h-64 p-8">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2 text-center">Not enough words</h3>
            <p className="text-center text-white/70 mb-6">
              You need at least {MIN_WORDS_REQUIRED} words to play games effectively. Try changing your filters to include more words.
            </p>
            <Button
              variant="outline"
              onClick={onBack}
              className="glass-button"
            >
              Back to Words
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const games = [
    {
      id: 'flash-cards',
      title: 'Flash Cards',
      description: 'Practice with interactive flash cards',
      component: FlashCards,
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/10',
      emoji: '🎴'
    },
    {
      id: 'multiple-choice',
      title: 'Multiple Choice',
      description: 'Test your knowledge with different types of questions',
      component: MultipleChoice,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10',
      emoji: '✍️'
    },
    {
      id: 'memory',
      title: 'Memory Game',
      description: 'Match pairs of words and translations',
      component: MemoryGame,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10',
      emoji: '🧩'
    },
    {
      id: 'fill-in-blank',
      title: 'Fill in the Blank',
      description: 'Practice writing translations from memory',
      component: FillInBlank,
      color: 'from-cyan-500 to-sky-600',
      bgColor: 'bg-cyan-500/10',
      emoji: '📝'
    },
    {
      id: 'word-scramble',
      title: 'Word Scramble',
      description: 'Unscramble letters to find the correct word',
      component: WordScramble,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10',
      emoji: '🔤'
    },
    {
      id: 'combined-test',
      title: 'Language Test',
      description: 'Challenge yourself with all game types in one test',
      component: CombinedTest,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10',
      emoji: '🏆'
    }
  ];

  if (!selectedGame) {
    return (
      <div className="fixed inset-0 bg-background text-foreground animated-gradient-bg overflow-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px] opacity-30" />
        
        <div className="relative min-h-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-indigo-900/70 backdrop-blur-lg py-4 px-4 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="glass-button"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl md:text-3xl font-extrabold game-header-text">Choose a Game</h1>
            <div className="w-10" /> {/* Spacer for alignment */}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 pb-10">
            {games.map((game) => (
              <Card
                key={game.id}
                className="group relative overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 hover:shadow-xl transition-all duration-300 rounded-xl hover:scale-[1.02]"
                onClick={() => setSelectedGame(game.id)}
              >
                <div className={`absolute inset-0 ${game.bgColor} opacity-10 group-hover:opacity-20 transition-opacity duration-500 ease-out rounded-xl`} />
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 ease-out rounded-xl"
                     style={{
                       background: `radial-gradient(circle at center, ${game.color.split(' ')[0]} 0%, transparent 70%)`
                     }}
                />
                <div className="relative z-10 p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl" role="img" aria-label={game.title}>
                      {game.emoji}
                    </span>
                    <h3 className={`text-2xl font-bold bg-gradient-to-r ${game.color} bg-clip-text text-transparent`}>
                      {game.title}
                    </h3>
                  </div>
                  <p className="text-white/80 group-hover:text-white transition-colors duration-300 font-medium">
                    {game.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const GameComponent = games.find((game) => game.id === selectedGame)?.component;

  if (!GameComponent) {
    return null;
  }

  // Pass the appropriate props based on the game component
  if (selectedGame === 'memory') {
    return <GameComponent words={wordsWithId} onBack={() => setSelectedGame(null)} points={0} />;
  }

  return (
    <GameComponent
      words={words}
      onBack={() => setSelectedGame(null)}
    />
  );
} 