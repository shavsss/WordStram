/**
 * Translation Popup Component
 * 
 * This module provides UI functionality for displaying word translations in a popup.
 * The popup appears when a user clicks on a word in the video captions.
 */

import { MessageType } from '../../shared/message-types';
import messageBus from '../../shared/message-bus';

/**
 * Interface for translation popup options
 */
interface TranslationPopupOptions {
  originalWord: string;
  translatedWord: string;
  position: {
    x: number;
    y: number;
  };
  onSave?: (originalWord: string, translatedWord: string) => void;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

/**
 * Request translation for a word from the background service
 * @param word Word to translate
 * @returns Promise resolving to the translated word
 */
export async function requestTranslation(word: string): Promise<string> {
  try {
    if (!word || word.trim() === '') {
      return word;
    }
    
    // Send message to background script
    const response = await messageBus.sendMessage({
      type: MessageType.TRANSLATE_WORD,
      payload: {
        word
      }
    });
    
    // Log response for debugging
    console.log('WordStream: Translation response:', response);
    
    if (response && response.success && response.translation) {
      return response.translation;
    } else {
      throw new Error('Translation failed or empty');
    }
  } catch (error) {
    console.error('WordStream: Error translating word:', error);
    return `Could not translate: ${word}`;
  }
}

/**
 * Create and show a translation popup
 * @param options Popup configuration options
 * @returns The popup DOM element
 */
export async function showTranslationPopup(options: TranslationPopupOptions): Promise<HTMLElement> {
  // If no translation is provided, try to get one
  if (!options.translatedWord || options.translatedWord.trim() === '') {
    try {
      // Show loading state
      const tempPopup = createPopup({
        ...options,
        translatedWord: 'Translating...'
      });
      
      // Request translation
      const translation = await requestTranslation(options.originalWord);
      
      // Remove temp popup
      tempPopup.remove();
      
      // Create new popup with translation
      return createPopup({
        ...options,
        translatedWord: translation
      });
    } catch (error) {
      console.error('WordStream: Error fetching translation:', error);
      // Continue with empty or default translation
      return createPopup({
        ...options,
        translatedWord: options.translatedWord || 'Translation failed'
      });
    }
  } else {
    // Use the provided translation
    return createPopup(options);
  }
}

/**
 * Create popup element with all styling and event handlers
 * @param options Popup configuration options
 * @returns The popup DOM element
 */
function createPopup(options: TranslationPopupOptions): HTMLElement {
  // Default options
  const config = {
    autoClose: true,
    autoCloseDelay: 5000,
    ...options
  };
  
  // Remove any existing popups
  const existingPopups = document.querySelectorAll('.wordstream-translation-popup');
  existingPopups.forEach(popup => popup.remove());
  
  // Create popup element
  const popup = document.createElement('div');
  popup.className = 'wordstream-translation-popup';
  
  // Add content with better styling
  popup.innerHTML = `
    <div class="wordstream-popup-content">
      <div class="wordstream-popup-header">
        <span class="wordstream-popup-title">${config.originalWord}</span>
        <button class="wordstream-popup-close">×</button>
      </div>
      <div class="wordstream-popup-body">
        <div class="wordstream-popup-translation">${config.translatedWord}</div>
      </div>
      <div class="wordstream-popup-footer">
        <button class="wordstream-popup-save">Save to Vocabulary</button>
      </div>
    </div>
  `;
  
  // Apply basic styles to ensure consistent appearance
  popup.style.position = 'absolute';
  popup.style.zIndex = '999999';
  popup.style.backgroundColor = 'rgba(28, 28, 28, 0.95)';
  popup.style.color = 'white';
  popup.style.padding = '0';
  popup.style.borderRadius = '8px';
  popup.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
  popup.style.maxWidth = '300px';
  popup.style.width = 'auto';
  popup.style.fontSize = '14px';
  popup.style.lineHeight = '1.5';
  popup.style.fontFamily = '"Roboto", "Segoe UI", sans-serif';
  
  // Style internal elements
  const content = popup.querySelector('.wordstream-popup-content') as HTMLElement;
  if (content) {
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.width = '100%';
  }
  
  const header = popup.querySelector('.wordstream-popup-header') as HTMLElement;
  if (header) {
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '10px 12px';
    header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
  }
  
  const title = popup.querySelector('.wordstream-popup-title') as HTMLElement;
  if (title) {
    title.style.fontWeight = 'bold';
    title.style.fontSize = '16px';
    title.style.color = '#64B5F6';
  }
  
  const closeBtn = popup.querySelector('.wordstream-popup-close') as HTMLElement;
  if (closeBtn) {
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 5px';
    closeBtn.style.lineHeight = '1';
  }
  
  const body = popup.querySelector('.wordstream-popup-body') as HTMLElement;
  if (body) {
    body.style.padding = '12px';
  }
  
  const translation = popup.querySelector('.wordstream-popup-translation') as HTMLElement;
  if (translation) {
    translation.style.fontSize = '15px';
  }
  
  const footer = popup.querySelector('.wordstream-popup-footer') as HTMLElement;
  if (footer) {
    footer.style.padding = '10px 12px';
    footer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
  }
  
  const saveBtn = popup.querySelector('.wordstream-popup-save') as HTMLElement;
  if (saveBtn) {
    saveBtn.style.background = '#64B5F6';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.padding = '6px 12px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '13px';
    saveBtn.style.fontWeight = 'bold';
  }
  
  // Position popup near the clicked position
  popup.style.left = `${config.position.x}px`;
  popup.style.top = `${config.position.y + 10}px`; // Slight offset below click point
  
  // Add to page
  document.body.appendChild(popup);
  
  // Adjust position if popup is off-screen
  const rect = popup.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    popup.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    popup.style.top = `${config.position.y - rect.height - 10}px`;
  }
  
