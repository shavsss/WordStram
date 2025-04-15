// Define all possible language codes
export type SupportedLanguageCode = 
  | 'auto' | 'af' | 'sq' | 'am' | 'ar' | 'hy' | 'az' | 'eu' | 'be' | 'bn' | 'bs' | 'bg' | 'ca' | 'ceb' 
  | 'ny' | 'zh-CN' | 'zh-TW' | 'co' | 'hr' | 'cs' | 'da' | 'nl' | 'en' | 'eo' | 'et' | 'tl' | 'fi' 
  | 'fr' | 'fy' | 'gl' | 'ka' | 'de' | 'el' | 'gu' | 'ht' | 'ha' | 'haw' | 'he' 
  | 'hi' | 'hmn' | 'hu' | 'is' | 'ig' | 'id' | 'ga' | 'it' | 'ja' | 'jv' | 'kn' | 'kk' | 'km' | 'ko' 
  | 'ku' | 'ky' | 'lo' | 'la' | 'lv' | 'lt' | 'lb' | 'mk' | 'mg' | 'ms' | 'ml' | 'mt' | 'mi' | 'mr' 
  | 'mn' | 'my' | 'ne' | 'no' | 'ps' | 'fa' | 'pl' | 'pt' | 'pa' | 'ro' | 'ru' | 'sm' | 'gd' | 'sr' 
  | 'st' | 'sn' | 'sd' | 'si' | 'sk' | 'sl' | 'so' | 'es' | 'su' | 'sw' | 'sv' | 'tg' | 'ta' | 'te' 
  | 'th' | 'tr' | 'uk' | 'ur' | 'ug' | 'uz' | 'vi' | 'cy' | 'xh' | 'yi' | 'yo' | 'zu';

export const LANGUAGE_MAP: Record<SupportedLanguageCode, string> = {
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

export function normalizeLanguageCode(code: string): SupportedLanguageCode {
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
  return (code as SupportedLanguageCode) || 'auto';
}

export function getLanguageCode(languageName: string): SupportedLanguageCode {
  const cleanName = languageName.trim().toLowerCase();
  const entry = Object.entries(LANGUAGE_MAP).find(([_, name]) => 
    cleanName.includes(name.toLowerCase())
  );
  return normalizeLanguageCode(entry?.[0] as SupportedLanguageCode) || 'en';
} 