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
  private messageHandlers: Map<string, ((message: any) => void)[]> = new Map();
  private connectionAttempts = 0;
  private options: Required<PortOptions>;
  private reconnectTimer: number | null = null;
  private connected = false;
  
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
      this.connected = true;
      
      this.port.onMessage.addListener((message: Message) => {
        this.handleMessage(message);
      });
      
      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.warn(`Port disconnected: ${error ? error.message : 'unknown reason'}`);
        
        this.port = null;
        this.connected = false;
        
        // Call the disconnect handler
        this.options.onDisconnect();
        
        // Attempt to reconnect if enabled
        if (this.options.reconnect) {
          this.scheduleReconnect();
        }
        
        // Dispatch an event for the connection recovery system
        try {
          window.dispatchEvent(new CustomEvent('wordstream:port_disconnected', {
            detail: { port: this.options.name, error: error?.message }
          }));
        } catch (eventError) {
          console.error('Error dispatching port disconnected event:', eventError);
        }
      });
      
      console.log(`Connected to port: ${this.options.name}`);
    } catch (error) {
      console.error('Failed to connect to background service:', error);
      this.connected = false;
      
      if (this.options.reconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * Schedule port reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.connectionAttempts++;
    
    // Exponential backoff with a cap
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(1.5, this.connectionAttempts - 1),
      30000 // Max 30 seconds
    );
    
    console.log(`Scheduling reconnect in ${delay}ms (attempt #${this.connectionAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`Attempting to reconnect (attempt #${this.connectionAttempts})`);
      this.connect();
    }, delay) as unknown as number;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.connected && this.port !== null;
  }
  
  /**
   * Add a message listener
   */
  public addListener(type: string, handler: (message: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
  }
  
  /**
   * Remove a message listener
   */
  public removeListener(type: string, handler: (message: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      return;
    }
    
    const handlers = this.messageHandlers.get(type)!;
    const index = handlers.indexOf(handler);
    
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }
  
  /**
   * Handle an incoming message
   */
  private handleMessage(message: Message): void {
    const type = message.type;
    
    if (!this.messageHandlers.has(type)) {
      return;
    }
    
    const handlers = this.messageHandlers.get(type)!;
    
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in handler for message type ${type}:`, error);
      }
    }
  }
  
  /**
   * Send a message to the background service worker
   */
  public postMessage(message: Message): void {
    if (!this.port?.postMessage) {
      console.warn('Cannot send message, port is not connected');
      
      // Check if the context is valid before attempting to reconnect
      try {
        if (chrome.runtime?.id) {
          this.connect();
        } else {
          console.warn('Extension context invalidated, cannot reconnect');
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('context invalidated')) {
          console.warn('Extension context invalidated, cannot reconnect');
        } else {
          console.error('Error checking extension context:', error);
        }
      }
      return;
    }
    
    try {
      this.port.postMessage(message);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Check if extension context was invalidated
      if (error.message && error.message.includes('context invalidated')) {
        console.warn('Extension context invalidated, cannot reconnect');
        this.connected = false;
        this.port = null;
        return;
      }
      
      this.port = null;
      this.connected = false;
      
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
    responseType: string,
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
      
      // Set timeout
      timeoutId = setTimeout(() => {
        timeoutId = null;
        this.removeListener(responseType, handleResponse);
        
        if (this.port) {
          this.port.onDisconnect.removeListener(disconnectHandler);
        }
        
        reject(new Error(`Response timeout for message type ${responseType}`));
      }, timeout) as unknown as number;
      
      // Send the message
      this.postMessage(message);
    });
  }
}

// Default PortConnection instance
let defaultConnection: PortConnection | null = null;

/**
 * Get a singleton PortConnection instance
 */
export function getPortConnection(options?: Partial<PortOptions>): PortConnection {
  try {
    if (!defaultConnection || !defaultConnection.isConnected()) {
      console.log('Creating new port connection with options:', options);
      defaultConnection = new PortConnection({
        name: 'popup', // השם צריך להיות קבוע ומוסכם בכל המקומות
        reconnect: true,
        reconnectDelay: 1000,
        ...(options || {})
      });
    }
    
    return defaultConnection;
  } catch (error) {
    console.error('Failed to create port connection:', error);
    // יצירת חיבור לא פעיל שלא יגרום לקריסה אבל יאפשר המשך פעולה
    return new PortConnection({
      name: 'fallback',
      reconnect: false,
      onDisconnect: () => console.warn('Fallback connection disconnected')
    });
  }
} 