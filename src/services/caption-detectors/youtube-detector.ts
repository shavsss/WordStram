/// <reference types="chrome"/>

import { TranslationService } from '@/services/translation/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { CaptionDetector } from './types';
import { CaptionsLanguageInfo } from '@/types';
import { Word } from '@/types/word';
import { normalizeLanguageCode, LANGUAGE_MAP } from './shared/language-map';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';

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

export class YouTubeCaptionDetector implements CaptionDetector {
  source = 'youtube';
  private translationService: TranslationService;
  private observer: MutationObserver | null = null;
  private popup: HTMLElement | null = null;
  private processedNodes = new Set<Node>();
  private checkInterval: number | null = null;
  private isProcessing = false;
  private lastProcessedText: WeakMap<Text, string> = new WeakMap();
  private processingDebouncer: number | null = null;
  private readonly DEBOUNCE_DELAY = 10;
  private animationFrameId: number | null = null;
  private ghostLayer: HTMLElement | null = null;
  private controlsContainer: HTMLElement | null = null;
  private videoUpdateInterval: number | null = null;
  private currentVideoTime: number = 0;
  private videoDuration: number = 0;
  private controlsRoot: any = null;

  constructor() {
    this.translationService = TranslationService.getInstance();
    this.initializeObserver();
  }

  private initializeObserver() {
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
    if (!this.observer) {
      console.warn('WordStream: Observer not initialized');
      return;
    }

    try {
      this.observer.observe(captionContainer, {
        childList: true,
        characterData: true,
        subtree: true
      });
      
      // Process existing text immediately
      const textNodes = Array.from(captionContainer.getElementsByClassName('ytp-caption-segment'))
        .flatMap(segment => Array.from(segment.childNodes))
        .filter(node => node.nodeType === Node.TEXT_NODE);
      
      textNodes.forEach(textNode => this.processTextNode(textNode as Text));
    } catch (error) {
      console.error('WordStream: Error starting observation:', error);
    }
  }

  public stopObserving(): void {
    if (!this.observer) {
      console.warn('WordStream: Observer not initialized');
      return;
    }

    try {
      this.observer.disconnect();
      if (this.processingDebouncer) {
        clearTimeout(this.processingDebouncer);
        this.processingDebouncer = null;
      }
    } catch (error) {
      console.error('WordStream: Error stopping observation:', error);
    }
  }

  private isCaptionSegment(node: Node | null): node is HTMLElement {
    return node instanceof HTMLElement && 
           node.classList.contains('ytp-caption-segment');
  }

  private needsSpaceBetweenWords(word1: string, word2: string): boolean {
    // Improved detection of languages without spaces
    const noSpaceScripts = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
    return !(noSpaceScripts.test(word1) || noSpaceScripts.test(word2));
  }

