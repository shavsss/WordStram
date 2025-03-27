/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/services/caption-detectors/shared/language-map.ts":
/*!***************************************************************!*\
  !*** ./src/services/caption-detectors/shared/language-map.ts ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LANGUAGE_MAP: () => (/* binding */ LANGUAGE_MAP),
/* harmony export */   getLanguageCode: () => (/* binding */ getLanguageCode),
/* harmony export */   normalizeLanguageCode: () => (/* binding */ normalizeLanguageCode)
/* harmony export */ });
const LANGUAGE_MAP = {
    'auto': 'Auto Detect',
    'af': 'Afrikaans',
    'sq': 'Albanian',
    'am': 'Amharic',
    'ar': 'Arabic',
    'hy': 'Armenian',
    'az': 'Azerbaijani',
    'eu': 'Basque',
    'be': 'Belarusian',
    'bn': 'Bengali',
    'bs': 'Bosnian',
    'bg': 'Bulgarian',
    'ca': 'Catalan',
    'ceb': 'Cebuano',
    'ny': 'Chichewa',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'co': 'Corsican',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'eo': 'Esperanto',
    'et': 'Estonian',
    'tl': 'Filipino',
    'fi': 'Finnish',
    'fr': 'French',
    'fy': 'Frisian',
    'gl': 'Galician',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'gu': 'Gujarati',
    'ht': 'Haitian Creole',
    'ha': 'Hausa',
    'haw': 'Hawaiian',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hmn': 'Hmong',
    'hu': 'Hungarian',
    'is': 'Icelandic',
    'ig': 'Igbo',
    'id': 'Indonesian',
    'ga': 'Irish',
    'it': 'Italian',
    'ja': 'Japanese',
    'jv': 'Javanese',
    'kn': 'Kannada',
    'kk': 'Kazakh',
    'km': 'Khmer',
    'ko': 'Korean',
    'ku': 'Kurdish',
    'ky': 'Kyrgyz',
    'lo': 'Lao',
    'la': 'Latin',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'lb': 'Luxembourgish',
    'mk': 'Macedonian',
    'mg': 'Malagasy',
    'ms': 'Malay',
    'ml': 'Malayalam',
    'mt': 'Maltese',
    'mi': 'Maori',
    'mr': 'Marathi',
    'mn': 'Mongolian',
    'my': 'Myanmar (Burmese)',
    'ne': 'Nepali',
    'no': 'Norwegian',
    'ps': 'Pashto',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'pa': 'Punjabi',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sm': 'Samoan',
    'gd': 'Scots Gaelic',
    'sr': 'Serbian',
    'st': 'Sesotho',
    'sn': 'Shona',
    'sd': 'Sindhi',
    'si': 'Sinhala',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'so': 'Somali',
    'es': 'Spanish',
    'su': 'Sundanese',
    'sw': 'Swahili',
    'sv': 'Swedish',
    'tg': 'Tajik',
    'ta': 'Tamil',
    'te': 'Telugu',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'ug': 'Uyghur',
    'uz': 'Uzbek',
    'vi': 'Vietnamese',
    'cy': 'Welsh',
    'xh': 'Xhosa',
    'yi': 'Yiddish',
    'yo': 'Yoruba',
    'zu': 'Zulu'
};
function normalizeLanguageCode(code) {
    // Normalize Hebrew language codes - all variants map to 'he'
    if (code === 'iw' || code === 'he-IL') {
        return 'he';
    }
    // Normalize Indonesian codes
    if (code === 'in') {
        return 'id';
    }
    // Normalize Javanese codes
    if (code === 'jw') {
        return 'jv';
    }
    return code || 'auto';
}
function getLanguageCode(languageName) {
    const cleanName = languageName.trim().toLowerCase();
    const entry = Object.entries(LANGUAGE_MAP).find(([_, name]) => cleanName.includes(name.toLowerCase()));
    return normalizeLanguageCode(entry === null || entry === void 0 ? void 0 : entry[0]) || 'en';
}


/***/ }),

/***/ "./src/services/gemini/gemini-service.ts":
/*!***********************************************!*\
  !*** ./src/services/gemini/gemini-service.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GEMINI_CONFIG: () => (/* binding */ GEMINI_CONFIG),
