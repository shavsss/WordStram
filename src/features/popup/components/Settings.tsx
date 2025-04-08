'use client';

import React from 'react';
import { Moon, Sun, Globe } from 'lucide-react';
import { LANGUAGE_MAP } from '@/services/caption-detectors/shared/language-map';

interface SettingsProps {
  settings: {
    autoTranslate: boolean;
    notifications: boolean;
    darkMode: boolean;
    targetLanguage: string;
  };
  onChange: (key: string, value: boolean | string) => void;
  onClose: () => void;
}

export function Settings({ settings, onChange, onClose }: SettingsProps) {
  const languages = Object.entries(LANGUAGE_MAP);

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>הגדרות</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="settings-content">
        <div className="setting-item">
          <label htmlFor="autoTranslate">תרגום אוטומטי</label>
          <input
            type="checkbox"
            id="autoTranslate"
            checked={settings.autoTranslate}
            onChange={(e) => onChange('autoTranslate', e.target.checked)}
          />
        </div>
        
        <div className="setting-item">
          <label htmlFor="notifications">התראות</label>
          <input
            type="checkbox"
            id="notifications"
            checked={settings.notifications}
            onChange={(e) => onChange('notifications', e.target.checked)}
          />
        </div>
        
        <div className="setting-item">
          <label htmlFor="darkMode">מצב כהה</label>
          <div className="toggle-container">
            <Sun size={16} />
            <input
              type="checkbox"
              id="darkMode"
              className="toggle"
              checked={settings.darkMode}
              onChange={(e) => onChange('darkMode', e.target.checked)}
            />
            <label htmlFor="darkMode" className="toggle-button"></label>
            <Moon size={16} />
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="targetLanguage">
            <Globe size={16} className="inline-icon" /> שפת תרגום
          </label>
          <select
            id="targetLanguage"
            value={settings.targetLanguage}
            onChange={(e) => onChange('targetLanguage', e.target.value)}
            className="language-select"
          >
            {languages.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
} 