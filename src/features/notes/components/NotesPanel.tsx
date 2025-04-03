import React, { useRef, useEffect, useState } from 'react';
import { NotesPanelProps, SIZES } from '../types';
import { useVideoNotes } from '../hooks/useVideoNotes';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { NoteItem } from './NoteItem';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

/**
 * פאנל הערות משופר עם תמיכה במצב חיבור, שגיאות וסנכרון
 */
export function NotesPanel({
  videoId,
  videoTitle,
  isVisible,
  onClose,
  currentTime
}: NotesPanelProps) {
  // Authentication check
  const { isAuthenticated } = useAuth();
  
  // Use custom hooks
  const {
    notes,
    currentNote,
    setCurrentNote,
    isSaving,
    isLoading,
    error,
    currentVideoTime,
    setCurrentVideoTime,
    loadNotes,
    saveNote,
    deleteNote,
    handleJumpToTime,
    formatVideoTime,
    forceSynchronize,
    isOnline,
    lastSyncTime
  } = useVideoNotes({ videoId, currentTime });
  
  const {
    sizeOption,
    position,
    isDarkMode,
    handleMouseDown,
    handleSizeChange,
    toggleDarkMode
  } = useDraggablePanel();
  
  // Add background sync with 2-minute interval (only when authenticated)
  const { isSyncing, lastSyncTime: autoSyncTime, forceSync } = useBackgroundSync({
    enabled: isAuthenticated,
    intervalMs: 2 * 60 * 1000, // 2 minutes
    onSyncStart: () => {
      console.log('WordStream: Background sync started');
    },
    onSyncComplete: (success) => {
      console.log(`WordStream: Background sync completed with status: ${success ? 'success' : 'error'}`);
      // Reload notes after background sync
      if (success) {
        loadNotes();
      }
    }
  });
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDoneRef = useRef<boolean>(false);
  
  // Get current size based on selected option
  const currentSize = SIZES[sizeOption];
  
  // פוקוס על שדה הטקסט בטעינה
  useEffect(() => {
    if (notesContainerRef.current) {
      notesContainerRef.current.focus();
    }
  }, []);
  
  // עדכון הזמן הנוכחי בסרטון
  useEffect(() => {
    if (typeof currentTime === 'number') {
      setCurrentVideoTime(currentTime);
    }
  }, [currentTime, setCurrentVideoTime]);
  
  // בכל פעם שהפאנל מוצג, נטען את ההערות מחדש
  useEffect(() => {
    if (isVisible) {
      console.log('WordStream: Notes panel is visible, loading notes');
      
      // טעינה פעילה של ההערות בכל פעם שהפאנל נפתח
      loadNotes();
      
      // Start tracking current time if we're in the content script
      const updateCurrentTime = () => {
        try {
          const video = document.querySelector('video');
          if (video) {
            const time = video.currentTime;
            setCurrentVideoTime(time);
          }
        } catch (err) {
          console.error('WordStream: Error updating time in notes panel', err);
        }
      };
      
      // Set up interval to track current time
      const timeInterval = setInterval(updateCurrentTime, 500);
      
      // מסמן שעשינו לפחות טעינה ראשונית אחת
      initialLoadDoneRef.current = true;
      
      // Clean up the interval when the panel is hidden or unmounted
      return () => {
        clearInterval(timeInterval);
      };
    }
  }, [isVisible, loadNotes]);
  
  // בכל פעם שמזהה ההערה משתנה, נטען את ההערות מחדש
  useEffect(() => {
    if (isVisible && initialLoadDoneRef.current && videoId) {
      console.log('WordStream: Video ID changed, reloading notes for new video');
      loadNotes();
    }
  }, [videoId, isVisible, loadNotes]);
  
  // בכל פעם שהמשתמש מתחבר או מתנתק, נטען את ההערות מחדש
  useEffect(() => {
    if (isVisible && initialLoadDoneRef.current) {
      console.log('WordStream: Authentication state changed, reloading notes');
      loadNotes();
    }
  }, [isAuthenticated, isVisible, loadNotes]);
  
  // Visibility logging
  useEffect(() => {
    console.log('WordStream: NotesPanel visibility changed to', isVisible ? 'visible' : 'hidden');
    if (isVisible) {
      console.log('WordStream: NotesPanel position:', position);
    }
  }, [isVisible, position]);
  
  // Don't render if not visible
  if (!isVisible) return null;
  
  const handleSaveNote = async () => {
    if (!currentNote.trim() || isSaving) return;
    
    // בדיקת אימות נוספת לפני שמירת הערה
    if (!isAuthenticated) {
      console.log('WordStream Notes: Save blocked - user not authenticated');
      return;
    }
    
    try {
      // Use the saveNote function from the hook with no arguments
      await saveNote();
      console.log('WordStream: Note saved successfully');
    } catch (error) {
      console.error('WordStream: Error saving note', error);
    }
  };
  
  const handleDeleteNote = async (noteId: string) => {
    // בדיקת אימות נוספת לפני מחיקת הערה
    if (!isAuthenticated) {
      console.log('WordStream Notes: Delete blocked - user not authenticated');
      return;
    }
    
    try {
      console.log('WordStream: Deleting note', noteId);
      
      // Use the deleteNote function from the hook with just the ID
      await deleteNote(noteId);
    } catch (error) {
      console.error('WordStream: Error deleting note', error);
    }
  };
  
  // Force manual sync button handler
  const handleManualSync = async () => {
    if (!isAuthenticated) return;
    await forceSynchronize();
  };
  
  // חישוב מחלקות CSS לפאנל על פי הגודל
  const panelClasses = cn(
    'fixed right-4 top-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col transition-all duration-300',
    {
      'w-80 h-96': sizeOption === 'small',
      'w-96 h-[70vh]': sizeOption === 'medium',
      'w-[32rem] h-[85vh]': sizeOption === 'large',
    }
  );
  
  // Make formatTimestamp safer by ensuring date conversion works
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
      return timestamp;
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={panelClasses}
      style={{ 
        top: `${position.y}px`, 
        left: `${position.x}px`,
        zIndex: 9999999,
      }}
      aria-label="Video notes panel"
    >
      {/* כותרת ולחצנים */}
      <div 
        className={cn(
          "header flex items-center justify-between p-2 border-b",
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center">
          <div className={cn(
            "text-sm font-medium truncate max-w-[200px]",
            isDarkMode ? "text-white" : "text-gray-700"
          )} title={videoTitle}>
            Notes & Summary
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* כפתורי גודל */}
          <div className="flex items-center space-x-0.5 mr-2">
            <button
              onClick={() => handleSizeChange('small')}
              className={cn(
                "text-xs px-1 py-0.5 rounded transition-colors",
                sizeOption === 'small' 
                  ? (isDarkMode ? "bg-gray-600 text-white" : "bg-gray-300 text-gray-700") 
                  : (isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-200")
              )}
              aria-label="Small size"
            >
              S
            </button>
            <button
              onClick={() => handleSizeChange('medium')}
              className={cn(
                "text-xs px-1 py-0.5 rounded transition-colors",
                sizeOption === 'medium' 
                  ? (isDarkMode ? "bg-gray-600 text-white" : "bg-gray-300 text-gray-700") 
                  : (isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-200")
              )}
              aria-label="Medium size"
            >
              M
            </button>
            <button
              onClick={() => handleSizeChange('large')}
              className={cn(
                "text-xs px-1 py-0.5 rounded transition-colors",
                sizeOption === 'large' 
                  ? (isDarkMode ? "bg-gray-600 text-white" : "bg-gray-300 text-gray-700") 
                  : (isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-200")
              )}
              aria-label="Large size"
            >
              L
            </button>
          </div>
          
          {/* Theme toggle */}
          <button
            onClick={toggleDarkMode}
            className={cn(
              "p-1 rounded-full",
              isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"
            )}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {/* כפתור סגירה */}
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded-full",
              isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"
            )}
            aria-label="Close notes panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* סטטוס חיבור */}
      {!isOnline && (
        <div className={cn(
          "p-2 text-xs bg-amber-50 border-b border-amber-100 text-amber-800 flex items-center justify-between"
        )}>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>You are offline. Changes will sync when you reconnect.</span>
          </div>
        </div>
      )}
      
      {/* הודעת שגיאה */}
      {error && (
        <div className={cn(
          "p-2 text-xs border-l-4 mb-2 flex items-center",
          isOnline 
            ? "border-red-500 bg-red-50 text-red-800" 
            : "border-amber-500 bg-amber-50 text-amber-800"
        )}>
          <div className="flex-1">{error}</div>
          
          {/* Show manual sync button if offline */}
          {!isOnline && isAuthenticated && (
            <button
              onClick={handleManualSync}
              className="ml-2 text-xs bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded"
            >
              Retry
            </button>
          )}
        </div>
      )}
      
      {/* רשימת הערות */}
      <div 
        ref={notesContainerRef}
        className={cn(
          "flex-grow overflow-y-auto p-3 space-y-3",
          isDarkMode ? "bg-gray-900" : "bg-white"
        )}
      >
        {isLoading && (
          <div className={cn(
            "flex justify-center items-center p-4",
            isDarkMode ? "text-gray-400" : "text-gray-500"
          )}>
            <Spinner className="h-8 w-8 text-blue-500" />
          </div>
        )}
        
        {!isLoading && notes.length > 0 ? (
          <div className="space-y-2.5">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onDelete={handleDeleteNote}
                onJumpToTime={handleJumpToTime}
                formatVideoTime={formatVideoTime}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        ) : !isLoading && (
          <div 
            className={cn(
              "text-center mt-10 text-sm",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}
          >
            No notes for this video yet. Start typing below to add one.
          </div>
        )}
        
        {/* פורמט הזמן הנוכחי ומצב הסנכרון */}
        <div className={cn(
          "mt-4 text-xs flex justify-between items-center",
          isDarkMode ? "text-gray-500" : "text-gray-400"
        )}>
          <div>
            {lastSyncTime ? (
              <span>Last sync: {formatTimestamp(lastSyncTime)}</span>
            ) : (
              <span>Not synced yet</span>
            )}
          </div>
          
          {isAuthenticated && (
            <div className="flex items-center">
              {isSyncing ? (
                <div className="flex items-center">
                  <Spinner className="w-3 h-3 mr-1" />
                  <span>Syncing...</span>
                </div>
              ) : (
                <button 
                  onClick={handleManualSync}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700",
                    isDarkMode ? "text-blue-400" : "text-blue-500"
                  )}
                  disabled={isSyncing}
                >
                  Sync now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* טופס הוספת הערה */}
      <div 
        className={cn(
          "p-3 border-t",
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
        )}
      >
        {currentVideoTime !== undefined && (
          <div className={cn(
            "text-xs mb-1",
            isDarkMode ? "text-gray-400" : "text-gray-500"
          )}>
            Current position: {formatVideoTime(currentVideoTime)}
          </div>
        )}
        
        <div className="flex space-x-2">
          <textarea
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Type your note here..."
            className={cn(
              "flex-grow p-2 border rounded text-sm min-h-[80px] resize-none",
              isDarkMode 
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500" 
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500"
            )}
            disabled={!isAuthenticated}
          />
        </div>
        
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveNote}
            disabled={!currentNote.trim() || isSaving || !isAuthenticated}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium flex items-center",
              !currentNote.trim() || isSaving || !isAuthenticated
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            {isSaving ? (
              <>
                <Spinner className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Saving...
              </>
            ) : (
              'Save Note'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 