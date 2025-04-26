import { GenericVideoDetector } from './video-element';
import { NetflixCaptionDetector } from './netflix-detector';
import { YouTubeCaptionDetector } from './youtube-detector';
import type { CaptionDetector } from '../../shared/types/index';

/**
 * Get the appropriate caption detector for the current site
 * @returns CaptionDetector implementation for the current site
 */
export function getCaptionDetector(): CaptionDetector {
  const url = window.location.href;
  
  // Check for specific video platforms
  if (url.includes('netflix.com/watch')) {
    console.log('WordStream: Using Netflix detector');
    return new NetflixCaptionDetector();
  } else if (url.includes('youtube.com/watch') || 
             url.includes('youtube.com/shorts') || 
             url.includes('youtube.com/embed') || 
             url.includes('youtube.com/live')) {
    console.log('WordStream: Using YouTube detector');
    return new YouTubeCaptionDetector();
  }
  
  // For all other sites, use the generic detector
  console.log('WordStream: Using generic detector');
  return new GenericVideoDetector();
}

// שמירת המצב של ניסיונות זיהוי הכתוביות
const detectionState = {
  retryCount: 0,
  maxRetries: 10,
  retryDelay: 2000, // מרווח זמן בין ניסיונות בms
  lastDetector: null as CaptionDetector | null,
  detectionTimeout: null as NodeJS.Timeout | null
};

/**
 * Start caption detection process
 * @returns Promise resolving to true if captions were found, false otherwise
 */
export async function startDetection(): Promise<boolean> {
  // נקה כל timeout קודם
  if (detectionState.detectionTimeout) {
    clearTimeout(detectionState.detectionTimeout);
    detectionState.detectionTimeout = null;
  }

  const detector = getCaptionDetector();
  detectionState.lastDetector = detector;
  console.log('WordStream: Using detector for', detector.source);
  
  try {
    const captionElement = await detector.detect();
    if (captionElement) {
      console.log('WordStream: Captions found, processing...');
      detector.processCaption(captionElement);
      // אפס את מונה הניסיונות כי הצלחנו
      detectionState.retryCount = 0;
      return true;
    } else {
      console.log('WordStream: No captions found, will retry later');
      
      // אם עדיין לא הגענו למספר המקסימלי של ניסיונות, ננסה שוב אחרי השהייה
      if (detectionState.retryCount < detectionState.maxRetries) {
        detectionState.retryCount++;
        
        console.log(`WordStream: Scheduling retry ${detectionState.retryCount}/${detectionState.maxRetries} in ${detectionState.retryDelay}ms`);
        
        // הגדל את מרווח הזמן בין ניסיונות עוקבים
        const delayMultiplier = 1 + (detectionState.retryCount / 5); // הגדלה הדרגתית של ההשהיה
        
        detectionState.detectionTimeout = setTimeout(() => {
          startDetection();
        }, detectionState.retryDelay * delayMultiplier);
      } else {
        console.log('WordStream: Max retry attempts reached for caption detection');
      }
      
      return false;
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
    return false;
  }
} 