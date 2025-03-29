import React, { useState, useEffect } from 'react';
import { NotesPanel } from './video-notes/NotesPanel';
import { FloatingButton } from './floating-controls/FloatingButton';
import { AuthPanel } from './auth/AuthPanel';
import { getCurrentTime, addTimeUpdateListener } from '@/services/video-service';
import { useAuth } from '@/hooks/useAuth';

interface FloatingControlsProps {
  videoId: string;
  videoTitle: string;
}

/**
 * Main floating controls component that manages Notes panel
 */
export function FloatingControls({ videoId, videoTitle }: FloatingControlsProps) {
  // States
  const [isNotesVisible, setIsNotesVisible] = useState(false);
  const [isAuthVisible, setIsAuthVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);
  
  // Auth state
  const { isAuthenticated, user } = useAuth();

  // Check if we're on YouTube
  const isYouTube = typeof window !== 'undefined' && window.location.hostname.includes('youtube.com');

  // Automatically show auth panel if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setIsAuthVisible(true);
    }
  }, [isAuthenticated]);

  // Add controls to YouTube page
  useEffect(() => {
    if (!isYouTube) return;
    
    console.log('WordStream: Adding floating controls to YouTube');
    
    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'wordstream-controls-container fixed left-5 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[9999999]';
    document.body.appendChild(controlsContainer);
    
    // Create Root for React to render into
    const root = document.createElement('div');
    root.id = 'wordstream-floating-controls-root';
    controlsContainer.appendChild(root);
    
    // Render the buttons using React
    const renderButtons = () => {
      // If not authenticated, hide all buttons except sign in
      if (!isAuthenticated) {
        const authIcon = (
          <svg 
            className="w-7 h-7 stroke-white" 
            viewBox="0 0 24 24" 
            fill="none" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        );
        
        const handleAuthClick = () => {
          console.log('WordStream: Auth button clicked');
          setIsAuthVisible(true);
        };
        
        // Only show auth button if not authenticated
        const ReactDOM = require('react-dom');
        ReactDOM.render(
          <div className="flex flex-col gap-4">
            <FloatingButton 
              onClick={handleAuthClick} 
              icon={authIcon} 
              label="SIGN IN" 
            />
          </div>,
          root
        );
        return;
      }
      
      // Regular buttons for authenticated users
      // Notes button
      const notesIcon = (
        <svg 
          className="w-7 h-7 stroke-white" 
          viewBox="0 0 24 24" 
          fill="none" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
      
      // Add Sign Out button icon
      const signOutIcon = (
        <svg 
          className="w-7 h-7 stroke-white" 
          viewBox="0 0 24 24" 
          fill="none" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      );
      
      // Toggle notes panel
      const toggleNotes = () => {
        setIsNotesVisible(!isNotesVisible);
      };
      
      // Handle sign out
      const handleSignOut = async () => {
        try {
          console.log('WordStream: Signing out user');
          const { auth } = await import('@/firebase/config');
          await auth.signOut();
          console.log('WordStream: User signed out successfully');
        } catch (error) {
          console.error('WordStream: Error signing out', error);
        }
      };
      
      // Render buttons with React
      const ReactDOM = require('react-dom');
      ReactDOM.render(
        <div className="flex flex-col gap-4">
          <FloatingButton 
            onClick={toggleNotes} 
            icon={notesIcon} 
            label="NOTES" 
          />
          <FloatingButton 
            onClick={handleSignOut} 
            icon={signOutIcon} 
            label="SIGN OUT" 
          />
        </div>,
        root
      );
    };
    
    renderButtons();
    
    // Set up time tracking using the video service, but only if authenticated
    if (isAuthenticated) {
      const updateCurrentTime = () => {
        setCurrentTime(getCurrentTime());
      };
      
      // Initial update
      updateCurrentTime();
      
      // Set up interval to track current video time
      const timeInterval = setInterval(updateCurrentTime, 1000);
      
      // Clean up
      return () => {
        console.log('WordStream: Cleaning up floating controls');
        clearInterval(timeInterval);
        if (document.body.contains(controlsContainer)) {
          document.body.removeChild(controlsContainer);
        }
      };
    } else {
      // Clean up for unauthenticated
      return () => {
        console.log('WordStream: Cleaning up floating controls');
        if (document.body.contains(controlsContainer)) {
          document.body.removeChild(controlsContainer);
        }
      };
    }
  }, [isYouTube, isAuthenticated]);
  
  // Log component mounting
  useEffect(() => {
    console.log('WordStream: FloatingControls mounted');
    return () => {
      console.log('WordStream: FloatingControls unmounted');
    };
  }, []);
  
  // Don't render controls if not on YouTube
  if (!isYouTube) {
    console.log('WordStream: Not on YouTube, not displaying controls');
    return null;
  }
  
  return (
    <>
      {/* Notes Panel - only show if authenticated */}
      {isAuthenticated && (
        <NotesPanel
          videoId={videoId}
          videoTitle={videoTitle}
          isVisible={isNotesVisible}
          onClose={() => setIsNotesVisible(false)}
          currentTime={currentTime}
        />
      )}
      
      {/* Auth Panel - always show if not authenticated */}
      <AuthPanel
        isVisible={!isAuthenticated || isAuthVisible}
        onClose={() => {
          // Only allow closing if authenticated
          if (isAuthenticated) {
            setIsAuthVisible(false);
          }
        }}
      />
    </>
  );
} 