/// <reference types="chrome"/>

import { TranslationService } from '../translation/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { CaptionDetector } from './caption-detector';
import { CaptionsLanguageInfo } from '@/types';
import { Word } from '@/types/word';
import { normalizeLanguageCode, LANGUAGE_MAP } from './shared/language-map';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';
import { safeDate } from '@/utils/date-utils';
import { createDebounce } from '../../utils/debounce';
import { generateUID } from '../../utils/uid';
import { loadAllWords } from '../../utils/word-storage';
import { BaseCaptionDetector } from './base-detector';

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

  public async detect(): Promise<HTMLElement | null> {
    const captionContainer = document.querySelector('.ytp-caption-window-container');
    if (captionContainer) {
      this.addFloatingControls();
      return captionContainer as HTMLElement;
    }

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const container = document.querySelector('.ytp-caption-window-container');
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

  public processCaption(caption: HTMLElement): void {
    this.processTextContainer(caption);
  }

  private processTextContainer(container: HTMLElement): void {
    const segments = container.querySelectorAll('.ytp-caption-segment');
    
    segments.forEach(segment => {
      const textNodes = this.getTextNodesIn(segment as HTMLElement);
      textNodes.forEach(node => this.processTextNode(node));
    });
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
    
    // Find the YouTube player container
    const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    
    if (playerContainer instanceof HTMLElement) {
      playerContainer.appendChild(this.controlsContainer);
      
      // Initialize ghost layer for controls
      this.ghostLayer = document.createElement('div');
      this.ghostLayer.className = 'wordstream-ghost-layer';
      this.ghostLayer.style.position = 'absolute';
      this.ghostLayer.style.top = '0';
      this.ghostLayer.style.left = '0';
      this.ghostLayer.style.width = '100%';
      this.ghostLayer.style.height = '100%';
      this.ghostLayer.style.zIndex = '9998';
      this.ghostLayer.style.pointerEvents = 'none';
      
      playerContainer.appendChild(this.ghostLayer);
      
      // Render React component
      this.renderControls(this.controlsContainer, true, true, true);
      
      console.log('WordStream YouTube: Added floating controls');
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
      
      // Render the FloatingControls React component (assuming it exists)
      this.controlsRoot.render(
        React.createElement(FloatingControls, { 
          source: 'youtube',
          showGemini,
          showNotes,
          persist
        })
      );
    } catch (error) {
      console.error('WordStream YouTube: Error rendering controls:', error);
    }
  }

  public removeFloatingControls(): void {
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      if (this.controlsRoot) {
        try {
          ReactDOM.unmountComponentAtNode(this.controlsContainer);
        } catch (error) {
          console.error('WordStream YouTube: Error unmounting controls:', error);
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
      const targetLang = await this.getTargetLanguage();
      
      // קבלת התרגום
      const translation = await this.getTranslation(text, targetLang);
      
      // הצגת חלון תרגום
      this.showTranslationPopup(translation.translatedText || 'Translation error', event);
      
      // בדיקת אימות לפני שמירת המילה - רק משתמשים מאומתים יכולים לשמור מילים
      const isAuthenticated = typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated === true;
      if (!isAuthenticated) {
        console.log('WordStream YouTube: Word translation shown, but saving skipped - user not authenticated');
        
        // הוסף הודעה שמעודדת התחברות אם המשתמש אינו מאומת
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
            if (chrome?.runtime?.id) {
              chrome.runtime.sendMessage({ action: 'OPEN_SIGNIN_POPUP' });
            }
          };
          
          // הוסף את ההודעה לפופאפ התרגום אם קיים
          const popup = document.querySelector('.wordstream-translation-popup');
          if (popup) {
            popup.appendChild(signInElement);
          }
        }, 500);
        
        return;
      }
      
      // המשך לטיפול בשמירת המילה אם המשתמש מאומת
      this.saveWord(text, translation, targetLang);
    } catch (error) {
      console.error('WordStream YouTube: Error handling word click:', error);
    }
  }

  private showTranslationPopup(translatedText: string, event: MouseEvent): void {
    // Clear any existing popups and timeouts
    if (this.popup) {
      this.popup.remove();
      document.removeEventListener('click', this.handleDocumentClick);
    }

    const target = event.target as HTMLElement;
    const originalWord = target.textContent || '';

    // Create popup
    this.popup = document.createElement('div');
    this.popup.className = 'wordstream-popup';
    
    // Force styles
    Object.assign(this.popup.style, {
      position: 'fixed',
      right: '24px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'rgba(28, 28, 28, 0.95)',
      borderRadius: '8px',
      padding: '16px',
      minWidth: '200px',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      color: '#fff',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif",
      fontSize: '14px',
      lineHeight: '1.5',
      zIndex: '9999999',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      transition: 'opacity 0.2s ease-out'
    });

    // Original word
    const originalWordElement = document.createElement('div');
    originalWordElement.className = 'original-word';
    originalWordElement.textContent = originalWord;
    Object.assign(originalWordElement.style, {
      color: '#64B5F6',
      fontWeight: '500',
      fontSize: '16px',
      marginBottom: '8px',
      display: 'block',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif"
    });
    this.popup.appendChild(originalWordElement);

    // Translated word
    const translatedElement = document.createElement('div');
    translatedElement.className = 'translated-word';
    translatedElement.textContent = translatedText;
    Object.assign(translatedElement.style, {
      fontWeight: '500',
      fontSize: '16px',
      display: 'block',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif"
    });
    this.popup.appendChild(translatedElement);

    // Add to page
    document.body.appendChild(this.popup);

    // Add click handler to close popup
    document.addEventListener('click', this.handleDocumentClick);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      if (this.popup) {
        this.popup.style.opacity = '0';
        setTimeout(() => {
          if (this.popup) {
            this.popup.remove();
            document.removeEventListener('click', this.handleDocumentClick);
          }
        }, 200);
      }
    }, 5000);
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
} 