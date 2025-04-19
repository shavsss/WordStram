/**
 * Recovery Test Utility
 * 
 * This utility provides functions to manually test the connection recovery mechanism.
 * Use this for development purposes only.
 */

/**
 * Simulate a background service worker disconnection
 * This will trigger the recovery mechanism
 */
export function simulateDisconnection(): void {
  console.log('WordStream: Simulating background service disconnection');
  
  // Dispatch the connection lost event
  window.dispatchEvent(new CustomEvent('wordstream:connection_lost', {
    detail: { 
      recoverable: true,
      error: 'Simulated disconnection for testing purposes'
    }
  }));
}

/**
 * Simulate a successful recovery
 */
export function simulateRecovery(): void {
  console.log('WordStream: Simulating background service recovery');
  
  // Dispatch the connection recovered event
  window.dispatchEvent(new CustomEvent('wordstream:connection_recovered'));
}

/**
 * Start a test cycle that simulates disconnection followed by recovery after a delay
 * @param disconnectDuration The time in milliseconds before recovery (default:
 * 5000)
 */
export function runRecoveryTest(disconnectDuration: number = 5000): void {
  console.log(`WordStream: Running recovery test with ${disconnectDuration}ms disconnect duration`);
  
  // Simulate disconnection
  simulateDisconnection();
  
  // Simulate recovery after the specified duration
  setTimeout(() => {
    simulateRecovery();
  }, disconnectDuration);
}

/**
 * Console command to run a recovery test
 * Usage: wordstreamTestRecovery([duration])
 * Example: wordstreamTestRecovery(3000) // 3 second disconnection
 */
if (typeof window !== 'undefined') {
  (window as any).wordstreamTestRecovery = runRecoveryTest;
  
  console.log('WordStream: Recovery test utility loaded');
  console.log('To test recovery, run: wordstreamTestRecovery() in the console');
} 