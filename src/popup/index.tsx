import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import AuthWrapper from './AuthWrapper';
import { FirestoreProvider } from '../contexts/FirestoreContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthManager from '@/core/auth-manager';
import { StoreProvider } from '@/providers/StoreProvider';
import { initializeConnectionRecovery } from '../utils/connection-recovery';

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
 * A connection error component displayed when background service is unavailable
 */
function ConnectionErrorComponent({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-4 bg-white text-black min-h-screen flex flex-col items-center justify-center">
      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-100 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      
      <h1 className="text-xl font-bold text-gray-800 mb-2 text-center">חיבור לשירות התוסף נכשל</h1>
      
      <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4 max-w-md w-full">
        <p className="text-red-800 text-center">לא ניתן לחבר לשירות הרקע של התוסף. התוסף לא יתפקד כראוי.</p>
      </div>
      
      <div className="mt-4 max-w-md w-full">
        <h2 className="text-lg font-medium mb-2 text-center">פעולות לפתרון:</h2>
        <ul className="list-disc pl-8 space-y-2 mb-6">
          <li>סגור וחזור לפתוח את דפדפן כרום</li>
          <li>השבת את התוסף והפעל אותו מחדש</li>
          <li>בדוק אם יש עדכונים לדפדפן או לתוסף</li>
          <li>נסה להסיר את התוסף ולהתקין אותו מחדש</li>
        </ul>
      </div>
      
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
      >
        נסה שוב
      </button>
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
  const [backgroundConnected, setBackgroundConnected] = useState<boolean | null>(null);
  
  // Set up connection recovery listeners
  useEffect(() => {
    const handleConnectionLost = (event: any) => {
      console.warn('WordStream: Connection to background service lost', event.detail);
      setBackgroundConnected(false);
      toast.error('שירות התוסף מנותק. מנסה להתחבר מחדש...', {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false
      });
    };
    
    const handleConnectionRecovered = () => {
      console.log('WordStream: Connection to background service recovered');
      setBackgroundConnected(true);
      toast.success('החיבור לשירות התוסף התחדש!', {
        position: "top-center",
        autoClose: 3000
      });
    };
    
    // Initialize connection recovery mechanism
    try {
      initializeConnectionRecovery();
      console.log('WordStream: Connection recovery mechanism initialized in popup');
      
      // Add event listeners
      window.addEventListener('wordstream:connection_lost', handleConnectionLost);
      window.addEventListener('wordstream:connection_recovered', handleConnectionRecovered);
    } catch (error) {
      console.warn('WordStream: Failed to initialize connection recovery in popup', error);
    }
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('wordstream:connection_lost', handleConnectionLost);
      window.removeEventListener('wordstream:connection_recovered', handleConnectionRecovered);
    };
  }, []);
  
  // Check background connection status
  const checkBackgroundConnection = async (): Promise<boolean> => {
    try {
      // Send a simple message to check if background is accessible
      const response = await new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Background service check timed out'));
        }, 3000);
        
        chrome.runtime.sendMessage(
          { action: 'CHECK_SERVICE_WORKER_HEALTH' },
          (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      return response && response.status === 'healthy';
    } catch (error) {
      console.error('WordStream: Background service check failed:', error);
      return false;
    }
  };
  
  // Handle retry connection
  const handleRetryConnection = async () => {
    setIsLoading(true);
    setInitStep("Attempting to reconnect...");
    
    try {
      // Try to reinitialize the services in the background
      const isConnected = await checkBackgroundConnection();
      
      if (isConnected) {
        setBackgroundConnected(true);
        init(); // Reinitialize the app
      } else {
        setBackgroundConnected(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('WordStream: Retry connection failed:', error);
      setBackgroundConnected(false);
      setIsLoading(false);
    }
  };
  
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
        // First check background service connection
        if (isMounted) setInitStep("Checking background service...");
        const isConnected = await checkBackgroundConnection();
        
        if (!isConnected) {
          console.error('WordStream: Background service is not available');
          if (isMounted) {
            setBackgroundConnected(false);
            setIsLoading(false);
            return;
          }
        } else {
          setBackgroundConnected(true);
        }
        
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
        
        // Step 3: Verify authentication state
        if (isMounted) setInitStep("Verifying authentication...");
        
        try {
          // פשוט בדוק האם יש משתמש מחובר ללא ניסיון לרענן טוקן
          const isAuthenticated = AuthManager.isAuthenticated();
          
          if (isAuthenticated) {
            console.log('WordStream: User is authenticated');
          } else {
            console.log('WordStream: No authenticated user found');
            
            // אם אין חיבור אינטרנט, הצג הודעה מותאמת
            if (!hasConnection) {
              console.warn('WordStream: Authentication may fail due to connection issues');
            }
          }
          
          // אין צורך לדאוג אם המשתמש מחובר או לא, Firebase יטפל בזה דרך onAuthStateChanged
        } catch (authError) {
          console.warn('WordStream: Auth check error (non-critical):', authError);
          // Continue despite auth error
        }
        
        // Step 4: Initialize data synchronization
        if (isMounted) setInitStep("Initializing data synchronization...");
        
        // No need to actually do anything here, Firebase handles sync automatically
        // Just give the process a moment to connect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Finish initialization
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('WordStream: Error during initialization:', error);
        if (isMounted) {
          setInitError('An error occurred while initializing. Please try again.');
          setIsLoading(false);
        }
      }
    };
    
    init();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  if (isLoading) {
    return <SimpleLoader message={initStep} />;
  }
  
  if (initError) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2 text-center">Initialization Error</h1>
        <p className="text-gray-600 mb-4 text-center">{initError}</p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Show connection error if background is disconnected
  if (backgroundConnected === false) {
    return <ConnectionErrorComponent onRetry={handleRetryConnection} />;
  }
  
  return (
    <StoreProvider>
      <AuthWrapper>
        <FirestoreProvider>
          <Popup />
          <ToastContainer position="top-right" />
        </FirestoreProvider>
      </AuthWrapper>
    </StoreProvider>
  );
}

// Render the app inside our error boundary
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
  </React.StrictMode>
); 