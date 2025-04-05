import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NotesPanelProps } from '../types';
import { useStore } from '@/hooks/useStore';
import { formatDate } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';

/**
 * פאנל הערות על גבי סרטון
 */
export function NotesPanel({
  videoId,
  videoTitle,
  currentTime,
  isVisible,
  onClose,
}: NotesPanelProps) {
  const {
    notes,
    videosWithNotes,
    isSyncing,
    error,
    syncAll,
    saveNote,
    deleteNote
  } = useStore({ videoId });

  // שמירה של ההערה האחרונה שניווטנו אליה
  const [lastHighlightedNoteId, setLastHighlightedNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // התנהגות כאשר הזמן הנוכחי משתנה
  useEffect(() => {
    if (currentTime !== undefined) {
      const currentNotes = notes.filter(note => {
        if (note.videoTime === undefined) return false;
        return Math.abs(note.videoTime - currentTime) < 0.5;
      });

      if (currentNotes.length > 0) {
        setLastHighlightedNoteId(currentNotes[0].id);
      } else {
        setLastHighlightedNoteId(null);
      }
    }
  }, [currentTime, notes]);

  // התחלת טעינה
  useEffect(() => {
    setIsLoading(true);
    // כאשר יש הערות, סימן שהטעינה הסתיימה
    if (notes.length > 0 || videosWithNotes.length > 0) {
      setIsLoading(false);
    }
  }, [notes.length, videosWithNotes.length]);

  // תזכורת פונקציות עזר עבור פעולות על ההערות
  const handleDeleteNote = (noteId: string) => {
    if (window.confirm('האם למחוק הערה זו?')) {
      deleteNote(noteId);
    }
  };
  
  // סנכרון ידני עם השרת
  const handleSync = useCallback(() => {
    syncAll();
  }, [syncAll]);
  
  // הוספת הערה חדשה
  const handleAddNote = useCallback(() => {
    if (newNote.trim() && videoId) {
      saveNote({
        content: newNote,
        videoId,
        videoTime: currentTime,
      });
      setNewNote('');
    }
  }, [newNote, videoId, currentTime, saveNote]);
  
  // מקשיד להוספת הערה בלחיצה על אנטר
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  }, [handleAddNote]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white shadow-lg flex flex-col z-50">
      <div className="flex justify-between items-center p-2 border-b">
        <h3 className="font-bold">{videoTitle || 'הערות'}</h3>
        
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <div className="flex items-center text-xs">
              <Spinner className="mr-1 h-4 w-4" />
              <span>מסנכרן...</span>
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleSync}
              className="text-xs py-0.5 px-2"
            >
              סנכרן
            </Button>
          )}
          
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="סגור"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center p-4">
              <p className="text-red-500">שגיאה בטעינת הערות</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={syncAll}
                className="mt-2"
              >
                נסה שוב
              </Button>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            אין הערות לסרטון זה
          </div>
        ) : (
          <ul className="space-y-2">
            {notes.map(note => (
              <li 
                key={note.id}
                className={cn(
                  "p-3 rounded-lg relative transition-colors border",
                  lastHighlightedNoteId === note.id ? "bg-blue-50 border-blue-200" : "border-gray-200"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center">
                    {note.videoTime !== undefined && (
                      <button
                        onClick={() => {
                          // ניווט לנקודה בסרטון - יש להגדיר בפרופס
                          const event = new CustomEvent('jump-to-time', { detail: { time: note.videoTime } });
                          window.dispatchEvent(event);
                        }}
                        className="flex items-center bg-transparent border-none rounded text-xs font-medium px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 mr-2"
                      >
                        <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        {note.formattedTime}
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDate(note.timestamp)}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 rounded-full bg-transparent border-none opacity-50 hover:opacity-100 hover:bg-gray-100"
                    title="מחק הערה"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                    </svg>
                  </button>
                </div>
                <div className="mt-1 text-sm">
                  {note.content}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t p-2">
        <div className="flex gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="הוסף הערה..."
            className="flex-1 p-2 border rounded resize-none min-h-[60px]"
          />
          <Button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="self-end"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
} 