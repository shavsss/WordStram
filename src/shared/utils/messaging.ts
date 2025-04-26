import { MessageResponse, MessageRequest } from '../types';

/**
 * Send a message to the extension's background script
 * @param message The message to send
 * @returns Promise that resolves with the response
 */
export const sendMessage = <T = any>(message: MessageRequest): Promise<MessageResponse<T>> => {
  return new Promise((resolve, reject) => {
    try {
      // Use Chrome's messaging API to send the message to the background script
      chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
        // Check for any error in the messaging system
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('WordStream messaging error:', error);
          reject(new Error(error.message));
          return;
        }
        
        // Check if the response indicates an error from the background script
        if (response && !response.success && response.error) {
          console.warn('WordStream background error:', response.error);
          resolve(response); // Still resolve with the error response
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      console.error('WordStream sendMessage error:', error);
      reject(error);
    }
  });
};

/**
 * Listen for messages from the background script or other content scripts
 * @param callback Function to handle incoming messages
 * @returns A function to remove the listener
 */
export const addMessageListener = <T = any>(
  callback: (
    message: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<T>) => void
  ) => void | boolean
): (() => void) => {
  // Add the listener
  chrome.runtime.onMessage.addListener(callback);
  
  // Return a function to remove the listener
  return () => {
    chrome.runtime.onMessage.removeListener(callback);
  };
};

/**
 * Create a response object for message handlers
 * @param success Whether the operation was successful
 * @param data Optional data to include in the response
 * @param error Optional error message if the operation failed
 * @returns A standardized message response
 */
export const createResponse = <T = any>(
  success: boolean,
  data?: T,
  error?: string
): MessageResponse<T> => {
  return {
    success,
    data,
    error,
  };
}; 