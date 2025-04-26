import React, { useState, useEffect } from 'react';
import { Settings as SettingsType } from '../../shared/types/index';
import { MessageType } from '../../shared/message-types';

interface SettingsProps {
  settings: SettingsType;
  onSettingsChange: (newSettings: SettingsType) => Promise<boolean>;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'he', name: 'Hebrew' }
];

const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange }) => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Local settings state
  const [localSettings, setLocalSettings] = useState({
    targetLanguage: 'en',
    autoTranslate: true,
    notifications: true,
    darkMode: false,
    showTranslations: true
  });
  
  // Initialize local settings from stored settings
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        targetLanguage: settings.targetLanguage,
        autoTranslate: settings.autoTranslate,
        notifications: settings.notifications,
        darkMode: settings.darkMode,
        showTranslations: settings.showTranslations
      });
    }
  }, [settings]);
  
  // Handle toggle change
  const handleToggleChange = (key: keyof typeof localSettings) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Handle language selection change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalSettings(prev => ({
      ...prev,
      targetLanguage: e.target.value
    }));
  };
  
  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update settings in storage
      const success = await onSettingsChange(localSettings);
      
      if (success) {
        setMessage({ text: 'Settings saved successfully!', type: 'success' });
        
        // Apply dark mode if changed
        if (localSettings.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // Notify all parts of the extension about the settings change
        chrome.runtime.sendMessage({
          type: MessageType.SETTINGS_UPDATED,
          payload: localSettings
        });
      } else {
        setMessage({ text: 'Failed to save settings.', type: 'error' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'An error occurred while saving settings.', type: 'error' });
    } finally {
      setSaving(false);
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };
  
  return (
    <div className="settings-container">
      <h2 className="settings-title">Settings</h2>
      
      <div className="settings-form">
        <div className="form-group">
          <label htmlFor="targetLanguage">Target Language</label>
          <select 
            id="targetLanguage" 
            className="form-control"
            value={localSettings.targetLanguage}
            onChange={handleLanguageChange}
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <p className="form-help">Words will be translated to this language</p>
        </div>
        
        <div className="form-group">
          <div className="form-switch">
            <label className="switch-label">
              <span>Auto-translate</span>
              <div className="switch-slider">
                <input 
                  type="checkbox" 
                  checked={localSettings.autoTranslate}
                  onChange={() => handleToggleChange('autoTranslate')}
                />
                <span className="slider"></span>
              </div>
            </label>
          </div>
          <p className="form-help">Automatically translate words when clicked</p>
        </div>
        
        <div className="form-group">
          <div className="form-switch">
            <label className="switch-label">
              <span>Notifications</span>
              <div className="switch-slider">
                <input 
                  type="checkbox" 
                  checked={localSettings.notifications}
                  onChange={() => handleToggleChange('notifications')}
                />
                <span className="slider"></span>
              </div>
            </label>
          </div>
          <p className="form-help">Show notifications for important events</p>
        </div>
        
        <div className="form-group">
          <div className="form-switch">
            <label className="switch-label">
              <span>Dark Mode</span>
              <div className="switch-slider">
                <input 
                  type="checkbox" 
                  checked={localSettings.darkMode}
                  onChange={() => handleToggleChange('darkMode')}
                />
                <span className="slider"></span>
              </div>
            </label>
          </div>
          <p className="form-help">Use dark theme for the extension</p>
        </div>
        
        <div className="form-group">
          <div className="form-switch">
            <label className="switch-label">
              <span>Show Translations</span>
              <div className="switch-slider">
                <input 
                  type="checkbox" 
                  checked={localSettings.showTranslations}
                  onChange={() => handleToggleChange('showTranslations')}
                />
                <span className="slider"></span>
              </div>
            </label>
          </div>
          <p className="form-help">Display translations on the video</p>
        </div>
        
        <div className="settings-actions">
          <button 
            className="button button-primary save-settings-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        
        {message && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings; 