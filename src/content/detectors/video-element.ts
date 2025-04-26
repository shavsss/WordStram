import { CaptionDetector } from '../../shared/types/index';
import { MessageType } from '../../shared/message-types';

export class GenericVideoDetector implements CaptionDetector {
  source = 'generic';
  private observer: MutationObserver | null = null;
  private videoObservers: Map<HTMLVideoElement, MutationObserver> = new Map();
  private captionContainers: Set<HTMLElement> = new Set();
  private videoElements: Set<HTMLVideoElement> = new Set();
  private processedTexts: Set<string> = new Set();
  private cleanupWatcher: NodeJS.Timeout | null = null;
  private overlayContainer: HTMLElement | null = null;
  private isAuthenticated: boolean = false;
  private authCheckAttempts: number = 0;
  private readonly MAX_AUTH_CHECK_ATTEMPTS = 5;
  
  constructor() {
    // Set up interval to check for removed videos periodically
    this.cleanupWatcher = setInterval(() => this.checkForRemovedVideos(), 10000);
    
    // Check authentication status immediately and retry a few times
    this.checkAuthState();
    
    // Listen for auth changes
    chrome.runtime.onMessage.addListener((message) => {
      console.log('WordStream: Message received in detector', message?.type);
      if (message.type === MessageType.AUTH_STATE_CHANGED) {
        console.log('WordStream: Auth state changed', message.payload?.isAuthenticated);
        this.isAuthenticated = !!message.payload?.isAuthenticated;
      }
    });
  }
  
