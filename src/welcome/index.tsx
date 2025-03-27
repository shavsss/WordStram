import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthForm } from '@/components/auth/AuthForm';
import '../styles/globals.css';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface Subscription {
  status: string;
  expiresAt?: string;
}

function WelcomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // פונקציה לטיפול בשינוי מצב האימות
  const handleAuthStateChange = (isSignedIn: boolean, user?: User, subscription?: Subscription) => {
    setIsAuthenticated(isSignedIn);
    if (user) {
      setUser(user);
      // שמירת המשתמש לאחסון המקומי
      chrome.storage.local.set({ user: user });
      
      // רישום האירוע בלוג
      console.log('User signed in:', user.email);
      
      // סגירת החלון באופן אוטומטי לאחר התחברות
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  };

  // בדיקה אם המשתמש כבר מחובר
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ 
          action: 'get_auth_state'
        });
        
        if (response?.isSignedIn && response?.user) {
          setIsAuthenticated(true);
          setUser(response.user);
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
      }
    };
    
    checkAuthState();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2 bg-gradient-to-tr from-blue-800 to-indigo-600 text-white p-8 md:p-12">
            <div className="flex items-center mb-8">
              <img src="icons/icon128.png" alt="WordStream Logo" className="w-16 h-16 mr-4" />
              <h1 className="text-3xl font-bold">WordStream</h1>
            </div>
            
            <h2 className="text-2xl font-semibold mb-4">ברוכים הבאים ל-WordStream Premium!</h2>
            <p className="mb-6 text-blue-100">
              WordStream היא תוספת פרימיום המסייעת לך ללמוד שפות בזמן צפייה בסרטונים האהובים עליך.
              כדי לספק לך חוויה חלקה בכל המכשירים שלך, עלינו להגדיר את החשבון שלך.
            </p>
            
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <p className="font-medium text-white">
                <span className="font-bold">חשוב:</span> WordStream דורש התחברות חד-פעמית בכל מכשיר חדש.
                לאחר ההתחברות, לא תצטרך להתחבר שוב במכשיר זה.
              </p>
            </div>
            
            <h3 className="text-xl font-medium mb-3">למה להתחבר?</h3>
            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 7L13 15L9 11L3 17M21 7H15M21 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">סנכרון בין מכשירים</h4>
                  <p className="text-sm text-blue-100">גישה למילים ולהתקדמות שלך בכל מכשיר</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">גיבויים בטוחים</h4>
                  <p className="text-sm text-blue-100">לעולם לא תאבד את רשימות המילים והפתקים שלך</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 5V7M15 11V13M15 17V19M5 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">תמיכת פרימיום</h4>
                  <p className="text-sm text-blue-100">קבל סיוע בעדיפות גבוהה כשאתה זקוק לעזרה</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2 p-8 md:p-12">
            {isAuthenticated ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full text-green-600 mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">התחברת בהצלחה!</h2>
                <p className="text-gray-600">
                  ברוך הבא, {user?.displayName || user?.email}! 
                  התחברת בהצלחה ל-WordStream.
                </p>
                <p className="text-gray-500 text-sm">חלון זה ייסגר אוטומטית בקרוב...</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">התחבר או הירשם</h2>
                <AuthForm onAuthStateChange={handleAuthStateChange} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount app
const container = document.getElementById('app');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <WelcomePage />
  </React.StrictMode>
); 