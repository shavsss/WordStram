import { MessageType } from './message-types';

interface Message {
  type: MessageType;
  payload?: any;
}

interface MessageHandler {
  (message: Message, sender: chrome.runtime.MessageSender): Promise<any> | any;
}

/**
 * Safely serialize message payload to ensure it's JSON-compatible
 * @param message The message to serialize
 * @returns A message with serializable payload
 */
function safeSerialize(message: Message): Message {
  if (!message.payload) return message;
  
  try {
    // Test if payload is already serializable
    JSON.stringify(message.payload);
    return message;
  } catch (e) {
    // If not serializable, attempt to create a serializable version
    return {
      type: message.type,
      payload: serializePayload(message.payload)
    };
  }
}

/**
 * Convert a potentially non-serializable payload to a serializable one
 * @param payload The payload to serialize
 * @returns A serializable version of the payload
 */
function serializePayload(payload: any): any {
  if (payload === undefined || payload === null) {
    return null;
  }
  
  if (typeof payload === 'function') {
    return '[Function]';
  }
  
  if (payload instanceof Error) {
    return {
      _errorMessage: payload.message,
      _errorName: payload.name,
      _errorStack: payload.stack
    };
  }
  
  if (Array.isArray(payload)) {
    return payload.map(item => serializePayload(item));
  }
  
  if (typeof payload === 'object') {
    const result: Record<string, any> = {};
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        try {
          result[key] = serializePayload(payload[key]);
        } catch (e) {
          result[key] = `[Unserializable: ${typeof payload[key]}]`;
        }
      }
    }
    return result;
  }
  
  return payload;
}

/**
 * MessageBus provides a unified way to send and receive messages
 * between different parts of the extension (background, content, popup).
 */
class MessageBus {
  private handlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private isConnected: boolean = false;
  private port: chrome.runtime.Port | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  
  constructor() {
    this.setupMessageHandling();
  }
  
  /**
   * Set up message handling and connection management
   */
  private setupMessageHandling() {
    // Set up standard message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      let responseHandled = false;
      
      this.handleIncomingMessage(message, sender)
        .then(response => {
          try {
            if (!responseHandled) {
              // Ensure response is serializable
              const serializedResponse = serializePayload(response);
              sendResponse(serializedResponse);
              responseHandled = true;
            }
          } catch (error) {
            console.error('Error sending response:', error);
            if (!responseHandled) {
              sendResponse({ success: false, error: 'Failed to send response' });
              responseHandled = true;
            }
          }
        })
        .catch(error => {
          console.error('Error handling message:', error);
          try {
            if (!responseHandled) {
              sendResponse({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
              responseHandled = true;
            }
          } catch (sendError) {
            console.error('Error sending error response:', sendError);
          }
        });
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    });
    
    // Attempt to establish a persistent connection
    this.connectToBackgroundScript();
  }
  
