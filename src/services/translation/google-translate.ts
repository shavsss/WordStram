import { env } from '@/config/env';

interface TranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

export async function translateText(
  text: string,
  targetLang = 'en'
): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${env.GOOGLE_TRANSLATE_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: 'auto'
    })
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }

  const data: TranslateResponse = await response.json();
  return data.data.translations[0].translatedText;
} 