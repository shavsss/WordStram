import React, { useState, useEffect } from 'react';
import { useWords } from '../../shared/hooks/useStorage';
import { MessageType } from '../../shared/message-types';
import { Word } from '../../games/exports';

interface GameStatsData {
  gameType: string;
  lastPlayed: string;
  highScore: number;
  totalPlayed: number;
  averageScore: number;
}

interface UsageStats {
  savedWordsCount: number;
  uniqueLanguages: number;
  practiceSessionsCount: number;
  lastPracticeDate: string | null;
  gameStats: GameStatsData[];
}

const Statistics: React.FC = () => {
  const { words } = useWords();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'words'>('overview');
  
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Request stats from background script
        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_STATS
        });
        
        if (response && response.success) {
          setStats(response.data);
        } else {
          // If background request fails, calculate basic stats from words
          calculateBasicStats();
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
        // Fallback to basic calculation
        calculateBasicStats();
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [words]);
  
  // Calculate basic statistics from available words data
  const calculateBasicStats = () => {
    if (!words || words.length === 0) {
      setStats({
        savedWordsCount: 0,
        uniqueLanguages: 0,
        practiceSessionsCount: 0,
        lastPracticeDate: null,
        gameStats: []
      });
      return;
    }
    
    const languages = new Set(words.map((word: Word) => word.targetLanguage));
    
    setStats({
      savedWordsCount: words.length,
      uniqueLanguages: languages.size,
      practiceSessionsCount: 0, // Can't calculate this from words alone
      lastPracticeDate: null,
      gameStats: [] // Need backend data for this
    });
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  if (loading) {
    return <div className="stats-loading">Loading statistics...</div>;
  }
  
  if (!stats) {
    return <div className="stats-error">Unable to load statistics.</div>;
  }
  
  // If no words saved yet
  if (stats.savedWordsCount === 0) {
    return (
      <div className="stats-empty">
        <h3>No Learning Data Yet</h3>
        <p>Start saving words while watching videos to see your learning statistics here!</p>
      </div>
    );
  }
  
  return (
    <div className="statistics-container">
      <div className="stats-tabs">
        <button 
          className={`stats-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`stats-tab ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          Games
        </button>
        <button 
          className={`stats-tab ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveTab('words')}
        >
          Words
        </button>
      </div>
      
      <div className="stats-content">
        {activeTab === 'overview' && (
          <div className="stats-overview">
            <h2>Learning Progress</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-number">{stats.savedWordsCount}</div>
                <div className="stat-label">Words Saved</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🌐</div>
                <div className="stat-number">{stats.uniqueLanguages}</div>
                <div className="stat-label">Languages</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🏋️</div>
                <div className="stat-number">{stats.practiceSessionsCount || 0}</div>
                <div className="stat-label">Practice Sessions</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-value">{formatDate(stats.lastPracticeDate)}</div>
                <div className="stat-label">Last Practice</div>
              </div>
            </div>
            
            <div className="learning-streak">
              <h3>Learning Streak</h3>
              <div className="streak-calendar">
                {/* Calendar visualization would go here */}
                <div className="placeholder-text">Calendar visualization coming soon</div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'games' && (
          <div className="stats-games">
            <h2>Game Performance</h2>
            
            {stats.gameStats && stats.gameStats.length > 0 ? (
              <div className="game-stats-list">
                {stats.gameStats.map((game, index) => (
                  <div className="game-stat-card" key={index}>
                    <h3>{game.gameType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
                    <div className="game-stat-content">
                      <div className="game-stat-item">
                        <span className="game-stat-label">High Score:</span>
                        <span className="game-stat-value">{game.highScore}</span>
                      </div>
                      <div className="game-stat-item">
                        <span className="game-stat-label">Average Score:</span>
                        <span className="game-stat-value">{game.averageScore.toFixed(1)}</span>
                      </div>
                      <div className="game-stat-item">
                        <span className="game-stat-label">Games Played:</span>
                        <span className="game-stat-value">{game.totalPlayed}</span>
                      </div>
                      <div className="game-stat-item">
                        <span className="game-stat-label">Last Played:</span>
                        <span className="game-stat-value">{formatDate(game.lastPlayed)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-game-stats">
                <p>You haven't played any games yet.</p>
                <p>Go to the Games tab to practice your vocabulary!</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'words' && (
          <div className="stats-words">
            <h2>Vocabulary Stats</h2>
            
            <div className="vocabulary-breakdown">
              <h3>Languages</h3>
              <div className="language-distribution">
                {/* Language distribution chart would go here */}
                <div className="placeholder-text">Language distribution chart coming soon</div>
              </div>
            </div>
            
            <div className="mastery-progress">
              <h3>Mastery Progress</h3>
              <div className="mastery-chart">
                {/* Mastery progress chart would go here */}
                <div className="placeholder-text">Mastery progress chart coming soon</div>
              </div>
            </div>
            
            <div className="recently-added">
              <h3>Recently Added Words</h3>
              <div className="recent-words-list">
                {words.slice(0, 5).map((word: Word, index: number) => (
                  <div className="recent-word" key={index}>
                    <span className="word-text">{word.word}</span>
                    <span className="word-translation">{word.translation}</span>
                    <span className="word-date">{new Date(word.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Statistics; 