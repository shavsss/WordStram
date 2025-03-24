import React, { useState, useEffect } from 'react';
import syncService from '../../services/storage/sync-service';

interface WordListSharingProps {
  currentWords?: any[];
  onImportList?: (words: any[]) => void;
}

export function WordListSharing({ currentWords = [], onImportList }: WordListSharingProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [publicLists, setPublicLists] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [listName, setListName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // Check authentication state
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = syncService.isAuthenticated();
      setIsAuthenticated(isAuth);
    };
    
    checkAuth();
    
    // Listen for auth changes
    const handleAuthChange = () => {
      checkAuth();
    };
    
    document.addEventListener('wordstream-auth-changed', handleAuthChange);
    
    return () => {
      document.removeEventListener('wordstream-auth-changed', handleAuthChange);
    };
  }, []);

  // Load public lists when component mounts
  useEffect(() => {
    if (currentWords.length > 0) {
      // Try to get the language from current words
      const firstWord = currentWords[0];
      if (firstWord && firstWord.language) {
        setSelectedLanguage(firstWord.language);
      }
    }
    
    loadPublicLists();
  }, [currentWords]);
  
  // Load public word lists
  const loadPublicLists = async (language?: string) => {
    setIsLoading(true);
    try {
      const lists = await syncService.getPublicWordLists(language);
      setPublicLists(lists);
    } catch (error) {
      console.error('[WordStream] Error loading public lists:', error);
      showMessage('Failed to load shared lists', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Show success/error message
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  // Handle sharing current list
  const handleShareList = async () => {
    if (!isAuthenticated) {
      showMessage('Please sign in to share word lists', 'error');
      return;
    }
    
    if (currentWords.length === 0) {
      showMessage('You need words in your list to share', 'error');
      return;
    }
    
    if (!listName.trim()) {
      showMessage('Please enter a name for your list', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const listId = await syncService.shareWordList(listName, currentWords, isPublic);
      
      if (listId) {
        showMessage(`Word list "${listName}" shared successfully!`, 'success');
        setListName('');
        
        // Reload public lists to show the newly shared list
        await loadPublicLists(selectedLanguage || undefined);
      }
    } catch (error) {
      console.error('[WordStream] Error sharing list:', error);
      showMessage('Failed to share word list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle importing a list
  const handleImportList = (list: any) => {
    if (onImportList && list.words) {
      onImportList(list.words);
      showMessage(`Imported word list "${list.name}"`, 'success');
    }
  };

  // Filter lists by language
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value;
    setSelectedLanguage(language);
    loadPublicLists(language || undefined);
  };

  return (
    <div className="word-list-sharing">
      {/* Sharing section */}
      <div className="sharing-section">
        <h3>Share Your Word List</h3>
        
        {!isAuthenticated ? (
          <p className="auth-required">
            Sign in to share word lists with others
          </p>
        ) : (
          <div className="share-form">
            <div className="form-row">
              <label htmlFor="list-name">List Name:</label>
              <input
                type="text"
                id="list-name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="My English Vocabulary"
                disabled={isLoading}
              />
            </div>
            
            <div className="form-row">
              <label htmlFor="is-public">
                <input
                  type="checkbox"
                  id="is-public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isLoading}
                />
                Make list public
              </label>
            </div>
            
            <button 
              className="share-button"
              onClick={handleShareList}
              disabled={isLoading || currentWords.length === 0}
            >
              {isLoading ? 'Sharing...' : 'Share Word List'}
            </button>
            
            {message && (
              <div className={`message ${messageType}`}>
                {message}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Discovery section */}
      <div className="discovery-section">
        <h3>Discover Shared Word Lists</h3>
        
        <div className="filter-controls">
          <label htmlFor="language-filter">Filter by language:</label>
          <select
            id="language-filter"
            value={selectedLanguage}
            onChange={handleLanguageChange}
          >
            <option value="">All Languages</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="ru">Russian</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="he">Hebrew</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        
        {isLoading ? (
          <div className="loading">Loading shared lists...</div>
        ) : publicLists.length === 0 ? (
          <div className="no-lists">
            No shared word lists found. Be the first to share!
          </div>
        ) : (
          <div className="public-lists">
            {publicLists.map((list) => (
              <div key={list.id} className="list-card">
                <h4>{list.name}</h4>
                <div className="list-stats">
                  <span>{list.words.length} words</span>
                  <span>• {list.language}</span>
                </div>
                <div className="list-preview">
                  {list.words.slice(0, 5).map((word: any, index: number) => (
                    <span key={index} className="preview-word">
                      {word.text || word.original}
                    </span>
                  ))}
                  {list.words.length > 5 && <span>...</span>}
                </div>
                <button 
                  className="import-button"
                  onClick={() => handleImportList(list)}
                >
                  Import List
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WordListSharing; 