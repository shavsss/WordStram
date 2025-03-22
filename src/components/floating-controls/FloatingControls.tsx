import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiAssistant } from '../smart-assistant/GeminiAssistant';
import { NotesPanel } from '../video-notes/NotesPanel';
import { cn } from '@/utils';

interface FloatingControlsProps {
  videoId: string;
  videoTitle: string;
  currentTime?: number;
  videoDuration?: number;
  initialShowGemini?: boolean;
  initialShowNotes?: boolean;
  persistVisibility?: boolean;
}

/**
 * Floating controls for video learning features
 */
export function FloatingControls({
  videoId,
  videoTitle,
  currentTime,
  videoDuration,
  initialShowGemini = false,
  initialShowNotes = false,
  persistVisibility = false
}: FloatingControlsProps) {
  // State for panels visibility
  const [showGemini, setShowGemini] = useState<boolean>(initialShowGemini);
  const [showNotes, setShowNotes] = useState<boolean>(initialShowNotes);
  
  // Create a ref for video player communication
  const playerRef = useRef<HTMLDivElement>(null);
  
  // Log when component mounts
  useEffect(() => {
    console.log('WordStream: FloatingControls mounted', {
      videoId,
      initialShowGemini,
      initialShowNotes,
      persistVisibility
    });
    
    return () => {
      console.log('WordStream: FloatingControls unmounting');
    };
  }, [videoId, initialShowGemini, initialShowNotes, persistVisibility]);
  
  // Update panel visibility when props change
  useEffect(() => {
    if (initialShowGemini !== showGemini) {
      console.log('WordStream: Updating Gemini visibility from prop', initialShowGemini);
      setShowGemini(initialShowGemini);
    }
    
    if (initialShowNotes !== showNotes) {
      console.log('WordStream: Updating Notes visibility from prop', initialShowNotes);
      setShowNotes(initialShowNotes);
    }
  }, [initialShowGemini, initialShowNotes]);
  
  // Force panels to stay open when persistVisibility is true
  useEffect(() => {
    if (persistVisibility) {
      console.log('WordStream: Forcing panels to stay open with persistVisibility=true');
      
      // This is a crucial effect to ensure panels don't auto-close
      // We need to prevent any code that might be closing the panels from outside
      const interval = setInterval(() => {
        if (initialShowGemini && !showGemini) {
          console.log('WordStream: Re-opening Gemini panel that was closed unexpectedly');
          setShowGemini(true);
        }
        if (initialShowNotes && !showNotes) {
          console.log('WordStream: Re-opening Notes panel that was closed unexpectedly');
          setShowNotes(true);
        }
      }, 300);
      
      return () => clearInterval(interval);
    }
  }, [persistVisibility, initialShowGemini, initialShowNotes, showGemini, showNotes]);
  
  // Handle panel close 
  const handleGeminiClose = useCallback(() => {
    console.log('WordStream: GeminiAssistant visibility changed to hidden');
    if (!persistVisibility) {
      setShowGemini(false);
    }
  }, [persistVisibility]);
  
  const handleNotesClose = useCallback(() => {
    console.log('WordStream: NotesPanel visibility changed to hidden');
    if (!persistVisibility) {
      setShowNotes(false);
    }
  }, [persistVisibility]);
  
  // Debug visibility
  useEffect(() => {
    console.log('WordStream: After render check for element', {
      geminiVisible: showGemini,
      notesVisible: showNotes
    });
  }, [showGemini, showNotes]);
  
  return (
    <div ref={playerRef} className="wordstream-floating-controls">
      <GeminiAssistant 
        videoId={videoId} 
        videoTitle={videoTitle} 
        isVisible={showGemini} 
        onClose={handleGeminiClose} 
      />
      
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