import React, { createContext, useEffect, useContext, ReactNode } from 'react';
import store from '@/core/store';
import { useAuth } from '@/hooks/useAuth';
import { firestore, auth } from '@/core/firebase/config';

/**
 * קונטקסט לנתוני החנות המרכזית
 */
const StoreContext = createContext<typeof store | null>(null);

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * פרוביידר עבור מערכת ניהול המצב המרכזית
 * 
 * יוזם את החנות בעת טעינת האפליקציה ודואג לסנכרן עם שרת הענן
 */
export function StoreProvider({ children }: StoreProviderProps) {
  const { currentUser, isAuthenticated } = useAuth();
  
  // אתחול החנות בעת טעינת האפליקציה
  useEffect(() => {
    // אתחול החנות עם הפונקציות הקיימות
    store.initialize({ 
      firestore, 
      auth, 
      enableLocalStorage: true, 
      enableBroadcastChannel: true,
      debug: true
    });
    
    // טעינת הנתונים המקומיים
    store.loadStateFromLocalStorage();
    
    return () => {
      // שמירת מצב לפני סגירה
      store.saveStateToLocalStorage();
    };
  }, []);
  
  // עדכון נתוני משתמש בעת התחברות
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      // כאשר המשתמש מתחבר, מיד מבצעים סנכרון מול השרת
      store.syncAll();
    }
  }, [currentUser, isAuthenticated]);
  
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook לגישה לחנות המרכזית
 */
export function useStoreContext() {
  const context = useContext(StoreContext);
  
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  
  return context;
} 