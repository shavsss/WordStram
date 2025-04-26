/**
 * Translation related message types
 */
export enum TranslationMessageType {
  TRANSLATE_WORD = 'translate_word',
  SAVE_WORD = 'save_word',
  GET_WORDS = 'get_words',
  DELETE_WORD = 'delete_word',
}

/**
 * Translation message payloads
 */
export interface TranslateWordMessage {
  type: TranslationMessageType.TRANSLATE_WORD;
  payload: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  };
}

export interface SaveWordMessage {
  type: TranslationMessageType.SAVE_WORD;
  payload: {
    text: string;
    translation: string;
    sourceLanguage: string;
    targetLanguage: string;
    context?: string;
  };
}

export interface GetWordsMessage {
  type: TranslationMessageType.GET_WORDS;
}

export interface DeleteWordMessage {
  type: TranslationMessageType.DELETE_WORD;
  payload: {
    id: string;
  };
} 