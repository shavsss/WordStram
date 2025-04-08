import { useState, useEffect, useCallback, useRef } from 'react';
import { formatVideoTime, jumpToTime, getCurrentVideoId, getCurrentTime, addTimeUpdateListener } from '@/services/video-service';
import type { WordStreamGlobal } from '@/types/global';

interface VideoState {
  currentTime: number;
  duration: number;
  videoId: string | undefined;
  videoTitle: string | undefined;
  isPlaying: boolean;
}

/**
 * Hook for interacting with the current video
 * Integrates with the global WordStream object to access and control video playback
 */
export function useVideo() {
  // Video state
  const [videoState, setVideoState] = useState<VideoState>({
    currentTime: 0,
    duration: 0,
    videoId: undefined,
    videoTitle: undefined,
    isPlaying: false
  });
  
  // Store cleanup function for time update listener
  const timeUpdateCleanupRef = useRef<(() => void) | null>(null);
  
  // Initialize from global WordStream object
  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;
    
    // Check if WordStream global is available
    const wordStream = window.WordStream as WordStreamGlobal | undefined;
    
    if (wordStream) {
      const initialVideoId = wordStream.videoId;
      const initialTitle = wordStream.videoTitle;
      const initialDuration = wordStream.videoDuration || 0;
      
      // Update state with initial values
      setVideoState(prev => ({
        ...prev,
        videoId: initialVideoId,
        videoTitle: initialTitle,
        duration: initialDuration
      }));
      
      // Try to get current time
      if (typeof wordStream.getCurrentTime === 'function') {
        const time = wordStream.getCurrentTime();
        if (typeof time === 'number') {
          setVideoState(prev => ({
            ...prev,
            currentTime: time
          }));
        }
      }
    } else {
      // Fall back to service functions if WordStream is not available
      const videoId = getCurrentVideoId();
      if (videoId) {
        setVideoState(prev => ({
          ...prev,
          videoId
        }));
      }
      
      // Get page title as fallback for video title
      if (typeof document !== 'undefined') {
        const pageTitle = document.title;
        setVideoState(prev => ({
          ...prev,
          videoTitle: pageTitle
        }));
      }
    }
  }, []);
  
  // Set up time update listener
  useEffect(() => {
    // Clean up previous listener if it exists
    if (timeUpdateCleanupRef.current) {
      timeUpdateCleanupRef.current();
      timeUpdateCleanupRef.current = null;
    }
    
    // Set up new listener
    const cleanup = addTimeUpdateListener((time) => {
      setVideoState(prev => ({
        ...prev,
        currentTime: time
      }));
    });
    
    timeUpdateCleanupRef.current = cleanup;
    
    // Clean up on unmount
    return () => {
      if (timeUpdateCleanupRef.current) {
        timeUpdateCleanupRef.current();
      }
    };
  }, [videoState.videoId]);
  
  // Jump to specific time in the video
  const seekTo = useCallback((timeInSeconds: number) => {
    if (typeof window === 'undefined') return;
    
    // Use global WordStream object if available
    const wordStream = window.WordStream as WordStreamGlobal | undefined;
    
    if (wordStream && typeof wordStream.jumpToTime === 'function') {
      wordStream.jumpToTime(timeInSeconds);
    } else {
      // Fall back to service function
      jumpToTime(timeInSeconds);
    }
    
    // Update local state
    setVideoState(prev => ({
      ...prev,
      currentTime: timeInSeconds
    }));
  }, []);
  
  // Get current video time
  const getVideoTime = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    
    // Use global WordStream object if available
    const wordStream = window.WordStream as WordStreamGlobal | undefined;
    
    if (wordStream && typeof wordStream.getCurrentTime === 'function') {
      const time = wordStream.getCurrentTime();
      if (typeof time === 'number') {
        return time;
      }
    }
    
    // Fall back to service function
    const time = getCurrentTime();
    return typeof time === 'number' ? time : 0;
  }, []);
  
  // Format time for display
  const formatTime = useCallback((seconds?: number): string => {
    return formatVideoTime(seconds);
  }, []);
  
  return {
    ...videoState,
    seekTo,
    getVideoTime,
    formatTime
  };
} 