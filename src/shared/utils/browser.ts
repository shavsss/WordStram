/**
 * Browser utility functions for Chrome extension API access
 */

/**
 * Provides access to Chrome runtime API for messaging
 */
export const runtime = {
  /**
   * Send a message to the extension's background script
   * @param message The message to send
   * @returns Promise that resolves with the response
   */
  sendMessage: (message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.error('Chrome runtime error:', error);
            reject(new Error(error.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        console.error('Error sending message:', error);
        reject(error);
      }
    });
  },

  /**
   * Get the extension ID
   * @returns The extension ID or null if not available
   */
  getExtensionId: (): string | null => {
    return chrome?.runtime?.id || null;
  },

  /**
   * Check if the extension is running in a Chrome extension context
   * @returns True if running in a Chrome extension context
   */
  isExtensionContext: (): boolean => {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  }
}; 