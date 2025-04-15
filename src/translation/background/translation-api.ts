/**
 * Translation API handler for background script
 * This file handles the actual API calls to Google Translate
 */

// Type for translation requests
export interface TranslationRequest {
  text: string;
  timestamp?: string;
  targetLang?: string;
}

// Type for translation responses
export interface TranslationResponse {
  success: boolean;
  translation?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

// Helper function for error handling
function safeStringifyError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch (e) {
        return 'Object error - cannot stringify';
      }
    }
    
    return String(error);
  } catch (e) {
    return 'Unknown error - cannot format';
  }
}

// API key storage
let GOOGLE_TRANSLATE_API_KEY: string = 'REQUIRES_SECURE_LOADING';

/**
 * Initialize the Google Translate API key
 */
export async function initializeTranslationApiKey(): Promise<void> {
  try {
    // Try to load from storage first
    const apiKeysResult = await chrome.storage.local.get(['google_translate_api_key']);
    if (apiKeysResult && apiKeysResult.google_translate_api_key) {
      GOOGLE_TRANSLATE_API_KEY = apiKeysResult.google_translate_api_key;
      console.log('WordStream: Loaded Translate API key from storage');
      return;
    }
    
    // Try to load from config file
    try {
      const apiKeysResponse = await fetch(chrome.runtime.getURL('api-keys.json'));
      if (apiKeysResponse.ok) {
        const apiKeys = await apiKeysResponse.json();
        if (apiKeys.google && apiKeys.google.translate) {
          GOOGLE_TRANSLATE_API_KEY = apiKeys.google.translate;
          // Save to storage for future use
          await chrome.storage.local.set({ google_translate_api_key: GOOGLE_TRANSLATE_API_KEY });
          console.log('WordStream: Loaded Translate API key from config file');
          return;
        }
      }
    } catch (configError) {
      console.warn('WordStream: Error loading Translate API key from config:', configError);
    }
    
    console.warn('WordStream: Could not initialize Google Translate API key');
  } catch (error) {
    console.error('WordStream: Error initializing translation API key:', error);
  }
}

/**
 * Handle translation requests
 */
export async function handleTranslation(data: TranslationRequest): Promise<TranslationResponse> {
  try {
    // Validate input
    if (!data.text || typeof data.text !== 'string') {
      console.error('WordStream: Invalid text for translation:', data.text);
      return {
        success: false,
        error: 'Invalid or missing text for translation'
      };
    }
    
    // Log text to translate
    console.log(`WordStream: Translating text: "${data.text.substring(0, 30)}${data.text.length > 30 ? '...' : ''}"`);
    
    // Get settings and ensure we have a valid target language
    const settingsResult = await chrome.storage.sync.get(['settings']);
    console.log('WordStream: Retrieved settings for translation:', settingsResult);

    const settings = settingsResult.settings || { targetLanguage: 'en' };
    let targetLang = data.targetLang || settings.targetLanguage || 'en';
    
    // Ensure target language is in correct format
    targetLang = targetLang.toLowerCase().trim();
    
    console.log('WordStream: Using target language for translation:', targetLang);

    // Ensure we have an API key
    if (!GOOGLE_TRANSLATE_API_KEY || GOOGLE_TRANSLATE_API_KEY === 'REQUIRES_SECURE_LOADING') {
      // Try to load the key from storage
      try {
        const apiKeysResult = await chrome.storage.local.get(['google_translate_api_key']);
        if (apiKeysResult && apiKeysResult.google_translate_api_key) {
          GOOGLE_TRANSLATE_API_KEY = apiKeysResult.google_translate_api_key;
          console.log('WordStream: Loaded translation API key from storage');
        } else {
          console.error('WordStream: Translation API key not available in storage');
          return {
            success: false,
            error: 'Translation API key not available'
          };
        }
      } catch (keyError) {
        console.error('WordStream: Failed to retrieve translation API key:', keyError);
        return {
          success: false,
          error: 'Failed to retrieve translation API key'
        };
      }
    }
    
    // Construct request URL with API key
    const requestUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    console.log('WordStream: Sending translation request to Google API');
    
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: data.text,
          target: targetLang
        }),
      });

      // Log response status
      console.log(`WordStream: Translation API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(e => 'Could not read error response');
        console.error(`WordStream: Translation request failed (${response.status}):`, errorText);
        throw new Error(`Translation request failed (${response.status}): ${errorText}`);
      }

      // Parse response
      try {
        const translationResult = await response.json();
        console.log('WordStream: Translation result received');
        
        if (!translationResult.data?.translations?.[0]) {
          console.error('WordStream: Invalid translation response structure:', translationResult);
          throw new Error('Invalid translation response structure');
        }
        
        // Return successful translation
        return {
          success: true,
          translation: translationResult.data.translations[0].translatedText,
          detectedSourceLanguage: translationResult.data.translations[0].detectedSourceLanguage
        };
      } catch (parseError) {
        console.error('WordStream: Error parsing translation response:', safeStringifyError(parseError));
        throw new Error(`Error parsing translation response: ${safeStringifyError(parseError)}`);
      }
    } catch (fetchError) {
      console.error('WordStream: Fetch error during translation:', safeStringifyError(fetchError));
      throw new Error(`Fetch error: ${safeStringifyError(fetchError)}`);
    }
  } catch (error) {
    console.error('WordStream: Translation error:', safeStringifyError(error));
    return {
      success: false,
      error: safeStringifyError(error)
    };
  }
} 