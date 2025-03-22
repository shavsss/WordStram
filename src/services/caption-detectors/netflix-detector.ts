/// <reference types="chrome"/>

import { TranslationService } from '@/services/translation/translation-service';
import { SupportedLanguageCode } from '@/config/supported-languages';
import { CaptionDetector } from './types';
import { CaptionsLanguageInfo } from '@/types';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FloatingControls } from '@/components/floating-controls/FloatingControls';

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
    this.translationService = new TranslationService();
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

  public processCaption(caption: HTMLElement): void {
    if (!caption) return;
    this.startObserving(caption);
  }

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

  private needsSpaceBetweenWords(word1: string, word2: string): boolean {
    const noSpaceScripts = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
    return !(noSpaceScripts.test(word1) || noSpaceScripts.test(word2));
  }

  private detectCaptionsLanguage(): CaptionsLanguageInfo {
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
        language: 'en',
        languageName: 'English',
        isAuto: false
      };
    } catch (error) {
      console.error('Error detecting Netflix captions language:', error);
      return {
        language: 'en',
        languageName: 'English',
        isAuto: false
      };
    }
  }

  async handleWordClick(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    const word = target.textContent;
    if (!word) return;

    console.log('WordStream: Handling click for word:', word);

    try {
      // Wait for Chrome API to be available
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        console.error('Chrome API not available');
        return;
      }

      // Detect captions language
      const captionsLanguage = this.detectCaptionsLanguage();
      console.log('WordStream: Detected Netflix captions language:', captionsLanguage);

      chrome.storage.sync.get(['settings', 'words', 'stats'], async (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error accessing storage:', chrome.runtime.lastError);
          return;
        }

        const targetLang = result.settings?.targetLanguage || 'en';
        console.log('WordStream: Translating to:', targetLang);
        
        const translation = await this.translationService.translate(word, targetLang);
        console.log('WordStream: Translation result:', translation);

        if (translation.success && translation.translatedText) {
          // Show translation popup
          this.showTranslationPopup(translation.translatedText, event);

          // Get Netflix show/movie title and episode info
          const title = document.querySelector('.video-title')?.textContent || document.title;
          const episodeInfo = {
            season: undefined as number | undefined,
            episode: undefined as number | undefined,
            episodeTitle: undefined as string | undefined
          };

          // Try to get episode info if available
          const episodeElement = document.querySelector('.video-title h4');
          if (episodeElement) {
            const episodeText = episodeElement.textContent || '';
            const match = episodeText.match(/S(\d+):E(\d+)/);
            if (match) {
              episodeInfo.season = parseInt(match[1]);
              episodeInfo.episode = parseInt(match[2]);
              episodeInfo.episodeTitle = episodeText.replace(/S\d+:E\d+\s*/, '').trim();
            }
          }

          // Save word to storage with language info
          const newWord = {
            id: `${word}-${Date.now()}`,
            originalWord: word,
            targetWord: translation.translatedText,
            sourceLanguage: captionsLanguage.language,
            targetLanguage: targetLang,
            timestamp: new Date().toISOString(),
            context: {
              source: 'netflix' as const,
              videoTitle: title,
              captionsLanguage,
              url: window.location.href,
              episodeInfo
            },
            stats: {
              successRate: 0,
              totalReviews: 0,
              lastReview: new Date().toISOString()
            }
          };

          // Load existing words and metadata
          chrome.storage.sync.get(['words_metadata', 'words_groups'], async (metadataResult) => {
            if (chrome.runtime.lastError) {
              console.error('Error accessing metadata:', chrome.runtime.lastError);
              return;
            }

            // Check if we're using the new format
            const usingNewFormat = !!(metadataResult.words_metadata && metadataResult.words_groups);
            
            if (usingNewFormat) {
              // Load all existing words using the new grouped format
              console.log('WordStream: Using new word storage format');
              let existingWords: any[] = [];
              
              if (Array.isArray(metadataResult.words_groups)) {
                // Fetch all word groups
                chrome.storage.sync.get(metadataResult.words_groups, (groupsResult) => {
                  if (chrome.runtime.lastError) {
                    console.error('Error loading word groups:', chrome.runtime.lastError);
                    return;
                  }
                  
                  // Combine groups
                  for (const groupKey of metadataResult.words_groups) {
                    if (groupsResult[groupKey] && Array.isArray(groupsResult[groupKey])) {
                      existingWords.push(...groupsResult[groupKey]);
                    }
                  }
                  
                  this.saveWordWithGroups(existingWords, newWord, captionsLanguage, targetLang);
                });
              } else {
                this.saveWordWithGroups([], newWord, captionsLanguage, targetLang);
              }
            } else {
              // Fall back to old format
              console.log('WordStream: Using old word storage format (legacy)');
              chrome.storage.sync.get(['words', 'stats'], (result) => {
                if (chrome.runtime.lastError) {
                  console.error('Error accessing words:', chrome.runtime.lastError);
                  return;
                }
                
                const words = result.words || [];
                const stats = result.stats || {
                  wordsLearned: 0,
                  dailyStreak: 0,
                  accuracy: 0,
                  lastActive: new Date().toISOString()
                };
                
                // Only add if word doesn't exist
                console.log(`Checking if word "${word}" already exists...`);
                const normalizedWord = word.trim().toLowerCase();
                
                if (!words.some((w: any) => 
                  w.originalWord.trim().toLowerCase() === normalizedWord && 
                  w.sourceLanguage === captionsLanguage.language && 
                  w.targetLanguage === targetLang)) {
                  
                  console.log(`Adding new word: "${word}" (${captionsLanguage.language} → ${targetLang})`);
                  words.push(newWord);
                  
                  // Update stats
                  const now = new Date();
                  const lastActive = new Date(stats.lastActive);
                  const isNewDay = now.getDate() !== lastActive.getDate() ||
                                 now.getMonth() !== lastActive.getMonth() ||
                                 now.getFullYear() !== lastActive.getFullYear();

                  if (isNewDay) {
                    const dayDiff = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
                    stats.dailyStreak = dayDiff === 1 ? stats.dailyStreak + 1 : 1;
                  }

                  stats.wordsLearned += 1;
                  stats.lastActive = now;

                  chrome.storage.sync.set({ 
                    words,
                    stats
                  }, () => {
                    if (chrome.runtime.lastError) {
                      console.error('Error saving data:', chrome.runtime.lastError);
                      return;
                    }
                    console.log('WordStream: Word saved:', newWord);
                    console.log('WordStream: Stats updated:', stats);
                  });
                } else {
                  console.log(`Word "${word}" already exists, not adding duplicate`);
                }
              });
            }
          });
        } else {
          console.error('Translation failed:', translation.error);
        }
      });
    } catch (error) {
      console.error('Error handling word click:', error);
    }
  }

  private getSubtitleContext(wordElement: HTMLElement): string {
    // Find the parent subtitle element
    const subtitle = wordElement.closest('.player-timedtext-text-container');
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

  private showTranslationPopup(translation: string, event: MouseEvent): void {
    // Remove existing popup
    if (this.popup) {
      this.popup.remove();
    }

    // Create new popup
    this.popup = document.createElement('div');
    this.popup.className = 'wordstream-popup';
    
    const target = event.target as HTMLElement;
    const originalWord = target.textContent || '';

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
    translatedElement.textContent = translation;
    Object.assign(translatedElement.style, {
      fontWeight: '500',
      fontSize: '16px',
      display: 'block',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif"
    });
    this.popup.appendChild(translatedElement);

    // Add popup to document
    document.body.appendChild(this.popup);

    // Remove popup after 4 seconds
    setTimeout(() => {
      if (this.popup) {
        this.popup.style.opacity = '0';
        setTimeout(() => {
          if (this.popup) {
            this.popup.remove();
            this.popup = null;
          }
        }, 200);
      }
    }, 4000);
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
      const textNodes = Array.from(captionContainer.getElementsByClassName('player-timedtext-text-container'))
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
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    } catch (error) {
      console.error('WordStream: Error stopping observation:', error);
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

    // Remove all event listeners from words
    const words = document.querySelectorAll('.wordstream-word');
    words.forEach((word) => {
      const clone = word.cloneNode(true);
      word.parentNode?.replaceChild(clone, word);
    });

    // Remove floating controls on cleanup
    this.removeFloatingControls();
  }

  public addFloatingControls(): void {
    console.log('[WordStream] Adding floating controls to Netflix...');
    
    try {
      // First try to find the standard Netflix player
      let videoPlayer = document.querySelector('.watch-video');
      
      // If that fails, look for any video container
      if (!videoPlayer) {
        console.warn('[WordStream] Standard Netflix player not found, trying alternatives');
        videoPlayer = document.querySelector('.VideoContainer') as HTMLElement ||
                     document.querySelector('.nfp') as HTMLElement;
      }
      
      // Last resort - attach to body
      if (!videoPlayer) {
        console.warn('[WordStream] Using fallback container for controls');
        videoPlayer = document.body as HTMLElement;
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
          console.log('[WordStream] Successfully imported React and ReactDOM for Netflix');
        } catch (e) {
          console.error('[WordStream] Failed to import React and ReactDOM for Netflix:', e);
          return;
        }
      }
      
      // Debug logs to check availability
      console.log('[WordStream] React available for Netflix:', !!React);
      console.log('[WordStream] ReactDOM available for Netflix:', !!ReactDOM);
      console.log('[WordStream] ReactDOM.createRoot available for Netflix:', !!(ReactDOM && ReactDOM.createRoot));
      
      // Check if the FloatingControls component is available from the global context
      const FloatingControls = (window as any).WordStream?.Components?.FloatingControls;
      if (!FloatingControls) {
        console.error('[WordStream] FloatingControls component not found for Netflix');
        return;
      }
      
      console.log('[WordStream] FloatingControls component found for Netflix');
      
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
        const videoElement = document.querySelector('video');
        const currentTime = videoElement ? videoElement.currentTime : 0;
        const videoDuration = videoElement ? videoElement.duration : 0;
        
        // Set up persistent visibility and debugging
        console.log(`[WordStream] Creating component for Netflix with persistVisibility=${persist}`);
        
        // Render the component with persistence for visibility
        root.render(
          React.createElement(FloatingControls, {
            onClose: () => {
              console.log('[WordStream] Close button clicked in Netflix');
              container.style.display = 'none';
            },
            persistVisibility: persist,
            initialShowGemini: showGemini,
            initialShowNotes: showNotes,
            currentTime: currentTime,
            videoDuration: videoDuration
          })
        );
        
        console.log('[WordStream] Component rendered successfully for Netflix');
      } catch (e) {
        console.error('[WordStream] Error rendering with createRoot for Netflix:', e);
      }
    } catch (error) {
      console.error('[WordStream] Error rendering controls for Netflix:', error);
    }
  }
  
  public removeFloatingControls(): void {
    console.log('[WordStream] Netflix detector: Cleanly releasing controls resources');
    
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
    
    console.log('[WordStream] Netflix detector: Controls resources released');
  }

  // Helper method to save word using the new grouped format
  private saveWordWithGroups(existingWords: any[], newWord: any, captionsLanguage: any, targetLang: string): void {
    // Check if word already exists
    const word = newWord.originalWord;
    const normalizedWord = word.trim().toLowerCase();
    
    const wordExists = existingWords.some((w: any) => 
      w.originalWord?.trim().toLowerCase() === normalizedWord && 
      w.sourceLanguage === captionsLanguage.language && 
      w.targetLanguage === targetLang
    );
    
    if (wordExists) {
      console.log(`Word "${word}" already exists, not adding duplicate`);
      return;
    }
    
    console.log(`Adding new word: "${word}" (${captionsLanguage.language} → ${targetLang})`);
    
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
    chrome.storage.sync.set({ words_metadata: wordsMetadata }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving metadata:', chrome.runtime.lastError);
        return;
      }
      
      // שמירת כל קבוצת מילים בנפרד
      for (const [groupKey, groupWords] of Object.entries(wordsByGroup)) {
        chrome.storage.sync.set({ [groupKey]: groupWords }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Error saving group ${groupKey}:`, chrome.runtime.lastError);
          }
        });
      }
      
      // טעינת הסטטיסטיקות הקיימות כדי לעדכן את הסטרייק ואת מספר המילים היומיות
      chrome.storage.sync.get(['stats'], (statsResult) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading stats:', chrome.runtime.lastError);
          return;
        }
        
        const currentStats = statsResult.stats || {};
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
        
        // שמירת רשימת הקבוצות ועדכון הסטטיסטיקות
        chrome.storage.sync.set({ 
          words_groups: Object.keys(wordsByGroup),
          stats: {
            totalWords: wordsToSave.length,
            lastSaved: now.toISOString(),
            todayWords: todayWords,
            streak: streak,
            lastActive: now.toISOString()
          }
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving groups list and stats:', chrome.runtime.lastError);
            return;
          }
          console.log('WordStream: Word saved successfully in grouped format');
          console.log('WordStream: Stats updated - streak:', streak, 'today words:', todayWords);
        });
      });
    });
  }
} 