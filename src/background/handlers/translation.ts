import { TranslationMessageType } from '../../shared/messages';
import storageService from '../../services/storage/storage-service';
import type { Word } from '../../shared/types/index';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handle word translation requests
 * @param message Message with translation request
 * @returns Promise resolving to the translation result
 */
export async function handleTranslateWord(message: any): Promise<any> {
  try {
    const { text, sourceLanguage, targetLanguage } = message.payload;
    
    if (!text) {
      return { success: false, error: 'No text provided' };
    }
    
    console.log('Translating word:', text, 'from', sourceLanguage, 'to', targetLanguage);
    
    // Get user settings for target language if not provided
    const settings = await storageService.getSettings();
    const actualTargetLang = targetLanguage || settings.targetLanguage || 'en';
    const actualSourceLang = sourceLanguage || 'auto';
    
    // TODO: Replace with actual translation API call when integrated
    // For now, we'll simulate a translation service
    const translation = `Translated: ${text}`;
    
    return {
      success: true,
      translation,
      originalText: text,
      sourceLanguage: actualSourceLang,
      targetLanguage: actualTargetLang
    };
  } catch (error) {
    console.error('Error translating word:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle saving a word
 * @param message Message with word to save
 * @returns Promise resolving to the save result
 */
export async function handleSaveWord(message: any): Promise<any> {
  try {
    const { text, translation, sourceLanguage, targetLanguage, context } = message.payload;
    
    if (!text || !translation) {
      return { success: false, error: 'Missing required word data' };
    }
    
    console.log('Saving word:', text);
    
    // Get user settings for target language if not provided
    const settings = await storageService.getSettings();
    
    // Create word object with settings-based target language
    const wordToSave: Word = {
      id: uuidv4(),
      originalWord: text,
      targetWord: translation,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage: targetLanguage || settings.targetLanguage || 'en',
      context: context || undefined,
      timestamp: new Date().toISOString(),
      favorite: false,
      mastery: 0
    };
    
    // Save word
    await storageService.saveWord(wordToSave);
    
    return {
      success: true,
      word: wordToSave
    };
  } catch (error) {
    console.error('Error saving word:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle retrieving all saved words
 * @returns Promise resolving to the words retrieval result
 */
export async function handleGetWords(): Promise<any> {
  try {
    console.log('Retrieving all saved words');
    
    // Get all words
    const words = await storageService.getAllWords();
    
    return {
      success: true,
      words
    };
  } catch (error) {
    console.error('Error retrieving words:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle deleting a word
 * @param message Message with word ID to delete
 * @returns Promise resolving to the deletion result
 */
export async function handleDeleteWord(message: any): Promise<any> {
  try {
    const { id } = message.payload;
    
    if (!id) {
      return { success: false, error: 'No word ID provided' };
    }
    
    console.log('Deleting word with ID:', id);
    
    // Delete word
    await storageService.deleteWord(id);
    
    return {
      success: true,
      wordId: id
    };
  } catch (error) {
    console.error('Error deleting word:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main handler for translation messages
 * @param message Message to handle
 * @returns Promise resolving to the handler result
 */
export async function handleTranslationMessage(message: any): Promise<any> {
  if (!message || !message.type) {
    return { success: false, error: 'Invalid message format' };
  }

  try {
    switch (message.type) {
      case TranslationMessageType.TRANSLATE_WORD:
        return await handleTranslateWord(message);
      
      case TranslationMessageType.SAVE_WORD:
        return await handleSaveWord(message);
      
      case TranslationMessageType.GET_WORDS:
        return await handleGetWords();
      
      case TranslationMessageType.DELETE_WORD:
        return await handleDeleteWord(message);
      
      default:
        return {
          success: false,
          error: `Unknown translation message type: ${message.type}`
        };
    }
  } catch (error) {
    console.error('Error handling translation message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in translation handler'
    };
  }
}

export default handleTranslationMessage; 