import { LRUCache } from 'lru-cache';
import { GoogleTranslateProvider } from './providers/google-translate';
import { TranslationResult } from '@/types';
import { SupportedLanguageCode, isLanguageSupported } from '@/config/supported-languages';

export class TranslationService {
  private cache: LRUCache<string, TranslationResult>;
  private provider: GoogleTranslateProvider;

  constructor() {
    this.provider = new GoogleTranslateProvider();
    this.cache = new LRUCache({
      max: 1000, // Maximum number of items to store
      ttl: 1000 * 60 * 60 * 24, // Cache for 24 hours
    });
  }

  async translate(text: string, targetLang: SupportedLanguageCode): Promise<TranslationResult> {
    if (!isLanguageSupported(targetLang)) {
      return {
        success: false,
        error: `Unsupported target language: ${targetLang}`,
      };
    }

    const cacheKey = `${text}:${targetLang}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.provider.translate(text, targetLang);
      if (result.success) {
        this.cache.set(cacheKey, result);
      }
      return result;
    } catch (error) {
      console.error('Translation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
} 