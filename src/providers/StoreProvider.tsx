import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';

interface StoreProviderProps {
  children: ReactNode;
}

interface StoreContextValue {
  getItem: <T>(key: string, defaultValue: T) => Promise<T>;
  setItem: <T>(key: string, value: T) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export function StoreProvider({ children }: StoreProviderProps) {
  const [isReady, setIsReady] = useState(false);

  // Check if we're in a browser environment with storage available
  const hasStorage = typeof chrome !== 'undefined' && !!chrome.storage;

  useEffect(() => {
    // Initialize the store and set ready status
    setIsReady(true);
    console.log('WordStream: Store provider initialized, storage available:', hasStorage);
    
    return () => {
      // Cleanup if needed
    };
  }, [hasStorage]);

  const getItem = async <T,>(key: string, defaultValue: T): Promise<T> => {
    if (!hasStorage) {
      console.warn(`WordStream: Storage not available, returning default for ${key}`);
      return defaultValue;
    }

    try {
      return new Promise<T>((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            console.warn(`WordStream: Error getting ${key} from storage:`, chrome.runtime.lastError);
            resolve(defaultValue);
            return;
          }
          
          if (result && result[key] !== undefined) {
            resolve(result[key] as T);
          } else {
            resolve(defaultValue);
          }
        });
      });
    } catch (error) {
      console.error(`WordStream: Error in getItem for ${key}:`, error);
      return defaultValue;
    }
  };

  const setItem = async <T,>(key: string, value: T): Promise<void> => {
    if (!hasStorage) {
      console.warn(`WordStream: Storage not available, can't set ${key}`);
      return;
    }

    try {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error(`WordStream: Error setting ${key} in storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`WordStream: Error in setItem for ${key}:`, error);
      throw error;
    }
  };

  const removeItem = async (key: string): Promise<void> => {
    if (!hasStorage) {
      console.warn(`WordStream: Storage not available, can't remove ${key}`);
      return;
    }

    try {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove(key, () => {
          if (chrome.runtime.lastError) {
            console.error(`WordStream: Error removing ${key} from storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`WordStream: Error in removeItem for ${key}:`, error);
      throw error;
    }
  };

  const clear = async (): Promise<void> => {
    if (!hasStorage) {
      console.warn('WordStream: Storage not available, can\'t clear');
      return;
    }

    try {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            console.error('WordStream: Error clearing storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('WordStream: Error in clear:', error);
      throw error;
    }
  };

  // If not ready yet, show nothing or a loading state
  if (!isReady) {
    return null;
  }

  return (
    <StoreContext.Provider value={{ getItem, setItem, removeItem, clear }}>
      {children}
    </StoreContext.Provider>
  );
} 