import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import Popup from './popup/Popup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getLogger } from './utils/logger';

const logger = getLogger('PopupEntry');

// Set up global error handler
window.addEventListener('error', (event) => {
  logger.error('Unhandled error:', event.error);
  logger.logToStorage(3, 'Unhandled window error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

// Set up unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
  logger.logToStorage(3, 'Unhandled promise rejection', {
    reason: event.reason?.toString(),
    stack: event.reason?.stack
  });
});

// Initialize the extension popup
const init = () => {
  const container = document.getElementById('root');
  if (!container) {
    logger.error('Root container not found [PopupEntry]');
    // Try to create the root container dynamically if it doesn't exist
    try {
      const newRoot = document.createElement('div');
      newRoot.id = 'root';
      document.body.prepend(newRoot);
      logger.info('Created root container dynamically');
      // Continue with the new container
      const root = createRoot(newRoot);
      renderApp(root);
    } catch (error) {
      logger.error('Failed to create root container:', error);
      return;
    }
    return;
  }
  
  const root = createRoot(container);
  renderApp(root);
  
  logger.info('Popup initialized');
};

// Separate render function to avoid code duplication
const renderApp = (root: any) => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          logger.error('Root level error boundary caught error:', error);
          logger.logToStorage(3, 'Root error boundary', {
            error: error.toString(),
            componentStack: errorInfo.componentStack
          });
        }}
      >
        <Popup />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 