/**
 * Connection Recovery Utility
 * 
 * This file contains functions to recover from extension context invalidation
 * and reconnect to the background service worker when it's restarted.
 */

/**
 * Check if the background service worker is healthy
 * @returns Promise that resolves to true if healthy, false otherwise
 */
export async function checkBackgroundHealth(): Promise<boolean> {
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('WordStream: Extension context already invalidated');
      return false;
    }
    
    // Try to send a message to the background service worker
    const response = await sendMessageWithTimeout({
      action: 'CHECK_SERVICE_WORKER_HEALTH'
    }, 3000); // 3 second timeout
    
    return response && response.status === 'healthy';
  } catch (error) {
    console.error('WordStream: Error checking background health', error);
    return false;
  }
}

/**
 * Attempt to recover from extension context invalidation
 * @returns Promise that resolves to true if recovery was successful
 */
export async function attemptRecovery(): Promise<boolean> {
  try {
    console.log('WordStream: Attempting recovery from extension context invalidation');
    
    // First check if background is accessible at all
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('WordStream: Chrome runtime not available, cannot recover');
      // Notify the UI
      window.dispatchEvent(new CustomEvent('wordstream:connection_lost', {
        detail: { recoverable: false }
      }));
      return false;
    }
    
    // Try to reinitialize the services in the background
    const response = await sendMessageWithTimeout({
      action: 'REINITIALIZE_SERVICES'
    }, 5000); // 5 second timeout
    
    if (response && response.success) {
      console.log('WordStream: Successfully reinitialized background services');
      
      // Notify the UI
      window.dispatchEvent(new CustomEvent('wordstream:connection_recovered'));
      return true;
    } else {
      // Reinitialize failed, notify the UI
      window.dispatchEvent(new CustomEvent('wordstream:connection_lost', {
        detail: { 
          recoverable: true,
          error: response?.error || 'Unknown error during recovery'
        }
      }));
      return false;
    }
  } catch (error) {
    console.error('WordStream: Recovery attempt failed', error);
    
    // Notify the UI
    window.dispatchEvent(new CustomEvent('wordstream:connection_lost', {
      detail: { 
        recoverable: true,
        error: error instanceof Error ? error.message : String(error)
      }
    }));
    return false;
  }
}

/**
 * Setup periodic health checks for the background service
 * @param intervalMs How often to check (default: 60 seconds)
 * @returns Function to stop the health checks
 */
export function setupConnectionHealthCheck(intervalMs = 60000): () => void {
  // Run an initial check
  checkBackgroundHealth().then(isHealthy => {
    if (!isHealthy) {
      attemptRecovery();
    }
  });
  
  // Set up recurring checks
  const intervalId = setInterval(async () => {
    const isHealthy = await checkBackgroundHealth();
    if (!isHealthy) {
      attemptRecovery();
    }
  }, intervalMs);
  
  // Return function to stop health checks
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Send a message to the background with a timeout
 * @param message Message to send
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves with the response, or rejects on timeout
 */
function sendMessageWithTimeout(message: any, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Message timed out'));
    }, timeoutMs);
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Initialize connection recovery in the content script or popup
 */
export function initializeConnectionRecovery() {
  // Set up listener for context lost events
  window.addEventListener('wordstream:context_lost', () => {
    console.warn('WordStream: Extension context lost, attempting recovery');
    attemptRecovery();
  });
  
  // Start health checks
  setupConnectionHealthCheck();
  
  // Also listen for errors that might indicate connection issues
  window.addEventListener('error', (event) => {
    // Only handle errors related to extension context
    if (event.message && 
        (event.message.includes('Extension context invalidated') || 
         event.message.includes('Extension context is invalidated'))) {
      console.warn('WordStream: Caught extension context error, attempting recovery');
      attemptRecovery();
    }
  });
} 