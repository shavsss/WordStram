declare const process: {
  env: {
    GOOGLE_TRANSLATE_API_KEY: string;
  };
};

export const env = {
  GOOGLE_TRANSLATE_API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY,
};

export const GOOGLE_TRANSLATE_API_KEY = "REQUIRES_SECURE_LOADING"; 