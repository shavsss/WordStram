import React, { useRef, useEffect } from 'react';
import { NotesPanelProps, SIZES } from '@/types/video-notes';
import { useVideoNotes } from '@/hooks/useVideoNotes';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { NoteItem } from './NoteItem';
import { useAuth } from '@/hooks/useAuth';

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
  // Authentication check
  const { isAuthenticated } = useAuth();
  
  // Use custom hooks
  const {
    notes,
    currentNote,
    setCurrentNote,
    isSaving,
    loadNotes,
    saveNote,
    deleteNote,
    handleJumpToTime,
    formatVideoTime,
    setCurrentVideoTime
  } = useVideoNotes({ videoId, currentTime });
  
  const {
    sizeOption,
    position,
    isDarkMode,
    handleMouseDown,
    handleSizeChange,
    toggleDarkMode
  } = useDraggablePanel();
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  
  // Get current size based on selected option
  const currentSize = SIZES[sizeOption];
  
  // Load notes when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      loadNotes();
      
      // Check if the panel is rendered in the content script
      console.log('WordStream: Notes panel is visible, loading notes');
      
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
      
      // Clean up the interval when the panel is hidden or unmounted
      return () => {
        clearInterval(timeInterval);
      };
    }
  }, [isVisible, loadNotes]);
  
  // Visibility logging
  useEffect(() => {
    console.log('WordStream: NotesPanel visibility changed to', isVisible ? 'visible' : 'hidden');
    if (isVisible) {
      console.log('WordStream: NotesPanel position:', position);
    }
  }, [isVisible, position]);
  
  if (!isVisible) return null;
  
  const handleSaveNote = async () => {
    if (!currentNote.trim() || isSaving) return;
    
    try {
      // Use the saveNote function from the hook with no arguments
      await saveNote();
      console.log('WordStream: Note saved successfully');
      
      // Force reload of notes to get the latest from Firestore
      loadNotes();
    } catch (error) {
      console.error('WordStream: Error saving note', error);
    }
  };
  
  const handleDeleteNote = async (noteId: string) => {
    try {
      console.log('WordStream: Deleting note', noteId);
      
      // Use the deleteNote function from the hook with just the ID
      await deleteNote(noteId);
      
      // Force reload of notes to get the latest from Firestore
      loadNotes();
    } catch (error) {
      console.error('WordStream: Error deleting note', error);
    }
  };
  
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
        onMouseDown={handleMouseDown}
        style={{ 
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${isDarkMode ? '#2a2a2a' : '#eeeeee'}`,
          cursor: 'move',
          userSelect: 'none',
          backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? '#ffffff' : '#333333'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span style={{ fontWeight: 600 }}>Video Notes</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Size options */}
          <div style={{ display: 'flex', marginRight: '10px' }}>
            <button 
              onClick={() => handleSizeChange('small')}
              style={{ 
                width: '16px', 
                height: '16px',
                border: `1px solid ${isDarkMode ? '#555555' : '#dddddd'}`,
                backgroundColor: sizeOption === 'small' ? (isDarkMode ? '#555555' : '#e0e0e0') : 'transparent',
                borderRadius: '2px',
                marginRight: '4px',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button 
              onClick={() => handleSizeChange('medium')}
              style={{ 
                width: '20px', 
                height: '20px',
                border: `1px solid ${isDarkMode ? '#555555' : '#dddddd'}`,
                backgroundColor: sizeOption === 'medium' ? (isDarkMode ? '#555555' : '#e0e0e0') : 'transparent',
                borderRadius: '2px',
                marginRight: '4px',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button 
              onClick={() => handleSizeChange('large')}
              style={{ 
                width: '24px', 
                height: '24px',
                border: `1px solid ${isDarkMode ? '#555555' : '#dddddd'}`,
                backgroundColor: sizeOption === 'large' ? (isDarkMode ? '#555555' : '#e0e0e0') : 'transparent',
                borderRadius: '2px',
                cursor: 'pointer',
                padding: 0
              }}
            />
          </div>
          
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '10px',
              padding: '4px'
            }}
          >
            {isDarkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? '#ffffff' : '#333333'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Title bar */}
      <div 
        style={{ 
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 600,
          color: isDarkMode ? '#e0e0e0' : '#333333',
          backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          borderBottom: `1px solid ${isDarkMode ? '#2a2a2a' : '#eeeeee'}`
        }}
      >
        {videoTitle || 'Untitled Video'}
      </div>
      
      {/* Notes list */}
      <div 
        ref={notesContainerRef}
        style={{ 
          padding: '16px', 
          flex: 1, 
          overflowY: 'auto',
          backgroundColor: isDarkMode ? '#121212' : '#ffffff'
        }}
      >
        {notes.length > 0 ? (
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onDelete={handleDeleteNote}
              onJumpToTime={handleJumpToTime}
              formatVideoTime={formatVideoTime}
              isDarkMode={isDarkMode}
            />
          ))
        ) : (
          <div 
            style={{ 
              color: isDarkMode ? '#888888' : '#999999',
              textAlign: 'center',
              marginTop: '40px',
              fontSize: '14px'
            }}
          >
            No notes for this video yet. Start typing below to add one.
          </div>
        )}
      </div>
      
      {/* Note input */}
      <div 
        style={{ 
          padding: '12px',
          borderTop: `1px solid ${isDarkMode ? '#2a2a2a' : '#eeeeee'}`,
          backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <textarea
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          placeholder="Add a note about this video..."
          style={{ 
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            borderRadius: '8px',
            border: `1px solid ${isDarkMode ? '#444444' : '#e0e0e0'}`,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#333333',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '14px',
            marginBottom: '8px',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = isDarkMode ? '#666666' : '#bbbbbb';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = isDarkMode ? '#444444' : '#e0e0e0';
          }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: isDarkMode ? '#888888' : '#777777' }}>
            {currentTime !== undefined && `Current time: ${formatVideoTime(currentTime)}`}
          </div>
          
          <button
            onClick={handleSaveNote}
            disabled={isSaving || !currentNote.trim()}
            style={{
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: currentNote.trim() ? 'pointer' : 'not-allowed',
              opacity: currentNote.trim() ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (currentNote.trim()) {
                e.currentTarget.style.backgroundColor = '#3367d6';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#4285f4';
            }}
          >
            {isSaving ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', animation: 'spin 1s linear infinite'}}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            )}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
} 