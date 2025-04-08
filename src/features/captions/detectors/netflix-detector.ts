/**
 * Netflix Caption Detector
 * גלאי כתוביות נטפליקס
 */

/// <reference types="chrome"/>

import { TranslationService } from '@/services/translation/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { CaptionDetector, CaptionsLanguageInfo } from '../types';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingControls } from '@/shared/panels/components/FloatingControls';
import { safeDate } from '@/utils/date-utils';

/**
 * גלאי כתוביות לאתר נטפליקס
 * Caption detector for Netflix
 */
export class NetflixCaptionDetector implements CaptionDetector {
  source = 'netflix';
  private translationService: TranslationService;
  private observer: MutationObserver | null = null;
  private popup: HTMLElement | null = null;
  private lastProcessedText: WeakMap<Text, string> = new WeakMap();
  private animationFrameId: number | null = null;
  private controlsContainer: HTMLElement | null = null;
  private videoUpdateInterval: number | null = null;
  private currentVideoTime: number = 0;
  private videoDuration: number = 0;
  private controlsRoot: any = null;

  constructor() {
    this.translationService = TranslationService.getInstance();
    this.initializeObserver();
  }

  /**
   * אתחול צופה על שינויים בעמוד
   * Initialize observer for DOM changes
   */
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

  /**
   * זיהוי מיכל הכתוביות בעמוד
   * Detect the caption container element
   */
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

  /**
   * עיבוד מיכל כתוביות
   * Process the caption container
   */
  public processCaption(caption: HTMLElement): void {
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      return;
    }

