import React, { memo } from 'react';
import { NoteItemProps } from '@/types/video-notes';

/**
 * Component for displaying a single note item
 */
export const NoteItem = memo(function NoteItem({
  note,
  onDelete,
  onJumpToTime,
  formatVideoTime,
  isDarkMode
}: NoteItemProps) {
  const formattedDate = new Date(note.timestamp).toLocaleString();
  const hasVideoTime = typeof note.videoTime === 'number';
  
  return (
    <div 
      className="note-item"
      style={{
        padding: '12px',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '10px',
        position: 'relative',
        transition: 'background-color 0.2s'
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}
      >
        <div style={{ fontSize: '11px', color: isDarkMode ? '#aaaaaa' : '#666666' }}>
          {formattedDate}
        </div>
        
        {hasVideoTime && (
          <button
            onClick={() => onJumpToTime(note.videoTime)}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              color: isDarkMode ? '#4caf50' : '#2e7d32',
              cursor: 'pointer',
              padding: '3px 6px',
              fontSize: '11px',
              borderRadius: '4px',
              marginLeft: '8px',
              fontWeight: 'bold'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {formatVideoTime(note.videoTime)}
          </button>
        )}
      </div>
      
      <div 
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: isDarkMode ? '#ffffff' : '#121212',
          lineHeight: '1.5',
          fontSize: '14px'
        }}
      >
        {note.content}
      </div>
      
      <button
        onClick={() => onDelete(note.id)}
        style={{
          position: 'absolute',
          top: '12px',
          right: '6px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          opacity: 0.5,
          transition: 'opacity 0.2s',
          borderRadius: '50%',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = isDarkMode ? '#333333' : '#eeeeee';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = '0.5';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? '#bbbbbb' : '#666666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}); 