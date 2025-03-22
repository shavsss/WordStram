import React, { useState, useEffect } from 'react';
import { GeminiAssistant } from './smart-assistant/GeminiAssistant';
import { NotesPanel } from './video-notes/NotesPanel';

interface FloatingControlsProps {
  videoId: string;
  videoTitle: string;
}

/**
 * Main floating controls component that manages both the AI Chat and Notes panels
 */
export function FloatingControls({ videoId, videoTitle }: FloatingControlsProps) {
  // States
  const [isGeminiVisible, setIsGeminiVisible] = useState(false);
  const [isNotesVisible, setIsNotesVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);

  // Check if we're on YouTube
  const isYouTube = typeof window !== 'undefined' && window.location.hostname.includes('youtube.com');

  // Add controls to YouTube page
  useEffect(() => {
    if (!isYouTube) return;
    
    console.log('WordStream: Adding floating controls to YouTube');
    
    // Create container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'wordstream-controls-container';
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.left = '20px';
    controlsContainer.style.top = '50%';
    controlsContainer.style.transform = 'translateY(-50%)';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.flexDirection = 'column';
    controlsContainer.style.gap = '16px';
    controlsContainer.style.zIndex = '9999999';
    
    // Create AI button
    const geminiButton = document.createElement('button');
    geminiButton.innerHTML = `
      <div style="width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; perspective: 800px;">
        <div style="position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 16px; background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%); box-shadow: 0 10px 25px -10px rgba(59, 130, 246, 0.6), 0 4px 10px rgba(0,0,0,0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px solid rgba(255,255,255,0.85);">
            <svg style="margin-top: -2px;" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span style="font-family: 'Inter', 'Arial', sans-serif; color: white; font-size: 10px; font-weight: 700; margin-top: 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">AI CHAT</span>
          </div>
        </div>
      </div>
    `;
    geminiButton.style.background = 'transparent';
    geminiButton.style.border = 'none';
    geminiButton.style.cursor = 'pointer';
    geminiButton.style.padding = '0';
    geminiButton.style.outline = 'none';
    geminiButton.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    // Create Notes button
    const notesButton = document.createElement('button');
    notesButton.innerHTML = `
      <div style="width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; perspective: 800px;">
        <div style="position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 10px 25px -10px rgba(16, 185, 129, 0.6), 0 4px 10px rgba(0,0,0,0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px solid rgba(255,255,255,0.85);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span style="font-family: 'Inter', 'Arial', sans-serif; color: white; font-size: 11px; font-weight: 700; margin-top: 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">NOTES</span>
          </div>
        </div>
      </div>
    `;
    notesButton.style.background = 'transparent';
    notesButton.style.border = 'none';
    notesButton.style.cursor = 'pointer';
    notesButton.style.padding = '0';
    notesButton.style.outline = 'none';
    notesButton.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    // Add hover effects
    [geminiButton, notesButton].forEach(button => {
      // Mouse over effect
      button.addEventListener('mouseover', () => {
        const innerDiv = button.querySelector('div > div') as HTMLElement;
        if (innerDiv) {
          innerDiv.style.transform = 'translateZ(10px) rotateY(-5deg) rotateX(5deg)';
        }
        button.style.transform = 'scale(1.05)';
      });
      
      // Mouse out effect
      button.addEventListener('mouseout', () => {
        const innerDiv = button.querySelector('div > div') as HTMLElement;
        if (innerDiv) {
          innerDiv.style.transform = '';
        }
        button.style.transform = 'scale(1)';
      });
      
      // Mouse down effect
      button.addEventListener('mousedown', () => {
        button.style.transform = 'scale(0.95)';
      });
      
      // Mouse up effect
      button.addEventListener('mouseup', () => {
        button.style.transform = 'scale(1.05)';
      });
    });
    
    // Add click handlers
    geminiButton.addEventListener('click', () => {
      console.log('WordStream: Gemini button clicked');
      setIsGeminiVisible(prev => !prev);
      if (isNotesVisible) setIsNotesVisible(false);
    });
    
    notesButton.addEventListener('click', () => {
      console.log('WordStream: Notes button clicked');
      setIsNotesVisible(prev => !prev);
      if (isGeminiVisible) setIsGeminiVisible(false);
    });
    
    // Add buttons to container
    controlsContainer.appendChild(geminiButton);
    controlsContainer.appendChild(notesButton);
    
    // Add container to page
    document.body.appendChild(controlsContainer);
    
    // Update current video time
    const updateCurrentTime = () => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        setCurrentTime(videoElement.currentTime);
      }
    };
    
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
  }, [isYouTube]);
  
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
      {/* Gemini Assistant */}
      <GeminiAssistant
        videoId={videoId}
        videoTitle={videoTitle}
        isVisible={isGeminiVisible}
        onClose={() => setIsGeminiVisible(false)}
      />
      
      {/* Notes Panel */}
      <NotesPanel
        videoId={videoId}
        videoTitle={videoTitle}
        isVisible={isNotesVisible}
        onClose={() => setIsNotesVisible(false)}
        currentTime={currentTime}
      />
    </>
  );
} 