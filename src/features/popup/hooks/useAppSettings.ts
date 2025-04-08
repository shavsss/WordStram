'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '@/features/vocabulary/types';

/**
 * הוק לניהול הגדרות האפליקציה
 */
export function useAppSettings() {
  // הגדרות ברירת מחדל
  const defaultSettings: AppSettings = {
    autoTranslate: true,
    notifications: true,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    targetLanguage: 'en'
  };

  // מצב מקומי
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * טעינת הגדרות מאחסון
   */
  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        console.warn('Chrome storage API not available, using default settings');
        setSettings(defaultSettings);
        setIsLoading(false);
        return;
      }

      // טעינה מהאחסון
      chrome.storage.sync.get(['settings'], (result) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || 'Failed to load settings');
          setSettings(defaultSettings);
        } else if (result.settings) {
          // שילוב של הגדרות שנטענו עם ברירות מחדל למקרה שחסרים שדות
          setSettings({
            ...defaultSettings,
            ...result.settings
          });
        } else {
          // אין הגדרות באחסון, שימוש בברירות מחדל
          setSettings(defaultSettings);
        }
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to load settings');
      setSettings(defaultSettings);
      setIsLoading(false);
    }
  }, [defaultSettings]);

  /**
   * עדכון הגדרה ספציפית
   */
  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<boolean> => {
    try {
      // עדכון המצב המקומי
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));

      // אם אין גישה לאחסון, החזרת הצלחה אך ללא שמירה
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        console.warn('Chrome storage API not available, settings not saved');
        return true;
      }

      // שמירה באחסון
      return new Promise<boolean>((resolve) => {
        chrome.storage.sync.get(['settings'], (result) => {
          const currentSettings = result.settings || defaultSettings;
          const updatedSettings = {
            ...currentSettings,
            [key]: value
          };

          chrome.storage.sync.set({ settings: updatedSettings }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving settings:', chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      return false;
    }
  }, [defaultSettings]);

  /**
   * עדכון מספר הגדרות בפעולה אחת
   */
  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      // עדכון המצב המקומי
      setSettings(prev => ({
        ...prev,
        ...newSettings
      }));

      // אם אין גישה לאחסון, החזרת הצלחה אך ללא שמירה
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        console.warn('Chrome storage API not available, settings not saved');
        return true;
      }

      // שמירה באחסון
      return new Promise<boolean>((resolve) => {
        chrome.storage.sync.get(['settings'], (result) => {
          const currentSettings = result.settings || defaultSettings;
          const updatedSettings = {
            ...currentSettings,
            ...newSettings
          };

          chrome.storage.sync.set({ settings: updatedSettings }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving settings:', chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }, [defaultSettings]);

  /**
   * טיפול במצב חשוך
   */
  useEffect(() => {
    const html = document.documentElement;
    if (settings.darkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
  }, [settings.darkMode]);

  /**
   * טעינת הגדרות בעת טעינת הקומפוננטה
   */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    updateSettings,
    loadSettings,
  };
} 