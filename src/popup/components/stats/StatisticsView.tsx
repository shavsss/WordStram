import React from 'react';
import { Word } from '@/shared/types';

interface StatisticsViewProps {
  stats: {
    totalWords: number;
    todayWords: number;
    streak: number;
    lastActive: string;
  } | undefined;
  words: Word[];
}

export default function StatisticsView({ stats, words }: StatisticsViewProps) {
  // Calculate basic statistics from words array if stats is undefined
  const calculatedStats = {
    totalWords: stats?.totalWords || words.length,
    todayWords: stats?.todayWords || 0,
    streak: stats?.streak || 0,
    lastActive: stats?.lastActive || new Date().toISOString()
  };
  
  // Calculate language distribution
  const languageDistribution: Record<string, number> = {};
  words.forEach(word => {
    const language = word.language || 'unknown';
    languageDistribution[language] = (languageDistribution[language] || 0) + 1;
  });

  // Sort languages by count
  const sortedLanguages = Object.entries(languageDistribution)
    .sort((a, b) => b[1] - a[1]);
  
  // Calculate proficiency levels
  const proficiencyLevels = {
    beginner: 0,
    intermediate: 0,
    advanced: 0
  };
  
  words.forEach(word => {
    if (!word.proficiency) {
      proficiencyLevels.beginner++;
    } else if (word.proficiency < 3) {
      proficiencyLevels.beginner++;
    } else if (word.proficiency < 5) {
      proficiencyLevels.intermediate++;
    } else {
      proficiencyLevels.advanced++;
    }
  });

  return (
    <div className="h-full">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Total Words */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Total Words
          </h3>
          <div className="flex items-end">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {calculatedStats.totalWords}
            </span>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Day Streak
          </h3>
          <div className="flex items-end">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {calculatedStats.streak}
            </span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              days
            </span>
          </div>
        </div>

        {/* Words added today */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Words Today
          </h3>
          <div className="flex items-end">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {calculatedStats.todayWords}
            </span>
          </div>
        </div>

        {/* Last active */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Last Active
          </h3>
          <div className="flex items-end">
            <span className="text-lg font-medium text-gray-900 dark:text-white">
              {new Date(calculatedStats.lastActive).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Language Distribution */}
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
        Language Distribution
      </h3>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-8 shadow-sm border border-gray-200 dark:border-gray-700">
        {sortedLanguages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No words added yet
          </p>
        ) : (
          <div className="space-y-3">
            {sortedLanguages.map(([language, count]) => (
              <div key={language}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {language.charAt(0).toUpperCase() + language.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {count} {count === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(count / calculatedStats.totalWords) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proficiency Levels */}
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
        Proficiency Levels
      </h3>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        {calculatedStats.totalWords === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No words added yet
          </p>
        ) : (
          <div className="space-y-3">
            {/* Beginner */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Beginner
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {proficiencyLevels.beginner} {proficiencyLevels.beginner === 1 ? 'word' : 'words'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${(proficiencyLevels.beginner / calculatedStats.totalWords) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Intermediate */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Intermediate
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {proficiencyLevels.intermediate} {proficiencyLevels.intermediate === 1 ? 'word' : 'words'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-yellow-500 h-2.5 rounded-full" 
                  style={{ width: `${(proficiencyLevels.intermediate / calculatedStats.totalWords) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Advanced */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Advanced
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {proficiencyLevels.advanced} {proficiencyLevels.advanced === 1 ? 'word' : 'words'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-purple-500 h-2.5 rounded-full" 
                  style={{ width: `${(proficiencyLevels.advanced / calculatedStats.totalWords) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 