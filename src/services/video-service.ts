/**
 * Service for handling video player operations
 * Abstracts video player interactions from the components
 */

/**
 * Jump to a specific time in the current video
 * @param timeInSeconds - The time to jump to in seconds
 * @returns boolean indicating success
 */
export function jumpToTime(timeInSeconds: number): boolean {
  if (typeof timeInSeconds !== 'number') return false;
  
  console.log('WordStream: Jumping to video time', timeInSeconds);
  
  try {
    // Find the video element and set its currentTime
    const videoElement = document.querySelector('video');
    if (!videoElement) return false;
    
    videoElement.currentTime = timeInSeconds;
    
    // Try to play but don't throw if autoplay is blocked
    videoElement.play().catch(() => {
      console.log('WordStream: Could not play video automatically - autoplay may be blocked');
    });
    
    return true;
  } catch (error) {
    console.error('WordStream: Failed to jump to time:', error);
    return false;
  }
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
 * Format video time from seconds to MM:SS
 * @param seconds - The time in seconds
 * @returns Formatted time string in MM:SS format
 */
export function formatVideoTime(seconds?: number): string {
  if (seconds === undefined) return '';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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