  /**
   * Establish a persistent connection to the background script
   */
  private connectToBackgroundScript() {
    try {
      if (chrome.runtime.id) {
        this.port = chrome.runtime.connect({ name: 'wordstream_persistent' });
        
        this.port.onDisconnect.addListener(() => {
          console.warn('MessageBus: Persistent connection lost');
          this.isConnected = false;
          this.port = null;
          
          // Try to reconnect if we haven't exceeded the maximum attempts
          if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`MessageBus: Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => this.connectToBackgroundScript(), 1000);
          } else {
            console.error('MessageBus: Maximum reconnect attempts exceeded');
          }
        });
        
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('MessageBus: Persistent connection established');
      }
    } catch (error) {
      console.error('MessageBus: Failed to establish persistent connection:', error);
    }
  }
  
  /**
   * Register a handler for a specific message type
   * @param type Message type to handle
   * @param handler Function to handle the message
   * @returns Function to unregister the handler
   */
  registerHandler(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler);
    
    // Return a function to unregister this handler
    return () => {
      const handlersForType = this.handlers.get(type);
      if (handlersForType) {
        handlersForType.delete(handler);
        
        // Clean up if no handlers left for this type
        if (handlersForType.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }
  
  /**
   * Send a message to the background script
   * @param message Message to send
   * @returns Promise resolving to the response
   */
  async sendMessage(message: Message): Promise<any> {
    try {
      // Ensure message is serializable before sending
      const serializedMessage = safeSerialize(message);
      
      // First try using the persistent connection if available
      if (this.isConnected && this.port) {
        return new Promise((resolve, reject) => {
          const messageId = Date.now().toString();
          const responseHandler = (response: any) => {
            if (response.messageId === messageId) {
              this.port?.onMessage.removeListener(responseHandler);
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response.data);
              }
            }
          };
          
          // Check if port is still connected before posting
          if (!this.port || chrome.runtime.lastError) {
            this.isConnected = false;
            // Fall back to standard messaging
            this.sendMessageStandard(serializedMessage)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          this.port.onMessage.addListener(responseHandler);
          this.port.postMessage({ ...serializedMessage, messageId });
          
          // Set timeout for port message
          setTimeout(() => {
            if (this.port) {
              this.port.onMessage.removeListener(responseHandler);
            }
            // Fall back to standard messaging
            this.sendMessageStandard(serializedMessage)
              .then(resolve)
              .catch(reject);
          }, 1000);
        });
      }
      
      // Otherwise, use standard messaging
      return this.sendMessageStandard(serializedMessage);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      
      // If the error is potentially related to a disconnected background script,
      // return a default response based on the message type
      if (error instanceof Error && error.message?.includes('Receiving end does not exist')) {
        console.warn('MessageBus: Falling back to defaults for disconnected service worker');
        
        // Provide sensible defaults for common message types
        if (message.type === MessageType.GET_SETTINGS) {
          return {
            success: true,
            settings: {
              enableTranslation: true,
              showHighlights: true,
              targetLanguage: 'en',
              highlightColor: 'rgba(100, 181, 246, 0.3)',
              autoSave: false
            }
          };
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Send a message using standard messaging
   * @param message Message to send
   * @returns Promise resolving to the response
   */
  private async sendMessageStandard(message: Message): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.error('Error in standard message sending:', error);
            reject(new Error(error.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        console.error('Exception in chrome.runtime.sendMessage:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Send a message to a specific tab
   * @param tabId Tab ID to send the message to
   * @param message Message to send
   * @returns Promise resolving to the response
   */
  async sendMessageToTab(tabId: number, message: Message): Promise<any> {
    try {
      // Ensure message is serializable
      const serializedMessage = safeSerialize(message);
      return await chrome.tabs.sendMessage(tabId, serializedMessage);
    } catch (error) {
      console.error(`Error sending message to tab ${tabId}:`, error);
      throw error;
    }
  }
  
  /**
   * Send a message to all tabs
   * @param message Message to send
   */
  async broadcastToTabs(message: Message): Promise<void> {
    try {
      // Ensure message is serializable
      const serializedMessage = safeSerialize(message);
      const tabs = await chrome.tabs.query({});
      
      const sends = tabs.map(tab => {
        if (tab.id) {
          return chrome.tabs.sendMessage(tab.id, serializedMessage)
            .catch(err => {
              // Ignore errors for tabs that don't have our content script
              if (err.message?.includes('receiving end does not exist')) {
                return;
              }
              console.warn(`Error sending to tab ${tab.id}:`, err);
            });
        }
        return Promise.resolve();
      });
      
      await Promise.all(sends);
    } catch (error) {
      console.error('Error broadcasting to tabs:', error);
    }
  }
  
  /**
   * Handle incoming messages
   * @param message Message received
   * @param sender Sender information
   * @returns Promise resolving to the response
   */
  private async handleIncomingMessage(
    message: any,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    // Check if message is valid
    if (!message || !message.type) {
      throw new Error('Invalid message format');
    }
    
    const { type } = message;
    const handlers = this.handlers.get(type as MessageType);
    
    if (!handlers || handlers.size === 0) {
      console.warn(`No handlers registered for message type: ${type}`);
      return { success: false, error: `No handler for message type: ${type}` };
    }
    
    try {
      // Execute all handlers for this message type
      const promises = Array.from(handlers).map(handler => 
        handler(message, sender)
      );
      
      // Wait for all handlers to complete and return the last response
      const results = await Promise.all(promises);
      return results[results.length - 1];
    } catch (error) {
      console.error(`Error executing handler for message type ${type}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
const messageBus = new MessageBus();
export default messageBus; 