  private checkAuthState() {
    console.log('WordStream: Checking auth state, attempt', this.authCheckAttempts + 1);
    chrome.runtime.sendMessage({ type: MessageType.GET_AUTH_STATE }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error checking auth state:', chrome.runtime.lastError);
        // Retry a few times
        if (this.authCheckAttempts < this.MAX_AUTH_CHECK_ATTEMPTS) {
          this.authCheckAttempts++;
          setTimeout(() => this.checkAuthState(), 1000);
        }
        return;
      }
      
      if (response && response.data && response.data.isAuthenticated) {
        console.log('WordStream: User is authenticated');
        this.isAuthenticated = true;
        
        // If we already have detected caption containers, process them now
        if (this.captionContainers.size > 0) {
          console.log('WordStream: Processing existing caption containers now that user is authenticated');
          for (const container of this.captionContainers) {
            this.processCaption(container);
          }
        }
      } else {
        console.log('WordStream: User is not authenticated');
        this.isAuthenticated = false;
      }
    });
  }
  
  public async detect(): Promise<HTMLElement | null> {
    try {
      // Always proceed with detection, but mark authentication status
      // This ensures we detect captions even if auth check is slow
      
      // Find all video elements on the page
      const videos = document.querySelectorAll('video');
      
      if (videos.length === 0) {
        return null;
      }
      
      if (!this.overlayContainer) {
        this.createOverlayContainer();
      }
      
      // Check each video element
      for (const video of Array.from(videos)) {
        if (this.videoElements.has(video)) {
          continue; // Already processing this video
        }
        
        // Track this video
        this.videoElements.add(video);
        
        // 1. Check for built-in text tracks (WebVTT subtitles)
        if (video.textTracks && video.textTracks.length > 0) {
          this.setupTextTrackObserving(video);
        }
        
        // 2. Look for nearby caption elements
        const captionElements = await this.findNearbyCaptionElements(video);
        for (const element of captionElements) {
          this.captionContainers.add(element);
          this.observeCaptionContainer(element);
        }
      }
      
      // Return all found caption containers for processing
      if (this.captionContainers.size > 0) {
        // Return the first container found for initial processing
        return Array.from(this.captionContainers)[0];
      }
      
      return null;
    } catch (error) {
      console.error('WordStream: Error detecting captions:', error);
      return null;
    }
  }
  
  private createOverlayContainer(): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'wordstream-overlay-container';
    this.overlayContainer.style.position = 'absolute';
    this.overlayContainer.style.top = '0';
    this.overlayContainer.style.left = '0';
    this.overlayContainer.style.pointerEvents = 'none';
    this.overlayContainer.style.zIndex = '99999';
    document.body.appendChild(this.overlayContainer);
  }
  
  private setupTextTrackObserving(video: HTMLVideoElement): void {
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      
      // Only process subtitles and captions
      if (track.kind !== 'subtitles' && track.kind !== 'captions') {
        continue;
      }
      
      // We don't change the mode - let the website control that
      
      // Listen for cue changes without modifying the track
      track.addEventListener('cuechange', () => {
        if (!track.activeCues || !this.isAuthenticated) return;
        
        for (let j = 0; j < track.activeCues.length; j++) {
          const cue = track.activeCues[j];
          
          if ('text' in cue && cue.text) {
            // Just log the text - don't actually modify the DOM
            console.log('WordStream: Caption text:', cue.text);
            
            // Store the text for possible future handling
            this.processedTexts.add(typeof cue.text === 'object' ? JSON.stringify(cue.text) : String(cue.text));
          }
        }
      });
    }
  }
  
  private async findNearbyCaptionElements(video: HTMLVideoElement): Promise<HTMLElement[]> {
    const results: HTMLElement[] = [];
    const videoRect = video.getBoundingClientRect();
    
    // Common caption container class names
    const captionClassPatterns = [
      /caption/i, /subtitle/i, /cue/i, /vtt/i, /text-track/i
    ];
    
    // Common aria labels for captions
    const ariaLabelPatterns = [
      /caption/i, /subtitle/i
    ];
    
    // Check for elements positioned near the video
    const checkElement = (element: HTMLElement) => {
      // Skip elements that are too small
      if (element.offsetWidth < 50 || element.offsetHeight < 10) {
        return false;
      }
      
      // Check class names
      if (element.className && captionClassPatterns.some(pattern => 
        pattern.test(element.className)
      )) {
        return true;
      }
      
      // Check aria labels
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel && ariaLabelPatterns.some(pattern => 
        pattern.test(ariaLabel)
      )) {
        return true;
      }
      
      // Check position relative to video (captions are usually below videos)
      const rect = element.getBoundingClientRect();
      
      // Captions are typically below the video in the same horizontal alignment
      const isBelow = rect.top >= videoRect.top + videoRect.height * 0.8;
      const horizontalOverlap = Math.max(0,
        Math.min(rect.right, videoRect.right) - Math.max(rect.left, videoRect.left)
      );
      const isHorizontallyAligned = horizontalOverlap > videoRect.width * 0.5;
      
      if (isBelow && isHorizontallyAligned) {
        return true;
      }
      
      // Not a likely caption container
      return false;
    };
    
    // First, check direct children and siblings of video's parent
    if (video.parentElement) {
      for (const child of Array.from(video.parentElement.children)) {
        if (child instanceof HTMLElement && child !== video && checkElement(child)) {
          results.push(child);
        }
      }
    }
    
    // If still haven't found captions, look more broadly
    if (results.length === 0) {
      // Find elements positioned below the video
      const potentialContainers = document.querySelectorAll('div, p, span');
      for (const element of Array.from(potentialContainers).slice(0, 100)) { // Limit search to avoid performance issues
        if (element instanceof HTMLElement && checkElement(element)) {
          results.push(element);
        }
      }
    }
    
    return results;
  }
  
  private observeVideo(video: HTMLVideoElement): void {
    // Create an observer to watch for changes to the video
    // This helps detect when textTracks are added after initial load
    if (this.videoObservers.has(video)) {
      return; // Already observing
    }
    
    const observer = new MutationObserver((mutations) => {
      let textTracksChanged = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          textTracksChanged = true;
          break;
        }
      }
      
      if (textTracksChanged && video.textTracks.length > 0) {
        this.setupTextTrackObserving(video);
      }
    });
    
    observer.observe(video, {
      attributes: true,
      attributeFilter: ['src']
    });
    
    this.videoObservers.set(video, observer);
  }
  
  private observeCaptionContainer(container: HTMLElement): void {
    if (!container || !this.isAuthenticated) return;
    
    // Create a non-intrusive observer that doesn't modify the DOM
    const observer = new MutationObserver((mutations) => {
      // Only process if authenticated
      if (!this.isAuthenticated) return;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const text = container.textContent || '';
          if (text.trim() && !this.processedTexts.has(text)) {
            console.log('WordStream: Caption text observed:', text);
            this.processedTexts.add(text);
            
            // Create clickable overlay for the text
            this.createClickableOverlay(container, text);
          }
        }
      }
    });
    
    // Observe with minimal options to avoid interference
    observer.observe(container, {
      childList: true,
      characterData: true,
      subtree: true
    });
    
    // Store this observer to clean up later
    container.dataset.wordstreamObserving = 'true';
  }
  
  private createClickableOverlay(container: HTMLElement, text: string): void {
    if (!this.overlayContainer) return;
    
    // Only proceed if authenticated
    if (!this.isAuthenticated) {
      console.log('WordStream: Not creating clickable overlay as user is not authenticated');
      return;
    }
    
    // Don't process the same text multiple times in short succession
    if (this.processedTexts.has(text)) {
      // If we've already processed this text very recently, skip
      const processingCount = this.processedTexts.size;
      if (processingCount > 50) {
        // Limit the number of processed texts to avoid memory issues
        this.processedTexts.clear();
      }
      return;
    }
    
    try {
      console.log('WordStream: Creating clickable overlay for text:', text.substring(0, 30));
      
      // Get position of the caption container
      const rect = container.getBoundingClientRect();
      
      // Create overlay for this caption - but make it lightweight
      const overlay = document.createElement('div');
      overlay.className = 'wordstream-caption-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.pointerEvents = 'auto';
      overlay.style.zIndex = '99999';
      overlay.style.backgroundColor = 'transparent';
      
      // Instead of creating a span for each word, just set a click handler
      // that will determine the word clicked based on the event
      overlay.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Get the clicked position relative to the overlay
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Use the position to estimate which word was clicked
        // This is a simplification - in a real implementation we would use 
        // more sophisticated word boundary detection
        const words = text.split(/\s+/);
        const approximateWordIndex = Math.floor((x / rect.width) * words.length);
        const clickedWord = words[Math.min(approximateWordIndex, words.length - 1)];
        
        if (!clickedWord || !clickedWord.trim()) return;
        
        // Process the word
        try {
          console.log('WordStream: Word clicked:', clickedWord);
          chrome.runtime.sendMessage({
            type: MessageType.TRANSLATE_WORD,
            payload: {
              text: clickedWord,
              context: text
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('WordStream: Error sending translation request:', chrome.runtime.lastError);
              this.showTranslationPopup(clickedWord, "Translation error: Connection problem", event as MouseEvent);
              return;
            }
            
            if (response && response.success) {
              this.showTranslationPopup(clickedWord, response.data.translation, event as MouseEvent);
            } else {
              this.showTranslationPopup(clickedWord, "Translation not available", event as MouseEvent);
            }
          });
        } catch (error) {
          console.error('WordStream: Error processing word click:', error);
        }
      });
      
      // Add overlay to container
      this.overlayContainer.appendChild(overlay);
      
      // Remove overlay after a shorter time to reduce interference
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 3000); // Reduced from 5000ms to 3000ms
    } catch (error) {
      console.error('WordStream: Error creating clickable overlay:', error);
    }
  }
  
  public processCaption(caption: HTMLElement): void {
    if (!caption) return;
    
    // Process the caption text without modifying its structure
    const text = caption.textContent || '';
    if (text.trim() && !this.processedTexts.has(text)) {
      console.log('WordStream: Processing caption text:', text.substring(0, 30));
      this.processedTexts.add(text);
      
      // Create clickable overlay - only creates if authenticated
      this.createClickableOverlay(caption, text);
    }
    
    // Set up observer for future changes
    this.observeCaptionContainer(caption);
  }
  
  private checkForRemovedVideos(): void {
    // Check each tracked video to see if it's still in the DOM
    for (const video of this.videoElements) {
      if (!document.body.contains(video)) {
        // Video has been removed, clean up its observers
        const observer = this.videoObservers.get(video);
        if (observer) {
          observer.disconnect();
          this.videoObservers.delete(video);
        }
        
        // Remove it from our set
        this.videoElements.delete(video);
      }
    }
    
    // Also check caption containers
    for (const container of this.captionContainers) {
      if (!document.body.contains(container)) {
        this.captionContainers.delete(container);
      }
    }
  }
  
  public cleanup(): void {
    // Clean up all observers
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Clean up video observers
    for (const observer of this.videoObservers.values()) {
      observer.disconnect();
    }
    this.videoObservers.clear();
    
    // Clear the cleanup interval
    if (this.cleanupWatcher) {
      clearInterval(this.cleanupWatcher);
      this.cleanupWatcher = null;
    }
    
    // Remove overlay container
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
      this.overlayContainer = null;
    }
    
    // Clear all tracking sets
    this.captionContainers.clear();
    this.videoElements.clear();
    this.processedTexts.clear();
    
    console.log('WordStream: Generic video detector cleaned up');
  }
  
  private showTranslationPopup(
    originalWord: string, 
    translatedWord: string, 
    event: MouseEvent
  ): void {
    if (!this.isAuthenticated) return;
    
    // Remove any existing popups
    const existingPopups = document.querySelectorAll('.wordstream-translation-popup');
    existingPopups.forEach(popup => popup.remove());
    
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'wordstream-translation-popup';
    popup.style.position = 'absolute';
    popup.style.zIndex = '100000';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '4px';
    popup.style.padding = '8px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.maxWidth = '300px';
    
    // Set popup content
    popup.innerHTML = `
      <div>
        <strong style="font-size: 14px;">${originalWord}</strong>
        <p style="margin: 8px 0; font-size: 14px;">${translatedWord}</p>
        <div style="display: flex; justify-content: space-between; margin-top: 12px;">
          <button class="wordstream-save-button" style="background: #4285f4; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Save</button>
          <button class="wordstream-close-button" style="background: #f1f1f1; color: #333; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    
    // Position popup near the clicked word
    const elementRect = (event.target as HTMLElement).getBoundingClientRect();
    popup.style.left = `${event.clientX}px`;
    popup.style.top = `${elementRect.bottom + window.scrollY + 10}px`;
    
    // Ensure popup is within viewport
    document.body.appendChild(popup);
    const popupRect = popup.getBoundingClientRect();
    
    if (popupRect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
    }
    
    if (popupRect.bottom > window.innerHeight) {
      popup.style.top = `${elementRect.top + window.scrollY - popupRect.height - 10}px`;
    }
    
    // Add event listeners to buttons
    const saveButton = popup.querySelector('.wordstream-save-button');
    const closeButton = popup.querySelector('.wordstream-close-button');
    
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        // Send message to save word
        chrome.runtime.sendMessage({
          type: MessageType.SAVE_WORD,
          payload: {
            text: originalWord,
            translation: translatedWord
          }
        }, (response) => {
          console.log('WordStream: Word saved response:', response);
        });
        
        popup.remove();
      });
    }
    
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        popup.remove();
      });
    }
    
    // Close on outside click
    const closePopup = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node)) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    };
    
    // Add delay to prevent immediate closure
    setTimeout(() => {
      document.addEventListener('click', closePopup);
    }, 100);
  }
} 