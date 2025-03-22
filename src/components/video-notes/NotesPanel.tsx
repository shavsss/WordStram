import React, { useState, useRef, useEffect } from 'react';

interface Note {
  id: string;
  content: string;
  timestamp: string; // ISO date string
  videoTime?: number; // Time in the video (seconds)
}

interface NotesPanelProps {
  videoId: string;
  videoTitle: string;
  isVisible: boolean;
  onClose: () => void;
  currentTime?: number; // Current video time in seconds
}

// Predefined sizes for the popup
type SizeOption = 'small' | 'medium' | 'large';
interface SizeConfig {
  width: number;
  height: number;
}

const SIZES: Record<SizeOption, SizeConfig> = {
  small: { width: 320, height: 400 },
  medium: { width: 400, height: 550 },
  large: { width: 500, height: 700 }
};

/**
 * Video Notes panel component for saving and viewing notes about video content
 */
export function NotesPanel({
  videoId,
  videoTitle,
  isVisible,
  onClose,
  currentTime
}: NotesPanelProps) {
  // States
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Size and position state
  const [sizeOption, setSizeOption] = useState<SizeOption>('medium');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
  // Get current size based on selected option
  const currentSize = SIZES[sizeOption];
  
  // Load saved notes for this video
  useEffect(() => {
    const loadNotes = async () => {
      if (!videoId) return;
      
      try {
        console.log('WordStream: Loading notes for video', videoId);
        chrome.storage.local.get([`notes-${videoId}`], (result) => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Error loading notes:', chrome.runtime.lastError);
            return;
          }
          
          if (result[`notes-${videoId}`]) {
            console.log('WordStream: Found saved notes with', result[`notes-${videoId}`].length, 'items');
            
            try {
              // Validate note data before setting
              const validatedNotes = result[`notes-${videoId}`].map((note: Note) => {
                console.log('WordStream: Note data:', note);
                return {
                  id: note.id || Date.now().toString(),
                  content: note.content || 'No content',
                  timestamp: note.timestamp || new Date().toISOString(),
                  videoTime: note.videoTime
                };
              });
              
              setNotes(validatedNotes);
            } catch (parseError) {
              console.error('WordStream: Error parsing note data:', parseError);
              setNotes([]);
            }
          } else {
            console.log('WordStream: No saved notes found for this video');
          }
        });
      } catch (error) {
        console.error('WordStream: Failed to load notes:', error);
      }
    };
    
    if (isVisible && videoId) {
      loadNotes();
    }
  }, [isVisible, videoId]);
  
  // Visibility logging
  useEffect(() => {
    console.log('WordStream: NotesPanel visibility changed to', isVisible ? 'visible' : 'hidden');
    if (isVisible) {
      console.log('WordStream: NotesPanel position:', position);
    }
  }, [isVisible, position]);
  
  // Save note to Chrome storage
  const saveNote = async () => {
    if (!currentNote.trim() || isSaving) return;
    
    setIsSaving(true);
    console.log('WordStream: Saving new note for video', videoId);
    
    try {
      const newNote: Note = {
        id: Date.now().toString(),
        content: currentNote.trim(),
        timestamp: new Date().toISOString(),
        videoTime: currentTime
      };
      
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      setCurrentNote('');
      
      // Save to Chrome storage
      chrome.storage.local.set({
        [`notes-${videoId}`]: updatedNotes
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error saving notes:', chrome.runtime.lastError);
        } else {
          console.log('WordStream: Note saved successfully');
        }
      });
    } catch (error) {
      console.error('WordStream: Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Delete note
  const deleteNote = (noteId: string) => {
    console.log('WordStream: Deleting note', noteId);
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    
    // Save to Chrome storage
    chrome.storage.local.set({
      [`notes-${videoId}`]: updatedNotes
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error deleting note:', chrome.runtime.lastError);
      } else {
        console.log('WordStream: Note deleted successfully');
      }
    });
  };
  
  // Jump to video time when clicking on note with videoTime
  const handleJumpToTime = (time?: number) => {
    if (typeof time !== 'number') return;
    
    console.log('WordStream: Jumping to video time', time);
    
    // Find the video element and set its currentTime
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = time;
      videoElement.play().catch(() => {
        // Autoplay might be blocked
        console.log('WordStream: Could not play video automatically');
      });
    }
  };
  
  // Format video time from seconds to MM:SS
  const formatVideoTime = (seconds?: number) => {
    if (seconds === undefined) return '';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format ISO date string to readable date
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'No date';
    
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      // Check if the date is today
      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                     date.getMonth() === today.getMonth() &&
                     date.getFullYear() === today.getFullYear();
      
      if (isToday) {
        // For today, just show the time
        return date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        // For other dates, show the date and time
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('WordStream: Error formatting date:', error, isoString);
      return 'Invalid date';
    }
  };
  
  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('textarea')) return;
    
    if (!(e.target as HTMLElement).closest('.header')) return;
    
    setIsDragging(true);
    dragStartPos.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    };
    
    e.preventDefault();
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Handle size change
  const handleSizeChange = (size: SizeOption) => {
    setSizeOption(size);
  };
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };
  
  if (!isVisible) return null;
  
  return (
    <div 
      ref={containerRef}
      className={isDarkMode ? 'dark' : 'light'}
      style={{ 
        position: 'fixed',
        width: `${currentSize.width}px`,
        height: `${currentSize.height}px`,
        top: `${position.y}px`, 
        left: `${position.x}px`,
        zIndex: 9999999,
        backgroundColor: isDarkMode ? '#121212' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'rgba(0, 0, 0, 0.25) 0px 4px 12px',
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
        fontSize: '14px',
        color: isDarkMode ? '#ffffff' : '#121212'
      }}
    >
      {/* Header */}
      <div 
        className="header"
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
          cursor: 'move'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ fontSize: '16px', fontWeight: 600 }}>Notes & Summary</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Size options */}
          <div style={{ 
            display: 'flex', 
            border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
            borderRadius: '4px', 
            overflow: 'hidden' 
          }}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                style={{
                  padding: '4px 8px',
                  backgroundColor: sizeOption === size 
                    ? (isDarkMode ? '#10B981' : '#10B981') 
                    : (isDarkMode ? '#333' : '#f0f0f0'),
                  color: sizeOption === size 
                    ? 'white' 
                    : (isDarkMode ? '#ccc' : '#333'),
                  border: 'none',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSizeChange(size);
                }}
              >
                {size.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          
          {/* Dark mode toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDarkMode();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#ffffff' : '#000000',
              transition: 'all 0.2s ease',
              width: '32px',
              height: '32px'
            }}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {/* Close button */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              color: isDarkMode ? '#ffffff' : '#121212',
              width: '24px',
              height: '24px'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Notes list */}
      <div 
        ref={notesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px', 
          backgroundColor: isDarkMode ? '#121212' : '#ffffff'
        }}
      >
        {notes.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            textAlign: 'center',
            backgroundColor: isDarkMode ? '#121212' : '#f8fafc'
          }}>
            <div style={{ 
              marginBottom: '16px', 
              color: isDarkMode ? '#34d399' : '#10b981',
              background: isDarkMode ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              borderRadius: '50%',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3 style={{ 
              marginBottom: '8px', 
              color: isDarkMode ? '#ffffff' : '#050505',
              fontWeight: 600
            }}>
              Take notes while watching
            </h3>
            <p style={{ 
              color: isDarkMode ? '#cccccc' : '#666666', 
              marginBottom: '24px', 
              maxWidth: '280px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Add your notes below to capture important moments
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  border: `1px solid ${isDarkMode ? '#3f3f46' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{
                  padding: '8px 12px',
                  borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e0e0e0'}`,
                  backgroundColor: isDarkMode ? '#27272a' : '#f5f5f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isDarkMode ? '#d4d4d8' : '#4b5563'
                  }}>
                    <svg style={{ 
                      width: '14px', 
                      height: '14px', 
                      marginRight: '6px',
                      color: isDarkMode ? '#34d399' : '#10b981'
                    }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span title={formatDate(note.timestamp)}>
                      {note.videoTime !== undefined ? formatVideoTime(note.videoTime) : 'No timestamp'}
                    </span>
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '10px', 
                      opacity: 0.7,
                      color: isDarkMode ? '#a1a1aa' : '#71717a'
                    }}>
                      {formatDate(note.timestamp)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {note.videoTime !== undefined && (
                      <button
                        onClick={() => handleJumpToTime(note.videoTime)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          backgroundColor: isDarkMode ? '#3f3f46' : '#e0e0e0',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: isDarkMode ? '#d4d4d8' : '#4b5563',
                          transition: 'all 0.2s ease',
                          fontWeight: 500
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Jump
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNote(note.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div style={{ 
                  padding: '12px',
                  whiteSpace: 'pre-line',
                  color: isDarkMode ? '#f1f5f9' : '#374151',
                  backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
                  lineHeight: '1.5'
                }}>
                  {note.content || 'No content'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Input area - fixed to bottom */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${isDarkMode ? '#333333' : '#e0e0e0'}`,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
        position: 'relative'
      }}>
        <div style={{ 
          marginBottom: '8px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center' 
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: isDarkMode ? '#aaaaaa' : '#666666',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Current time: {currentTime !== undefined ? formatVideoTime(currentTime) : '--:--'}
          </div>
          
          <button
            onClick={() => currentTime !== undefined && setCurrentNote(curr => 
              curr + (curr ? '\n' : '') + `[${formatVideoTime(currentTime)}] `
            )}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: currentTime !== undefined 
                ? (isDarkMode ? '#2d2d2d' : '#f0f0f0')
                : (isDarkMode ? '#444' : '#ddd'),
              color: currentTime !== undefined 
                ? (isDarkMode ? '#aaaaaa' : '#666666')
                : (isDarkMode ? '#888' : '#aaa'),
              cursor: currentTime !== undefined ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
            disabled={currentTime === undefined}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v10l5 5"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Add timestamp
          </button>
        </div>
        
        <form 
          onSubmit={(e) => { e.preventDefault(); saveNote(); }} 
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <textarea
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Write your note about this video..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
              borderRadius: '8px',
              resize: 'none',
              minHeight: '80px',
              backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#121212',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
            rows={3}
          />
          <button
            type="submit"
            disabled={isSaving || !currentNote.trim()}
            style={{
              alignSelf: 'flex-end',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: isSaving || !currentNote.trim() 
                ? (isDarkMode ? '#444' : '#ddd')
                : '#10B981',
              color: isSaving || !currentNote.trim() 
                ? (isDarkMode ? '#888' : '#aaa')
                : 'white',
              border: 'none',
              cursor: isSaving || !currentNote.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {isSaving ? 'Saving...' : 'Save Note'}
          </button>
        </form>
      </div>
    </div>
  );
} 