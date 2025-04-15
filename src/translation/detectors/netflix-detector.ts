/// <reference types="chrome"/>

import { BaseCaptionDetector } from './base-detector';
import { CaptionsLanguageInfo } from '@/types';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';

export class NetflixCaptionDetector extends BaseCaptionDetector {
  source = 'netflix';

  protected initializeObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      this.animationFrameId = requestAnimationFrame(() => {
        const textNodesToProcess = new Set<Text>();

        mutations.forEach(mutation => {
          if (mutation.type === 'characterData' && mutation.target instanceof Text) {
            const parent = mutation.target.parentElement;
            if (parent?.classList.contains('player-timedtext-text-container')) {
              textNodesToProcess.add(mutation.target);
            }
          } else if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node instanceof Text) {
                const parent = node.parentElement;
                if (parent?.classList.contains('player-timedtext-text-container')) {
                  textNodesToProcess.add(node);
                }
              } else if (node instanceof HTMLElement && 
                        node.classList.contains('player-timedtext-text-container')) {
                node.childNodes.forEach(child => {
                  if (child instanceof Text) {
                    textNodesToProcess.add(child);
                  }
                });
              }
            });
          }
        });

        textNodesToProcess.forEach(node => this.processTextNode(node));
        this.animationFrameId = null;
      });
    });
  }

  public async detect(): Promise<HTMLElement | null> {
    const captionContainer = document.querySelector('.player-timedtext');
    if (captionContainer) {
      this.addFloatingControls();
      return captionContainer as HTMLElement;
    }

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const container = document.querySelector('.player-timedtext');
        if (container) {
          obs.disconnect();
          this.addFloatingControls();
          resolve(container as HTMLElement);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10000);
    });
  }

  public processCaption(captionContainer: HTMLElement): void {
    if (!captionContainer) return;
    
    this.processTextContainer(captionContainer);
    this.startObserving(captionContainer);
  }

  private processTextContainer(container: HTMLElement): void {
    if (!container) return;

    const textNodes = this.getTextNodesIn(container);
    textNodes.forEach(node => this.processTextNode(node));
  }

  protected detectCaptionsLanguage(): CaptionsLanguageInfo {
    try {
      // Try to get language from Netflix's subtitle menu
      const subtitleMenu = document.querySelector('.track-list-subtitles');
      if (subtitleMenu) {
        const selectedTrack = subtitleMenu.querySelector('[aria-selected="true"]');
        if (selectedTrack) {
          const label = selectedTrack.textContent || '';
          const isAuto = label.toLowerCase().includes('auto-generated');
          
          // Netflix usually includes language code in data attributes
          const langCode = selectedTrack.getAttribute('data-lang') || 
                          selectedTrack.getAttribute('lang') ||
                          'en';
          
          return {
            language: langCode,
            languageName: label,
            isAuto
          };
        }
      }

      // Fallback: Try to get from video player
      const player = document.querySelector('.VideoContainer');
      if (player) {
        const lang = player.getAttribute('lang') || document.documentElement.lang;
        if (lang) {
          return {
            language: lang,
            languageName: lang,
            isAuto: false
          };
        }
      }

      // Default fallback
      return {
        language: 'auto',
        languageName: 'Auto-Detected',
        isAuto: true
      };
    } catch (error) {
      console.error('WordStream Netflix: Error detecting captions language:', error);
      return {
        language: 'auto',
        languageName: 'Auto-Detected',
        isAuto: true
      };
    }
  }

  protected getSubtitleContext(wordElement: HTMLElement): string {
    try {
      const textContainer = wordElement.closest('.player-timedtext-text-container');
      if (textContainer) {
        return textContainer.textContent || '';
      }
      return '';
    } catch (error) {
      console.error('WordStream Netflix: Error getting subtitle context:', error);
      return '';
    }
  }
  
  public startObserving(captionContainer: HTMLElement): void {
    if (!this.observer || !captionContainer) return;
    
    this.observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    console.log('WordStream Netflix: Started observing caption container');
  }

  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      console.log('WordStream Netflix: Stopped observing caption container');
    }
  }

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
    
    // Find the Netflix player container
    const playerContainer = document.querySelector('.watch-video') || 
                            document.querySelector('.NFPlayer') || 
                            document.querySelector('.VideoContainer');
    
    if (playerContainer instanceof HTMLElement) {
      playerContainer.appendChild(this.controlsContainer);
      
      // Render React component
      this.renderControls(this.controlsContainer, true, true, true);
      
      console.log('WordStream Netflix: Added floating controls');
    }
  }

  public removeFloatingControls(): void {
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      if (this.controlsRoot) {
        try {
          ReactDOM.unmountComponentAtNode(this.controlsContainer);
        } catch (error) {
          console.error('WordStream Netflix: Error unmounting controls:', error);
        }
        this.controlsRoot = null;
      }
      
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
      this.controlsContainer = null;
    }
  }

  public renderControls(container: HTMLElement, persist: boolean = true, showGemini: boolean = false, showNotes: boolean = false) {
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
          source: 'netflix',
          showGemini,
          showNotes,
          persist
        })
      );
    } catch (error) {
      console.error('WordStream Netflix: Error rendering controls:', error);
    }
  }
} 