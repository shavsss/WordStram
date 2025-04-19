/**
 * Network utilities for handling retries and error recovery
 */
import { getLogger } from './logger';

const logger = getLogger('NetworkHelpers');

/**
 * Check if an error is suitable for retry
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('network')) {
    return true;
  }
  
  // Native fetch errors
  if (error.name === 'NetworkError' ||
      error.name === 'AbortError' ||
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection')) {
    return true;
  }
  
  // Node.js style errors
  if (error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENETUNREACH') {
    return true;
  }
  
  // HTTP status codes that suggest retrying
  if (error.status === 408 || // Request Timeout
      error.status === 429 || // Too Many Requests
      error.status === 500 || // Internal Server Error
      error.status === 502 || // Bad Gateway
      error.status === 503 || // Service Unavailable
      error.status === 504) { // Gateway Timeout
    return true;
  }
  
  // Firebase specific errors
  if (error.code === 'unavailable' ||
      error.code === 'resource-exhausted' ||
      error.code?.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Execute an operation with exponential backoff retry
 * @param operation The operation to execute
 * @param maxRetries Maximum number of retry attempts
 * @param baseDelay Base delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Log success after retry
      if (attempt > 0) {
        logger.info(`Operation succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // If this was the last attempt or the error is not retryable, throw
      if (attempt === maxRetries || !isRetryableError(error)) {
        if (attempt > 0) {
          logger.error(`Operation failed after ${attempt} retries`, error);
        }
        throw error;
      }
      
      // Calculate backoff with jitter (random variance)
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      logger.warn(`Operation failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`, error);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never happen, but TypeScript requires a return
  throw lastError || new Error('Unknown error during retry');
}

/**
 * Fetch with retry capabilities
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  }
): Promise<Response> {
  const options = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    ...retryOptions
  };
  
  return withRetry(
    () => fetch(input, init),
    options.maxRetries,
    options.baseDelay,
    options.maxDelay
  );
}

/**
 * Fetch JSON data with retry capabilities
 */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  }
): Promise<T> {
  const response = await fetchWithRetry(input, init, retryOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  
  return response.json() as Promise<T>;
} 