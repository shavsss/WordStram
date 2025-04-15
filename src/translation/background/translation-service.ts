/**
 * Translation Service for background processes
 * Handles translation requests from content scripts and popup
 */

// Define translation request interface
export interface TranslationRequest {
  text: string;
  timestamp?: string;
  targetLang?: string;
}

// Define translation response interface
export interface TranslationResponse {
  success: boolean;
  translation?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

/**
 * Get translation API key from storage
 */
async function getTranslationApiKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['api_keys'], (result) => {
      if (result && result.api_keys && result.api_keys.GOOGLE_API_KEY) {
        resolve(result.api_keys.GOOGLE_API_KEY);
      } else {
        reject(new Error('Translation API key not found in storage'));
      }
    });
  });
}

/**
 * Initialize translation API key
 */
export async function initializeTranslationApiKey(): Promise<void> {
  try {
    const apiKey = await getTranslationApiKey();
    console.log('WordStream: Translation API key initialized');
  } catch (error) {
    console.error('WordStream: Failed to initialize translation API key:', error);
    throw error;
  }
}

/**
 * Handle translation request
 * @param data TranslationRequest object containing text to translate
 */
export async function handleTranslation(data: TranslationRequest): Promise<TranslationResponse> {
  try {
    console.log('WordStream: Handling translation request:', data.text.substring(0, 50) + '...');
    
    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        error: 'No text provided for translation'
      };
    }
    
    // Get API key from storage
    const apiKey = await getTranslationApiKey();
    
    // Prepare request to Google Translate API
    const targetLang = data.targetLang || 'en'; // Default to English
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: data.text,
        target: targetLang,
        format: 'text'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Translation API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.data && result.data.translations && result.data.translations.length > 0) {
      return {
        success: true,
        translation: result.data.translations[0].translatedText,
        detectedSourceLanguage: result.data.translations[0].detectedSourceLanguage
      };
    } else {
      throw new Error('Invalid response format from translation API');
    }
  } catch (error) {
    console.error('WordStream: Translation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if translation service is available
 */
export async function checkTranslationAvailable(): Promise<{ success: boolean, available: boolean, error?: string }> {
  try {
    // Check if API key exists
    const apiKey = await getTranslationApiKey().catch(() => null);
    
    if (!apiKey) {
      return {
        success: true,
        available: false,
        error: 'No API key configured for translation service'
      };
    }
    
    // Test API with a simple request
    const testResult = await handleTranslation({
      text: 'hello',
      targetLang: 'fr'
    });
    
    return {
      success: true,
      available: testResult.success
    };
  } catch (error) {
    return {
      success: false,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 