/* harmony export */   sendToGemini: () => (/* binding */ sendToGemini)
/* harmony export */ });
/// <reference types="chrome"/>
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Default configuration for Gemini API
const GEMINI_CONFIG = {
    apiKey: 'AIzaSyCLBHKWu7l78tS2xVmizicObSb0PpUqsxM', // Using the same API key as Google Translate
    model: 'gemini-pro-latest', // תמיד מצביע על הגרסה העדכנית ביותר הזמינה
    fallbackModel: 'gemini-1.5-pro', // המודל העדכני והחזק ביותר הזמין רשמית (2024)
    secondaryFallbackModel: 'gemini-1.5-flash', // המודל המהיר והעדכני ביותר לתרחישי גיבוי
    maxTokens: 8192 // הגדלת מספר הטוקנים המקסימלי לתשובות ארוכות ומפורטות יותר
};
/**
 * Send a query to Gemini API with conversation history
 */
function sendToGemini(query, history, videoTitle) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try to get API key from Chrome Storage or use the same as Google Translate
            const storageResult = yield chrome.storage.local.get(['geminiApiKey']);
            const apiKey = storageResult.geminiApiKey || GEMINI_CONFIG.apiKey;
            console.log("Using API key for Gemini:", apiKey.substring(0, 10) + "...");
            if (!apiKey) {
                return "API key not configured. Please set your Gemini API key in the extension settings.";
            }
            // Instead of making a direct fetch request, use chrome.runtime.sendMessage to send via background script
            const response = yield chrome.runtime.sendMessage({
                action: 'gemini',
                message: query,
                history: history,
                videoTitle: videoTitle
            });
            if (!response.success) {
                throw new Error(response.error || 'Failed to get response from Gemini');
            }
            return response.answer || 'No answer received';
        }
        catch (error) {
            console.error('Error calling Gemini API:', error);
            return "Sorry, I couldn't process your request at this time. Please try again later.";
        }
    });
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************************!*\
  !*** ./src/background/index.ts ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _services_caption_detectors_shared_language_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @/services/caption-detectors/shared/language-map */ "./src/services/caption-detectors/shared/language-map.ts");
