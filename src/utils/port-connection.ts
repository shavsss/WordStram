import { Message, MessageType } from '../shared/message';

// Default timeout for port operations (ms)
const DEFAULT_TIMEOUT = 5000;

/**
 * Options for creating a port connection
 */
interface PortOptions {
  name: string;
  timeout?: number;
  reconnect?: boolean;
  reconnectDelay?: number;
  onDisconnect?: () => void;
}

/**
 * Creates and manages a connection to the background service worker
 */
export class PortConnection {
  private port: chrome.runtime.Port | null = null;
  private messageHandlers: Map<MessageType, ((message: any) => void)[]> = new Map();
  private connectionAttempts = 0;
  private options: Required<PortOptions>;
  private reconnectTimer: number | null = null;
  
  /**
   * Create a new port connection
   */
  constructor(options: PortOptions) {
    this.options = {
      name: options.name,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      reconnect: options.reconnect !== undefined ? options.reconnect : true,
      reconnectDelay: options.reconnectDelay || 1000,
      onDisconnect: options.onDisconnect || (() => {})
    };
    
    this.connect();
  }
  
  /**
   * Connect to the background service worker
   */
  private connect(): void {
    try {
      this.port = chrome.runtime.connect({ name: this.options.name });
      this.connectionAttempts = 0;
      
      this.port.onMessage.addListener((message: Message) => {
        this.handleMessage(message);
      });
      
      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.warn(`Port disconnected: ${error ? error.message : 'unknown reason'}`);
        
        this.port = null;
        
        // Call the disconnect handler
        this.options.onDisconnect();
        
        // Attempt to reconnect if enabled
        if (this.options.reconnect) {
          this.scheduleReconnect();
        }
      });
      
      console.log(`Connected to port: ${this.options.name}`);
    } catch (error) {
      console.error('Failed to connect to background service:', error);
      
      if (this.options.reconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.connectionAttempts++;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(1.5, this.connectionAttempts - 1),
      30000
    );
    
    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.connectionAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
  
  /**
   * Validate a message against its expected type
   */
  private validateMessage(message: any, expectedType: MessageType): boolean {
    if (!message || typeof message !== 'object') {
      console.warn('Invalid message: not an object', message);
      return false;
    }
    
    if (message.type !== expectedType) {
      console.warn(`Message type mismatch: expected ${expectedType}, got ${message.type}`, message);
      return false;
    }
    
    // Additional validation based on message type
    switch (expectedType) {
      case MessageType.TRANSLATE_TEXT:
        if (!message.text || !message.targetLang) {
          console.warn('Invalid TRANSLATE_TEXT message: missing required fields', message);
          return false;
        }
        break;
        
      case MessageType.GET_GEMINI_RESPONSE:
        if (!message.query) {
          console.warn('Invalid GET_GEMINI_RESPONSE message: missing query', message);
          return false;
        }
        break;
      
      case MessageType.SIGN_IN_WITH_GOOGLE:
      case MessageType.SIGN_OUT:
      case MessageType.GET_AUTH_STATE:
        // These messages don't require additional fields
        break;
      
      case MessageType.SAVE_NOTE:
        if (!message.content) {
          console.warn('Invalid SAVE_NOTE message: missing content', message);
          return false;
        }
        break;
    }
    
    return true;
  }
  
  /**
   * Handle an incoming message
   */
  private handleMessage(message: Message): void {
    if (!message || !message.type) {
      console.warn('Received invalid message:', message);
      return;
    }
    
    // Validate message against its type
    if (!this.validateMessage(message, message.type)) {
      console.error('Message validation failed:', message);
      return;
    }
    
    const handlers = this.messageHandlers.get(message.type as MessageType);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
        }
      });
    }
  }
  
  /**
   * Send a message to the background service worker
   */
  public postMessage(message: Message): void {
    if (!this.port) {
      console.warn('Cannot send message, port is not connected');
      this.connect();
      return;
    }
    
    try {
      this.port.postMessage(message);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      this.port = null;
      
      if (this.options.reconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * Send a message and wait for a response
   */
  public async sendMessage<T extends Message>(
    message: Message,
    responseType: MessageType,
    timeoutMs?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = timeoutMs || this.options.timeout;
      let timeoutId: number | null = null;
      let disconnectHandler: () => void;
      
      // Create one-time handler for the response
      const handleResponse = (response: T) => {
        // Clear the timeout
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        // Remove the message handler
        this.removeListener(responseType, handleResponse);
        
        // Remove disconnect handler
        if (this.port) {
          this.port.onDisconnect.removeListener(disconnectHandler);
        }
        
        // Handle errors in the response
        if ('error' in response && response.error) {
          reject(new Error(response.error as string));
        } else {
          resolve(response);
        }
      };
      
      // Handler for disconnection during pending request
      disconnectHandler = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        this.removeListener(responseType, handleResponse);
        reject(new Error('Connection to background service lost while waiting for response'));
      };
      
      // If port is already disconnected, fail fast
      if (!this.port) {
        return reject(new Error('Cannot send message, port is not connected'));
      }
      
      // Add disconnect handler
      this.port.onDisconnect.addListener(disconnectHandler);
      
      // Add the response handler
      this.addListener(responseType, handleResponse);
      
      // Set a timeout
      timeoutId = window.setTimeout(() => {
        this.removeListener(responseType, handleResponse);
        if (this.port) {
          this.port.onDisconnect.removeListener(disconnectHandler);
        }
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);
      
      // Send the message
      try {
        this.postMessage(message);
      } catch (error: any) {
        // Clean up on send failure
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        this.removeListener(responseType, handleResponse);
        if (this.port) {
          this.port.onDisconnect.removeListener(disconnectHandler);
        }
        
        reject(new Error(`Failed to send message: ${error.message}`));
      }
    });
  }
  
  /**
   * Add a message listener
   */
  public addListener<T extends Message>(
    type: MessageType,
    handler: (message: T) => void
  ): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler as any);
  }
  
  /**
   * Remove a message listener
   */
  public removeListener<T extends Message>(
    type: MessageType,
    handler: (message: T) => void
  ): void {
    if (!this.messageHandlers.has(type)) {
      return;
    }
    
    const handlers = this.messageHandlers.get(type)!;
    const index = handlers.indexOf(handler as any);
    
    if (index !== -1) {
      handlers.splice(index, 1);
    }
    
    if (handlers.length === 0) {
      this.messageHandlers.delete(type);
    }
  }
  
  /**
   * Disconnect the port
   */
  public disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (error) {
        console.error('Error disconnecting port:', error);
      }
      
      this.port = null;
    }
  }
}

// Create a singleton instance for common use
let defaultConnection: PortConnection | null = null;

/**
 * Get the default port connection
 */
export function getPortConnection(options?: Partial<PortOptions>): PortConnection {
  if (!defaultConnection) {
    defaultConnection = new PortConnection({
      name: 'default',
      ...(options || {})
    });
  }
  
  return defaultConnection;
} 