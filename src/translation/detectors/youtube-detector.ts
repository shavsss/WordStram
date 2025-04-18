/// <reference types="chrome"/>

import { TranslationService } from '../translation/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { BaseCaptionDetector } from './base-detector';
import { CaptionDetector } from './types';
import { CaptionsLanguageInfo } from '@/types';
import { WordContext, WordStats } from '@/types/word';
import { normalizeLanguageCode, LANGUAGE_MAP } from './shared/language-map';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';
import { safeDate } from '@/utils/date-utils';
import { createDebounce } from '../../utils/debounce';
import { generateUID } from '../../utils/uid';
import { loadAllWords } from '../../utils/word-storage';
import { debounce } from '../../utils/debounce';
import { saveWordToStorage } from '../../utils/word-storage';

// Note: We use dynamic import of auth-manager for authentication checks 
// to avoid circular dependencies. See handleWordClick method for implementation.

// נוסיף הגדרת טיפוס עבור window.WordStream
declare global {
  interface Window {
    WordStream?: {
      local?: {
        isAuthenticated?: boolean;
      };
    };
  }
}

interface StorageResult {
  settings?: {
    targetLanguage: SupportedLanguageCode;
  };
  words?: Array<{
    id: string;
    originalWord: string;
    targetWord: string;
    sourceLanguage: string;
    targetLanguage: string;
    timestamp: string;
    context: {
      source: 'youtube';
      videoTitle: string;
      url: string;
      captionsLanguage: string;
    };
    stats: {
      successRate: number;
      totalReviews: number;
      lastReview: string;
    };
  }>;
  stats?: {
    totalWords: number;
    lastSaved: string;
  };
}

// פונקציית עזר לטיפול בשגיאות
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

// פונקציה לטעינת כל המילים בפורמט החדש
async function loadAllWords(): Promise<any[]> {
  try {
    // קבלת המטא-דאטה על קבוצות המילים
    const metadata = await new Promise<any>((resolve, reject) => {
      chrome.storage.sync.get(['words_metadata', 'words_groups'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result);
      });
    });
    
    // אם אין מטא-דאטה, כנראה שאין לנו מילים בפורמט החדש
    // ננסה לטעון מילים בפורמט הישן
    if (!metadata.words_metadata) {
      const oldResult = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['words'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(result);
        });
      });
      
      console.log('WordStream: Loaded words in old format:', oldResult.words?.length || 0);
      return oldResult.words || [];
    }
    
    // אם יש לנו מטא-דאטה אבל אין רשימת קבוצות, נחזיר מערך ריק
    if (!metadata.words_groups || !Array.isArray(metadata.words_groups)) {
      console.log('WordStream: No word groups found');
      return [];
    }
    
    // טעינת כל קבוצות המילים
    const wordGroups = await new Promise<any>((resolve, reject) => {
      chrome.storage.sync.get(metadata.words_groups, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result);
      });
    });
    
    // איחוד כל הקבוצות למערך אחד
    const allWords = [];
    for (const groupKey of metadata.words_groups) {
      if (wordGroups[groupKey] && Array.isArray(wordGroups[groupKey])) {
        allWords.push(...wordGroups[groupKey]);
      }
    }
    
    console.log('WordStream: Loaded words in new format:', allWords.length);
    return allWords;
  } catch (error) {
    console.error('WordStream: Error loading words:', safeStringifyError(error));
    return [];
  }
}

export class YouTubeCaptionDetector extends BaseCaptionDetector {
  source = 'youtube';
  private translationService: TranslationService;
  private processedNodes = new Set<Node>();
  private checkInterval: number | null = null;
  private isProcessing = false;
  private processingDebouncer: number | null = null;
  private readonly DEBOUNCE_DELAY = 10;
  private ghostLayer: HTMLElement | null = null;
  private controlsContainer: HTMLElement | null = null;
  private videoUpdateInterval: number | null = null;
  private currentVideoTime: number = 0;
  private videoDuration: number = 0;
  private controlsRoot: any = null;
  private captionContainer: HTMLElement | null = null;

