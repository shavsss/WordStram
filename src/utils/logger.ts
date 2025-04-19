/**
 * Advanced logging utility for WordStream extension
 * Provides consistent logging across extension components
 * with support for log levels and storage
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  data?: any;
}

/**
 * Advanced logger class
 */
export class Logger {
  private readonly prefix: string;
  private static level: LogLevel = LogLevel.INFO;
  private static maxStoredLogs: number = 100;
  
  /**
   * Create a new logger instance
   * @param component Component name that will appear in log messages
   */
  constructor(component: string) {
    this.prefix = component;
  }
  
  /**
   * Set the global minimum log level
   */
  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }
  
  /**
   * Set the maximum number of logs to store
   */
  static setMaxStoredLogs(maxLogs: number): void {
    Logger.maxStoredLogs = maxLogs;
  }
  
  /**
   * Log a debug message (level 0)
   */
  debug(message: string, ...args: any[]): void {
    if (Logger.level <= LogLevel.DEBUG) {
      console.debug(`[${this.prefix}] ${message}`, ...args);
    }
  }
  
  /**
   * Log an info message (level 1)
   */
  info(message: string, ...args: any[]): void {
    if (Logger.level <= LogLevel.INFO) {
      console.info(`[${this.prefix}] ${message}`, ...args);
    }
  }
  
  /**
   * Log a warning message (level 2)
   */
  warn(message: string, ...args: any[]): void {
    if (Logger.level <= LogLevel.WARN) {
      console.warn(`[${this.prefix}] ${message}`, ...args);
    }
  }
  
  /**
   * Log an error message (level 3)
   */
  error(message: string, ...args: any[]): void {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(`[${this.prefix}] ${message}`, ...args);
    }
  }
  
  /**
   * Save a log entry to local storage for later debugging
   * This is useful for capturing errors that users encounter
   */
  async logToStorage(level: LogLevel, message: string, data?: any): Promise<void> {
    try {
      // Create the log entry
      const timestamp = new Date().toISOString();
      const logEntry: LogEntry = {
        timestamp,
        level: LogLevel[level],
        component: this.prefix,
        message,
        data: data || null
      };
      
      // Get existing logs or initialize empty array
      const result = await chrome.storage.local.get(['wordstream_logs']);
      const logs: LogEntry[] = result.wordstream_logs || [];
      
      // Add new log and limit array size
      logs.push(logEntry);
      if (logs.length > Logger.maxStoredLogs) {
        logs.splice(0, logs.length - Logger.maxStoredLogs);
      }
      
      // Save back to storage
      await chrome.storage.local.set({ wordstream_logs: logs });
    } catch (error) {
      // Don't try to log this to storage to avoid infinite loops
      console.error(`[${this.prefix}] Failed to save log to storage:`, error);
    }
  }
  
  /**
   * Log an entry both to console and storage
   */
  async logWithStorage(level: LogLevel, message: string, data?: any): Promise<void> {
    // Log to console based on level
    switch(level) {
      case LogLevel.DEBUG:
        this.debug(message, data);
        break;
      case LogLevel.INFO:
        this.info(message, data);
        break;
      case LogLevel.WARN:
        this.warn(message, data);
        break;
      case LogLevel.ERROR:
        this.error(message, data);
        break;
    }
    
    // Also log to storage
    await this.logToStorage(level, message, data);
  }
}

/**
 * Get a logger instance for a specific component
 */
export function getLogger(component: string): Logger {
  return new Logger(component);
}

/**
 * Read all stored logs
 */
export async function getStoredLogs(): Promise<LogEntry[]> {
  try {
    const result = await chrome.storage.local.get(['wordstream_logs']);
    return result.wordstream_logs || [];
  } catch (error) {
    console.error('Failed to read logs from storage:', error);
    return [];
  }
}

/**
 * Clear all stored logs
 */
export async function clearStoredLogs(): Promise<void> {
  try {
    await chrome.storage.local.remove(['wordstream_logs']);
  } catch (error) {
    console.error('Failed to clear logs from storage:', error);
  }
} 