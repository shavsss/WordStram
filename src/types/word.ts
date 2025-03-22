export interface Word {
  id: string;                    // Unique identifier
  originalWord: string;          // Original word in source language
  targetWord: string;           // Translated word
  sourceLanguage: string;       // Source language code
  targetLanguage: string;       // Target language code for translation
  timestamp: string;            // When the word was added/updated
  context: {
    source: 'youtube' | 'netflix';
    videoTitle: string;
    url: string;
    captionsLanguage: string;   // Current captions language in the video
  };
  stats: {
    successRate: number;
    totalReviews: number;
    lastReview: string;
  };
} 