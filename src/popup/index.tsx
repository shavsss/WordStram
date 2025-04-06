import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import AuthWrapper from './AuthWrapper';
import { FirestoreProvider } from '../contexts/FirestoreContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthManager from '@/core/auth-manager';
import { StoreProvider } from '@/providers/StoreProvider';

// Get the container element
const container = document.getElementById('app');

if (!container) {
  throw new Error('No container element found. Make sure there is a div with id "app" in the HTML.');
}

/**
 * An advanced error boundary component to catch and display errors during rendering
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('WordStream Error Boundary caught an error:', error, errorInfo);
    
    // Set the detailed error information
    this.setState({ errorInfo });
    
    // Log to chrome.storage.local for debugging
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'wordstream_last_error': {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (storageError) {
      console.error('Failed to log error to chrome.storage:', storageError);
    }
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise, render a default error message
      return (
        <div className="p-4 bg-white text-black min-h-screen flex flex-col">
          <h1 className="text-xl font-bold text-red-600 mb-2">שגיאה בטעינת התוסף</h1>
          
          <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
            <p className="text-red-800 font-medium">{this.state.error?.message}</p>
          </div>
          
          <div className="mt-4">
            <h2 className="text-lg font-medium mb-2">פעולות לפתרון:</h2>
            <ul className="list-disc pl-4 space-y-2">
              <li>רענן את חלון התוסף</li>
              <li>נסה להתנתק ולהתחבר מחדש</li>
              <li>נקה את זיכרון המטמון של הדפדפן</li>
              <li>הסר את התוסף והתקן אותו מחדש</li>
            </ul>
          </div>
          
          {this.state.errorInfo && (
            <details className="mt-6 border border-gray-200 rounded p-2">
              <summary className="cursor-pointer text-sm text-gray-600">פרטי שגיאה טכניים</summary>
              <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                {this.state.error?.stack}
                
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * A simple loading component to display while the app initializes
 */
function SimpleLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-center text-gray-600 dark:text-gray-300">{message}</p>
    </div>
  );
}

/**
 * A wrapper component that provides initialization and error handling
 */
