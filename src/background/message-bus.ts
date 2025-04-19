/**
 * Message Bus for WordStream Extension
 * 
 * This module handles communication between different parts of the extension:
 * - Background service worker
 * - Content scripts injected into web pages
 * - Popup UI
 * 
 * It provides a reliable message routing and error recovery system.
 * 
 * @version 2.0
 * @module background/message-bus
 */

import { MessageType } from '../shared/message';

/**
 * Type definition for message handlers
 * @typedef {Function} MessageHandler
 * @param {any} message - The message object
 * @param {chrome.runtime.MessageSender} sender - Information about the sender
 * @param {Function} sendResponse - Function to send a response
 * @returns {boolean|void|Promise<any>} - Return true to keep the channel open for async response
 */
type MessageHandler = (
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
) => boolean | void | Promise<any>;

/**
 * Collection of registered message handlers
 */
const messageHandlers: Record<string, MessageHandler> = {};

/**
 * The health status of the message bus
 */
const healthStatus = {
  isInitialized: false,
  unhandledErrors: 0,
  lastErrorTime: 0,
  startTime: Date.now()
};

/**
 * Register a message handler for a specific message type
 * 
 * @param {MessageType|string} messageType - Type of message to handle
 * @param {MessageHandler} handler - Handler function to process this message type
 */
export function registerMessageHandler(messageType: MessageType | string, handler: MessageHandler): void {
  if (typeof messageType !== 'string') {
    console.error('WordStream: Invalid message type', messageType);
    return;
  }
  
  if (typeof handler !== 'function') {
    console.error('WordStream: Invalid message handler for type', messageType);
    return;
  }
  
  // Store the handler with the message type as the key
  messageHandlers[messageType] = handler;
  console.log(`WordStream: Registered handler for message type ${messageType}`);
}

/**
 * Initialize the message bus
 * Sets up listeners for incoming messages and handles routing to registered handlers
 */
export function initMessageBus(): void {
  // Prevent multiple initializations
  if (healthStatus.isInitialized) {
    console.warn('WordStream: Message bus already initialized');
    return;
  }
  
  healthStatus.isInitialized = true;
  healthStatus.startTime = Date.now();
  
  // Register global unhandled error handler
  self.addEventListener('error', handleGlobalError);
  self.addEventListener('unhandledrejection', handleUnhandledRejection);
  
  // Set up the message listener with improved error handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let asyncResponsePending = false;
    
    try {
      // Check if we have a type in the message
      if (!message || !message.type) {
        console.warn('WordStream: Received message without type', message);
        sendResponse({ error: 'Message missing type field' });
        return false;
      }
      
      const messageType = message.type;
      
      // Find handler for this message type
      const handler = messageHandlers[messageType];
      if (!handler) {
        console.warn(`WordStream: No handler registered for message type ${messageType}`);
        sendResponse({ 
          error: `No handler for message type: ${messageType}`,
          success: false
        });
        return false;
      }
      
      // Execute handler with appropriate error handling
      Promise.resolve()
        .then(() => handler(message, sender, sendResponse))
        .then(result => {
          // If the handler returns a promise
          if (result instanceof Promise) {
            asyncResponsePending = true;
            result
              .then(response => {
                if (response !== undefined) {
                  try {
                    sendResponse(response);
                  } catch (sendError) {
                    console.error(`WordStream: Error sending response for ${messageType}:`, sendError);
                  }
                }
              })
              .catch(error => {
                console.error(`WordStream: Error handling message ${messageType}:`, error);
                try {
                  sendResponse({ 
                    error: error instanceof Error ? error.message : 'Unknown error',
                    success: false 
                  });
                } catch (sendError) {
                  console.error(`WordStream: Error sending error response for ${messageType}:`, sendError);
                }
              });
            return true;
          }
          
          // Handle synchronous responses
          if (result !== undefined && result !== false) {
            try {
              sendResponse(result);
            } catch (sendError) {
              console.error(`WordStream: Error sending immediate response for ${messageType}:`, sendError);
            }
          }
          
          return false;
        })
        .catch(error => {
          console.error(`WordStream: Error executing handler for ${messageType}:`, error);
          try {
            sendResponse({ 
              error: error instanceof Error ? error.message : 'Handler execution error',
              success: false 
            });
          } catch (sendError) {
            console.error(`WordStream: Error sending error response for ${messageType}:`, sendError);
          }
        });
      
      return asyncResponsePending;
    } catch (error) {
      // Something went wrong in our message handling infrastructure
      console.error(`WordStream: Critical error in message bus:`, error);
      
      try {
        sendResponse({ 
          error: 'Critical message bus error', 
          success: false 
        });
      } catch (sendError) {
        // At this point we can't do much else
        console.error(`WordStream: Failed to send error response:`, sendError);
      }
      
      return false;
    }
  });
  
  console.log('WordStream: Message bus initialized');
}

/**
 * Handle global uncaught errors
 */
function handleGlobalError(event: ErrorEvent) {
  healthStatus.unhandledErrors++;
  healthStatus.lastErrorTime = Date.now();
  
  console.error('WordStream: Uncaught error in background service', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent) {
  healthStatus.unhandledErrors++;
  healthStatus.lastErrorTime = Date.now();
  
  // Prevent the error from being logged as unhandled
  event.preventDefault();
  
  // Log the error with more context
  console.error('WordStream: Unhandled promise rejection in background service', {
    reason: event.reason,
    message: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined
  });
}

/**
 * Send a message to content scripts in all tabs
 * @param {any} message - Message to send
 * @returns {Promise<void>} Promise that resolves when all messages are sent
 */
export async function broadcastToContentScripts(message: any): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    
    await Promise.all(
      tabs.map(tab => {
        if (tab.id) {
          return chrome.tabs.sendMessage(tab.id, message).catch(error => {
            // Ignore errors for tabs that don't have our content script
            // This is expected and not a true error condition
            if (error?.message?.includes('receiving end does not exist')) {
              return; // Not an error we care about
            }
            
            console.warn(`WordStream: Error sending message to tab ${tab.id}:`, error);
          });
        }
        return Promise.resolve();
      })
    );
  } catch (error) {
    console.error('WordStream: Error broadcasting to content scripts:', error);
  }
}

/**
 * Send a message to the popup
 * @param {any} message - Message to send
 */
export function sendToPopup(message: any): void {
  chrome.runtime.sendMessage(message).catch((error: unknown) => {
    // Ignore errors if popup is not open
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('receiving end does not exist')) {
      console.error('WordStream: Error sending message to popup:', error);
    }
  });
}

/**
 * Get the health status of the message bus
 * @returns {Object} Health status information
 */
export function getMessageBusStatus() {
  return {
    ...healthStatus,
    uptime: Date.now() - healthStatus.startTime,
    handlerCount: Object.keys(messageHandlers).length
  };
} 