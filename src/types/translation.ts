export interface TranslationResult {
  text: string;
  detectedLanguage?: string;
  confidence: number;
  provider: string;
  alternatives?: string[];
}

export interface TranslationProvider {
  translate(
    text: string,
    context: string,
    sourceLang?: string,
    targetLang?: string
  ): Promise<TranslationResult>;
} 