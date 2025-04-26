import type { CaptionDetector } from '../../shared/types/index';
import { sendMessage } from '../../shared/utils/messaging';
import { MessageType } from '../../shared/message-types';

/**
 * YouTube Caption Detector
 * 
 * This detector is specifically designed to work with YouTube's caption system.
 * It looks for YouTube-specific caption elements and processes them for word translation.
 * Enhanced to handle YouTube's different caption formats and dynamically loaded captions.
 */
export class YouTubeCaptionDetector implements CaptionDetector {
  source = 'youtube';
  private observer: MutationObserver | null = null;
  private captionContainers: Set<HTMLElement> = new Set();
  private processedCaptions: WeakMap<Node, string> = new WeakMap();
  private videoElements: Set<HTMLElement> = new Set();
  private lastScan: number = 0;
  private scanInterval: number = 1500; // Increased back to 1500ms to reduce CPU usage
  private cleanupWatcher: NodeJS.Timeout | null = null;
  private playerObserver: MutationObserver | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 20; // Reduced from 40 to 20 to prevent excessive retries
  private isAudioMode: boolean = false;
  private processedNodes: WeakSet<Node> = new WeakSet();
  private isMusic: boolean = false;
  private isEmbedded: boolean = false;
  private hasError: boolean = false;
  private errorCount: number = 0;
  private maxErrors: number = 5;
  private isAuthenticated: boolean = false;
  private selectors = {
    // Standard YouTube selectors
    standardCaptions: [
      // Standard caption container
      '.ytp-caption-segment',
      // Legacy caption container
      '.caption-window .captions-text .caption-row .caption-segment',
      // Live-generated captions
      '.ytp-live-caption-segment', 
      // New-format caption segments
      '.ytp-caption-window-container [class*="-caption-segment"]',
      // Modern transcript view
      '.ytd-transcript-segment-renderer #content',
      // New UI captions (2023)
      'div[jsname="WbJdle"]',
      // Direct text nodes
      '.caption-window span',
      // Auto-generated captions
      '.ytp-caption-window-rollup',
      // Any element with caption role
      '[role="caption"]',
      // New formats 2024
      '.ytd-watch-flexy .captions-text-track'
    ],
    // YouTube Music specific selectors
    musicCaptions: [
      // Lyrics (standard format)
      '.ytmusic-lyrics-renderer .lyrics',
      // Lyrics line
      '.ytmusic-player-lyrics-line .content',
      // Lyrics line active
      '.ytmusic-player-lyrics-line.active .content',
      // New lyrics format
      '.ytmusic-lyrics-detail-renderer'
    ],
    // Embedded player selectors
    embeddedCaptions: [
      // Embedded player captions
      '.caption-window .captions-text .caption-segment',
      // YouTube iframe captions
      '.ytp-caption-window-container .ytp-caption-segment',
      // Embedded player caption windows
      'div[aria-label*="caption"], div[aria-label*="subtitle"]'
    ]
  };
  