  constructor() {
    super();
    this.translationService = TranslationService.getInstance();
    this.initializeObserver();
  }

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
            if (parent?.classList.contains('ytp-caption-segment')) {
              textNodesToProcess.add(mutation.target);
            }
          } else if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node instanceof Text) {
                const parent = node.parentElement;
                if (parent?.classList.contains('ytp-caption-segment')) {
                  textNodesToProcess.add(node);
                }
              } else if (node instanceof HTMLElement && node.classList.contains('ytp-caption-segment')) {
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

  public startObserving(captionContainer: HTMLElement): void {
    if (!this.observer || !captionContainer) return;
    
    this.observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    console.log('WordStream YouTube: Started observing caption container');
    
    // Also process any existing captions
    this.processCaption(captionContainer);
  }

  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      console.log('WordStream YouTube: Stopped observing caption container');
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private isCaptionSegment(node: Node | null): node is HTMLElement {
    return node instanceof HTMLElement && node.classList.contains('ytp-caption-segment');
  }

  private needsSpaceBetweenWords(word1: string, word2: string): boolean {
    return !/[.,!?:;]$/.test(word1) && !/^[.,!?:;]/.test(word2);
  }

  protected detectCaptionsLanguage(): CaptionsLanguageInfo {
    // Always return 'auto' and let Google Translate detect the language
    return {
      language: 'auto',
      languageName: 'Auto-Detected',
      isAuto: true
    };
  }

  protected getSubtitleContext(wordElement: HTMLElement): string {
    try {
      const captionSegment = wordElement.closest('.ytp-caption-segment');
      if (captionSegment) {
        return captionSegment.textContent || '';
      }
      return '';
    } catch (error) {
      console.error('WordStream YouTube: Error getting subtitle context:', error);
      return '';
    }
  }

  /**
   * Detect captions container
   */
  public async detect(): Promise<HTMLElement | null> {
    try {
      console.log('WordStream: YouTube caption detector attempting to detect captions');
      
      // Look for the captions container
      const captionContainer = document.querySelector('.ytp-caption-window-container') ||
                               document.querySelector('.captions-text') ||
                               document.querySelector('.caption-window');
      
      if (captionContainer instanceof HTMLElement) {
        console.log('WordStream: YouTube caption container found');
        this.captionContainer = captionContainer;
        
        // Automatically start processing captions without showing controls
        this.startObserving(captionContainer);
        
        return captionContainer;
      }
      
      // If not found, try again later through callback
      console.log('WordStream: YouTube caption container not found');
      return null;
    } catch (error) {
      console.error('WordStream: Error detecting YouTube captions:', error);
      return null;
    }
  }

  public processCaption(caption: HTMLElement): void {
    this.processTextContainer(caption);
  }

  private processTextContainer(container: HTMLElement): void {
    const textNodes = this.getTextNodesIn(container);
    textNodes.forEach(node => this.processTextNode(node));
  }

  public addFloatingControls(): void {
    // Auto-translation is enabled for authenticated users
    // No need to show translation controls
    console.log('WordStream: Caption auto-translation is activated for authenticated users');
  }

  public renderControls(container: HTMLElement, persist: boolean = true, showGemini: boolean = false, showNotes: boolean = false) {
    // Only show Gemini and Notes controls, not translation controls
    if (this.controlsRoot) {
      this.controlsRoot.unmount();
      this.controlsRoot = null;
    }
    
    if (!showGemini && !showNotes) {
      return; // No need to render controls if nothing to show
    }
    
    // Create the root if needed
    if (!this.controlsRoot) {
      const ReactDOM = require('react-dom');
      this.controlsRoot = ReactDOM.createRoot(container);
    }
    
    // Import React components
    const React = require('react');
    const FloatingControls = require('@/components/floating-controls/FloatingControls').default;
    
    // Render only Gemini and Notes controls
    this.controlsRoot.render(React.createElement(FloatingControls, {
      onClose: () => {
        // Remove the container on close if not persist
        if (!persist && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      },
      showGemini: showGemini, 
      showNotes: showNotes,
      onGeminiClick: () => {
        try {
          // Send a message to initiate Gemini chat
          window.dispatchEvent(new CustomEvent('wordstream:toggle_gemini'));
        } catch (error) {
          console.error('WordStream: Error toggling Gemini:', error);
        }
      },
      onNotesClick: () => {
        try {
          // Send a message to toggle notes panel
          window.dispatchEvent(new CustomEvent('wordstream:toggle_notes'));
        } catch (error) {
          console.error('WordStream: Error toggling notes:', error);
        }
      }
    }));
  }

  private getVideoId(): string {
    const url = new URL(window.location.href);
    return url.searchParams.get('v') || '';
  }

  private getPlayerApi(): any {
    return document.querySelector('#movie_player') as any;
  }

  async handleWordClick(event: MouseEvent): Promise<void> {
    if (!event.target) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const wordElement = event.target as HTMLSpanElement;
    const text = wordElement.textContent || '';
    
    if (!text.trim()) return;
    
    console.log('WordStream YouTube: Handling click for word:', text);

    try {
      // Show immediate feedback to user that we're processing
      const tempPopup = this.showTranslationPopup('Translating...', event);
      
      let targetLang = 'en'; // Default fallback
      try {
        targetLang = await this.getTargetLanguage();
      } catch (langError) {
        console.warn('WordStream YouTube: Error getting target language, using default:', langError);
        // Continue with default language
      }
      
      // Get translation with better error handling
      let translation;
      try {
        translation = await this.getTranslation(text, targetLang);
      } catch (translationError) {
        console.error('WordStream YouTube: Translation error:', translationError);
        // Create a fallback translation object
        translation = {
          success: true,
          translatedText: `${text} [Translation error]`,
          detectedSourceLanguage: 'unknown',
          isFallback: true
        };
      }
      
      // Update translation popup with actual translation
      this.updateTranslationPopup(tempPopup, translation.translatedText || 'Translation error');
      
      // Handle authentication for saving words
      let isAuthenticated = false;
      
      try {
        // Use auth-manager as single source of truth
        try {
          // Import dynamically to avoid circular dependencies
          const authManagerModule = await import('@/auth/auth-manager');
          isAuthenticated = await authManagerModule.isAuthenticated();
          console.log('WordStream YouTube: Authentication checked via auth-manager:', isAuthenticated);
        } catch (importError) {
          console.warn('WordStream YouTube: Could not import auth-manager, falling back to local checks:', importError);
          
          // Check if extension context is valid before trying authentication
          if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            console.warn('WordStream YouTube: Extension context invalidated, can\'t check authentication');
            // Continue without authentication
          } else {
            // First try to check window.WordStream if available
            if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated === true) {
              isAuthenticated = true;
            } else {
              // Try Chrome messaging as a fallback with timeout
              const authResponse = await new Promise<any>((resolve) => {
                const timeout = setTimeout(() => {
                  console.warn('WordStream YouTube: Auth check timed out');
                  resolve({ isAuthenticated: false });
                }, 2000);
                
                chrome.runtime.sendMessage({ action: 'GET_AUTH_STATE' }, (response) => {
                  clearTimeout(timeout);
                  if (chrome.runtime.lastError) {
                    console.warn('WordStream YouTube: Auth check error:', chrome.runtime.lastError);
                    resolve({ isAuthenticated: false });
                    return;
                  }
                  resolve(response || { isAuthenticated: false });
                });
              });
              
              isAuthenticated = authResponse?.isAuthenticated === true;
            }
          }
        }
      } catch (authError) {
        console.error('WordStream YouTube: Error checking authentication:', authError);
        isAuthenticated = false;
      }
      
      if (!isAuthenticated) {
        console.log('WordStream YouTube: Word translation shown, but saving skipped - user not authenticated');
        
        // Add a message that encourages sign-in if the user is not authenticated
        setTimeout(() => {
          const signInElement = document.createElement('div');
          signInElement.className = 'wordstream-signin-prompt';
          signInElement.textContent = 'Sign in to save words';
          signInElement.style.cssText = `
            font-size: 11px;
            color: #999;
            margin-top: 5px;
            text-align: center;
            cursor: pointer;
          `;
          signInElement.onclick = (e) => {
            e.stopPropagation();
            try {
              if (chrome?.runtime?.id) {
                chrome.runtime.sendMessage({ action: 'OPEN_SIGNIN_POPUP' });
              }
            } catch (messageError) {
              console.error('WordStream YouTube: Error opening signin popup:', messageError);
            }
          };
          
          // Add the message to the translation popup if it exists
          const popup = document.querySelector('.wordstream-translation-popup');
          if (popup) {
            popup.appendChild(signInElement);
          }
        }, 500);
        
        return;
      }
      
      // Continue to handle saving the word if the user is authenticated
      try {
        await this.saveWord(text, translation, targetLang);
      } catch (saveError) {
        console.error('WordStream YouTube: Error saving word:', saveError);
        // Just log the error but don't interrupt the user experience
      }
    } catch (error) {
      console.error('WordStream YouTube: Error handling word click:', error);
      this.showTranslationPopup(`Error: ${error instanceof Error ? error.message : String(error)}`, event);
    }
  }

  /**
   * Show a translation popup
   */
  private showTranslationPopup(translatedText: string, event: MouseEvent): HTMLElement {
    // Remove any existing popup
    const existingPopup = document.querySelector('.wordstream-translation-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'wordstream-translation-popup';
    popup.style.cssText = `
      position: absolute;
      z-index: 99999;
      background: white;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      padding: 8px 12px;
      max-width: 300px;
      word-break: break-word;
      transform: translateX(-50%);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      transition: opacity 0.2s ease;
    `;
    
    popup.textContent = translatedText;
    
    // Position the popup
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    popup.style.left = rect.left + rect.width / 2 + 'px';
    popup.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    
    // Add to document
    document.body.appendChild(popup);
    
    // Close popup when clicking outside
    setTimeout(() => {
      document.addEventListener('click', this.handleDocumentClick);
    }, 10);
    
    return popup;
  }

  /**
   * Update an existing translation popup
   */
  private updateTranslationPopup(popup: HTMLElement, translatedText: string): void {
    if (!popup || !document.body.contains(popup)) {
      return;
    }
    
    popup.textContent = translatedText;
  }

  private handleDocumentClick = (e: MouseEvent) => {
    if (this.popup && !this.popup.contains(e.target as Node)) {
      this.popup.remove();
      document.removeEventListener('click', this.handleDocumentClick);
    }
  }

  public cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isProcessing = false;
    this.processedNodes.clear();

    // Remove all event listeners from words
    const words = document.querySelectorAll('.wordstream-word');
    words.forEach((word) => {
      const clone = word.cloneNode(true);
      word.parentNode?.replaceChild(clone, word);
    });

    // Remove floating controls on cleanup
    this.removeFloatingControls();
  }

  public processTextNode(textNode: Text): void {
    // הסרת בדיקת האימות כדי לאפשר תרגום לכל המשתמשים
    if (!textNode || !textNode.textContent) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    const lastText = this.lastProcessedText.get(textNode);
    if (lastText === text) {
      return;
    }

    const parent = textNode.parentNode;
    if (!parent) return;

    // Create ghost layer for smooth transitions
    const ghostContainer = document.createElement('div');
    ghostContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      width: 100%;
    `;
    ghostContainer.textContent = lastText || '';
    parent.appendChild(ghostContainer);

    const words = text.split(/[\s\u200B-\u200D\uFEFF]+/).filter(word => word.length > 0);
    const fragment = document.createDocumentFragment();
    
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'wordstream-word';
      span.textContent = word;
      
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleWordClick(e as MouseEvent);
      }, { passive: false });
      
      fragment.appendChild(span);
      
      if (index < words.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });

    parent.replaceChild(fragment, textNode);
    this.lastProcessedText.set(textNode, text);

    requestAnimationFrame(() => {
      ghostContainer.remove();
    });
  }

  private detectCaptionLanguage(element: HTMLElement): string {
    // Get the language from the caption element's attributes or parent elements
    const langAttr = element.getAttribute('lang') || 
                    element.closest('[lang]')?.getAttribute('lang') || 
                    document.documentElement.lang;
    
    // Normalize the language code
    return normalizeLanguageCode(langAttr || 'auto');
  }

  async getTargetLanguage(): Promise<string> {
    // Wait for Chrome API with increased retries and delay
    if (!await this.waitForChromeAPI(10, 1500)) {
      console.error('WordStream YouTube: Chrome API initialization failed');
      throw new Error('Extension not initialized. Please refresh the page.');
    }

    // Get settings from storage
    try {
      const settingsResult = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(['settings'], (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(items);
        });
      });
      
      const settings = settingsResult.settings;
      // Get target language or default to English
      const targetLang = settings?.targetLanguage || 'en';
      console.log('WordStream YouTube: Using target language:', targetLang);
      return targetLang;
    } catch (storageError) {
      console.error('WordStream YouTube: Error getting storage settings:', storageError);
      throw new Error(`Storage error: ${storageError}`);
    }
  }

  async getTranslation(text: string, targetLang: string): Promise<any> {
    try {
      // Call translation service
      const translation = await this.translationService.translate(text, targetLang);
      console.log('WordStream YouTube: Translation result:', translation);

      if (!translation.success) {
        throw new Error(translation.error || 'Unknown translation error');
      }
      
      if (!translation.translatedText) {
        throw new Error('Translation succeeded but no translated text returned');
      }
      
      return translation;
    } catch (translationError) {
      console.error('WordStream YouTube: Translation error:', translationError);
      throw new Error(`Translation error: ${translationError}`);
    }
  }

  async saveWord(text: string, translation: any, targetLang: string): Promise<void> {
    try {
      // טעינת המילים הקיימות
      let existingWords;
      try {
        existingWords = await loadAllWords();
      } catch (loadError) {
        console.error('WordStream YouTube: Error loading words:', loadError);
        existingWords = [];
      }

      // Create new word object
      const newWord = {
        id: `${text}-${Date.now()}`,
        originalWord: text,
        targetWord: translation.translatedText,
        sourceLanguage: translation.detectedSourceLanguage || 'auto',
        targetLanguage: targetLang,
        timestamp: new Date().toISOString(),
        context: {
          source: 'youtube' as const,
          videoTitle: document.title,
          url: window.location.href,
          captionsLanguage: translation.detectedSourceLanguage || 'auto'
        },
        stats: {
          successRate: 0,
          totalReviews: 0,
          lastReview: new Date().toISOString()
        }
      };

      // Save the word if it doesn't already exist
      try {
        // Check if this word already exists with the same source and target language
        console.log(`Checking if word "${text}" already exists...`);
        const normalizedWord = text.trim().toLowerCase();
        
        const wordExists = existingWords.some((w: any) => 
          w.originalWord?.trim().toLowerCase() === normalizedWord && 
          w.sourceLanguage === newWord.sourceLanguage && 
          w.targetLanguage === targetLang
        );

        // If word doesn't exist yet, save it
        if (!wordExists) {
          console.log(`Adding new word: "${text}" (${newWord.sourceLanguage} → ${targetLang})`);
          
          // בדיקת מספר המילים השמורות
          // אם יש יותר מדי מילים, נסיר את הישנות ביותר
          const MAX_WORDS = 100; // הגבלה סבירה למספר המילים השמורות
          let wordsToSave = [...existingWords, newWord];
          
          // אם יש יותר מדי מילים, מחק את הישנות ביותר
          if (wordsToSave.length > MAX_WORDS) {
            console.log(`WordStream YouTube: Too many saved words (${wordsToSave.length}), removing oldest`);
            // מיון המילים לפי timestamp (מהישן לחדש)
            wordsToSave.sort((a, b) => 
              new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
            );
            // השאר רק את ה-MAX_WORDS המילים החדשות ביותר
            wordsToSave = wordsToSave.slice(-MAX_WORDS);
          }
          
          // שינוי השמירה שלנו לפורמט של קבוצות קטנות יותר
          // ממפה את המילים לפי קבוצות של 10 (קבוצה 0, קבוצה 1, וכו')
          const wordsByGroup: { [key: string]: any[] } = {};
          const GROUP_SIZE = 10;
          
          // חלוקת המילים לקבוצות קטנות יותר
          wordsToSave.forEach((word, index) => {
            const groupIndex = Math.floor(index / GROUP_SIZE);
            const groupKey = `words_group_${groupIndex}`;
            
            if (!wordsByGroup[groupKey]) {
              wordsByGroup[groupKey] = [];
            }
            
            wordsByGroup[groupKey].push(word);
          });
          
          // מטא-נתונים על המילים
          const wordsMetadata = {
            totalGroups: Object.keys(wordsByGroup).length,
            totalWords: wordsToSave.length,
            lastUpdated: new Date().toISOString()
          };
          
          // שמירת המטא-נתונים
          await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.set({ words_metadata: wordsMetadata }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              resolve();
            });
          });
          
          // שמירת כל קבוצת מילים בנפרד
          for (const [groupKey, groupWords] of Object.entries(wordsByGroup)) {
            await new Promise<void>((resolve, reject) => {
              chrome.storage.sync.set({ [groupKey]: groupWords }, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                resolve();
              });
            });
          }
          
          // טעינת הסטטיסטיקות הקיימות כדי לעדכן את הסטרייק ואת מספר המילים היומיות
          let currentStats;
          try {
            currentStats = await new Promise<any>((resolve, reject) => {
              chrome.storage.sync.get(['stats'], (result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                resolve(result.stats || {});
              });
            });
          } catch (error) {
            console.error('WordStream YouTube: Error loading stats:', error);
            currentStats = {};
          }
          
          // חישוב עדכון הסטרייק והמילים היומיות
          const now = new Date();
          const lastActive = currentStats.lastActive ? new Date(currentStats.lastActive) : new Date(0);
          
          // נרמול התאריכים לצורך השוואה (הסרת רכיב הזמן)
          const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const lastActiveDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
          
          // חישוב ההפרש בימים
          const diffTime = Math.abs(todayDate.getTime() - lastActiveDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let streak = currentStats.streak || 0;
          let todayWords = currentStats.todayWords || 0;
          
          // אם זה יום חדש, נאפס את מספר המילים היומיות
          if (diffDays >= 1) {
            todayWords = 1; // מילה אחת נוספה עכשיו
          } else {
            // אותו יום - הגדלת מספר המילים היומיות
            todayWords += 1;
          }
          
          // אם היום האחרון הפעיל היה אתמול, נגדיל את הסטרייק
          if (diffDays === 1) {
            streak += 1;
          } 
          // אם עברו יותר מיום, נאפס את הסטרייק
          else if (diffDays > 1) {
            streak = 1; // היום הנוכחי נחשב כיום פעילות ראשון
          }
          // אם זה אותו יום, נשמור על אותו ערך
          
          // עדכון הסטטיסטיקות
          await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.set({
              stats: {
                totalWords: wordsToSave.length,
                lastSaved: now.toISOString(),
                todayWords: todayWords,
                streak: streak,
                lastActive: now.toISOString()
              }
            }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              resolve();
            });
          });

          // שמירת רשימת הקבוצות כדי שנוכל למצוא אותן בעתיד
          await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.set({ 
              words_groups: Object.keys(wordsByGroup) 
            }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              resolve();
            });
          });

          console.log('WordStream YouTube: Word saved successfully');
        } else {
          console.log('WordStream YouTube: Word already exists, not saving duplicate');
        }
      } catch (saveError) {
        // Just log if saving fails, don't show to user as translation worked
        console.error('WordStream YouTube: Error saving word:', saveError);
      }
    } catch (error) {
      console.error('WordStream YouTube: Error in saveWord:', error);
    }
  }

  /**
   * Implement automatic translation for YouTube captions
   */
  public removeFloatingControls(): void {
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      if (this.controlsRoot) {
        try {
          // Using try/catch as unmounting might fail
          if (typeof this.controlsRoot.unmount === 'function') {
            this.controlsRoot.unmount();
          } else if (typeof ReactDOM !== 'undefined' && ReactDOM.unmountComponentAtNode) {
            ReactDOM.unmountComponentAtNode(this.controlsContainer);
          }
        } catch (error) {
          console.error('WordStream: Error unmounting controls:', error);
        }
        this.controlsRoot = null;
      }
      
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
      this.controlsContainer = null;
    }
    
    if (this.ghostLayer && this.ghostLayer.parentNode) {
      this.ghostLayer.parentNode.removeChild(this.ghostLayer);
      this.ghostLayer = null;
    }
  }
} 