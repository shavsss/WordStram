import React, { memo } from 'react';
import { NoteItemProps } from '../types';
import { cn } from '@/lib/utils';

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
      className={cn(
        "note-item p-3 rounded-lg relative transition-colors",
        isDarkMode ? "bg-gray-800" : "bg-gray-100"
      )}
    >
      <div className="flex justify-between items-start mb-1">
        <div className={cn(
          "text-xs",
          isDarkMode ? "text-gray-400" : "text-gray-600"
        )}>
          {formattedDate}
        </div>
        
        {hasVideoTime && (
          <button
            onClick={() => onJumpToTime(note.videoTime)}
            className={cn(
              "flex items-center bg-transparent border-none rounded text-xs font-medium px-1.5 py-0.5",
              isDarkMode ? "text-emerald-400 hover:bg-gray-700" : "text-emerald-700 hover:bg-gray-200"
            )}
            aria-label={`Jump to ${formatVideoTime(note.videoTime)}`}
          >
            <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {formatVideoTime(note.videoTime)}
          </button>
        )}
      </div>
      
      <div 
        className={cn(
          "whitespace-pre-wrap break-words leading-normal text-sm",
          isDarkMode ? "text-white" : "text-gray-900"
        )}
      >
        {note.content}
      </div>
      
      <button
        onClick={() => onDelete(note.id)}
        className={cn(
          "absolute top-3 right-2 p-1 rounded-full bg-transparent border-none opacity-50 transition-all",
          "flex items-center justify-center hover:opacity-100",
          isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-200 text-gray-600"
        )}
        aria-label="Delete note"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}); 