import { CaptionDetector } from '../../shared/types/index';

/**
 * Netflix caption detector for handling captions on Netflix.com
 */
export class NetflixCaptionDetector implements CaptionDetector {
  source = 'netflix';
  private observer: MutationObserver | null = null;
  private captionContainers: Set<HTMLElement> = new Set();
  private videoElements: Set<HTMLVideoElement> = new Set();
  private processedCaptions: WeakMap<Node, string> = new WeakMap();
  private cleanupWatcher: NodeJS.Timeout | null = null;

  constructor() {
    // Set up interval to check for removed videos periodically
    this.cleanupWatcher = setInterval(() => this.checkForRemovedVideos(), 10000);
  }

  public async detect(): Promise<HTMLElement | null> {
    try {
      // Check if we're on a Netflix watch page
      if (!window.location.href.includes('netflix.com/watch')) {
        return null;
      }
      
      console.log('WordStream: Detecting Netflix captions');
      
      // Look for the Netflix player container
      const playerContainer = document.querySelector('.netflix-player');
      if (!playerContainer) {
        console.log('WordStream: Netflix player not found');
        return null;
      }
      
      // Find all video elements within the player
      const videos = playerContainer.querySelectorAll('video');
      if (videos.length === 0) {
        console.log('WordStream: No video elements found in Netflix player');
        return null;
      }
      
      // Track video elements
      for (const video of Array.from(videos)) {
        this.videoElements.add(video);
      }
      
      // Netflix captions are typically in a container with these class patterns
      const captionSelectors = [
        '.player-timedtext',
        '.VideoContainer div.player-timedtext',
        '.nf-player-container .player-timedtext'
      ];
      
      // Try each selector
      for (const selector of captionSelectors) {
        const captionContainer = document.querySelector(selector) as HTMLElement;
        if (captionContainer) {
          console.log('WordStream: Found Netflix caption container', captionContainer);
          this.captionContainers.add(captionContainer);
          this.observeCaptionContainer(captionContainer);
          return captionContainer;
        }
      }
      
      // If no caption container found yet, look for subtitle-specific elements
      const subtitleElements = document.querySelectorAll('.player-timedtext-text-container');
      if (subtitleElements.length > 0) {
        const container = subtitleElements[0].parentElement as HTMLElement;
        if (container) {
          console.log('WordStream: Found Netflix subtitle container', container);
          this.captionContainers.add(container);
          this.observeCaptionContainer(container);
          return container;
        }
      }
      
      console.log('WordStream: No Netflix caption container found');
      return null;
    } catch (error) {
      console.error('WordStream: Error detecting Netflix captions:', error);
      return null;
    }
  }

