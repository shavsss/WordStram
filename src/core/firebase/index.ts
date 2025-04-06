/**
 * Firebase module main index
 * 
 * This is the main entry point for the Firebase module.
 * It re-exports services, types and configuration needed by the application.
 */

// Export configuration
export * from './config';

// Export types
export * from './types';

// Export authentication services
export * from './auth';

// Export Firebase services
export * from './services';

// Export synchronization utilities
export * from './sync/data-sync-manager';
export * from './sync/broadcast';
export * from './sync/listeners';
export * from './sync/offline-queue';

// Export utility functions
export * from './utils/connection-utils'; 