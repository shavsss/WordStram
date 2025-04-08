import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/hooks/useStore';
import { formatDate } from '@/utils/helpers';
import { VideoWithNotes, Note } from '@/features/notes/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';

interface NotesAndSummariesProps {
  isDarkMode?: boolean;
}

export function NotesAndSummaries({ isDarkMode = false }: NotesAndSummariesProps) {
  const { 
    videosWithNotes, 
    syncAll, 
    isSyncing, 
    lastSyncTime, 
    error,
    deleteNote
  } = useStore();
  
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
  // בחירת סרטון ראשון כברירת מחדל
  useEffect(() => {
    if (videosWithNotes.length > 0 && !selectedVideo) {
      setSelectedVideo(videosWithNotes[0].videoId);
    }
  }, [videosWithNotes, selectedVideo]);
  
  // סנכרון ידני עם הענן
  const handleSyncClick = useCallback(() => {
    syncAll();
  }, [syncAll]);
  
  // מחיקת הערה
  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק הערה זו?')) {
      await deleteNote(noteId);
    }
  }, [deleteNote]);
  
  // פתיחת סרטון בחלון חדש
  const openVideoInNewTab = useCallback((videoURL: string) => {
    window.open(videoURL, '_blank');
  }, []);
  
  // סינון הערות לסרטון הנבחר
  const selectedVideoNotes = selectedVideo 
    ? videosWithNotes.find(video => video.videoId === selectedVideo)?.notes || []
    : [];
  
  return (
    <div className={`
      w-full h-full p-4 flex flex-col
      ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
    `}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">הערות וסיכומים</h1>
        
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <div className="flex items-center">
              <Spinner className="mr-2 h-4 w-4" />
              <span className="text-sm">מסנכרן...</span>
            </div>
          ) : (
            <>
              {lastSyncTime && (
                <span className="text-sm text-gray-500">
                  סונכרן לאחרונה: {formatDate(lastSyncTime)}
                </span>
              )}
              <Button 
                size="sm"
                onClick={handleSyncClick}
                disabled={isSyncing}
              >
                סנכרן עכשיו
              </Button>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className={`
          mb-4 p-3 border-l-4 border-red-500 bg-red-50 text-red-700
          ${isDarkMode ? 'bg-red-900 text-red-200' : ''}
        `}>
          <p>שגיאה בסנכרון: {error}</p>
        </div>
      )}
      
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* רשימת סרטונים */}
        <div className={`
          w-1/4 overflow-y-auto p-3 rounded
          ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}
        `}>
          <h2 className="text-lg font-medium mb-3">סרטונים</h2>
          
          {videosWithNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>אין סרטונים עם הערות</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleSyncClick}
              >
                סנכרן מהענן
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {videosWithNotes.map(video => (
                <li 
                  key={video.videoId}
                  className={`
                    p-2 rounded cursor-pointer transition-colors
                    ${selectedVideo === video.videoId 
                      ? isDarkMode 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-100 text-blue-800'
                      : isDarkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-200'
                    }
                  `}
                  onClick={() => setSelectedVideo(video.videoId)}
                >
                  <h3 className="font-medium truncate" title={video.videoTitle}>
                    {video.videoTitle || 'סרטון ללא כותרת'}
                  </h3>
                  <div className="text-xs mt-1 flex justify-between">
                    <span>{video.notes.length} הערות</span>
                    <span>{formatDate(video.lastUpdated)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* הערות לסרטון נבחר */}
        <div className={`
          flex-1 overflow-hidden flex flex-col
        `}>
          {selectedVideo ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium">
                  {videosWithNotes.find(v => v.videoId === selectedVideo)?.videoTitle || 'סרטון ללא כותרת'}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const video = videosWithNotes.find(v => v.videoId === selectedVideo);
                    if (video) {
                      openVideoInNewTab(video.videoURL);
                    }
                  }}
                >
                  פתח בYouTube
                </Button>
              </div>
              
              <div className={`
                flex-1 overflow-y-auto p-3 rounded
                ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}
              `}>
                {selectedVideoNotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>אין הערות לסרטון זה</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {selectedVideoNotes.map(note => (
                      <li 
                        key={note.id}
                        className={`
                          p-3 rounded relative
                          ${isDarkMode ? 'bg-gray-700' : 'bg-white border border-gray-200'}
                        `}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center">
                            {note.videoTime !== undefined && (
                              <span className={`
                                inline-block px-2 py-0.5 rounded text-xs mr-2
                                ${isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}
                              `}>
                                {formatTime(note.videoTime)}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {formatDate(note.timestamp)}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleDeleteNote(note.id)}
                            className={`
                              p-1 rounded-full text-gray-500 hover:text-red-500
                              ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}
                            `}
                            title="מחק הערה"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap">
                          {note.content}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">בחר סרטון כדי לראות את ההערות שלו</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// עזר: פורמט זמן בסרטון
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
} 