    if (!caption) return;
    this.startObserving(caption);
  }

  /**
   * עיבוד של צומת טקסט
   * Process a text node to make words clickable
   */
  public processTextNode(textNode: Text): void {
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

    // יצירת שכבת רפאים למעברים חלקים
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
        const nextWord = words[index + 1];
        if (this.needsSpaceBetweenWords(word, nextWord)) {
          fragment.appendChild(document.createTextNode(' '));
        }
      }
    });

    parent.replaceChild(fragment, textNode);
    this.lastProcessedText.set(textNode, text);

    requestAnimationFrame(() => {
      ghostContainer.remove();
    });
  }

  /**
   * בדיקה אם צריך רווח בין מילים (בהתאם לכתב)
   * Check if space is needed between words based on script
   */
  private needsSpaceBetweenWords(word1: string, word2: string): boolean {
    const noSpaceScripts = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
    return !(noSpaceScripts.test(word1) || noSpaceScripts.test(word2));
  }

  /**
   * זיהוי שפת הכתוביות
   * Detect the captions language
   */
  private detectCaptionsLanguage(): CaptionsLanguageInfo {
    try {
      // ניסיון לקבל שפה מתפריט הכתוביות של נטפליקס
      // Try to get language from Netflix's subtitle menu
      const subtitleMenu = document.querySelector('.track-list-subtitles');
      if (subtitleMenu) {
        const selectedTrack = subtitleMenu.querySelector('[aria-selected="true"]');
        if (selectedTrack) {
          const label = selectedTrack.textContent || '';
          const isAuto = label.toLowerCase().includes('auto-generated');
          
          // קוד השפה בדרך כלל כלול במאפייני נתונים
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

      // גיבוי: ניסיון לקבל מנגן הווידאו
      // Fallback: Try to get from video player
      const player = document.querySelector('.VideoContainer');
      if (player) {
        const lang = player.getAttribute('lang') || document.documentElement.lang;
        if (lang) {
          return {
            language: lang.split('-')[0],
            languageName: new Intl.DisplayNames([navigator.language], { type: 'language' }).of(lang) || lang,
            isAuto: false
          };
        }
      }

      console.error('WordStream: Error detecting Netflix captions language:', 'No language found');
      
      // ברירת מחדל: אנגלית
      // Default to English
      return {
        language: 'en',
        languageName: 'English',
        isAuto: false
      };
    } catch (error) {
      console.error('WordStream: Error detecting Netflix captions language:', error);
      
      return {
        language: 'en',
        languageName: 'English',
        isAuto: false
      };
    }
  }

  /**
   * טיפול בלחיצה על מילה
   * Handle word click event
   */
  async handleWordClick(event: MouseEvent): Promise<void> {
    if (typeof window !== 'undefined' && window.WordStream?.local?.isAuthenticated !== true) {
      console.log('WordStream Netflix: Word click blocked - user not authenticated');
      return;
    }
    
    const wordElement = event.target as HTMLElement;
    if (!wordElement || !wordElement.textContent) return;

    const word = wordElement.textContent.trim();
    if (!word) return;

    try {
      // קבלת שפת הכתוביות
      // Get captions language
      const captionsLanguage = this.detectCaptionsLanguage();
      console.log('WordStream: Detected Netflix captions language:', captionsLanguage);

      // קבלת שפת היעד מההגדרות
      // Get target language from settings
      let targetLang: SupportedLanguageCode = 'en';
      if (captionsLanguage.language === 'en') {
        targetLang = 'he';
      }

      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          const result = await new Promise<{settings?: {targetLanguage?: string}}>(resolve => {
            chrome.storage.sync.get(['settings'], result => resolve(result));
          });
          
          if (result.settings?.targetLanguage) {
            targetLang = result.settings.targetLanguage as SupportedLanguageCode;
          }
        }
      } catch (storageError) {
        console.error('WordStream: Error getting settings:', storageError);
      }

      // פיענוח הקשר המילה
      // Get word context
      const context = this.getSubtitleContext(wordElement);

      // תרגום המילה
      // Translate the word
      let translationResult;
      if (captionsLanguage.language === 'en' && targetLang === 'he') {
        translationResult = await this.translationService.translateToHebrew(word);
      } else if (captionsLanguage.language === 'he' && targetLang === 'en') {
        translationResult = await this.translationService.translateToEnglish(word);
      } else {
        translationResult = await this.translationService.translate(word, targetLang);
      }

      if (!translationResult.success || !translationResult.translatedText) {
        console.error('WordStream: Translation failed:', translationResult.error);
        return;
      }

      // הצגת תרגום
      // Show translation
      this.showTranslationPopup(translationResult.translatedText, event);

      // קבלת פרטי המדיה
      // Get Netflix show/movie title and episode info
      let videoTitle = document.title.replace(' - Netflix', '');
      const episodeInfo = document.querySelector('.video-title h4, .video-title h3');
      if (episodeInfo && episodeInfo.textContent) {
        videoTitle = episodeInfo.textContent.trim();
      }

      // קבלת URL של הסרטון
      // Get video URL
      const videoURL = window.location.href;
      const videoId = videoURL.match(/watch\/(\d+)/)?.[1] || '';

      // קבלת כל המילים
      // Get all words
      const existingWords = await new Promise<any[]>(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          chrome.storage.sync.get(['words'], result => {
            resolve(result.words || []);
          });
        } else {
          resolve([]);
        }
      });

      // שמירת המילה
      // Save the word with context
      const sourceLang = captionsLanguage.language;
      const newWord = {
        id: Date.now().toString(),
        word,
        translation: translationResult.translatedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        timestamp: safeDate(new Date()).toISOString(),
        context: {
          source: 'netflix' as const,
          text: context,
          videoTitle,
          videoId,
          url: videoURL,
          captionsLanguage: sourceLang
        },
        stats: {
          successRate: 0,
          totalReviews: 0,
          lastReview: null
        }
      };

      // שמירת המילה תוך טיפול בקבוצות מילים
      // Save the word with groups handling
      this.saveWordWithGroups(existingWords, newWord, captionsLanguage.language, targetLang);

    } catch (error) {
      console.error('WordStream: Error handling word click:', error);
    }
  }

  /**
   * קבלת הקשר מהכתוביות
   * Get context from subtitle
   */
  private getSubtitleContext(wordElement: HTMLElement): string {
    try {
      let subtitleElement = wordElement.closest('.player-timedtext-text-container');
      if (!subtitleElement) {
        subtitleElement = wordElement.closest('.player-timedtext');
      }
      
      if (subtitleElement) {
        return subtitleElement.textContent?.trim() || '';
      }
      
      return '';
    } catch (error) {
      console.error('WordStream: Error getting subtitle context:', error);
      return '';
    }
  }

  /**
   * הצגת חלונית תרגום
   * Show translation popup
   */
  private showTranslationPopup(translation: string, event: MouseEvent): void {
    // הסרת חלונית קודמת
    // Remove previous popup
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    // יצירת חלונית חדשה
    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'wordstream-translation-popup';
    popup.style.cssText = `
      position: absolute;
      z-index: 9999;
      background-color: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 16px;
      max-width: 300px;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: opacity 0.3s ease;
      display: flex;
      align-items: center;
      text-align: center;
    `;

    // תוכן התרגום
    // Translation content
    popup.textContent = translation;

    // הוספה למסמך
    // Add to document
    document.body.appendChild(popup);
    this.popup = popup;

    // מיקום החלונית יחסית לאירוע הלחיצה
    // Position popup relative to click
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    
    // מיקום בתחתית המילה שנלחצה
    // Position below the clicked word
    let top = rect.bottom + 10;
    
    // אם החלונית תצא מחוץ למסך, יש למקם אותה מעל המילה
    // If popup would go outside screen, position above the word
    if (top + popupRect.height > window.innerHeight) {
      top = rect.top - popupRect.height - 10;
    }
    
    // מיקום אופקי במרכז המילה
    // Horizontal position in the center of the word
    let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
    
    // תיקון אם החלונית תצא מהמסך מצד שמאל או ימין
    // Fix if popup would go outside screen from left or right
    if (left < 10) left = 10;
    if (left + popupRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popupRect.width - 10;
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    // הסרת החלונית לאחר זמן קצוב
    // Remove popup after timeout
    setTimeout(() => {
      if (this.popup) {
        this.popup.style.opacity = '0';
        setTimeout(() => {
          if (this.popup) {
            this.popup.remove();
            this.popup = null;
          }
        }, 300);
      }
    }, 2500);
  }

  /**
   * התחלת צפייה במיכל הכתוביות
   * Start observing caption container
   */
  public startObserving(captionContainer: HTMLElement): void {
    if (!this.observer) {
      console.warn('WordStream: Observer not initialized');
      return;
    }

    this.observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // אחת ל-200ms לבדוק אם יש תוכן טקסט ישיר
    // Check for direct text content every 200ms
    this.processCaption(captionContainer);
  }

  /**
   * עצירת צפייה במיכל הכתוביות
   * Stop observing caption container
   */
  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * ניקוי משאבים
   * Clean up resources
   */
  public cleanup(): void {
    this.stopObserving();
    this.removeFloatingControls();

    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    if (this.videoUpdateInterval) {
      clearInterval(this.videoUpdateInterval);
      this.videoUpdateInterval = null;
    }
  }

  /**
   * הוספת פקדים צפים
   * Add floating controls
   */
  public addFloatingControls(): void {
    console.log('[WordStream] Adding floating controls to Netflix...');
    
    try {
      // חיפוש קונטיינר לפקדים
      // First try to find the standard Netflix player
      const playerContainer = document.querySelector('#appMountPoint');
      
      if (!playerContainer) {
        console.warn('[WordStream] Standard Netflix player not found, trying alternatives');
        return;
      }

      // בדיקה אם הקונטיינר כבר קיים
      // Check if container already exists
      const existingContainer = document.getElementById('wordstream-controls-container');
      if (existingContainer) {
        this.controlsContainer = existingContainer;
        return;
      }

      // יצירת קונטיינר
      // Create container
      const container = document.createElement('div');
      container.id = 'wordstream-controls-container';
      container.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      `;
      
      document.body.appendChild(container);
      this.controlsContainer = container;
      
      // עדכון נתוני וידאו
      // Update video data
      this.videoUpdateInterval = window.setInterval(() => {
        try {
          const videoPlayer = document.querySelector('video');
          if (videoPlayer) {
            this.currentVideoTime = videoPlayer.currentTime;
            this.videoDuration = videoPlayer.duration;
          }
        } catch (e) {
          console.warn('WordStream: Error updating video time', e);
        }
      }, 1000);
      
      // רינדור הפקדים
      // Render controls
      this.renderControls(container);
      
    } catch (error) {
      console.error('WordStream: Error adding floating controls', error);
    }
  }

  /**
   * רינדור פקדים צפים
   * Render floating controls
   */
  public renderControls(container: HTMLElement, persist: boolean = true, showGemini: boolean = false, showNotes: boolean = false) {
    // וידוא שהקונטיינר קיים
    // Ensure container exists
    if (!container) {
      return;
    }
    
    // ניסיון להשתמש ב-React
    // Try to use React
    try {
      console.log('[WordStream] Successfully imported React and ReactDOM for Netflix');
      
      try {
        if (!React || !createRoot) {
          console.error('[WordStream] React or createRoot not available for Netflix');
          return;
        }
        
        console.log('[WordStream] React available for Netflix:', !!React);
        console.log('[WordStream] ReactDOM.createRoot available for Netflix:', !!createRoot);
        
        try {
          if (!FloatingControls) {
            console.error('[WordStream] FloatingControls component not found for Netflix');
            return;
          }
          
          console.log('[WordStream] FloatingControls component found for Netflix');
          
          try {
            // קבלת כותרת הוידאו
            // Get video title
            let videoTitle = document.title.replace(' - Netflix', '');
            const episodeInfo = document.querySelector('.video-title h4, .video-title h3');
            if (episodeInfo && episodeInfo.textContent) {
              videoTitle = episodeInfo.textContent.trim();
            }
            
            // קבלת URL ומזהה הוידאו
            // Get video URL and ID
            const videoURL = window.location.href;
            const videoId = videoURL.match(/watch\/(\d+)/)?.[1] || '';
            
            // קבלת שפת הכתוביות
            // Get captions language
            const captionsLanguage = this.detectCaptionsLanguage();
            
            console.log(`[WordStream] Creating component for Netflix with persistVisibility=${persist}`);
            
            const app = React.createElement(FloatingControls, {
              videoId,
              videoTitle,
              videoURL,
              videoTime: this.currentVideoTime,
              captionsLanguage: captionsLanguage.language,
              showGemini,
              showNotes,
              source: 'netflix',
              persistVisibility: persist,
              onClose: () => {
                console.log('[WordStream] Close button clicked in Netflix');
                this.removeFloatingControls();
              }
            });
            
            // ניקוי אם יש כבר רינדור קודם
            // Clean up previous render
            if (this.controlsRoot) {
              this.controlsRoot.unmount();
            }
            
            // רינדור
            // Render
            this.controlsRoot = createRoot(container);
            this.controlsRoot.render(app);
            console.log('[WordStream] Component rendered successfully for Netflix');
          } catch (e) {
            console.error('[WordStream] Error rendering with createRoot for Netflix:', e);
          }
        } catch (error) {
          console.error('[WordStream] Error rendering controls for Netflix:', error);
        }
      } catch (reactError) {
        console.error('[WordStream] Error with React for Netflix:', reactError);
      }
    } catch (e) {
      console.error('[WordStream] Failed to import React and ReactDOM for Netflix:', e);
    }
  }

  /**
   * הסרת פקדים צפים
   * Remove floating controls
   */
  public removeFloatingControls(): void {
    console.log('[WordStream] Netflix detector: Cleanly releasing controls resources');
    
    try {
      if (this.controlsRoot) {
        try {
          this.controlsRoot.unmount();
        } catch (e) {
          console.warn('WordStream: Error unmounting component', e);
        }
        this.controlsRoot = null;
      }
      
      if (this.controlsContainer) {
        try {
          this.controlsContainer.remove();
        } catch (e) {
          console.warn('WordStream: Error removing controls container', e);
        }
        this.controlsContainer = null;
      }
      
      if (this.videoUpdateInterval) {
        clearInterval(this.videoUpdateInterval);
        this.videoUpdateInterval = null;
      }
      
      console.log('[WordStream] Netflix detector: Controls resources released');
    } catch (error) {
      console.error('WordStream: Error removing floating controls', error);
    }
  }

  /**
   * שמירת מילה עם קבוצות
   * Save word with groups handling
   */
  private saveWordWithGroups(existingWords: any[], newWord: any, captionsLanguage: any, targetLang: string): void {
    try {
      // קבוצת ברירת מחדל בהתאם לכיוון התרגום
      // Default group based on translation direction
      let groupKey = captionsLanguage === 'en' ? 'English-Hebrew' : (captionsLanguage === 'he' ? 'Hebrew-English' : 'Other');
      
      // בדיקה אם המילה כבר קיימת
      // Check if word already exists
      const wordExists = existingWords.some(w => 
        w.word === newWord.word && 
        w.sourceLanguage === newWord.sourceLanguage && 
        w.targetLanguage === newWord.targetLanguage
      );
      
      if (wordExists) {
        console.log('WordStream: Word already exists, not saving again');
        return;
      }
      
      // שמירה בלוקל סטורג'
      // Save to local storage
      chrome.storage.sync.set({ words: [...existingWords, newWord] }, () => {
        console.log('WordStream: Word saved successfully');
      });
    } catch (error) {
      console.error('WordStream: Error saving word:', error);
    }
  }
} 