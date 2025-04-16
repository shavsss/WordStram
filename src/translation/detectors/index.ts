import { CaptionDetector } from './types';
import { YouTubeCaptionDetector } from './youtube-detector';
import { NetflixCaptionDetector } from './netflix-detector';
import { UniversalCaptionDetector } from './universal-detector';
import type { ContentSource } from '@/types';

let currentDetector: CaptionDetector | null = null;
let isAdPlaying = false;
let lastPlayerState = '';
let playerObserver: MutationObserver | null = null;
let pageObserver: MutationObserver | null = null;
let detectionInterval: NodeJS.Timeout | null = null;
// Add a flag to track if we're having auth issues but should still show features
let authIssuesDetected = false;
// Flag to indicate if user is logged in
let isUserAuthenticated = false;

/**
 * Factory function to get the appropriate detector for the current website
 * @returns The detector instance for the current site or null if not supported
 */
export function getDetectorForCurrentSite(): CaptionDetector {
  const url = window.location.href;
  
  if (url.includes('youtube.com')) {
    console.log('WordStream: Detected YouTube site, initializing YouTube detector');
    return new YouTubeCaptionDetector();
  }
  
  if (url.includes('netflix.com')) {
    console.log('WordStream: Detected Netflix site, initializing Netflix detector');
    return new NetflixCaptionDetector();
  }
  
  // For any other site, use the universal detector
  console.log('WordStream: Using universal detector for this site');
  return new UniversalCaptionDetector();
}

export type { CaptionDetector };
export {
  YouTubeCaptionDetector,
  NetflixCaptionDetector,
  UniversalCaptionDetector,
  startDetection
};

export function getCaptionDetector(source: ContentSource): CaptionDetector {
  cleanup();
  
  switch (source) {
    case 'youtube':
      currentDetector = new YouTubeCaptionDetector();
      break;
    case 'netflix':
      currentDetector = new NetflixCaptionDetector();
      break;
    case 'universal':
      currentDetector = new UniversalCaptionDetector();
      break;
    default:
      console.log('WordStream: Unknown source type, using universal detector');
      currentDetector = new UniversalCaptionDetector();
  }

  return currentDetector;
}

// Check if we've detected auth issues but should still show features
export function hasAuthIssues(): boolean {
  return authIssuesDetected;
}

// Mark that we're having auth issues but should still show features
export function setAuthIssuesDetected(value: boolean): void {
  authIssuesDetected = value;
  console.log(`WordStream: Auth issues detected flag set to ${value}`);
}

// Set authentication status
export function setAuthenticated(authenticated: boolean): void {
  isUserAuthenticated = authenticated;
  console.log(`WordStream: User authentication status set to ${authenticated}`);
  
  // If user becomes authenticated, auto-start captioning
  if (authenticated && currentDetector) {
    startDetection(true);
  }
}

function cleanup() {
  if (currentDetector) {
    currentDetector.cleanup();
    currentDetector = null;
  }

  if (playerObserver) {
    playerObserver.disconnect();
    playerObserver = null;
  }

  if (pageObserver) {
    pageObserver.disconnect();
    pageObserver = null;
  }

  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }

  isAdPlaying = false;
  lastPlayerState = '';
}

// Initialize the appropriate detector based on the current URL
function initializeDetector(): CaptionDetector {
  const detector = getDetectorForCurrentSite();
  currentDetector = detector;
  return detector;
}

// Check authentication status from background
async function checkAuthenticationStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.log('WordStream: Error checking auth status or not authenticated');
        resolve(false);
        return;
      }
      
      const isAuthenticated = response.isAuthenticated || false;
      console.log(`WordStream: User authentication status: ${isAuthenticated}`);
      isUserAuthenticated = isAuthenticated;
      resolve(isAuthenticated);
    });
  });
}