  // Setup event listeners
  // Close button
  const closeButton = popup.querySelector('.wordstream-popup-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      popup.remove();
      if (config.onClose) config.onClose();
    });
  }
  
  // Save button
  const saveButton = popup.querySelector('.wordstream-popup-save');
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      await saveWord(config.originalWord, config.translatedWord);
      
      // Show saved status
      if (saveButton instanceof HTMLElement) {
        saveButton.textContent = 'Saved ✓';
        saveButton.style.backgroundColor = '#4CAF50';
      }
      
      // Callback if provided
      if (config.onSave) {
        config.onSave(config.originalWord, config.translatedWord);
      }
      
      // Auto-close after saving
      setTimeout(() => {
        popup.remove();
        if (config.onClose) config.onClose();
      }, 1500);
    });
  }
  
  // Close when clicking outside
  const handleOutsideClick = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener('click', handleOutsideClick);
      if (config.onClose) config.onClose();
    }
  };
  
  // Add delay to prevent immediate closure
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 100);
  
  // Auto-close after delay if enabled
  if (config.autoClose) {
    setTimeout(() => {
      if (document.body.contains(popup)) {
        popup.remove();
        if (config.onClose) config.onClose();
      }
    }, config.autoCloseDelay);
  }
  
  return popup;
}

/**
 * Save a word to user's vocabulary
 * @param originalWord Original word
 * @param translatedWord Translated word
 * @returns Promise resolving to true if saved successfully
 */
export async function saveWord(originalWord: string, translatedWord: string): Promise<boolean> {
  try {
    // Gather context information
    const context = {
      source: 'video',
      url: window.location.href,
      title: document.title,
      timestamp: getVideoTimestamp()
    };
    
    // Send message to background script
    const response = await messageBus.sendMessage({
      type: MessageType.SAVE_WORD,
      payload: {
        word: {
          originalWord,
          translatedWord,
          context,
          sourceLanguage: 'auto', // Use auto-detect by default
          id: `word_${Date.now()}`, // Generate unique ID
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Log response for debugging
    console.log('WordStream: Save word response:', response);
    
    return response && response.success;
  } catch (error) {
    console.error('WordStream: Error saving word:', error);
    return false;
  }
}

/**
 * Get current video timestamp if a video is playing
 * @returns Current video time in seconds or 0
 */
function getVideoTimestamp(): number {
  const videoElements = document.querySelectorAll('video');
  for (const video of Array.from(videoElements)) {
    if (!video.paused) {
      return video.currentTime;
    }
  }
  return 0;
} 