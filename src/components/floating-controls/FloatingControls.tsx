import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotesPanel } from '../video-notes/NotesPanel';
import { cn } from '@/utils';

interface FloatingControlsProps {
  videoId: string;
  videoTitle: string;
  currentTime?: number;
  videoDuration?: number;
  initialShowNotes?: boolean;
  persistVisibility?: boolean;
  onClose?: () => void;
}

/**
 * Floating controls for video learning features
 */
export function FloatingControls({
  videoId,
  videoTitle,
  currentTime,
  videoDuration,
  initialShowNotes = false,
  persistVisibility = false,
  onClose
}: FloatingControlsProps) {
  // State for panel visibility
  const [showNotes, setShowNotes] = useState<boolean>(initialShowNotes);
  
  // Create a ref for video player communication
  const playerRef = useRef<HTMLDivElement>(null);
  
  // Log when component mounts
  useEffect(() => {
    console.log('WordStream: FloatingControls mounted', {
      videoId,
      initialShowNotes,
      persistVisibility
    });
    
    return () => {
      console.log('WordStream: FloatingControls unmounting');
    };
  }, [videoId, initialShowNotes, persistVisibility]);
  
  // Update panel visibility when props change
  useEffect(() => {
    if (initialShowNotes !== showNotes) {
      console.log('WordStream: Updating Notes visibility from prop', initialShowNotes);
      setShowNotes(initialShowNotes);
    }
  }, [initialShowNotes]);
  
  // Force panels to stay open when persistVisibility is true
  useEffect(() => {
    if (persistVisibility) {
      console.log('WordStream: Forcing panel to stay open with persistVisibility=true');
      
      // This is a crucial effect to ensure panel doesn't auto-close
      // We need to prevent any code that might be closing the panel from outside
      const interval = setInterval(() => {
        if (initialShowNotes && !showNotes) {
          console.log('WordStream: Re-opening Notes panel that was closed unexpectedly');
          setShowNotes(true);
        }
      }, 300);
      
      return () => clearInterval(interval);
    }
  }, [persistVisibility, initialShowNotes, showNotes]);
  
  // Handle panel close 
  const handleNotesClose = useCallback(() => {
    console.log('WordStream: NotesPanel visibility changed to hidden');
    if (!persistVisibility) {
      setShowNotes(false);
    }
    if (onClose) {
      onClose();
    }
  }, [persistVisibility, onClose]);
  
  // Debug visibility
  useEffect(() => {
    console.log('WordStream: After render check for element', {
      notesVisible: showNotes
    });
  }, [showNotes]);
  
  return (
    <div ref={playerRef} className="wordstream-floating-controls">      
      <NotesPanel 
        videoId={videoId} 
        videoTitle={videoTitle} 
        isVisible={showNotes} 
        onClose={handleNotesClose} 
        currentTime={currentTime}
      />
    </div>
  );
} 