  private observeCaptionContainer(container: HTMLElement): void {
    if (!container) return;
    
    if (this.observer) {
      this.observer.disconnect();
    }
    
    console.log('WordStream: Setting up observer for Netflix caption container');
    
    // Create a new mutation observer to track changes to the container
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'childList' || 
          mutation.type === 'characterData' ||
          mutation.type === 'attributes'
        ) {
          this.processCaptionText(container);
        }
      }
    });
    
    // Start observing the container
    this.observer.observe(container, {
      childList: true,      // Observe direct children
      characterData: true,  // Observe text changes
      subtree: true,        // Observe all descendants
      attributes: true      // Observe attribute changes
    });
    
    // Process the initial caption text
    this.processCaptionText(container);
  }
  
  private processCaptionText(container: HTMLElement): void {
    if (!container) return;
    
    try {
      // Netflix captions are typically in span elements within the container
      const captionSpans = container.querySelectorAll('.player-timedtext-text-container span');
      
      if (captionSpans.length === 0) {
        // Try alternative selectors
        const altSpans = container.querySelectorAll('span');
        if (altSpans.length > 0) {
          this.processTextElements(altSpans);
        }
      } else {
        this.processTextElements(captionSpans);
      }
      
      // Send the full caption text for vocabulary tracking
      const fullText = container.textContent || '';
      if (fullText.trim()) {
        console.log('WordStream: Netflix caption text processed:', fullText);
      }
    } catch (error) {
      console.error('WordStream: Error processing Netflix caption text:', error);
    }
  }
  
  private processTextElements(elements: NodeListOf<Element>): void {
    for (const element of Array.from(elements)) {
      // Skip if already processed with the same text
      const text = element.textContent || '';
      if (!text.trim()) continue;
      
      if (this.processedCaptions.has(element) && this.processedCaptions.get(element) === text) {
        continue;
      }
      
      // Store the processed text
      this.processedCaptions.set(element, text);
      
      // Make each word clickable
      this.makeWordsClickable(element as HTMLElement);
    }
  }
  
  private makeWordsClickable(element: HTMLElement): void {
    if (!element || !element.textContent) return;
    
    const text = element.textContent;
    
    // Skip if nothing to process
    if (!text.trim()) return;
    
    // Create a document fragment to replace the content
    const fragment = document.createDocumentFragment();
    
    // Split the text into words
    const words = text.split(/(\s+)/);
    
    // Process each word
    words.forEach(word => {
      if (!word.trim()) {
        // For whitespace, just add a text node
        fragment.appendChild(document.createTextNode(word));
        return;
      }
      
      // Create a span for this word
      const wordSpan = document.createElement('span');
      wordSpan.textContent = word;
      wordSpan.className = 'wordstream-word';
      wordSpan.dataset.originalWord = word;
      
      // Add click handler for translation
      wordSpan.addEventListener('click', (event) => {
        this.onWordClick(event);
      });
      
      // Add to fragment
      fragment.appendChild(wordSpan);
    });
    
    // Clear the element and append the new content
    element.textContent = '';
    element.appendChild(fragment);
  }
  
  private onWordClick(event: MouseEvent) {
    const element = event.target as HTMLElement;
    const word = element.textContent || '';
    
    // Prevent empty clicks
    if (!word.trim()) return;
    
    console.log('WordStream: Netflix word clicked:', word);

    // Show translation popup with the word
    this.showTranslationPopup(word, '', { x: event.clientX, y: event.clientY });
  }
  
  private showTranslationPopup(originalWord: string, translatedWord: string, position: { x: number, y: number }) {
    // Create popup element if it doesn't exist
    let popup = document.getElementById('wordstream-translation-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'wordstream-translation-popup';
      popup.className = 'wordstream-translation-popup';
      document.body.appendChild(popup);
    }
    
    // Position the popup near the clicked word
    popup.style.left = `${position.x}px`;
    popup.style.top = `${position.y + 20}px`;
    
    // Set popup content
    popup.innerHTML = `
      <div class="wordstream-original-word">${originalWord}</div>
      <div class="wordstream-translated-word">${translatedWord || 'Translating...'}</div>
      <div class="wordstream-actions">
        <button class="wordstream-save-button">Save</button>
        <button class="wordstream-close-button">Close</button>
      </div>
    `;
    
    // Show the popup
    popup.style.display = 'block';
    
    // Send translation request
    chrome.runtime.sendMessage({
      type: 'TRANSLATE_WORD',
      payload: {
        word: originalWord,
        context: document.title || ''
      }
    });
    
    // Add event listeners for buttons
    const closeButton = popup.querySelector('.wordstream-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (popup) popup.style.display = 'none';
      });
    }
  }
  
  public processCaption(caption: HTMLElement): void {
    if (!caption) return;
    
    // Process the caption text
    this.processCaptionText(caption);
    
    // Set up observer for future changes
    this.observeCaptionContainer(caption);
  }
  
  private checkForRemovedVideos(): void {
    // Check each tracked video to see if it's still in the DOM
    for (const video of this.videoElements) {
      if (!document.body.contains(video)) {
        // Video has been removed, clean up
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
    console.log('WordStream: Cleaning up Netflix detector');
    
    // Clean up observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Clear the cleanup interval
    if (this.cleanupWatcher) {
      clearInterval(this.cleanupWatcher);
      this.cleanupWatcher = null;
    }
    
    // Clear all tracking sets
    this.captionContainers.clear();
    this.videoElements.clear();
    
    console.log('WordStream: Netflix detector cleaned up');
  }
} 