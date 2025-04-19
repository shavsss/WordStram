import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getLogger } from '../utils/logger';

const logger = getLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle UI render errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    logger.error('Uncaught error in component:', error);
    logger.logToStorage(3, 'UI component error', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI if provided, or default error view
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <details className="text-sm">
            <summary className="cursor-pointer">Show details</summary>
            <p className="mt-2 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-32">
              {this.state.error?.toString()}
            </p>
          </details>
          <button
            className="mt-3 px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-100 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 