// Start the caption detection process
async function startDetection(force = false) {
  const detector = currentDetector || initializeDetector();
  if (!detector) return;

  console.log('WordStream: Starting caption detection...');
  
  try {
    // Check authentication on first run
    if (!isUserAuthenticated && !authIssuesDetected) {
      const isAuthenticated = await checkAuthenticationStatus();
      isUserAuthenticated = isAuthenticated;
    }
    
    const captionElement = await detector.detect();
    if (captionElement) {
      console.log('WordStream: Captions found, processing...');
      detector.processCaption(captionElement);
      
      // If user is authenticated, don't show floating controls for translation
      // but still make captions clickable
      if (isUserAuthenticated || authIssuesDetected) {
        // Just make captions clickable without showing floating control
        detector.startObserving(captionElement);
      }
    } else if (force) {
      console.log('WordStream: No captions found, will retry in 1 second');
      setTimeout(() => startDetection(true), 1000);
    } else {
      console.log('WordStream: No captions found, will retry on player state changes');
      
      // Add an additional retry after 3 seconds to be more aggressive
      // This helps with cases where captions might be delayed
      setTimeout(() => {
        console.log('WordStream: Additional retry for caption detection');
        startDetection(true);
      }, 3000);
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
    
    // If we get an error, try again after a short delay
    // This helps with temporary errors during page load
    setTimeout(() => {
      console.log('WordStream: Retrying caption detection after error');
      startDetection(true);
    }, 2000);
  }
}

function handlePlayerStateChange(playerContainer: HTMLElement) {
  // Get current player state
  const currentState = Array.from(playerContainer.classList)
    .find(cls => cls.endsWith('-mode'))?.replace('-mode', '') || '';
  
  // Check if ad state changed
  const currentAdState = playerContainer.classList.contains('ad-showing');
  
  // Only restart detection if there's a meaningful state change
  if (currentState !== lastPlayerState || currentAdState !== isAdPlaying) {
    console.log('WordStream: Player state changed', {
      previousState: lastPlayerState,
      currentState,
      wasAdPlaying: isAdPlaying,
      isAdPlaying: currentAdState
    });
    
    // Update states
    lastPlayerState = currentState;
    isAdPlaying = currentAdState;
    
    // Force detection restart after state change
    startDetection(true);
  }
}

function observePlayer(playerContainer: HTMLElement) {
  if (!playerContainer.dataset.wordstreamObserved) {
    playerContainer.dataset.wordstreamObserved = 'true';
    
    // Clean up existing observer if any
    if (playerObserver) {
      playerObserver.disconnect();
    }
    
    // Create new observer
    playerObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          handlePlayerStateChange(playerContainer);
        }
      });
    });
    
    playerObserver.observe(playerContainer, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Initial state check
    handlePlayerStateChange(playerContainer);
  }
}

// Listen for token refresh failure messages and set our flag
if (typeof document !== 'undefined') {
  document.addEventListener('wordstream:token_refresh_failed', () => {
    console.log('WordStream: Token refresh failure detected in caption detector');
    setAuthIssuesDetected(true);
    // Start detection anyway, ignoring auth
    startDetection(true);
  });
  
  // Also listen for auth errors
  document.addEventListener('wordstream:auth_error', () => {
    console.log('WordStream: Auth error detected in caption detector');
    setAuthIssuesDetected(true);
    // Start detection anyway, ignoring auth
    startDetection(true);
  });
  
  // Listen for authentication state changes
  document.addEventListener('wordstream:auth_state_changed', (event) => {
    const customEvent = event as CustomEvent;
    const isAuthenticated = customEvent.detail?.isAuthenticated || false;
    console.log(`WordStream: Auth state changed event received, authenticated: ${isAuthenticated}`);
    setAuthenticated(isAuthenticated);
  });
}

// Check authentication status immediately
checkAuthenticationStatus().then((isAuthenticated) => {
  console.log(`WordStream: Initial auth check completed: ${isAuthenticated}`);
  if (isAuthenticated) {
    // Start detection right away if authenticated
    startDetection(true);
  }
});

// Watch for navigation events and player state changes
let previousUrl = window.location.href;
pageObserver = new MutationObserver(() => {
  // Check for URL changes (SPA navigation)
  if (window.location.href !== previousUrl) {
    previousUrl = window.location.href;
    console.log('WordStream: URL changed, restarting detection');
    cleanup();
    startDetection(true);
    return;
  }

  // Find any video players on the page to observe
  const videoPlayers = document.querySelectorAll('video');
  videoPlayers.forEach(video => {
    const playerContainer = video.parentElement;
    if (playerContainer instanceof HTMLElement) {
      observePlayer(playerContainer);
    }
  });
  
  // For YouTube/Netflix specific containers
  const specificContainers = [
    document.querySelector('#movie_player'),          // YouTube 
    document.querySelector('.html5-video-player'),    // YouTube
    document.querySelector('.watch-video'),           // Netflix
    document.querySelector('.NFPlayer'),              // Netflix
    document.querySelector('.VideoContainer')         // Netflix
  ];
  
  specificContainers.forEach(container => {
    if (container instanceof HTMLElement) {
      observePlayer(container);
    }
  });
});

pageObserver.observe(document, { 
  subtree: true, 
  childList: true,
  attributes: true,
  attributeFilter: ['class']
});

// Initial check for any video players
function checkForPlayers() {
  const videoElements = document.querySelectorAll('video');
  let foundPlayers = false;
  
  videoElements.forEach(video => {
    const playerContainer = video.parentElement;
    if (playerContainer instanceof HTMLElement) {
      observePlayer(playerContainer);
      foundPlayers = true;
    }
  });
  
  // Also check for site-specific containers
  const specificContainers = [
    document.querySelector('#movie_player'),          // YouTube 
    document.querySelector('.html5-video-player'),    // YouTube
    document.querySelector('.watch-video'),           // Netflix
    document.querySelector('.NFPlayer'),              // Netflix
    document.querySelector('.VideoContainer')         // Netflix
  ];
  
  specificContainers.forEach(container => {
    if (container instanceof HTMLElement) {
      observePlayer(container);
      foundPlayers = true;
    }
  });
  
  return foundPlayers;
}

// Check every second for the first 30 seconds
let checkCount = 0;
detectionInterval = setInterval(() => {
  checkCount++;
  if (checkForPlayers() || checkCount >= 30) {
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
  }
}, 1000);