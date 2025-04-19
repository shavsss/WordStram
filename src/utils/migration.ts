/**
 * Data migration utilities for WordStream extension
 * Used for migrating data from older versions to the current format
 */
import { getLogger } from './logger';

const logger = getLogger('Migration');

// Keys used in old storage format
const OLD_STORAGE_KEYS = [
  'wordstream_user_data',
  'wordstream_settings',
  'wordstream_translations',
  'wordstream_notes',
  'wordstream_history'
];

// Keys used in new storage format
const NEW_STORAGE_KEYS = [
  'wordstream_v2_settings',
  'wordstream_logs'
];

/**
 * Check if migration is needed by looking for old data format
 */
export async function checkIfMigrationNeeded(): Promise<boolean> {
  try {
    const data = await chrome.storage.local.get(OLD_STORAGE_KEYS);
    
    // Check if any old keys exist
    for (const key of OLD_STORAGE_KEYS) {
      if (data[key] !== undefined) {
        logger.info(`Found old data format: ${key}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking for migration:', error);
    return false;
  }
}

/**
 * Migrate user data from old format to new Firebase-based storage
 */
export async function migrateUserData(userId?: string): Promise<boolean> {
  try {
    // If no user ID is provided, we can't migrate user data to Firebase
    if (!userId) {
      logger.warn('No user ID provided, skipping Firebase data migration');
      return false;
    }
    
    logger.info('Starting user data migration');
    
    // Get all old data
    const data = await chrome.storage.local.get(OLD_STORAGE_KEYS);
    
    // Migrate settings (can be done regardless of auth state)
    if (data.wordstream_settings) {
      const newSettings: any = {
        darkMode: data.wordstream_settings.darkMode || false,
        selectedLanguage: data.wordstream_settings.targetLanguage || 'en',
        isTranslationEnabled: data.wordstream_settings.translationEnabled !== false,
        showSpeedController: data.wordstream_settings.speedController !== false,
        showFloatingButtons: data.wordstream_settings.floatingButtons !== false,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'v1'
      };
      
      await chrome.storage.local.set({ wordstream_v2_settings: newSettings });
      logger.info('Settings migrated successfully');
    }
    
    // Log migration metadata
    await chrome.storage.local.set({
      wordstream_migration: {
        timestamp: new Date().toISOString(),
        oldKeys: Object.keys(data),
        userId: userId
      }
    });
    
    // Mark migration as complete but note that Firebase data migration
    // will be handled by the background service
    return true;
  } catch (error) {
    logger.error('Error during data migration:', error);
    return false;
  }
}

/**
 * Clean up old data after successful migration to avoid duplicates
 */
export async function cleanupOldData(): Promise<void> {
  try {
    logger.info('Cleaning up old data format after migration');
    await chrome.storage.local.remove(OLD_STORAGE_KEYS);
    logger.info('Old data cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up old data:', error);
  }
}

/**
 * Send message to background service to migrate Firebase data
 */
export async function triggerFirebaseMigration(port: chrome.runtime.Port): Promise<void> {
  try {
    port.postMessage({
      action: 'MIGRATE_FIREBASE_DATA',
      source: 'migration_util'
    });
    
    logger.info('Triggered Firebase data migration in background service');
  } catch (error) {
    logger.error('Error triggering Firebase migration:', error);
  }
}

/**
 * Check for migration needs and handle the migration process
 */
export async function handleMigrationIfNeeded(port: chrome.runtime.Port, userId?: string): Promise<boolean> {
  try {
    // Check if migration is needed
    const needsMigration = await checkIfMigrationNeeded();
    
    if (!needsMigration) {
      logger.info('No migration needed');
      return false;
    }
    
    // Perform local data migration
    const migrationResult = await migrateUserData(userId);
    
    if (migrationResult) {
      // Trigger Firebase data migration in background service
      if (userId) {
        await triggerFirebaseMigration(port);
      }
      
      // Clean up old data
      await cleanupOldData();
      
      logger.info('Migration completed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error during migration process:', error);
    return false;
  }
} 