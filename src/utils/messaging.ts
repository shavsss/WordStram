/**
 * Messaging Utils
 * 
 * Utilities for safe messaging between different parts of the extension
 */

/**
 * Notify the background script that this component is ready to receive messages
 * @param componentType The type of component ('popup' or 'content_script')
 * @returns Promise that resolves when background acknowledges readiness
 */
export function notifyReady(componentType: 'popup' | 'content_script'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({
        action: 'READY_CHECK',
        component: componentType,
        timestamp: Date.now()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to notify readiness: ${chrome.runtime.lastError.message}`);
          // Retry after a delay
          setTimeout(() => {
            notifyReady(componentType).then(resolve);
          }, 500);
          return;
        }
        
        if (response && response.ready) {
          console.log(`Background acknowledged ${componentType} is ready`);
          resolve(true);
        } else {
          console.warn('Background did not acknowledge readiness');
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error in notifyReady:', error);
      resolve(false);
    }
  });
}

/**
 * Safely send a message to the background script
 * @param message The message to send
 * @returns Promise that resolves with the response
 */
export function sendToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`Error sending message to background: ${chrome.runtime.lastError.message}`);
          resolve(null);
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      console.error('Error in sendToBackground:', error);
      resolve(null);
    }
  });
}

/**
 * Initialize messaging for a component
 * Should be called early in the lifecycle of popup or content script
 * @param componentType The type of component
 */
export async function initMessaging(componentType: 'popup' | 'content_script'): Promise<void> {
  console.log(`Initializing messaging for ${componentType}`);
  
  // Add ping handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'PING') {
      sendResponse({ status: 'READY', component: componentType });
      return true;
    }
    return false; // Let other listeners handle other message types
  });
  
  // Notify background this component is ready
  await notifyReady(componentType);
  
  console.log(`${componentType} messaging initialized`);
} 