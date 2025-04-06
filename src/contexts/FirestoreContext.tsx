import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, Suspense } from 'react';
import { toast } from 'react-toastify';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { Note } from '@/features/notes/types';
import { VideoMetadata } from '@/types';
import { ChatConversation } from '@/types/chats';
import { useAuth } from '@/hooks/useAuth';
import * as BackgroundMessaging from '@/utils/background-messaging';

interface FirestoreContextType {
  videos: VideoMetadata[];
  chats: ChatConversation[];
  notes: Record<string, Note[]>;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  refreshData: () => Promise<void>;
  forceSyncAll: () => Promise<boolean>;
  isChatsLoading: boolean;
  isVideosLoading: boolean;
  isNotesLoading: boolean;
}

const FirestoreContext = createContext<FirestoreContextType | null>(null);

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirestoreProvider');
  }
  return context;
};

interface FirestoreProviderProps {
  children: ReactNode;
}

// Add error boundary component for safer chunk loading
class ErrorBoundary extends React.Component<{ children: ReactNode, fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode, fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("WordStream: Error caught in boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Safe import wrapper
const SafeFirestoreLoader = ({ children }: { children: ReactNode }) => {
  return (
    <ErrorBoundary fallback={
      <div className="p-4 text-center">
        <p className="text-red-500">Error loading data</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    }>
      <Suspense fallback={
        <div className="flex justify-center p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      }>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

export function FirestoreProvider({ children }: FirestoreProviderProps) {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [isVideosLoading, setIsVideosLoading] = useState(true);
  const [isNotesLoading, setIsNotesLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const isMounted = React.useRef(true);
  const messageListenerRef = React.useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Cleanup message listener if exists
      if (messageListenerRef.current) {
        messageListenerRef.current();
      }
    };
  }, []);

  // Safe state setter helpers that check if component is still mounted
  const safeSetVideos = useCallback((data: VideoMetadata[]) => {
    if (isMounted.current) setVideos(data);
  }, []);
  
  const safeSetChats = useCallback((data: ChatConversation[]) => {
    if (isMounted.current) setChats(data);
  }, []);
  
  const safeSetNotes = useCallback((data: Record<string, Note[]>) => {
    if (isMounted.current) setNotes(data);
  }, []);

  // Set up background sync with improved error handling
  const { isSyncing, lastSyncTime, forceSync } = useBackgroundSync({
    enabled: !!currentUser,
    intervalMs: 5 * 60 * 1000, // 5 minutes
    onSyncComplete: (success) => {
      if (!isMounted.current) return;
      
      if (success) {
        setLastSyncTimestamp(new Date().toISOString());
        console.log('WordStream: Background sync completed successfully');
      } else {
        console.warn('WordStream: Background sync completed with errors');
        // Try to load from local storage as fallback
        loadFromLocalStorage();
      }
    }
  });

  // Load data from local storage as fallback
  const loadFromLocalStorage = useCallback(async () => {
    try {
      console.log('WordStream: Loading data from local storage as fallback');
      
      // Load chats from storage
      chrome.storage.local.get(['chats_storage'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error accessing local storage:', chrome.runtime.lastError);
          return;
        }
        
        if (result.chats_storage) {
          const storedChats = Object.values(result.chats_storage || {}) as ChatConversation[];
          if (storedChats.length > 0) {
            safeSetChats(storedChats);
            setIsChatsLoading(false);
          }
        }
      });
      
      // Load notes from storage
      chrome.storage.local.get(['notes_storage'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error accessing local storage:', chrome.runtime.lastError);
          return;
        }
        
        if (result.notes_storage) {
          safeSetNotes(result.notes_storage);
          setIsNotesLoading(false);
        }
      });
      
      // Check overall loading state
      updateLoadingState();
      
    } catch (error) {
      console.error('WordStream: Error loading from local storage:', error);
    }
  }, [safeSetChats, safeSetNotes]);

  // Helper to update overall loading state based on individual states
  const updateLoadingState = useCallback(() => {
    if (isMounted.current) {
      setIsLoading(isChatsLoading || isVideosLoading || isNotesLoading);
    }
  }, [isChatsLoading, isVideosLoading, isNotesLoading]);

  // Set up message listener for data updates from background
  const setupMessageListener = useCallback(() => {
    if (!currentUser) return;
    
    const handleMessage = (message: any) => {
      if (!message || !message.action) return;
      
      // Handle different message types
      switch (message.action) {
        case 'NOTES_UPDATED':
          if (message.notes) {
            console.log('WordStream: Received notes update from background');
            // Process and update notes
            const notesByVideo: Record<string, Note[]> = {};
            
            // Group notes by videoId
            message.notes.forEach((note: Note) => {
              if (note.videoId) {
                if (!notesByVideo[note.videoId]) {
                  notesByVideo[note.videoId] = [];
                }
                notesByVideo[note.videoId].push(note);
              }
            });
            
            safeSetNotes(notesByVideo);
            setIsNotesLoading(false);
            updateLoadingState();
          }
          break;
          
        case 'CHATS_UPDATED':
          if (message.chats) {
            console.log('WordStream: Received chats update from background');
            safeSetChats(message.chats);
            setIsChatsLoading(false);
            updateLoadingState();
          }
          break;
          
        case 'VIDEOS_UPDATED':
          if (message.videos) {
            console.log('WordStream: Received videos update from background');
            safeSetVideos(message.videos);
            setIsVideosLoading(false);
            updateLoadingState();
          }
          break;
          
        case 'SYNC_COMPLETED':
          console.log('WordStream: Sync completed');
          setLastSyncTimestamp(new Date().toISOString());
          // Refresh data after sync
          refreshData();
          break;
      }
    };
    
    // Set up the broadcast listener from background
    messageListenerRef.current = BackgroundMessaging.setupBroadcastListener(handleMessage);
    
    return () => {
      if (messageListenerRef.current) {
        messageListenerRef.current();
        messageListenerRef.current = null;
      }
    };
  }, [currentUser, safeSetNotes, safeSetChats, safeSetVideos, updateLoadingState]);

  // Handler for broadcast messages (updates from other tabs/windows)
  const handleBroadcastMessage = useCallback((message: any) => {
    if (!message || !message.action) return;
    
    switch (message.action) {
      case 'NOTE_ADDED':
      case 'NOTE_UPDATED':
      case 'NOTE_DELETED':
      case 'NOTES_CHANGED':
        // Refresh notes when changes are detected
        fetchAllNotes(currentUser?.uid);
        break;
        
      case 'CHAT_ADDED':
      case 'CHAT_UPDATED':
      case 'CHAT_DELETED':
      case 'CHATS_CHANGED':
        // Refresh chats when changes are detected
        fetchChats();
        break;
    }
  }, [currentUser]);

  // Fetch all data when user authentication state changes
  useEffect(() => {
    let progressTimeoutId: NodeJS.Timeout | undefined;
    
    const fetchData = async () => {
      if (!currentUser) {
        // Clear data when user logs out
        safeSetVideos([]);
        safeSetChats([]);
        safeSetNotes({});
        setIsLoading(false);
        setIsChatsLoading(false);
        setIsVideosLoading(false);
        setIsNotesLoading(false);
        return;
      }
      
      setIsLoading(true);
      setIsChatsLoading(true);
      setIsVideosLoading(true);
      setIsNotesLoading(true);
      setHasError(false);
      
      // Set up progressive loading
      progressTimeoutId = setTimeout(() => {
        if (isLoading && isMounted.current) {
          // Load from cache if taking too long
          loadFromLocalStorage();
        }
      }, 3000);
      
      try {
        // Initialize data sync with background
        console.log('WordStream: Initializing data sync with background');
        await BackgroundMessaging.initializeDataSync();
        
        // Set up message listeners
        setupMessageListener();
        
        // Fetch initial data
        await Promise.all([
          fetchChats(),
          fetchAllNotes(currentUser.uid),
          fetchVideos()
        ]);
        
        if (isMounted.current) {
          setLastSyncTimestamp(new Date().toISOString());
        }
      } catch (error) {
        console.error('WordStream: Error fetching initial data:', error);
        setHasError(true);
        setErrorMessage(String(error));
        
        // Try loading from cache as fallback
        loadFromLocalStorage();
      } finally {
        clearTimeout(progressTimeoutId);
      }
    };
    
    fetchData();
    
    return () => {
      clearTimeout(progressTimeoutId);
    };
  }, [currentUser]);

  // Fetch chats through background messaging
  const fetchChats = useCallback(async () => {
    try {
      console.log('WordStream: Fetching chats via background messaging');
      const chatData = await BackgroundMessaging.getChats();
      
      if (chatData) {
        console.log(`WordStream: Received ${chatData.length} chats`);
        safeSetChats(chatData);
        
        // Cache in local storage
        try {
          const chatsStorage: Record<string, any> = {};
          chatData.forEach(chat => {
            if (chat.id) {
              chatsStorage[chat.id] = chat;
            }
          });
          
          chrome.storage.local.set({ 'chats_storage': chatsStorage });
        } catch (storageError) {
          console.warn('WordStream: Error caching chats in storage:', storageError);
        }
      }
      
      setIsChatsLoading(false);
      updateLoadingState();
    } catch (error) {
      console.error('WordStream: Error fetching chats:', error);
      setIsChatsLoading(false);
      updateLoadingState();
      
      // Try loading from storage as fallback
      loadFromLocalStorage();
    }
  }, [safeSetChats, updateLoadingState, loadFromLocalStorage]);

  // Fetch notes for a user via background messaging
  const fetchAllNotes = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setIsNotesLoading(false);
      updateLoadingState();
      return;
    }
    
