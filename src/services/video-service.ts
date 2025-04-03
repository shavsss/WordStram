/**
 * Service for video related operations
 */

/**
 * Format video time in HH:MM:SS or MM:SS format
 * @param seconds - The time in seconds
 * @returns Formatted time string
 */
export function formatVideoTime(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds)) {
    return '--:--';
  }
  
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  
  if (hours > 0) {
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  }
  
  return `${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Jump to a specific time in the video
 * @param seconds The time in seconds to jump to
 */
export function jumpToTime(seconds: number): void {
  // Use any type casting to bypass TypeScript checking
  const wordStream = window.WordStream as any;
  
  if (typeof wordStream?.jumpToTime === 'function') {
    wordStream.jumpToTime(seconds);
  } else {
    console.warn('VideoService: jumpToTime function not available on WordStream');
  }
}

/**
 * Get the current video ID
 * @returns The current video ID or undefined if not available
 */
export function getCurrentVideoId(): string | undefined {
  // Use any type casting to bypass TypeScript checking
  const wordStream = window.WordStream as any;
  
  if (wordStream?.videoId) {
    return wordStream.videoId;
  }
  
  return undefined;
}

/**
 * Get the current video time
 * @returns The current time in seconds or undefined if not available
 */
export function getCurrentVideoTime(): number | undefined {
  // Use any type casting to bypass TypeScript checking
  const wordStream = window.WordStream as any;
  
  if (typeof wordStream?.getCurrentTime === 'function') {
    return wordStream.getCurrentTime();
  }
  
  return undefined;
}

/**
 * Get the current time of the video
 * @returns The current time in seconds, or undefined if no video is playing
 */
export function getCurrentTime(): number | undefined {
  try {
    const videoElement = document.querySelector('video');
    return videoElement ? videoElement.currentTime : undefined;
  } catch (error) {
    console.error('WordStream: Failed to get current time:', error);
    return undefined;
  }
}

/**
 * Add a time update listener to the video player
 * @param callback - Function to call when time updates
 * @returns Function to remove the listener
 */
export function addTimeUpdateListener(
  callback: (time: number) => void
): () => void {
  const videoElement = document.querySelector('video');
  if (!videoElement) return () => {};
  
  const handleTimeUpdate = () => {
    callback(videoElement.currentTime);
  };
  
  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  
  return () => {
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  };
} 