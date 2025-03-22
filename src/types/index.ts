export interface User {
  id: string;
  settings: UserSettings;
  statistics: UserStatistics;
}

export interface UserSettings {
  nativeLanguage: string;
  learningLanguages: string[];
  uiPreferences: {
    autoSave: boolean;
    popupPosition: 'left' | 'right';
    theme: 'light' | 'dark';
  };
}

export interface UserStatistics {
  streak: number;
  totalWords: number;
  lastActive: Date;
  dailyGoals: {
    target: number;
    achieved: number;
  };
}

export type ContentSource = 'youtube' | 'netflix';

export interface TranslationContext {
  source: ContentSource;
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

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedSourceLanguage?: string;
  error?: string;
}

export interface TranslationProvider {
  translate(
    text: string,
    context: string,
    sourceLang?: string,
    targetLang?: string
  ): Promise<TranslationResult>;
}

export interface Word {
  id: string;
  original: string;
  translation: string;
  context: {
    source: ContentSource;
    contentId: string;  // videoId for YouTube, showId for Netflix
    timestamp: number;
    sentence: string;
    title: string;
    episodeInfo?: {  // Netflix specific
      season?: number;
      episode?: number;
      episodeTitle?: string;
    };
  };
  stats: {
    successRate: number;
    totalReviews: number;
    lastReview: Date;
  };
}

export interface CaptionDetector {
  source: string;
  detect(): Promise<HTMLElement | null>;
  processCaption(caption: HTMLElement): void;
  processTextNode(textNode: Text): void;
  startObserving(captionContainer: HTMLElement): void;
  stopObserving(): void;
  cleanup(): void;
  handleWordClick(event: MouseEvent): Promise<void>;
  addFloatingControls(): void;
  removeFloatingControls(): void;
}

export interface UserStats {
  totalWords: number;
  streak: number;
  lastVisit: string;
}

export interface CaptionsLanguageInfo {
  language: string;        // Language code (en, es, etc.)
  languageName: string;    // Language name (English, Spanish, etc.)
  isAuto: boolean;        // Whether these are auto-generated captions
}

export interface SavedWord {
  id: string;
  original: string;
  translated: string;
  sourceLanguage: string;    // Source language from captions
  timestamp: Date;
  context: {
    source: 'youtube' | 'netflix';
    videoTitle: string;
    captionsLanguage: CaptionsLanguageInfo;
    url: string;
  };
  stats: {
    successRate: number;
    totalReviews: number;
    lastReview: Date;
  };
  userEdits?: {
    timestamp: Date;
    previousLanguage: string;
    newLanguage: string;
  }[];
} 