import { CaptionDetector } from '@/types';
import { YouTubeCaptionDetector } from '../../../services/caption-detectors/youtube-detector';
import { NetflixCaptionDetector } from '../../../services/caption-detectors/netflix-detector';

// Global variables
let currentDetector: CaptionDetector | null = null;
let captionCheckInterval: number | null = null;
let lastCaptionContainer: HTMLElement | null = null;

/**
 * מחזיר את גלאי הכתוביות הנוכחי
 */
export function getCurrentDetector(): CaptionDetector | null {
  return currentDetector;
}

/**
 * מאתחל את גלאי הכתוביות המתאים בהתאם לאתר הנוכחי
 */
function initializeDetector(): CaptionDetector | null {
  const url = window.location.href;
  cleanup();

  if (url.includes('youtube.com')) {
    currentDetector = new YouTubeCaptionDetector();
    return currentDetector;
  } else if (url.includes('netflix.com')) {
    currentDetector = new NetflixCaptionDetector();
    return currentDetector;
  }
  
  return null;
}

/**
 * מנקה את המשאבים הקיימים
 */
function cleanup() {
  if (currentDetector) {
    currentDetector.stopObserving();
    currentDetector = null;
  }

  if (captionCheckInterval) {
    window.clearInterval(captionCheckInterval);
    captionCheckInterval = null;
  }

  lastCaptionContainer = null;
}

/**
 * בודק אם מיכל הכתוביות השתנה
 */
function hasCaptionContainerChanged(newContainer: HTMLElement): boolean {
  if (!lastCaptionContainer || !newContainer) return true;
  return lastCaptionContainer !== newContainer;
}

/**
 * מנטר כתוביות באופן רציף
 */
async function monitorCaptions() {
  if (!currentDetector) return;

  try {
    const captionElement = await currentDetector.detect();
    
    if (captionElement && hasCaptionContainerChanged(captionElement)) {
      console.log('WordStream: Caption container changed, updating...');
      
      // Stop observing old container
      if (lastCaptionContainer) {
        currentDetector.stopObserving();
      }
      
      // Start observing new container
      lastCaptionContainer = captionElement;
      currentDetector.processCaption(captionElement);
      console.log('WordStream: Now observing new caption container');
    }
  } catch (error) {
    console.error('WordStream: Error monitoring captions:', error);
  }
}

/**
 * מתחיל את תהליך זיהוי הכתוביות
 */
export async function startDetection() {
  // Clean up existing detector and interval
  cleanup();
  
  // Initialize new detector
  currentDetector = initializeDetector();
  if (!currentDetector) return;

  console.log('WordStream: Starting caption detection...');
  
  try {
    // Initial caption check
    await monitorCaptions();
    
    // Set up continuous monitoring
    captionCheckInterval = window.setInterval(monitorCaptions, 1000) as unknown as number;
    
    // Also watch for player state changes
    const player = document.querySelector('.html5-video-player');
    if (player) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.target instanceof HTMLElement) {
            // Check for ad-related class changes or video player state changes
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'class' || 
                 mutation.attributeName === 'data-state')) {
              monitorCaptions();
            }
          }
        });
      });
      
      observer.observe(player, {
        attributes: true,
        attributeFilter: ['class', 'data-state']
      });
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
  }
} 