  private async waitForChromeAPI(maxRetries = 5, retryDelay = 1000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.sync) {
        console.log('WordStream: Chrome API initialized successfully');
        return true;
      }
      console.log(`WordStream: Waiting for Chrome API (attempt ${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    console.error('WordStream: Chrome API not available after retries');
    return false;
  }

  private async detectCaptionsLanguage(): Promise<CaptionsLanguageInfo> {
    // Always return 'auto' and let Google Translate detect the language
    return {
      language: 'auto',
      languageName: 'Auto Detect',
      isAuto: true
    };
  }

  async handleWordClick(event: MouseEvent): Promise<void> {
    // בדיקת אימות לפני המשך הפעולה
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      console.log('WordStream YouTube: Word click blocked - user not authenticated');
      return;
    }
    
    if (!event.target) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const wordElement = event.target as HTMLElement;
    const text = wordElement.textContent || '';
    
    if (!text.trim()) return;
    
    // בדיקת האימות הוסרה כדי לאפשר תרגום לכולם
    // אין צורך לבדוק אם המשתמש מחובר
    
    console.log('WordStream: Handling click for word:', text);

    try {
      // Wait for Chrome API with increased retries and delay
      if (!await this.waitForChromeAPI(10, 1500)) {
        console.error('WordStream: Chrome API initialization failed');
        this.showTranslationPopup('Extension not initialized. Please refresh the page.', event);
        return;
      }

      // Get settings from storage
      let settings: StorageResult['settings'];
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
        
        settings = settingsResult.settings;
      } catch (storageError) {
        console.error('WordStream: Error getting storage settings:', safeStringifyError(storageError));
        this.showTranslationPopup(`Storage error: ${safeStringifyError(storageError)}`, event);
        return;
      }

      // Get target language or default to English
      const targetLang = settings?.targetLanguage || 'en';
      console.log('WordStream: Using target language:', targetLang);
      
      // Call translation service
      let translation;
      try {
        translation = await this.translationService.translate(text, targetLang);
      console.log('WordStream: Translation result:', translation);

        if (!translation.success) {
          throw new Error(translation.error || 'Unknown translation error');
        }
        
        if (!translation.translatedText) {
          throw new Error('Translation succeeded but no translated text returned');
        }
      } catch (translationError) {
        console.error('WordStream: Translation error:', safeStringifyError(translationError));
        this.showTranslationPopup(`Translation error: ${safeStringifyError(translationError)}`, event);
        return;
      }

        // Show translation popup
        this.showTranslationPopup(translation.translatedText, event);

      // טעינת המילים הקיימות
      let existingWords;
      try {
        existingWords = await loadAllWords();
      } catch (loadError) {
        console.error('WordStream: Error loading words:', safeStringifyError(loadError));
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
            console.log(`WordStream: Too many saved words (${wordsToSave.length}), removing oldest`);
            // מיון המילים לפי timestamp (מהישן לחדש)
            wordsToSave.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
            console.error('WordStream: Error loading stats:', safeStringifyError(error));
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

          console.log('WordStream: Word saved successfully');
      } else {
          console.log('WordStream: Word already exists, not saving duplicate');
        }
      } catch (saveError) {
        // Just log if saving fails, don't show to user as translation worked
        console.error('WordStream: Error saving word:', safeStringifyError(saveError));
      }
    } catch (error) {
      console.error('WordStream: Error handling word click:', safeStringifyError(error));
      this.showTranslationPopup(`Error: ${safeStringifyError(error)}`, event);
    }
  }

  private getSubtitleContext(wordElement: HTMLElement): string {
    // Find the parent subtitle element
    const subtitle = wordElement.closest('.ytp-caption-segment');
    if (!subtitle) return '';

    // Get the full text and normalize spaces
    const text = subtitle.textContent?.trim() || '';
    
    // Enhanced text normalization
    return text
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/([.,!?;:])(?!\s)/g, '$1 ')  // Add space after punctuation if missing
      .replace(/\s+([.,!?;:])/g, '$1')  // Remove space before punctuation
      .replace(/\s+/g, ' ')  // Clean up any double spaces
      .replace(/\s*\n\s*/g, ' ')  // Replace newlines with spaces
      .replace(/([A-Za-z])\s+([.,!?;:])/g, '$1$2')  // Remove spaces between word and punctuation
      .trim();
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

  public async detect(): Promise<HTMLElement | null> {
    try {
      const captionContainer = document.querySelector('.ytp-caption-window-container');
      
      if (captionContainer) {
        this.addFloatingControls();
      }
      
      return captionContainer as HTMLElement || null;
    } catch (error) {
      console.error('Error detecting caption container:', error);
      return null;
    }
  }

  public processCaption(caption: HTMLElement): void {
    // בדיקת אימות לפני עיבוד כתובית
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      return;
    }
    
    if (!caption) return;
    this.startObserving(caption);
  }

  public processTextNode(textNode: Text): void {
    // בדיקת אימות לפני עיבוד טקסט
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      return;
    }
    
    if (!textNode || !textNode.textContent) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    const lastText = this.lastProcessedText.get(textNode);
    if (lastText === text) {
      return;
    }

    const parent = textNode.parentNode;
    if (!parent) return;

    // Create ghost layer
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
        const nextWord = words[index + 1];
        if (this.needsSpaceBetweenWords(word, nextWord)) {
          fragment.appendChild(document.createTextNode(' '));
        }
      }
    });

    // Replace text content
    parent.replaceChild(fragment, textNode);
    this.lastProcessedText.set(textNode, text);

    // Remove ghost layer after frame
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

  public addFloatingControls(): void {
    console.log('[WordStream] Adding floating controls to YouTube...');
    
    try {
      // Try to get player API but don't require it for controls
      const playerApi = this.getPlayerApi();
      if (!playerApi) {
        console.warn('[WordStream] Player API not found, will attempt to add controls anyway');
        // Continue without returning
      }

      // First try to find the standard YouTube player
      let videoPlayer = document.querySelector('div.html5-video-player');
      
      // If that fails, look for any video container
      if (!videoPlayer) {
        console.warn('[WordStream] Standard video player not found, trying alternatives');
        videoPlayer = document.querySelector('.ytd-player') as HTMLElement;
      }
      
      // Last resort - attach to body
      if (!videoPlayer) {
        console.warn('[WordStream] Using fallback container for controls');
        videoPlayer = (document.querySelector('.watch-main-col') || document.body) as HTMLElement;
      }

      // Remove any existing floating controls
      this.removeFloatingControls();
      
      // Check if controls already exist
      const existingControls = document.getElementById('wordstream-floating-controls-container');
      if (existingControls) {
        console.log('[WordStream] Controls already exist, removing first');
        existingControls.remove();
      }

      // NOTE: The cyan floating buttons that were previously created here have been removed
      // The main floating controls are now only created using addDirectFloatingControls() in content/index.ts
      // This code used to create a container with Gemini and Notes buttons on the right side

      /*
      // Create container for the floating buttons - FIXED VERSION
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'wordstream-floating-controls-container';
      controlsContainer.style.position = 'fixed'; // Fixed position instead of absolute for better reliability
      controlsContainer.style.top = '70px';
      controlsContainer.style.right = '20px';
      controlsContainer.style.zIndex = '9999999'; // Extremely high z-index
      controlsContainer.style.display = 'flex';
      controlsContainer.style.flexDirection = 'column';
      controlsContainer.style.gap = '10px';
      controlsContainer.style.pointerEvents = 'none'; // Make container transparent to mouse events
      
      // Create wrapper for the buttons to allow for proper mouse events
      const buttonsWrapper = document.createElement('div');
      buttonsWrapper.id = 'wordstream-buttons-wrapper';
      buttonsWrapper.style.display = 'flex';
      buttonsWrapper.style.flexDirection = 'column';
      buttonsWrapper.style.gap = '8px';
      buttonsWrapper.style.pointerEvents = 'auto'; // Enable mouse events
      buttonsWrapper.style.opacity = '0.8'; // Start more visible
      buttonsWrapper.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      
      // Mouse hover effects for buttons wrapper
      buttonsWrapper.addEventListener('mouseenter', () => {
        buttonsWrapper.style.opacity = '1';
        buttonsWrapper.style.transform = 'scale(1.05)';
      });
      
      buttonsWrapper.addEventListener('mouseleave', () => {
        buttonsWrapper.style.opacity = '0.8';
        buttonsWrapper.style.transform = 'scale(1)';
      });
      
      // Create wrapper for the React component
      const reactContainer = document.createElement('div');
      reactContainer.id = 'wordstream-react-container';
      reactContainer.style.pointerEvents = 'auto'; // Enable mouse events
      reactContainer.style.display = 'none'; // Initially hidden
      
      // Initialize panel state tracking
      let isPanelVisible = false;
      let activePanel = '';
      
      // Create Gemini Assistant button (more opaque and slightly larger) - IMPROVED VISIBILITY
      const geminiButton = document.createElement('button');
      geminiButton.id = 'wordstream-gemini-button';
      geminiButton.innerHTML = '<span style="font-size: 16px;">💬</span>';
      geminiButton.style.width = '36px';
      geminiButton.style.height = '36px';
      geminiButton.style.borderRadius = '50%';
      geminiButton.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'; // More opaque blue
      geminiButton.style.color = 'white';
      geminiButton.style.border = '2px solid rgba(255, 255, 255, 0.6)'; // More visible border
      geminiButton.style.display = 'flex';
      geminiButton.style.alignItems = 'center';
      geminiButton.style.justifyContent = 'center';
      geminiButton.style.cursor = 'pointer';
      geminiButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)'; // Stronger shadow
      geminiButton.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
      geminiButton.title = 'Open Gemini Assistant';
      
      // Hover effects
      geminiButton.addEventListener('mouseenter', () => {
        geminiButton.style.transform = 'scale(1.1)';
        geminiButton.style.backgroundColor = 'rgba(59, 130, 246, 1)';
      });
      
      geminiButton.addEventListener('mouseleave', () => {
        geminiButton.style.transform = 'scale(1)';
        geminiButton.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
      });
      
      // Create Notes button (semi-transparent and smaller) - IMPROVED VISIBILITY
      const notesButton = document.createElement('button');
      notesButton.id = 'wordstream-notes-button';
      notesButton.innerHTML = '<span style="font-size: 16px;">📝</span>';
      notesButton.style.width = '36px';
      notesButton.style.height = '36px';
      notesButton.style.borderRadius = '50%';
      notesButton.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'; // More opaque blue
      notesButton.style.color = 'white';
      notesButton.style.border = '2px solid rgba(255, 255, 255, 0.6)'; // More visible border
      notesButton.style.display = 'flex';
      notesButton.style.alignItems = 'center';
      notesButton.style.justifyContent = 'center';
      notesButton.style.cursor = 'pointer';
      notesButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)'; // Stronger shadow
      notesButton.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
      notesButton.title = 'Open Notes Panel';

      // Hover effects
      notesButton.addEventListener('mouseenter', () => {
        notesButton.style.transform = 'scale(1.1)';
        notesButton.style.backgroundColor = 'rgba(59, 130, 246, 1)';
      });
      
      notesButton.addEventListener('mouseleave', () => {
        notesButton.style.transform = 'scale(1)';
        notesButton.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
      });
      
      // Add click handler for Gemini button
      geminiButton.addEventListener('click', () => {
        console.log('[WordStream] Gemini button clicked');
        
        // Toggle panel
        if (isPanelVisible && activePanel === 'gemini') {
          // If already open, close it
          reactContainer.style.display = 'none';
          isPanelVisible = false;
          activePanel = '';
          return;
        }
        
        // Otherwise, open the panel
        reactContainer.style.display = 'block';
        this.renderControls(reactContainer, true, true, false); // persistVisibility=true, showGemini=true
        isPanelVisible = true;
        activePanel = 'gemini';
      });
      
      // Add click handler for Notes button
      notesButton.addEventListener('click', () => {
        console.log('[WordStream] Notes button clicked');
        
        // Toggle panel
        if (isPanelVisible && activePanel === 'notes') {
          // If already open, close it
          reactContainer.style.display = 'none';
          isPanelVisible = false;
          activePanel = '';
          return;
        }
        
        // Otherwise, open the panel
        reactContainer.style.display = 'block';
        this.renderControls(reactContainer, true, false, true); // persistVisibility=true, showNotes=true
        isPanelVisible = true;
        activePanel = 'notes';
      });
      
      // Add buttons to wrapper
      buttonsWrapper.appendChild(geminiButton);
      buttonsWrapper.appendChild(notesButton);
      
      // Add wrappers to container
      controlsContainer.appendChild(buttonsWrapper);
      controlsContainer.appendChild(reactContainer);
      
      // Add container to player
      videoPlayer.appendChild(controlsContainer);
      
      // Store a reference to the container for later cleanup
      this.controlsContainer = controlsContainer;
      
      // Log visibility to help debug
      console.log('[WordStream] Control container is visible: ', window.getComputedStyle(controlsContainer).display !== 'none');
      
      // Double-check that it stays in DOM (occasional issue)
      setTimeout(() => {
        const stillInDOM = document.getElementById('wordstream-floating-controls-container');
        console.log('[WordStream] Control container still in DOM after 1s: ', !!stillInDOM);
      }, 1000);
      */
    } catch (error) {
      console.error('[WordStream] Error adding floating controls:', error);
    }
  }

  public renderControls(container: HTMLElement, persist: boolean = true, showGemini: boolean = false, showNotes: boolean = false) {
    console.log(`[WordStream] Rendering controls. Persist: ${persist}, Show Gemini: ${showGemini}, Show Notes: ${showNotes}`);
    
    try {
      // Check if React is available globally
      let React = (window as any).React;
      let ReactDOM = (window as any).ReactDOM;
      
      if (!React || !ReactDOM || !ReactDOM.createRoot) {
        console.log('[WordStream] React or ReactDOM not found globally, importing directly...');
        
        // If not available globally, try to import directly
        // This assumes that React and ReactDOM are available in the extension's namespace
        try {
          React = require('react');
          ReactDOM = require('react-dom/client');
          console.log('[WordStream] Successfully imported React and ReactDOM');
        } catch (e) {
          console.error('[WordStream] Failed to import React and ReactDOM:', e);
          return;
        }
      }
      
      // Debug logs to check availability
      console.log('[WordStream] React available:', !!React);
      console.log('[WordStream] ReactDOM available:', !!ReactDOM);
      console.log('[WordStream] ReactDOM.createRoot available:', !!(ReactDOM && ReactDOM.createRoot));
      
      // Check if the FloatingControls component is available from the global context
      const FloatingControls = (window as any).WordStream?.Components?.FloatingControls;
      if (!FloatingControls) {
        console.error('[WordStream] FloatingControls component not found');
        return;
      }
      
      console.log('[WordStream] FloatingControls component found');
      
      // Clear existing content
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Create a new div for the root
      const rootElement = document.createElement('div');
      rootElement.className = 'wordstream-root';
      container.appendChild(rootElement);
      
      try {
        // Use createRoot (React 18+)
        const root = ReactDOM.createRoot(rootElement);
        
        // Track current time and duration
        const playerApi = this.getPlayerApi();
        const currentTime = playerApi ? playerApi.getCurrentTime() : 0;
        const videoDuration = playerApi ? playerApi.getDuration() : 0;
        
        // Set up persistent visibility and debugging
        console.log(`[WordStream] Creating component with persistVisibility=${persist}`);
        
        // Render the component with persistence for visibility
        root.render(
          React.createElement(FloatingControls, {
            onClose: () => {
              console.log('[WordStream] Close button clicked');
              container.style.display = 'none';
            },
            persistVisibility: persist,
            initialShowGemini: showGemini,
            initialShowNotes: showNotes,
            currentTime: currentTime,
            videoDuration: videoDuration
          })
        );
        
        console.log('[WordStream] Component rendered successfully');
      } catch (e) {
        console.error('[WordStream] Error rendering with createRoot:', e);
      }
    } catch (error) {
      console.error('[WordStream] Error rendering controls:', error);
    }
  }
  
  public removeFloatingControls(): void {
    console.log('[WordStream] YouTube detector: Cleanly releasing controls resources');
    
    // Clear any intervals
    if (this.videoUpdateInterval) {
      clearInterval(this.videoUpdateInterval as unknown as number);
      this.videoUpdateInterval = null;
    }
    
    // Just unmount React components if needed
    if (this.controlsRoot) {
      try {
        this.controlsRoot.unmount();
      } catch (e) {
        console.warn('[WordStream] Error unmounting React root:', e);
      }
      this.controlsRoot = null;
    }
    
    // Just clean up references, don't touch DOM (handled by content script)
    this.controlsContainer = null;
    
    console.log('[WordStream] YouTube detector: Controls resources released');
  }

  private getVideoId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || window.location.pathname;
  }

  private getPlayerApi(): any {
    // Access YouTube's player API through the window object
    try {
      // YouTube's player API is available in multiple potential locations
      if (document.querySelector('.html5-video-player')) {
        // Method 1: From the HTML5 player element directly
        const playerElement = document.querySelector('.html5-video-player');
        if (playerElement && (playerElement as any).getPlayerState) {
          console.log('[WordStream] Found player API via player element');
          return playerElement;
        }

        // Method 2: From the global YouTube object
        if (window.hasOwnProperty('yt') && 
            (window as any).yt && 
            (window as any).yt.player && 
            (window as any).yt.player.getPlayerByElement) {
          const player = (window as any).yt.player.getPlayerByElement(playerElement);
          if (player) {
            console.log('[WordStream] Found player API via yt.player global object');
            return player;
          }
        }

        // Method 3: Access via legacy API
        const videoElement = document.querySelector('video');
        if (videoElement) {
          console.log('[WordStream] Using video element as fallback for player API');
          return {
            getPlayerState: () => videoElement.paused ? 2 : 1,
            getCurrentTime: () => videoElement.currentTime,
            getDuration: () => videoElement.duration,
            getVideoUrl: () => window.location.href,
            getVideoData: () => ({
              video_id: this.getVideoId(),
              title: document.title.replace(' - YouTube', '')
            })
          };
        }
      }
      
      console.error('[WordStream] Player API not found');
      return null;
    } catch (error) {
      console.error('[WordStream] Error getting player API:', error);
      return null;
    }
  }
} 