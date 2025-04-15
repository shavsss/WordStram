/// <reference types="chrome"/>

import { TranslationService } from '../services/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { CaptionDetector } from './types';
import { CaptionsLanguageInfo } from '@/types';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';
import { safeDate } from '@/utils/date-utils';

// Helper function for error handling
function safeStringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch (e) {
        return 'Object error - cannot stringify';
      }
    }
    
    return String(error);
  } catch (e) {
    return 'Unknown error - cannot format';
  }
}

// Define global type for window.WordStream
declare global {
  interface Window {
    WordStream?: {
      local?: {
        isAuthenticated?: boolean;
      };
    };
  }
}

export abstract class BaseCaptionDetector implements CaptionDetector {
  abstract source: string;
  protected translationService: TranslationService;
  protected observer: MutationObserver | null = null;
  protected popup: HTMLElement | null = null;
  protected lastProcessedText: WeakMap<Text, string> = new WeakMap();
  protected animationFrameId: number | null = null;
  protected controlsContainer: HTMLElement | null = null;
  protected videoUpdateInterval: number | null = null;
  protected currentVideoTime: number = 0;
  protected videoDuration: number = 0;
  protected controlsRoot: any = null;

  constructor() {
    this.translationService = TranslationService.getInstance();
    this.initializeObserver();
  }

  // Abstract methods that must be implemented by platform-specific detectors
  protected abstract initializeObserver(): void;
  protected abstract detectCaptionsLanguage(): CaptionsLanguageInfo;
  protected abstract getSubtitleContext(wordElement: HTMLElement): string;

