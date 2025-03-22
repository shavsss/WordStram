import type { Word } from '@/types';
import { SupportedLanguageCode } from '@/config/supported-languages';

// Use a constant API key instead of process.env
const GOOGLE_TRANSLATE_API_KEY = 'YOUR_API_KEY_HERE';

interface TranslationContext {
  source: 'youtube' | 'netflix';
  contentId: string;
  timestamp: number;
  sentence: string;
  title: string;
  episodeInfo?: {
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
}

interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

// Local storage version to replace Firebase
export async function translateAndStore(
  word: string,
  context: TranslationContext
): Promise<void> {
  try {
    // Get translation from Google Translate API
    const translation = await translateWord(word);

    // Store the word in local storage instead of Firestore
    const wordDoc: Omit<Word, 'id'> = {
      original: word,
      translation,
      context,
      stats: {
        successRate: 0,
        totalReviews: 0,
        lastReview: new Date()
      }
    };

    // Use Chrome storage API
    if (chrome && chrome.storage) {
      chrome.storage.sync.get(['words'], (result) => {
        const words = result.words || [];
        words.push({
          id: Date.now().toString(), // Simple ID generation
          ...wordDoc
        });
        chrome.storage.sync.set({ words });
      });
    } else {
      // Fallback to localStorage
      const wordsJson = localStorage.getItem('wordstream_words') || '[]';
      const words = JSON.parse(wordsJson);
      words.push({
        id: Date.now().toString(),
        ...wordDoc
      });
      localStorage.setItem('wordstream_words', JSON.stringify(words));
    }
  } catch (error) {
    console.error('Error translating and storing word:', error);
  }
}

async function translateWord(word: string): Promise<string> {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: word,
        target: 'en', // Should be replaced with user's target language
        source: 'auto'
      })
    }
  );

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

export class TranslationService {
  async translate(text: string, targetLang: SupportedLanguageCode): Promise<TranslationResult> {
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            target: targetLang,
            source: 'auto'
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Translation request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.data?.translations?.[0]) {
        throw new Error('Invalid translation response');
      }

      return {
        success: true,
        translatedText: result.data.translations[0].translatedText,
        detectedSourceLanguage: result.data.translations[0].detectedSourceLanguage
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 