    try {
      console.log('WordStream: Fetching all videos with notes via background messaging');
      const videosWithNotes = await BackgroundMessaging.getAllVideosWithNotes();
      
      if (videosWithNotes) {
        console.log(`WordStream: Received ${videosWithNotes.length} videos with notes`);
        
        // Process notes by video
        const notesByVideo: Record<string, Note[]> = {};
        
        videosWithNotes.forEach(video => {
          if (video.videoId && video.notes) {
            notesByVideo[video.videoId] = video.notes;
          }
        });
        
        safeSetNotes(notesByVideo);
        
        // Cache in local storage
        try {
          chrome.storage.local.set({ 'notes_storage': notesByVideo });
        } catch (storageError) {
          console.warn('WordStream: Error caching notes in storage:', storageError);
        }
      }
      
      setIsNotesLoading(false);
      updateLoadingState();
    } catch (error) {
      console.error('WordStream: Error fetching notes:', error);
      setIsNotesLoading(false);
      updateLoadingState();
      
      // Try loading from storage as fallback
      loadFromLocalStorage();
    }
  }, [safeSetNotes, updateLoadingState, loadFromLocalStorage]);

  // Fetch videos metadata via background messaging
  const fetchVideos = useCallback(async () => {
    try {
      console.log('WordStream: Fetching videos metadata via background messaging');
      // Since there's no direct function for this in BackgroundMessaging,
      // we get this from getAllVideosWithNotes which contains video metadata
      const videosWithNotes = await BackgroundMessaging.getAllVideosWithNotes();
      
      if (videosWithNotes) {
        const videosData: VideoMetadata[] = videosWithNotes.map(video => ({
          id: video.videoId || '',
          userId: currentUser?.uid || '',  // Add userId from currentUser
          videoId: video.videoId || '',
          videoTitle: video.videoTitle || '',
          videoURL: video.videoURL || '',
          lastUpdated: video.lastUpdated || new Date().toISOString(),
          // Add default values for any other required fields
          lastViewed: new Date().toISOString(),
          durationInSeconds: 0,
          watchedPercentage: 0
        }));
        
        console.log(`WordStream: Processed ${videosData.length} videos`);
        safeSetVideos(videosData);
        
        // Cache in local storage
        try {
          chrome.storage.local.set({ 'videos_storage': videosData });
        } catch (storageError) {
          console.warn('WordStream: Error caching videos in storage:', storageError);
        }
      }
      
      setIsVideosLoading(false);
      updateLoadingState();
    } catch (error) {
      console.error('WordStream: Error fetching videos:', error);
      setIsVideosLoading(false);
      updateLoadingState();
      
      // Try loading from storage as fallback
      loadFromLocalStorage();
    }
  }, [safeSetVideos, updateLoadingState, loadFromLocalStorage, currentUser]);

  // Public method to refresh all data
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    setIsChatsLoading(true);
    setIsVideosLoading(true);
    setIsNotesLoading(true);
    
    try {
      // Fetch all data from background
      await Promise.all([
        fetchChats(),
        fetchAllNotes(currentUser.uid),
        fetchVideos()
      ]);
      
      setLastSyncTimestamp(new Date().toISOString());
    } catch (error) {
      console.error('WordStream: Error refreshing data:', error);
      setHasError(true);
      setErrorMessage(String(error));
      
      // Try loading from cache as fallback
      loadFromLocalStorage();
    }
  }, [currentUser, fetchChats, fetchAllNotes, fetchVideos, loadFromLocalStorage]);

  // Public method to force sync with Firestore
  const forceSyncAll = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    
    setIsLoading(true);
    toast.info('Syncing data...');
    
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Sync operation timed out after 20 seconds'));
      }, 20000);
    });
    
    // Create the actual sync promise
    const syncPromise = async (): Promise<boolean> => {
      // Use our background sync mechanism
      try {
        await BackgroundMessaging.initializeDataSync();
        
        if (isMounted.current) {
          setLastSyncTimestamp(new Date().toISOString());
          // Refresh the data to ensure UI is updated
          await refreshData();
        }
        
        // Record success in local storage
        chrome.storage.local.set({
          'last_sync_status': {
            success: true,
            timestamp: new Date().toISOString(),
            type: 'force'
          }
        });
        
        toast.success('Sync completed successfully');
        return true;
      } catch (error) {
        console.error('WordStream: Error during forced sync:', error);
        
        toast.warning('Sync could not be completed');
        
        // Record failure
        chrome.storage.local.set({
          'last_sync_status': {
            success: false,
            error: String(error),
            timestamp: new Date().toISOString(),
            type: 'force'
          }
        });
        
        return false;
      }
    };
    
    // Race between sync and timeout
    try {
      const success = await Promise.race([syncPromise(), timeoutPromise]);
      return !!success;
    } catch (raceError) {
      console.error('WordStream: Sync race error:', raceError);
      toast.error('Sync timed out. Try again later.');
      return false;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [currentUser, refreshData]);

  const value = {
    videos,
    chats,
    notes,
    isLoading,
    hasError,
    errorMessage,
    refreshData,
    forceSyncAll,
    isChatsLoading,
    isVideosLoading,
    isNotesLoading
  };

  return (
    <FirestoreContext.Provider value={value}>
      <SafeFirestoreLoader>
        {children}
      </SafeFirestoreLoader>
    </FirestoreContext.Provider>
  );
} 