import { YouTubeCaptionDetector } from './youtube-detector';
import { NetflixCaptionDetector } from './netflix-detector';
import type { CaptionDetector } from '@/types';
import type { ContentSource } from '@/types';

let currentDetector: CaptionDetector | null = null;
let isAdPlaying = false;
let lastPlayerState = '';
let playerObserver: MutationObserver | null = null;
let pageObserver: MutationObserver | null = null;
let detectionInterval: NodeJS.Timeout | null = null;

export function getCaptionDetector(source: ContentSource): CaptionDetector {
  cleanup();
  
  switch (source) {
    case 'youtube':
      currentDetector = new YouTubeCaptionDetector();
      break;
    case 'netflix':
      currentDetector = new NetflixCaptionDetector();
      break;
    default:
      throw new Error(`Unsupported content source: ${source}`);
  }

  return currentDetector;
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

// Start the caption detection process
async function startDetection(force = false) {
  const detector = currentDetector || initializeDetector();
  if (!detector) return;

  console.log('WordStream: Starting caption detection...');
  
  try {
    const captionElement = await detector.detect();
    if (captionElement) {
      console.log('WordStream: Captions found, processing...');
      detector.processCaption(captionElement);
    } else if (force) {
      console.log('WordStream: No captions found, will retry in 1 second');
      setTimeout(() => startDetection(true), 1000);
    } else {
      console.log('WordStream: No captions found, will retry on player state changes');
    }
  } catch (error) {
    console.error('WordStream: Error detecting captions:', error);
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

// Start initial detection
startDetection(true);

// Watch for navigation events and player state changes
let previousUrl = window.location.href;
pageObserver = new MutationObserver(() => {
  // Check for URL changes (YouTube's SPA navigation)
  if (window.location.href !== previousUrl) {
    previousUrl = window.location.href;
    console.log('WordStream: URL changed, restarting detection');
    cleanup();
    startDetection(true);
    return;
  }

  // Check for player container changes
  const playerContainer = document.querySelector('#movie_player') || 
                         document.querySelector('.html5-video-player');
  
  if (playerContainer instanceof HTMLElement) {
    observePlayer(playerContainer);
  }
});

pageObserver.observe(document, { 
  subtree: true, 
  childList: true,
  attributes: true,
  attributeFilter: ['class']
});

// Initial check for player and periodic retries
function checkForPlayer() {
  const playerContainer = document.querySelector('#movie_player') || 
                         document.querySelector('.html5-video-player');
  
  if (playerContainer instanceof HTMLElement) {
    observePlayer(playerContainer);
    return true;
  }
  return false;
}

// Check every second for the first 30 seconds
let checkCount = 0;
detectionInterval = setInterval(() => {
  checkCount++;
  if (checkForPlayer() || checkCount >= 30) {
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
  }
}, 1000);