/* harmony import */ var _services_gemini_gemini_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/services/gemini/gemini-service */ "./src/services/gemini/gemini-service.ts");
/// <reference types="chrome"/>
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('WordStream: Background script installed and running');
    // Initialize default settings if they don't exist
    chrome.storage.sync.get(['settings'], (result) => {
        if (!result.settings) {
            const defaultSettings = {
                targetLanguage: 'en',
                autoTranslate: true,
                notifications: true,
                darkMode: false
            };
            chrome.storage.sync.set({ settings: defaultSettings }, () => {
                console.log('WordStream: Default settings initialized');
            });
        }
    });
});
// Add persistent connection check
let isBackgroundActive = true;
chrome.runtime.onConnect.addListener((port) => {
    console.log('WordStream: New connection established', port.name);
    port.onDisconnect.addListener(() => {
        console.log('WordStream: Connection disconnected', port.name);
    });
});
// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    var _a;
    console.log('WordStream: Received message', request.action || request.type);
    if (!isBackgroundActive) {
        console.error('WordStream: Background script is not active');
        sendResponse({ success: false, error: 'Background script is not active' });
        return false;
    }
    if (request.type === 'PING') {
        sendResponse({ success: true, message: 'Background script is active' });
        return true; // Will respond asynchronously
    }
    if (request.type === 'TRANSLATE_WORD') {
        handleTranslation(request.payload).then(sendResponse);
        return true; // Will respond asynchronously
    }
    if (request.action === 'gemini') {
        console.log('WordStream: Processing Gemini request', {
            message: request.message,
            historyLength: (_a = request.history) === null || _a === void 0 ? void 0 : _a.length,
            videoId: request.videoId
        });
        handleGeminiRequest(request)
            .then((result) => {
            console.log('WordStream: Gemini response generated successfully');
            sendResponse(result);
        })
            .catch(error => {
            console.error('WordStream: Error generating Gemini response:', error);
            sendResponse({
                success: false,
                answer: null,
                error: error instanceof Error ? error.message : 'Unknown error processing Gemini request'
            });
        });
        return true; // Will respond asynchronously
    }
    if (request.type === 'UPDATE_LANGUAGE_SETTINGS') {
        handleLanguageSettingsUpdate(request.payload)
            .then((result) => {
            console.log('WordStream: Language settings update result', result);
            sendResponse(result);
        })
            .catch(error => {
            console.error('WordStream: Language settings update error', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error updating language settings'
            });
        });
        return true;
    }
});
// פונקציית עזר לטיפול בשגיאות
function safeStringifyError(error) {
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
            }
            catch (e) {
                return 'Object error - cannot stringify';
            }
        }
        return String(error);
    }
    catch (e) {
        return 'Unknown error - cannot format';
    }
}
// Use a constant API key
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyCLBHKWu7l78tS2xVmizicObSb0PpUqsxM';
function handleTranslation(data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
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
            const settingsResult = yield chrome.storage.sync.get(['settings']);
            console.log('WordStream: Retrieved settings for translation:', settingsResult);
            const settings = settingsResult.settings || { targetLanguage: 'en' };
            let targetLang = data.targetLang || settings.targetLanguage || 'en';
            // Ensure target language is in correct format and normalized
            targetLang = (0,_services_caption_detectors_shared_language_map__WEBPACK_IMPORTED_MODULE_0__.normalizeLanguageCode)(targetLang.toLowerCase().trim());
            console.log('WordStream: Using target language for translation:', targetLang);
            // Construct request URL
            const requestUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
            console.log('WordStream: Sending translation request to Google API');
            // הבקשה הבסיסית שעבדה
            try {
                const response = yield fetch(requestUrl, {
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
                    const errorText = yield response.text().catch(e => 'Could not read error response');
                    console.error(`WordStream: Translation request failed (${response.status}):`, errorText);
                    throw new Error(`Translation request failed (${response.status}): ${errorText}`);
                }
                // Parse response
                try {
                    const translationResult = yield response.json();
                    console.log('WordStream: Translation result received');
                    if (!((_b = (_a = translationResult.data) === null || _a === void 0 ? void 0 : _a.translations) === null || _b === void 0 ? void 0 : _b[0])) {
                        console.error('WordStream: Invalid translation response structure:', translationResult);
                        throw new Error('Invalid translation response structure');
                    }
                    // Return successful translation
                    return {
                        success: true,
                        translation: translationResult.data.translations[0].translatedText,
                        detectedSourceLanguage: translationResult.data.translations[0].detectedSourceLanguage
                    };
                }
                catch (parseError) {
                    console.error('WordStream: Error parsing translation response:', safeStringifyError(parseError));
                    throw new Error(`Error parsing translation response: ${safeStringifyError(parseError)}`);
                }
            }
            catch (fetchError) {
                console.error('WordStream: Fetch error during translation:', safeStringifyError(fetchError));
                throw new Error(`Fetch error: ${safeStringifyError(fetchError)}`);
            }
        }
        catch (error) {
            console.error('WordStream: Translation error:', safeStringifyError(error));
            return {
                success: false,
                error: safeStringifyError(error)
            };
        }
    });
}
function handleLanguageSettingsUpdate(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log('WordStream: Updating language settings', settings);
            if (!settings.targetLanguage) {
                throw new Error('Target language is required');
            }
            const result = yield chrome.storage.sync.get(['settings']);
            console.log('WordStream: Current settings', result.settings);
            const currentSettings = result.settings || {};
            const targetLanguage = settings.targetLanguage.toLowerCase().trim();
            if (!targetLanguage) {
                throw new Error('Invalid target language format');
            }
            const newSettings = Object.assign(Object.assign({}, currentSettings), { targetLanguage });
            yield new Promise((resolve, reject) => {
                chrome.storage.sync.set({ settings: newSettings }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                    else {
                        resolve();
                    }
                });
            });
            // Verify the update
            const verifyResult = yield chrome.storage.sync.get(['settings']);
            console.log('WordStream: Verified settings after update', verifyResult.settings);
            if (((_a = verifyResult.settings) === null || _a === void 0 ? void 0 : _a.targetLanguage) !== targetLanguage) {
                throw new Error('Failed to verify settings update');
            }
            return { success: true };
        }
        catch (error) {
            console.error('WordStream: Error updating language settings:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
}
// הגדרת קבועים לשימוש ב-API
const GEMINI_API_KEY = _services_gemini_gemini_service__WEBPACK_IMPORTED_MODULE_1__.GEMINI_CONFIG.apiKey;
// הוספת קבועים למודלים
const GEMINI_MODEL_PRIMARY = _services_gemini_gemini_service__WEBPACK_IMPORTED_MODULE_1__.GEMINI_CONFIG.model;
const GEMINI_MODEL_FALLBACK = _services_gemini_gemini_service__WEBPACK_IMPORTED_MODULE_1__.GEMINI_CONFIG.fallbackModel;
const GEMINI_MODEL_SECONDARY_FALLBACK = _services_gemini_gemini_service__WEBPACK_IMPORTED_MODULE_1__.GEMINI_CONFIG.secondaryFallbackModel;
// שימוש באינדקס API הסטנדרטי
const API_VERSIONS = ['v1'];
function handleGeminiRequest(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = GEMINI_API_KEY;
        const GEMINI_MODEL = request.model || GEMINI_MODEL_PRIMARY;
        const FALLBACK_MODEL = GEMINI_MODEL_FALLBACK;
        const SECONDARY_FALLBACK_MODEL = GEMINI_MODEL_SECONDARY_FALLBACK;
        if (!apiKey) {
            console.error('[WordStream] Gemini API key is missing');
            return { success: false, error: 'API key is missing' };
        }
        try {
            console.log(`[WordStream] Processing Gemini request with model: ${GEMINI_MODEL}`);
            // בדיקת API קיים ונגיש - נסיון לקבל את רשימת המודלים הזמינים
            console.log('[WordStream] Checking available models');
            const listModelsEndpoint = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
            const listModelsResponse = yield fetch(listModelsEndpoint);
            const modelsData = yield listModelsResponse.json();
            // רשימת מודלים זמינים עבור הדיבוג
            if (modelsData.models) {
                const availableModels = modelsData.models.map((m) => m.name);
                console.log('[WordStream] Available models:', availableModels.join(', '));
                // בדוק אם המודל העיקרי זמין
                if (!availableModels.includes(GEMINI_MODEL)) {
                    console.warn(`[WordStream] Primary model ${GEMINI_MODEL} not found in available models. Will try fallback model.`);
                }
            }
            else {
                console.warn('[WordStream] Could not retrieve models list:', modelsData);
            }
            // יצירת endpoint דינמי לפי המודל הנבחר
            // נשתמש ב-endpoint סטנדרטי של gemini במקום הגרסה הישנה
            const apiVersion = API_VERSIONS[0];
            const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
            // ייצור ההקשר משופר עם פרטי הסרטון
            let contextPrompt = `You are WordStream's AI Assistant, a versatile, Claude-like educational assistant that helps users learn while watching videos. Follow these important guidelines:

    1. RESPONSE STRUCTURE & ANSWER DEPTH:
       - ALWAYS ANSWER FIRST, THEN CHECK USER SATISFACTION - Never respond with a question first unless absolutely necessary.
       - Provide the best possible answer based on available data before asking if further clarification is needed.
       - Do not shorten responses arbitrarily—answer as completely as possible.
       - For complex topics, start with a complete answer and offer further depth if needed.
       - For straightforward factual questions, provide a concise answer first and offer an option to elaborate if the user is interested.
       - Never skip directly to asking a question without providing substantial information first.
    
    2. LANGUAGE & USER ADAPTATION:
       - AUTOMATICALLY RESPOND IN THE USER'S LANGUAGE - If they write in Hebrew, respond in Hebrew; if English, respond in English.
       - Never change languages unless explicitly requested by the user.
       - Maintain awareness of the last 5-7 user messages to prevent redundant explanations.
       - If the user follows up on a previous topic, understand and continue naturally.
       - Extend memory retention when the user continues on the same topic, but reset context smoothly when a completely new topic is introduced.
    
    3. VIDEO-RELATED QUESTIONS:
       - Recognize whether a question is about the video or general and respond accordingly.
       - When answering timestamped video-related questions, analyze transcript context if available and provide specific insights rather than generic explanations.
       - If direct video content is unavailable, infer meaning based on related context without speculating. Offer an educated guess only if clearly indicated as such.
    
    4. STRUCTURED RESPONSES & FORMATTING:
       - Use clean, easy-to-read formatting with clear paragraphs or bullet points.
       - Break down complex topics with headings for longer explanations.
       - Highlight important keywords to make scanning easier.
       - Provide full, structured responses by default unless the user requests a summary.
    
    5. HANDLING UNCERTAINTY & EDGE CASES:
       - Never give false information—if you don't have enough data, offer related insights instead.
       - Minimize "I don't know" responses by attempting to infer meaning and offer the most relevant answer possible.
       - If uncertain, ask clarifying questions instead of giving vague responses.
    
    6. CONVERSATIONAL FLOW & ENGAGEMENT:
       - Never drop topics abruptly.
       - If a user moves between subjects, acknowledge the transition while keeping responses fluid.
       - Limit follow-up prompts to once per conversation unless the user actively engages. If the user ignores a follow-up twice, stop prompting for further engagement.
    
    7. LANGUAGE LEARNING FOCUS:
       - Adapt response complexity based on user proficiency. For beginners, simplify explanations; for advanced users, offer in-depth linguistic details.
       - Provide educational insights like usage examples, synonyms, or pronunciation notes.
       - Relate explanations to real-world usage scenarios to make learning practical.
    
    8. INTEGRATION WITH EXTENSION FEATURES:
       - Only mention WordStream features when relevant to the conversation—avoid forcing feature suggestions unless they directly benefit the user’s current request.
       - Offer learning tips that complement the extension's capabilities.
    
    9. PERSONALIZED LEARNING GUIDANCE:
       - Recognize repeated topics from the same user and build upon previous explanations.
       - Provide encouragement that motivates continued learning.
    
    Remember: Always answer first, then check satisfaction. Respond in the user's language. Maintain context with short responses. Structure information clearly. Handle uncertainty gracefully. Keep conversations flowing naturally. Focus on language learning value.`;
            // הוסף פרטי הסרטון להקשר
            if (request.videoTitle) {
                contextPrompt += `\n\nThe user is watching the following video: "${request.videoTitle}"`;
            }
            if (request.videoContext) {
                if (request.videoContext.description) {
                    contextPrompt += `\nVideo description: ${request.videoContext.description}`;
                }
                if (request.videoContext.channelName) {
                    contextPrompt += `\nChannel: ${request.videoContext.channelName}`;
                }
                if (request.videoContext.url) {
                    contextPrompt += `\nURL: ${request.videoContext.url}`;
                }
            }
            // יצירת payload עם ההיסטוריה אם היא קיימת
            let messages = [];
            // הוסף הודעות מההיסטוריה
            if (request.history && request.history.length > 0) {
                messages = request.history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                }));
            }
            // הוסף את ההודעה הנוכחית של המשתמש
            messages.push({
                role: "user",
                parts: [{ text: request.message }]
            });
            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: contextPrompt }]
                    },
                    ...messages.slice(-30) // הגדלנו את מספר ההודעות מ-20 ל-30 לזיכרון משופר של שיחות ארוכות
                ],
                generationConfig: {
                    temperature: 0.75, // איזון בין יצירתיות לדיוק
                    topK: 40,
                    topP: 0.92,
                    maxOutputTokens: 8192, // הגדלת אורך התשובה המקסימלי לתשובות ארוכות ומפורטות יותר
                    stopSequences: [] // מאפשר לסיים תשובות בצורה טבעית יותר
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            };
            console.log(`[WordStream] Sending request to Gemini API: ${endpoint}`);
            // לוגים מורחבים לצורך דיבוג
            console.log('[WordStream] Gemini payload:', JSON.stringify(payload, null, 2).substring(0, 500) + '...');
            const response = yield fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = yield response.text();
                console.error(`[WordStream] Gemini API error (${response.status}):`, errorData);
                // בדוק אם זו שגיאת 404 ונסה ליפול חזרה למודל הראשון
                if (response.status === 404 && GEMINI_MODEL !== FALLBACK_MODEL) {
                    console.log(`[WordStream] Trying primary fallback model: ${FALLBACK_MODEL}`);
                    // קרא שוב לפונקציה עם מודל אחר
                    const fallbackRequest = Object.assign(Object.assign({}, request), { model: FALLBACK_MODEL });
                    return handleGeminiRequest(fallbackRequest);
                }
                // בדוק אם זו שגיאת 404 עם מודל הגיבוי הראשון ונסה ליפול חזרה למודל הגיבוי השני
                if (response.status === 404 && GEMINI_MODEL === FALLBACK_MODEL && FALLBACK_MODEL !== SECONDARY_FALLBACK_MODEL) {
                    console.log(`[WordStream] Trying secondary fallback model: ${SECONDARY_FALLBACK_MODEL}`);
                    // קרא שוב לפונקציה עם מודל הגיבוי השני
                    const secondaryFallbackRequest = Object.assign(Object.assign({}, request), { model: SECONDARY_FALLBACK_MODEL });
                    return handleGeminiRequest(secondaryFallbackRequest);
                }
                return {
                    success: false,
                    error: `Gemini API error (${response.status}): ${errorData}`
                };
            }
            const data = yield response.json();
            console.log('[WordStream] Gemini API response:', data);
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                return {
                    success: false,
                    error: 'Empty response from Gemini API'
                };
            }
            // חלץ את התשובה מהמודל
            const answer = data.candidates[0].content.parts[0].text;
            return {
                success: true,
                answer
            };
        }
        catch (error) {
            console.error('[WordStream] Error in Gemini request:', error);
            return {
                success: false,
                error: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    });
}

})();

/******/ })()
;
//# sourceMappingURL=background.js.map