  // Common method to wait for Chrome API
  protected async waitForChromeAPI(maxRetries = 5, delayMs = 500): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        if (chrome && chrome.runtime && chrome.storage) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts >= maxRetries) {
          clearInterval(checkInterval);
          resolve(false);
        }
        attempts++;
      }, delayMs);
    });
  }

  // Common method to handle word clicks
  public async handleWordClick(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!event.target || !(event.target instanceof HTMLElement)) {
      console.error('WordStream: Invalid event target for handleWordClick');
      return;
    }

    try {
      // Wait for Chrome API to be available
      const apiAvailable = await this.waitForChromeAPI();
      if (!apiAvailable) {
        this.showTranslationPopup('Extension not initialized. Please refresh the page.', event);
        return;
      }

      // Get the word and context
      const wordElement = event.target;
      const text = wordElement.textContent?.trim();
      if (!text) {
        return;
      }

      // Get target language from storage
      const storageResult = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['settings'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(result);
        });
      });

      // Get the target language (default to English if not set)
      const targetLang = storageResult?.settings?.targetLanguage || 'en';

      // Get translation
      const translation = await this.getTranslation(text, targetLang);

      // Display translation in popup
      this.showTranslationPopup(translation.translatedText || 'Translation error', event);

      // Check if user is authenticated before saving
      if (window.WordStream?.local?.isAuthenticated !== true) {
        console.log(`WordStream ${this.source}: Word translation shown, but saving skipped - user not authenticated`);
        return;
      }

      // Save the word if authenticated
      this.saveWord(text, translation, targetLang);
    } catch (error) {
      console.error(`WordStream ${this.source}: Error in handleWordClick:`, safeStringifyError(error));
      this.showTranslationPopup(`Error: ${safeStringifyError(error)}`, event);
    }
  }

  // Common popup implementation
  protected showTranslationPopup(translatedText: string, event: MouseEvent): void {
    // Remove existing popup if any
    if (this.popup) {
      document.body.removeChild(this.popup);
      this.popup = null;
    }

    // Create new popup
    this.popup = document.createElement('div');
    this.popup.className = 'wordstream-translation-popup';
    
    // Position it near the clicked word
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    
    // Set popup styles
    Object.assign(this.popup.style, {
      position: 'fixed',
      zIndex: '9999',
      backgroundColor: '#333',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '4px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      fontSize: '14px',
      maxWidth: '300px',
      top: `${rect.top - 40}px`,
      left: `${rect.left + (rect.width / 2)}px`,
      transform: 'translateY(-50%)',
      opacity: '0',
      transition: 'opacity 0.2s ease-in-out'
    });
    
    // Add original word
    const originalElement = document.createElement('div');
    originalElement.className = 'original-word';
    originalElement.textContent = (event.target as HTMLElement).textContent || '';
    Object.assign(originalElement.style, {
      fontSize: '12px',
      color: '#aaa',
      marginBottom: '4px'
    });
    this.popup.appendChild(originalElement);
    
    // Add translated word
    const translatedElement = document.createElement('div');
    translatedElement.className = 'translated-word';
    translatedElement.textContent = translatedText;
    Object.assign(translatedElement.style, {
      fontWeight: 'bold'
    });
    this.popup.appendChild(translatedElement);
    
    // Add to DOM
    document.body.appendChild(this.popup);
    
    // Fade in
    setTimeout(() => {
      if (this.popup) {
        this.popup.style.opacity = '1';
      }
    }, 10);
    
    // Register click outside to close
    document.addEventListener('click', this.handleDocumentClick);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      if (this.popup) {
        document.body.removeChild(this.popup);
        this.popup = null;
        document.removeEventListener('click', this.handleDocumentClick);
      }
    }, 3000);
  }

  // Close popup when clicking outside
  protected handleDocumentClick = (e: MouseEvent) => {
    if (this.popup && e.target !== this.popup && !this.popup.contains(e.target as Node)) {
      document.body.removeChild(this.popup);
      this.popup = null;
      document.removeEventListener('click', this.handleDocumentClick);
    }
  };

  // Standard cleanup method
  public cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.popup) {
      document.body.removeChild(this.popup);
      this.popup = null;
    }
    
    document.removeEventListener('click', this.handleDocumentClick);
    
    if (this.videoUpdateInterval) {
      clearInterval(this.videoUpdateInterval);
      this.videoUpdateInterval = null;
    }

    this.removeFloatingControls();
  }

  // Common method to process a text node - creating clickable word spans
  public processTextNode(textNode: Text): void {
    if (!textNode || !textNode.textContent) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    const lastText = this.lastProcessedText.get(textNode);
    if (lastText === text) {
      return;
    }

    const parent = textNode.parentNode;
    if (!parent) return;

    const words = text.split(/\s+/).filter(word => word.length > 0);
    const fragment = document.createDocumentFragment();
    
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'wordstream-word';
      span.textContent = word;
      
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleWordClick(e as MouseEvent);
      });
      
      fragment.appendChild(span);
      
      if (index < words.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });

    parent.replaceChild(fragment, textNode);
    this.lastProcessedText.set(textNode, text);
  }

  // Common method to get text nodes in a container
  protected getTextNodesIn(container: HTMLElement): Text[] {
    const textNodes: Text[] = [];
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while (node = walk.nextNode()) {
      if (node instanceof Text) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  // Common translation method
  protected async getTranslation(text: string, targetLang: string): Promise<any> {
    try {
      // Call translation service
      const translation = await this.translationService.translate(text, targetLang);
      console.log(`WordStream ${this.source}: Translation result:`, translation);
      
      if (!translation.success) {
        throw new Error(translation.error || 'Unknown translation error');
      }
      
      if (!translation.translatedText) {
        throw new Error('Translation succeeded but no translated text returned');
      }
      
      return translation;
    } catch (translationError) {
      console.error(`WordStream ${this.source}: Translation error:`, translationError);
      throw new Error(`Translation error: ${translationError}`);
    }
  }

  // Common method to save a word
  protected async saveWord(text: string, translation: any, targetLang: string): Promise<void> {
    try {
      const captionInfo = this.detectCaptionsLanguage();

      // Get current video details
      const videoTitle = document.title.replace(' - YouTube', '').trim();
      const url = window.location.href;

      // Create word object
      const word = {
        id: Date.now().toString(),
        originalWord: text,
        targetWord: translation.translatedText,
        sourceLanguage: translation.detectedSourceLanguage || 'auto',
        targetLanguage: targetLang,
        timestamp: safeDate(new Date()),
        context: {
          source: this.source,
          videoTitle,
          url,
          captionsLanguage: translation.detectedSourceLanguage || 'auto'
        },
        stats: {
          successRate: 0,
          totalReviews: 0,
          lastReview: null
        }
      };

      // Save to storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.sync.get(['words'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const words = result.words || [];
          words.push(word);
          
          chrome.storage.sync.set({ words }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
          });
        });
      });
      
      console.log(`WordStream ${this.source}: Word saved successfully`, word);

    } catch (storageError) {
      // Just log if saving fails, don't show to user as translation worked
      console.error(`WordStream ${this.source}: Error saving word:`, safeStringifyError(storageError));
    }
  }

  // Abstract methods that each platform detector must implement
  public abstract detect(): Promise<HTMLElement | null>;
  public abstract processCaption(caption: HTMLElement): void;
  public abstract startObserving(captionContainer: HTMLElement): void;
  public abstract stopObserving(): void;
  public abstract addFloatingControls(): void;
  public abstract removeFloatingControls(): void;
  public abstract renderControls(container: HTMLElement, persist: boolean, showGemini: boolean, showNotes: boolean): void;
} 