function AppWrapper() {
  const [isLoading, setIsLoading] = useState(true);
  const [initStep, setInitStep] = useState<string>("Starting WordStream...");
  const [initError, setInitError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    // בדיקת חיבור לאינטרנט
    const checkInternetConnection = async (): Promise<boolean> => {
      try {
        if (isMounted) setInitStep("Checking connection...");
        
        // נסה לגשת לשרת Firebase כדי לבדוק חיבור
        const response = await fetch('https://firestore.googleapis.com', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
        });
        
        // כל תשובה מהשרת מעידה על חיבור תקין
        console.log('WordStream: Internet connection check successful');
        return true;
      } catch (error) {
        console.warn('WordStream: Internet connection check failed:', error);
        
        // נסה לגשת לשרת גוגל אחר
        try {
          await fetch('https://googleapis.com', {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
          });
          
          // אם הצלחנו כאן, יש חיבור לאינטרנט
          console.log('WordStream: Secondary internet connection check successful');
          return true;
        } catch (secondaryError) {
          console.error('WordStream: Secondary internet check failed:', secondaryError);
          return false;
        }
      }
    };
    
    // Initialize the app with more detailed steps and longer timeouts
    const init = async () => {
      try {
        // Step 1: Clear any expired caches
        if (isMounted) setInitStep("Clearing expired caches...");
        
        try {
          if (chrome.storage && chrome.storage.local) {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            
            // Clear expired cache timestamps
            await new Promise<void>((resolve) => {
              chrome.storage.local.get(null, (items) => {
                if (chrome.runtime.lastError) {
                  console.warn('Error accessing storage:', chrome.runtime.lastError);
                  resolve();
                  return;
                }
                
                const keysToRemove: string[] = [];
                
                // Find timestamp entries older than 1 hour
                Object.keys(items).forEach(key => {
                  if (key.endsWith('_cache_timestamp') && items[key] < oneHourAgo) {
                    // Add both timestamp and the related cache
                    keysToRemove.push(key);
                    keysToRemove.push(key.replace('_timestamp', ''));
                  }
                });
                
                if (keysToRemove.length > 0) {
                  chrome.storage.local.remove(keysToRemove, () => {
                    if (chrome.runtime.lastError) {
                      console.warn('Error removing expired caches:', chrome.runtime.lastError);
                    } else {
                      console.log('Cleared expired caches:', keysToRemove);
                    }
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            });
          }
        } catch (cacheError) {
          console.warn('Non-critical error clearing caches:', cacheError);
          // Continue despite cache error
        }
        
        // Step 2: Check internet connection
        if (isMounted) setInitStep("Checking connection...");
        const hasConnection = await checkInternetConnection();
        
        if (!hasConnection) {
          console.error('No internet connection detected');
          if (isMounted) {
            setInitError('Please check your internet connection and try again.');
            return;
          }
        }
        
        // Step 3: Verify authentication state with a longer timeout
        if (isMounted) setInitStep("Verifying authentication...");
        
        try {
          // Try to verify and refresh the user token with a timeout
          const authPromise = AuthManager.verifyTokenAndRefresh();
          const authTimeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.warn('WordStream: Auth verification timed out');
              resolve(false);
            }, 15000); // 15 second timeout
          });
          
          // Race the auth promise against the timeout
          const authResult = await Promise.race([authPromise, authTimeoutPromise]);
          
          if (authResult) {
            console.log('WordStream: Authentication verified successfully');
          } else {
            console.warn('WordStream: Authentication verification failed or timed out');
            
            // אם אין חיבור אינטרנט, הצג הודעה מותאמת
            if (!hasConnection) {
              console.warn('WordStream: Authentication failed likely due to connection issues');
            }
          }
        } catch (authError) {
          console.warn('WordStream: Auth initialization error (non-critical):', authError);
          // Continue despite auth error
        }
        
        // Step 4: Initialize data synchronization
        if (isMounted) setInitStep("Initializing data synchronization...");
        
        // Add a small delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Step 5: Final initialization delay to ensure interface is ready
        if (isMounted) setInitStep("Preparing interface...");
        
        // Step 6: Complete initialization
        if (isMounted) {
          setInitError(null);
          setInitStep("");
        }
      } catch (error) {
        console.error('Initialization error:', error);
        
        // Store the error for debugging if we can
        try {
          chrome.storage.local.set({
            'wordstream_init_error': error ? (error instanceof Error ? error.message : String(error)) : 'Unknown initialization error',
            'wordstream_error_timestamp': Date.now()
          });
        } catch (storageError) {
          console.error('Could not save error information:', storageError);
        }
        
        if (isMounted) {
          setInitError('Failed to initialize. Please reload the extension.');
        }
      }
    };
    
    // Start initialization
    init();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);
  
  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-red-50 dark:bg-red-900/20">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Initialization Error</h2>
        <p className="text-center text-red-600 dark:text-red-400 mb-4">{initError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reload Extension
        </button>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <FirestoreProvider>
        <StoreProvider>
          <AuthWrapper>
            <Popup />
          </AuthWrapper>
          <ToastContainer 
            position="bottom-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={true}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </StoreProvider>
      </FirestoreProvider>
    </ErrorBoundary>
  );
}

// Add base styles to body to prevent FOUC (Flash of Unstyled Content)
document.body.classList.add('bg-white', 'font-sans');

// Create a global error handler
window.addEventListener('error', (event) => {
  console.error('WordStream: Global error caught:', event.error);
  
  // Log to chrome storage for debugging
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'wordstream_global_error': {
          message: event.error?.message || 'Unknown error',
          stack: event.error?.stack,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (storageError) {
    console.error('Failed to log global error to storage:', storageError);
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('WordStream: Unhandled promise rejection:', event.reason);
  
  // Log to chrome storage for debugging
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'wordstream_unhandled_rejection': {
          message: event.reason?.message || 'Unknown rejection',
          stack: event.reason?.stack,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (storageError) {
    console.error('Failed to log promise rejection to storage:', storageError);
  }
});

// Render the app
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
); 