  constructor() {
    // Set up interval to check for removed videos periodically with a longer interval
    this.cleanupWatcher = setInterval(() => this.checkForRemovedVideos(), 15000); // Increased from 10s to 15s
    
    // Detect YouTube Music
    this.isMusic = window.location.hostname.includes('music.youtube.com');
    
    // Detect if we're in an embedded player
    this.isEmbedded = 
      window.location.hostname.includes('youtube.com/embed') ||
      window !== window.top;
    
    console.log(`WordStream: YouTube detector initialized (Music: ${this.isMusic}, Embedded: ${this.isEmbedded})`);
    
    // Check authentication state
    this.checkAuthState();
    
    // Listen for auth changes
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === MessageType.AUTH_STATE_CHANGED) {
        this.isAuthenticated = !!message.payload?.isAuthenticated;
      }
    });
  }
  
  private checkAuthState() {
    chrome.runtime.sendMessage({ type: MessageType.GET_AUTH_STATE }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error checking auth state:', chrome.runtime.lastError);
        return;
      }
      
      this.isAuthenticated = !!(response && response.data && response.data.isAuthenticated);
    });
  }
  
  /**
   * Initialize caption detection
   */
  async initialize(): Promise<boolean> {
    console.log(`WordStream: Initializing YouTube${this.isMusic ? ' Music' : ''}${this.isEmbedded ? ' Embedded' : ''} caption detector`);
    
    // Early detection attempt
    const found = await this.detectCaptionElements();
    
    if (found) {
      console.log('WordStream: YouTube caption elements found immediately');
    } else {
      console.log('WordStream: YouTube caption elements not found, will observe DOM for changes');
      this.setupDOMObserver();
    }
    
    return true;
  }
  
  /**
   * Detect caption elements and start observing them
   */
  private async detectCaptionElements(): Promise<boolean> {
    // Get all potential selectors based on the detected YouTube variant
    let selectors = [...this.selectors.standardCaptions];
    
    if (this.isMusic) {
      selectors = [...selectors, ...this.selectors.musicCaptions];
    }
    
    if (this.isEmbedded) {
      selectors = [...selectors, ...this.selectors.embeddedCaptions];
    }
    
    // Combine selectors into a single query
    const combinedSelector = selectors.join(', ');
    const captionElements = document.querySelectorAll(combinedSelector);
    
    if (captionElements.length > 0) {
      console.log(`WordStream: Found ${captionElements.length} caption elements`);
      
      // Process each element
      captionElements.forEach(element => {
        // Check if this element has valid caption text
        if (element.textContent && element.textContent.trim()) {
          this.observeCaptionContainer(element as HTMLElement);
        }
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Set up DOM observer to detect caption containers added dynamically
   */
  private setupDOMObserver(): void {
    try {
      if (this.observer) {
        this.observer.disconnect();
      }
      
      // Create a new observer with a more basic configuration
      this.observer = new MutationObserver((mutations) => {
        // Add debounce for performance - only process every 500ms
        if (Date.now() - this.lastScan < 500) return;
        this.lastScan = Date.now();
        
        // Process subtitles with a single DOM lookup per mutation batch
        const captionsElements = document.querySelectorAll('.caption-window, .ytp-caption-segment');
        if (captionsElements.length > 0) {
          const captionText = Array.from(captionsElements)
            .map(el => el.textContent || '')
            .join(' ')
            .trim();
            
          if (captionText && !this.processedCaptions.has(captionsElements[0])) {
            console.log('WordStream: YouTube caption text:', captionText.substring(0, 30) + '...');
            this.processedCaptions.set(captionsElements[0], captionText);
            
            // Use a lightweight click handler instead of modifying the DOM
            this.setupClickHandler(captionsElements[0] as HTMLElement, captionText);
          }
        }
      });
      
      // Observe with minimal settings
      const playerArea = document.querySelector('#movie_player') || document;
      this.observer.observe(playerArea, {
        childList: true,
        subtree: true,
        characterData: false, // Reduce overhead by not tracking text changes directly
        attributes: false     // Don't track attribute changes
      });
      
    } catch (error) {
      this.handleError('Error setting up YouTube caption observer:', error);
    }
  }
  
  /**
   * Detect YouTube caption elements
   * @returns HTMLElement containing captions or null if none found
   */
  public async detect(): Promise<HTMLElement | null> {
    try {
      if (this.hasError && this.errorCount >= this.maxErrors) {
        console.log('WordStream: Too many errors, stopping YouTube caption detection');
        return null;
      }
      
      // Check if we're on a YouTube page
      const isYouTube = /youtube\.com\/(watch|shorts|embed|live)/i.test(window.location.href);
      if (!isYouTube) {
        return null;
      }
      
      // Only allow processing at a reasonable interval to prevent performance issues
      const now = Date.now();
      if (now - this.lastScan < this.scanInterval) {
        return null;
      }
      this.lastScan = now;
      
      // Don't proceed if not authenticated
      if (!this.isAuthenticated) {
        console.log('WordStream: User not authenticated, skipping YouTube caption detection');
        return null;
      }
      
      console.log('WordStream: Detecting YouTube captions, attempt', this.retryCount + 1);
      
      // For safety, wrap the core detection in a try/catch
      let captionContainer = null;
      try {
        // Find player (without excessive DOM queries)
        const player = document.querySelector('#movie_player') || 
                       document.querySelector('.html5-video-player') ||
                       document.querySelector('.ytd-player');
        
        if (!player) {
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
          }
          return null;
        }
        
        // Look for caption container using simpler selectors
        captionContainer = document.querySelector('.captions-text') || 
                           document.querySelector('.ytp-caption-segment') ||
                           document.querySelector('.caption-window');
                           
        if (captionContainer && captionContainer instanceof HTMLElement) {
          console.log('WordStream: Found YouTube caption container');
          this.captionContainers.add(captionContainer);
          
          // Set up a more gentle observer
          if (!captionContainer.hasAttribute('data-wordstream-observing')) {
            captionContainer.setAttribute('data-wordstream-observing', 'true');
            this.setupDOMObserver();
          }
          
          return captionContainer;
        } else {
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
          }
          return null;
        }
      } catch (error) {
        this.handleError('Error in YouTube caption detection:', error);
        return null;
      }
    } catch (outerError) {
      this.handleError('Critical error in YouTube caption detection:', outerError);
      return null;
    }
  }
  
  /**
   * Observe YouTube player for state changes
   * @param player YouTube player element
   */
  private observeYouTubePlayer(player: HTMLElement): void {
    // Skip if already observing
    if (this.playerObserver || player.dataset.wordstreamPlayerObserved === 'true') {
      return;
    }
    
    // Mark as observed
    player.dataset.wordstreamPlayerObserved = 'true';
    
    // Create observer for player state changes
    this.playerObserver = new MutationObserver((mutations) => {
      // Check for class changes which indicate state changes
      const stateChanges = mutations.filter(m => 
        m.type === 'attributes' && 
        m.attributeName === 'class' &&
        m.target instanceof HTMLElement
      );
      
      if (stateChanges.length > 0) {
        // Check if we're in an ad
        const isAdPlaying = player.classList.contains('ad-showing') || 
                           player.classList.contains('ad-interrupting');
        
        // Get player state (playing, paused, etc)
        const state = Array.from(player.classList)
          .find(c => c.endsWith('-mode'))
          ?.replace('-mode', '') || '';
        
        console.log(`WordStream: YouTube player state changed: ${state}${isAdPlaying ? ' (Ad playing)' : ''}`);
        
        // Restart caption detection after state change
        // This helps when captions disappear during ads or when video is paused
        if (!isAdPlaying && (state === 'playing' || state === 'unstarted')) {
          // Reset retry count and try again after a short delay
          this.retryCount = 0;
          setTimeout(() => this.detect(), 1000);
        }
      }
    });
    
    // Observe class changes on player
    this.playerObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Also observe video time updates to detect new videos
    const videoElement = player.querySelector('video');
    if (videoElement) {
      videoElement.addEventListener('timeupdate', () => {
        // Check if we might need to re-detect captions (if none are currently detected)
        if (this.captionContainers.size === 0) {
          // Only check occasionally to avoid constant checks
          if (Math.random() < 0.05) { // ~5% chance each time
            this.detect();
          }
        }
      });
    }
  }
  
  /**
   * Process a caption element
   * @param caption HTMLElement containing captions
   */
  public processCaption(caption: HTMLElement): void {
    if (!caption || !this.isAuthenticated) return;
    
    try {
      const text = caption.textContent || '';
      if (text.trim()) {
        console.log('WordStream: Processing YouTube caption:', text.substring(0, 30) + '...');
        this.setupClickHandler(caption, text);
      }
    } catch (error) {
      this.handleError('Error processing YouTube caption:', error);
    }
  }
  
  /**
   * Clean up resources when detector is no longer needed
   */
  public cleanup(): void {
    console.log('WordStream: Cleaning up YouTube detector');
    
    try {
      // Disconnect all observers
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      if (this.playerObserver) {
        this.playerObserver.disconnect();
        this.playerObserver = null;
      }
      
      // Clear interval
      if (this.cleanupWatcher) {
        clearInterval(this.cleanupWatcher);
        this.cleanupWatcher = null;
      }
      
      // Clean up any popups
      const popup = document.getElementById('wordstream-popup');
      if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
      
      // Reset state
      this.captionContainers.clear();
      this.videoElements.clear();
      this.processedCaptions = new WeakMap();
      this.processedNodes = new WeakSet();
      this.retryCount = 0;
      this.hasError = false;
      this.errorCount = 0;
      
    } catch (error) {
      console.error('WordStream: Error during cleanup:', error);
    }
  }
  
  /**
   * Observe a caption container for changes
   * @param container Caption container element
   */
  private observeCaptionContainer(container: HTMLElement): void {
    // Check if we're already observing this container
    if (!container || container.dataset.wordstreamObserved === 'true') {
      return;
    }
    
    // Mark as observed to prevent duplicate observers
    container.dataset.wordstreamObserved = 'true';
    
    // Create observer if needed
    if (!this.observer) {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Process added nodes
            mutation.addedNodes.forEach(node => {
              if (node instanceof HTMLElement) {
                this.processElementNode(node);
              } else if (node instanceof Text) {
                this.processTextNode(node);
              }
            });
          } else if (mutation.type === 'characterData' && mutation.target instanceof Text) {
            // Process text changes
            this.processTextNode(mutation.target);
          }
        }
      });
    }
    
    // Start observing
    this.observer.observe(container, {
      childList: true,
      characterData: true,
      subtree: true
    });
    
    // Process existing content
    this.processCaptionText(container);
  }
  
  /**
   * Process all text within a caption container
   * @param container Caption container element
   */
  private processCaptionText(container: HTMLElement): void {
    // Process element nodes
    Array.from(container.children).forEach(child => {
      if (child instanceof HTMLElement) {
        this.processElementNode(child);
      }
    });
    
    // Process text nodes
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode instanceof Text) {
        this.processTextNode(textNode);
      }
      textNode = walker.nextNode();
    }
  }
  
  /**
   * Process an individual HTML element node
   * @param element HTML element to process
   */
  private processElementNode(element: HTMLElement): void {
    // Skip if already processed
    if (element.dataset.wordstreamProcessed === 'true') {
      return;
    }
    
    // Mark as processed
    element.dataset.wordstreamProcessed = 'true';
    
    // Process text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode instanceof Text) {
        this.processTextNode(textNode);
      }
      textNode = walker.nextNode();
    }
  }
  
  /**
   * Process a text node for word highlighting
   * @param textNode Text node to process
   */
  private processTextNode(textNode: Text): void {
    // Skip if already processed
    if (this.processedCaptions.has(textNode)) {
      return;
    }
    
    // Store original text to avoid processing it again
    this.processedCaptions.set(textNode, textNode.nodeValue || '');
    
    // Skip empty or whitespace-only nodes
    if (!textNode.nodeValue || !textNode.nodeValue.trim()) {
      return;
    }
    
    // Get parent element
    const parentElement = textNode.parentElement;
    if (!parentElement) return;
    
    // For YouTube Music lyrics, we need special handling
    if (this.isMusic && (
      parentElement.closest('.ytmusic-lyrics-renderer') ||
      parentElement.closest('.ytmusic-player-lyrics-line')
    )) {
      this.processLyricsElement(parentElement);
      return;
    }
    
    // Replace the text node with word elements
    const fragment = document.createDocumentFragment();
    const text = textNode.nodeValue || '';
    
    // Enhanced regex to handle various punctuation and special characters correctly
    // This pattern separates words, punctuation, and whitespace while preserving them
    const parts = text.split(/(\s+|[.,!?;:()\[\]{}""''`\-–—…])/);
    
    // Filter out empty strings that might result from the split
    const filteredParts = parts.filter(part => part !== '');
    
    filteredParts.forEach((part) => {
      // Check if the part is whitespace or punctuation
      if (!part.trim() || /^[.,!?;:()\[\]{}""''`\-–—…]+$/.test(part)) {
        // For whitespace or punctuation, just add a text node
        fragment.appendChild(document.createTextNode(part));
        return;
      }
      
      // Create a span for the word
      const wordSpan = document.createElement('span');
      wordSpan.textContent = part;
      wordSpan.className = 'wordstream-word';
      wordSpan.dataset.originalWord = part;
      
      // Extract pure word without any attached punctuation for translation
      const pureWord = part.replace(/[.,!?;:()\[\]{}""''`\-–—…]/g, '');
      if (pureWord !== part) {
        wordSpan.dataset.pureWord = pureWord;
      }
      
      // Store normalized form for dictionary lookup (lowercase)
      wordSpan.dataset.normalizedWord = pureWord.toLowerCase();
      
      // Add click event to translate word
      wordSpan.addEventListener('click', this.handleWordClick.bind(this));
      
      fragment.appendChild(wordSpan);
    });
    
    // Replace the text node with the fragment
    if (parentElement) {
      parentElement.replaceChild(fragment, textNode);
    }
  }
  
  /**
   * Special handler for YouTube Music lyrics
   * @param element Lyrics container element
   */
  private processLyricsElement(element: HTMLElement): void {
    // Skip if already processed
    if (element.dataset.wordstreamProcessed) return;
    element.dataset.wordstreamProcessed = 'true';
    
    // Preserve the original content for reference
    const originalContent = element.textContent || '';
    
    // Clear the element's content
    element.innerHTML = '';
    
    // Split text into lines, preserving line breaks
    const lines = originalContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines
      if (!line.trim()) {
        element.appendChild(document.createElement('br'));
        continue;
      }
      
      // Process the line with enhanced word detection
      const lineFragment = document.createDocumentFragment();
      
      // Enhanced regex to handle various punctuation and special characters
      const parts = line.split(/(\s+|[.,!?;:()\[\]{}""''`\-–—…])/);
      const filteredParts = parts.filter(part => part !== '');
      
      filteredParts.forEach((part) => {
        // Check if the part is whitespace or punctuation
        if (!part.trim() || /^[.,!?;:()\[\]{}""''`\-–—…]+$/.test(part)) {
          lineFragment.appendChild(document.createTextNode(part));
          return;
        }
        
        // Create a span for the word
        const wordSpan = document.createElement('span');
        wordSpan.textContent = part;
        wordSpan.className = 'wordstream-word';
        wordSpan.dataset.originalWord = part;
        
        // Extract pure word without punctuation
        const pureWord = part.replace(/[.,!?;:()\[\]{}""''`\-–—…]/g, '');
        if (pureWord !== part) {
          wordSpan.dataset.pureWord = pureWord;
        }
        
        // Store normalized form for dictionary lookup
        wordSpan.dataset.normalizedWord = pureWord.toLowerCase();
        
        // Add click event to translate word
        wordSpan.addEventListener('click', this.handleWordClick.bind(this));
        
        lineFragment.appendChild(wordSpan);
      });
      
      // Add the processed line
      element.appendChild(lineFragment);
      
      // Add line break if not the last line
      if (i < lines.length - 1) {
        element.appendChild(document.createElement('br'));
      }
    }
  }
  
  /**
   * Handle click on a word
   * @param event Click event
   */
  private handleWordClick(event: MouseEvent): void {
    // Get the clicked element
    const target = event.target as HTMLElement;
    
    // Get the word from the element
    const word = target.textContent?.trim();
    if (!word) return;
    
    // Show translation popup
    import('../ui/translation-popup').then(({ showTranslationPopup }) => {
      showTranslationPopup({
        originalWord: word,
        translatedWord: '',  // We'll let the popup get the translation
        position: {
          x: event.clientX,
          y: event.clientY
        }
      });
    });
  }
  
  /**
   * Check for removed videos and clean up
   */
  private checkForRemovedVideos(): void {
    try {
      // Clean up any resources for removed videos
      for (const container of this.captionContainers) {
        if (!document.body.contains(container)) {
          this.captionContainers.delete(container);
        }
      }
    } catch (error) {
      console.error('WordStream: Error checking for removed videos:', error);
    }
  }
  
  private setupClickHandler(container: HTMLElement, text: string): void {
    if (!container || !this.isAuthenticated) return;
    
    // Instead of modifying the DOM, just add a click handler to the container
    if (!container.hasAttribute('data-wordstream-handler')) {
      container.setAttribute('data-wordstream-handler', 'true');
      
      container.addEventListener('click', (event) => {
        // Extract clicked word from selection or approximate position
        let word = '';
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          word = selection.toString().trim();
        } else {
          // Approximate word from click position (simplified)
          const words = text.split(/\s+/);
          const rect = container.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const approximateIndex = Math.floor((x / rect.width) * words.length);
          word = words[Math.min(approximateIndex, words.length - 1)];
        }
        
        if (!word) return;
        
        console.log('WordStream: YouTube word clicked:', word);
        
        // Show translation popup
        this.showTranslationPopup(word, '', {
          x: event.clientX,
          y: event.clientY
        });
        
        // Send translation request
        chrome.runtime.sendMessage({
          type: MessageType.TRANSLATE_WORD,
          payload: {
            text: word,
            context: text
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Translation error:', chrome.runtime.lastError);
            return;
          }
          
          if (response && response.success) {
            this.updateTranslationPopup(word, response.data.translation);
          }
        });
      });
    }
  }
  
  private showTranslationPopup(word: string, translation: string, position: {x: number, y: number}): void {
    // Create or get popup
    let popup = document.getElementById('wordstream-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'wordstream-popup';
      popup.style.position = 'absolute';
      popup.style.zIndex = '100000';
      popup.style.background = 'white';
      popup.style.border = '1px solid #ccc';
      popup.style.borderRadius = '4px';
      popup.style.padding = '8px';
      popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      document.body.appendChild(popup);
    }
    
    // Set content and position
    popup.innerHTML = `
      <div style="margin-bottom: 8px"><strong>${word}</strong></div>
      <div>${translation || 'Translating...'}</div>
      <div style="margin-top: 10px; text-align: right">
        <button id="wordstream-save-btn">Save</button>
        <button id="wordstream-close-btn">Close</button>
      </div>
    `;
    
    popup.style.left = `${position.x}px`;
    popup.style.top = `${position.y + 20}px`;
    popup.style.display = 'block';
    
    // Add event listeners
    const closeBtn = document.getElementById('wordstream-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (popup) popup.style.display = 'none';
      });
    }
    
    // Close on outside click after delay
    setTimeout(() => {
      document.addEventListener('click', function closeHandler(e) {
        if (popup && !popup.contains(e.target as Node)) {
          popup.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      });
    }, 100);
  }
  
  private updateTranslationPopup(word: string, translation: string): void {
    const popup = document.getElementById('wordstream-popup');
    if (popup) {
      const contentDiv = popup.querySelector('div:nth-child(2)');
      if (contentDiv) {
        contentDiv.textContent = translation || 'No translation available';
      }
    }
  }
  
  private handleError(message: string, error: any) {
    console.error(`WordStream: ${message}`, error);
    this.hasError = true;
    this.errorCount++;
    
    // If we've hit the error limit, clean up resources
    if (this.errorCount >= this.maxErrors) {
      this.cleanup();
    }
  }
} 