/// <reference types="chrome"/>

import { BaseCaptionDetector } from './base-detector';
import { CaptionsLanguageInfo } from '@/types';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';

/**
 * Universal caption detector that works with any website containing videos
 * This detector attempts to find captions on any web page, not just specific
 * streaming sites like YouTube or Netflix
 */
export class UniversalCaptionDetector extends BaseCaptionDetector {
  source = 'universal';
  private videoElements: HTMLVideoElement[] = [];
  private captionContainers: HTMLElement[] = [];
  private activeContainer: HTMLElement | null = null;
  private scanInterval: number | null = null;

  protected initializeObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      this.animationFrameId = requestAnimationFrame(() => {
        const textNodesToProcess = new Set<Text>();
        let newCaptionContainersFound = false;

        // Look for caption text in mutations
        mutations.forEach(mutation => {
          if (mutation.type === 'characterData' && mutation.target instanceof Text) {
            const parent = mutation.target.parentElement;
            // If the parent has text that looks like a caption (in the caption container or has caption-like classes)
            if (
              parent && 
              (this.isInCaptionContainer(parent) || this.hasCaptionLikeAttributes(parent))
            ) {
              textNodesToProcess.add(mutation.target);
              
              // If we found a new potential caption container, remember it
              if (!this.isInCaptionContainer(parent) && this.hasCaptionLikeAttributes(parent)) {
                this.addCaptionContainer(this.findCaptionContainer(parent));
                newCaptionContainersFound = true;
              }
            }
          } else if (mutation.type === 'childList') {
            // Look for added nodes that might be captions
            mutation.addedNodes.forEach(node => {
              // For text nodes
              if (node instanceof Text) {
                const parent = node.parentElement;
                if (
                  parent && 
                  (this.isInCaptionContainer(parent) || this.hasCaptionLikeAttributes(parent))
                ) {
                  textNodesToProcess.add(node);
                  
                  // If we found a new potential caption container, remember it
                  if (!this.isInCaptionContainer(parent) && this.hasCaptionLikeAttributes(parent)) {
                    this.addCaptionContainer(this.findCaptionContainer(parent));
                    newCaptionContainersFound = true;
                  }
                }
              } 
              // For element nodes
              else if (node instanceof HTMLElement) {
                // Check if this element looks like a caption container
                if (this.hasCaptionLikeAttributes(node)) {
                  this.addCaptionContainer(node);
                  newCaptionContainersFound = true;
                }
                
                // Also check any text nodes inside this element
                const textNodes = this.getTextNodesIn(node);
                textNodes.forEach(textNode => {
                  const parent = textNode.parentElement;
                  if (
                    parent && 
                    (this.isInCaptionContainer(parent) || this.hasCaptionLikeAttributes(parent))
                  ) {
                    textNodesToProcess.add(textNode);
                    
                    // If we found a new potential caption container, remember it
                    if (!this.isInCaptionContainer(parent) && this.hasCaptionLikeAttributes(parent)) {
                      this.addCaptionContainer(this.findCaptionContainer(parent));
                      newCaptionContainersFound = true;
                    }
                  }
                });
              }
            });
          }
        });

        // Process all the text nodes we found
        textNodesToProcess.forEach(node => this.processTextNode(node));
        
        // If we found new caption containers, we should start observing them
        if (newCaptionContainersFound) {
          this.captionContainers.forEach(container => {
            this.startObserving(container);
          });
        }
        
        this.animationFrameId = null;
      });
    });
  }

  /**
   * Check if an element is already in our list of caption containers
   */
  private isInCaptionContainer(element: HTMLElement): boolean {
    return this.captionContainers.some(container => 
      container === element || container.contains(element)
    );
  }

  /**
   * Find the appropriate caption container for an element
   * This attempts to find the parent container that holds all the captions
   */
  private findCaptionContainer(element: HTMLElement): HTMLElement {
    // Try to find a parent that looks like a caption container
    let current: HTMLElement | null = element;
    let depth = 0;
    const MAX_DEPTH = 5; // Don't go too far up the DOM tree
    
    while (current && depth < MAX_DEPTH) {
      if (this.hasCaptionLikeAttributes(current, true)) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }
    
    // If we didn't find a better container, use the original element
    return element;
  }

  /**
   * Add a caption container if it's not already in our list
   */
  private addCaptionContainer(container: HTMLElement): void {
    if (!this.isInCaptionContainer(container)) {
      console.log('WordStream Universal: Found new caption container', container);
      this.captionContainers.push(container);
      // Set as active container
      this.activeContainer = container;
    }
  }

  /**
   * Check if an element has caption-like attributes
   * This is a heuristic to identify elements that might contain captions
   */
  private hasCaptionLikeAttributes(element: HTMLElement, isContainer = false): boolean {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    
    // Classes and IDs that suggest this might be a caption
    const captionTerms = [
      'caption', 'subtitle', 'cue', 'transcript', 'cc', 'sub', 
      'track', 'vtt', 'text-track', 'texttrak'
    ];
    
    // Check for container-specific attributes if looking for a container
    if (isContainer) {
      const containerTerms = [
        'caption-window', 'subtitle-container', 'captions-area', 'transcript-container',
        'video-text', 'player-text'
      ];
      
      const hasContainerTerm = containerTerms.some(term => 
        className.includes(term) || id.includes(term) || ariaLabel.includes(term)
      );
      
      if (hasContainerTerm) return true;
    }
    
    // Check for caption terms in class, id or aria-label
    const hasCaptionTerm = captionTerms.some(term => 
      className.includes(term) || id.includes(term) || ariaLabel.includes(term)
    );
    
    // Other heuristics based on common caption characteristics
    const isOverlayOnVideo = this.isOverlayingVideo(element);
    const hasTimedAppearance = element.classList.contains('active') || 
                              element.style.display === 'block' || 
                              element.style.visibility === 'visible';
    const hasTextContent = element.textContent?.trim().length > 0;
    
    // Positioning clues that suggest this is a caption
    const hasPositioningClues = element.style.position === 'absolute' || 
                               element.style.bottom !== '' || 
                               element.style.position === 'fixed';
                               
    // If this is being analyzed as a potential caption element
    if (!isContainer) {
      // Small text blocks that appear at the bottom of the screen are likely captions
      return (hasCaptionTerm || isOverlayOnVideo) && hasTextContent;
    }
    
    // If we're looking for a container
    return hasCaptionTerm || (isOverlayOnVideo && hasPositioningClues);
  }

  /**
   * Check if an element is overlaying a video
   */
  private isOverlayingVideo(element: HTMLElement): boolean {
    // If no videos have been detected, we can't check for overlay
    if (this.videoElements.length === 0) return false;
    
    // Try to find the nearest video element
    let current: HTMLElement | null = element;
    let video: HTMLVideoElement | null = null;
    let depth = 0;
    const MAX_DEPTH = 10;
    
    // Go up the DOM tree looking for a parent with a video
    while (current && depth < MAX_DEPTH) {
      if (current.querySelector('video')) {
        video = current.querySelector('video');
        break;
      }
      current = current.parentElement;
      depth++;
    }
    
    // If we didn't find a video nearby, check if any of our known videos contain this element
    if (!video) {
      for (const videoEl of this.videoElements) {
        const videoRect = videoEl.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Check if the element's rectangle overlaps with the video's rectangle
        const overlaps = !(
          elementRect.right < videoRect.left || 
          elementRect.left > videoRect.right || 
          elementRect.bottom < videoRect.top || 
          elementRect.top > videoRect.bottom
        );
        
        if (overlaps) return true;
      }
      
      return false;
    }
    
    // If we found a video, check if the element is positioned over it
    return true;
  }

  /**
   * Main detection method that looks for videos and caption containers
   */
  public async detect(): Promise<HTMLElement | null> {
    console.log('WordStream Universal: Detecting captions...');
    
    // Find all video elements on the page
    this.videoElements = Array.from(document.querySelectorAll('video'));
    console.log('WordStream Universal: Found', this.videoElements.length, 'video elements');
    
    // Find potential caption containers
    this.findCaptionContainers();
    
    // If we found caption containers, use the first one
    if (this.captionContainers.length > 0) {
      this.activeContainer = this.captionContainers[0];
      
      // Add floating controls
      this.addFloatingControls();
      
      // Start observing the container
      this.startObserving(this.activeContainer);
      
      console.log('WordStream Universal: Found caption container', this.activeContainer);
      return this.activeContainer;
    }
    
    // If we didn't find any containers, but we found videos,
    // we'll set up scanning to find captions that might appear later
    if (this.videoElements.length > 0) {
      console.log('WordStream Universal: Setting up caption scanning...');
      this.setupCaptionScanning();
    }
    
    // Return the first video element as a fallback
    return this.videoElements.length > 0 
      ? this.videoElements[0].parentElement 
      : null;
  }

  /**
   * Find potential caption containers on the page
   */
  private findCaptionContainers(): void {
    // Clear existing containers
    this.captionContainers = [];
    
    // Look for elements with caption-like classes or attributes
    const potentialContainers = document.querySelectorAll('div, span, p, section');
    
    for (const element of potentialContainers) {
      if (this.hasCaptionLikeAttributes(element as HTMLElement, true)) {
        this.addCaptionContainer(element as HTMLElement);
      }
    }
    
    // For each video, also look for caption-like elements nearby
    this.videoElements.forEach(video => {
      const parent = video.parentElement;
      if (parent) {
        const nearbyElements = parent.querySelectorAll('div, span, p');
        for (const element of nearbyElements) {
          if (this.hasCaptionLikeAttributes(element as HTMLElement, true)) {
            this.addCaptionContainer(element as HTMLElement);
          }
        }
      }
    });
  }

  /**
   * Set up scanning for captions if we couldn't find them initially
   */
  private setupCaptionScanning(): void {
    // Clear any existing interval
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    // Set up a new interval to periodically scan for caption containers
    this.scanInterval = window.setInterval(() => {
      // Look for caption containers
      this.findCaptionContainers();
      
      // If we found any, start observing them
      if (this.captionContainers.length > 0) {
        this.captionContainers.forEach(container => {
          this.startObserving(container);
        });
        
        // Set the active container
        this.activeContainer = this.captionContainers[0];
        
        // Add floating controls
        this.addFloatingControls();
        
        // Stop scanning
        if (this.scanInterval) {
          clearInterval(this.scanInterval);
          this.scanInterval = null;
        }
        
        console.log('WordStream Universal: Found caption containers during scan', this.captionContainers);
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Process a caption container
   */
  public processCaption(captionContainer: HTMLElement): void {
    if (!captionContainer) return;
    
    console.log('WordStream Universal: Processing caption container', captionContainer);
    
    // Add to our list of containers if it's not already there
    this.addCaptionContainer(captionContainer);
    
    // Process text nodes in the container
    const textNodes = this.getTextNodesIn(captionContainer);
    textNodes.forEach(node => this.processTextNode(node));
    
    // Start observing this container
    this.startObserving(captionContainer);
  }

  /**
   * Start observing a caption container for changes
   */
  public startObserving(captionContainer: HTMLElement): void {
    if (!this.observer || !captionContainer) return;
    
    // Only observe each container once
    if (captionContainer.dataset.wordstreamObserved) return;
    captionContainer.dataset.wordstreamObserved = 'true';
    
    this.observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    console.log('WordStream Universal: Started observing caption container', captionContainer);
  }

  /**
   * Stop observing
   */
  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      console.log('WordStream Universal: Stopped observing');
    }
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    super.cleanup();
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.videoElements = [];
    this.captionContainers = [];
    this.activeContainer = null;
    
    console.log('WordStream Universal: Cleaned up resources');
  }

  /**
   * Add floating controls near the video
   */
  public addFloatingControls(): void {
    // Create a container for the controls
    if (this.controlsContainer) {
      this.removeFloatingControls();
    }
    
    this.controlsContainer = document.createElement('div');
    this.controlsContainer.className = 'wordstream-floating-controls';
    this.controlsContainer.style.position = 'absolute';
    this.controlsContainer.style.top = '10px';
    this.controlsContainer.style.right = '10px';
    this.controlsContainer.style.zIndex = '9999';
    
    // Find the best container to attach our controls to
    let playerContainer: HTMLElement | null = null;
    
    // First, try to find a container with a video
    if (this.videoElements.length > 0) {
      const firstVideo = this.videoElements[0];
      // Try to get the video container (usually a div around the video)
      playerContainer = firstVideo.parentElement;
      
      // If the parent is too narrow, try to find a larger container
      if (playerContainer && playerContainer.offsetWidth < 400) {
        playerContainer = playerContainer.parentElement;
      }
    }
    
    // If we didn't find a suitable player container, try to use the caption container
    if (!playerContainer && this.activeContainer) {
      playerContainer = this.activeContainer.parentElement;
    }
    
    // Fallback to body if we still don't have a container
    if (!playerContainer) {
      playerContainer = document.body;
    }
    
    if (playerContainer) {
      // Make sure our container is positioned properly
      if (playerContainer === document.body) {
        this.controlsContainer.style.position = 'fixed';
        this.controlsContainer.style.top = '20px';
        this.controlsContainer.style.right = '20px';
      }
      
      playerContainer.appendChild(this.controlsContainer);
      
      // Render React component
      this.renderControls(this.controlsContainer, true, true, true);
      
      console.log('WordStream Universal: Added floating controls to', playerContainer);
    }
  }

  /**
   * Remove floating controls
   */
  public removeFloatingControls(): void {
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      if (this.controlsRoot) {
        try {
          ReactDOM.unmountComponentAtNode(this.controlsContainer);
        } catch (error) {
          console.error('WordStream Universal: Error unmounting controls:', error);
        }
        this.controlsRoot = null;
      }
      
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
      this.controlsContainer = null;
    }
  }

  /**
   * Render the floating controls
   */
  public renderControls(container: HTMLElement, persist: boolean = true, showGemini: boolean = false, showNotes: boolean = false): void {
    if (!container) return;
    
    try {
      if (this.controlsRoot) {
        ReactDOM.unmountComponentAtNode(container);
        this.controlsRoot = null;
      }
      
      this.controlsRoot = ReactDOM.createRoot(container);
      
      // Render the FloatingControls React component
      this.controlsRoot.render(
        React.createElement(FloatingControls, { 
          source: 'universal',
          showGemini,
          showNotes,
          persist
        })
      );
    } catch (error) {
      console.error('WordStream Universal: Error rendering controls:', error);
    }
  }

  /**
   * Get caption language information
   */
  protected detectCaptionsLanguage(): CaptionsLanguageInfo {
    // Try to detect language from video track elements
    if (this.videoElements.length > 0) {
      const video = this.videoElements[0];
      const tracks = video.textTracks;
      
      if (tracks && tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (track.mode === 'showing' && track.language) {
            return {
              language: track.language,
              languageName: track.label || track.language,
              isAuto: false
            };
          }
        }
      }
    }
    
    // Try to detect from document language
    const docLang = document.documentElement.lang;
    if (docLang) {
      return {
        language: docLang,
        languageName: docLang,
        isAuto: false
      };
    }
    
    // Default to auto detection
    return {
      language: 'auto',
      languageName: 'Auto-Detected',
      isAuto: true
    };
  }

  /**
   * Get the context of a subtitle
   */
  protected getSubtitleContext(wordElement: HTMLElement): string {
    try {
      // Try to find the closest paragraph or div containing the word
      const container = wordElement.closest('p, div, span, .caption, .subtitle');
      if (container) {
        return container.textContent || '';
      }
      
      // If we can't find a container, use the word itself
      return wordElement.textContent || '';
    } catch (error) {
      console.error('WordStream Universal: Error getting subtitle context:', error);
      return '';
    }
  }
} 