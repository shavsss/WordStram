import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { countries } from '@/data/countries';
import { debugFirestoreStructure, debugChats } from '@/core/firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as FirestoreService from '@/core/firebase/firestore';
import { getCurrentUser } from '@/core/firebase/auth';
import { useFirestore } from '@/contexts/FirestoreContext';
import { syncNotesBetweenStorageAndFirestore, syncChatsBetweenStorageAndFirestore } from '@/services/firebase-sync';

interface AuthPanelProps {
  onClose: () => void;
  isVisible: boolean;
  isPopup?: boolean;
}

/**
 * Authentication panel for sign in/sign up
 */
export function AuthPanel({ onClose, isVisible, isPopup = false }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Additional user info for registration
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  
  // Get FirestoreContext
  const firestoreContext = useFirestore();
  
  const { 
    isAuthenticated,
    currentUser,
    signInWithEmail,
    signInWithGoogle,
    register,
    signOut,
    resetPassword,
    error
  } = useAuth();
  
  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Validate password complexity and matching when in signup mode
  useEffect(() => {
    if (isSignUp) {
      // Check password complexity only in sign up mode
      if (password) {
        const hasMinLength = password.length >= 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        
        if (!hasMinLength) {
          setPasswordError('Password must be at least 8 characters long');
        } else if (!hasUpperCase) {
          setPasswordError('Password must contain at least one uppercase letter');
        } else if (!hasNumber) {
          setPasswordError('Password must contain at least one number');
        } else if (!hasSpecialChar) {
          setPasswordError('Password must contain at least one special character');
        } else if (confirmPassword && password !== confirmPassword) {
          setPasswordError('Passwords do not match');
        } else {
          setPasswordError(null);
        }
      }
      
      // Also check if passwords match when confirmPassword is set
      if (confirmPassword && password !== confirmPassword) {
        setPasswordError('Passwords do not match');
      }
    } else {
      // In login mode, no password validation
      setPasswordError(null);
    }
  }, [password, confirmPassword, isSignUp]);
  
  // Log auth state changes
  useEffect(() => {
    if (isVisible) {
      console.log('WordStream AuthPanel: Auth state', { 
        isAuthenticated, currentUser, error
      });
    }
  }, [isVisible, isAuthenticated, currentUser, error]);
  
  if (!isVisible) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resetPasswordMode) {
      if (email) {
        const success = await resetPassword(email);
        if (success) {
          setSuccessMessage('Password reset link sent to your email');
          setResetPasswordMode(false);
        }
      }
      return;
    }
    
    if (isSignUp) {
      // Additional password validation before submission
      const hasMinLength = password.length >= 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      
      if (!hasMinLength) {
        setPasswordError('Password must be at least 8 characters long');
        return;
      } else if (!hasUpperCase) {
        setPasswordError('Password must contain at least one uppercase letter');
        return;
      } else if (!hasNumber) {
        setPasswordError('Password must contain at least one number');
        return;
      } else if (!hasSpecialChar) {
        setPasswordError('Password must contain at least one special character');
        return;
      } else if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
      
      // Collect additional user data
      const userData = {
        gender,
        age: age ? parseInt(age, 10) : undefined,
        location: country
      };
      
      await register(email, password, userData);
    } else {
      await signInWithEmail(email, password);
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
  };
  
  // Reset additional fields when switching between sign in and sign up
  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setPasswordError(null);
    setConfirmPassword('');
    
    if (!isSignUp) {
      // Reset fields when switching to sign up
      setGender('');
      setAge('');
      setCountry('');
    }
  };
  
  // Switch to reset password mode
  const switchToResetMode = () => {
    setResetPasswordMode(true);
    // Keep the email filled if available
    // Don't reset password field since it's not used in reset mode
  };
  
  // Handler for the debug button
  const handleDebugStructure = async () => {
    if (!isAuthenticated || !currentUser) {
      toast.error('You must be logged in to debug the structure');
      return;
    }
    
    try {
      toast.info('Checking Firestore structure, check console for details...');
      const results = await debugFirestoreStructure(currentUser.uid);
      toast.success(`Debug complete! Found: ${results.videos} videos, ${results.notes} notes, and ${results.chats} chats`);
    } catch (error) {
      console.error('Error in debug:', error);
      toast.error('Error checking structure');
    }
  };
  
  // Handler for the debug chats button
  const handleDebugChats = async () => {
    if (!isAuthenticated || !currentUser) {
      toast.error('You must be logged in to debug chats');
      return;
    }
    
    try {
      toast.info('Checking chats in Firestore, check console for details...');
      const results = await debugChats(currentUser.uid);
      toast.success(`Chats debug complete! Found: ${results.total} chats across ${Object.keys(results.byVideoId).length} videos`);
    } catch (error) {
      console.error('Error in chats debug:', error);
      toast.error('Error checking chats');
    }
  };
  
  // Add function for data sync
  const handleSyncData = async () => {
    try {
      setIsLoading(true);
      toast.info('מתחיל סנכרון נתונים דו-כיווני');
      
      // Attempt full synchronization using FirestoreContext
      console.log('WordStream: Starting full data sync');
      
      // בדיקה שהקונטקסט קיים
      if (firestoreContext) {
        const syncSuccess = await firestoreContext.forceSyncAll();
        if (syncSuccess) {
          toast.success('סנכרון הושלם בהצלחה');
        } else {
          toast.warning('סנכרון הושלם חלקית - יתכן שחלק מהנתונים לא סונכרנו');
        }
      } else {
        // גיבוי במקרה שאין קונטקסט - שימוש ישיר בשירות ה-Firestore
        await syncChatsBetweenStorageAndFirestore();
        await syncNotesBetweenStorageAndFirestore();
        
        // Check and debug data structure
        const currentUser = getCurrentUser();
        if (currentUser) {
          const results = await FirestoreService.debugFirestoreStructure(currentUser.uid);
          toast.success(`סנכרון הושלם! נמצאו ${results.videos} סרטונים, ${results.notes} הערות, ${results.chats} צ'אטים`);
        } else {
          toast.error('לא ניתן לבצע סנכרון: משתמש לא מחובר');
        }
      }
    } catch (error) {
      console.error('WordStream: Sync error:', error);
      toast.error('שגיאה בסנכרון נתונים');
    } finally {
      setIsLoading(false);
    }
  };
  
  // When user is authenticated, show profile info and actions
  if (isAuthenticated) {
    return (
      <div
        className={`auth-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">פרופיל משתמש</h2>
          {!isPopup && (
            <button
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={onClose}
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 text-center mb-2">
            מחובר כ-{currentUser?.email}
          </p>
          <div className="flex flex-col space-y-3">
            <button
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  בתהליך...
                </span>
              ) : (
                'התנתקות'
              )}
            </button>
            
            {/* New Sync Data Button */}
            <button
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              onClick={handleSyncData}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  מסנכרן...
                </span>
              ) : (
                'סנכרון נתונים'
              )}
            </button>
            
            <button
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              onClick={handleDebugStructure}
              disabled={isLoading}
            >
              בדיקת מבנה נתונים
            </button>
            
            <button
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              onClick={handleDebugChats}
              disabled={isLoading}
            >
              בדיקת צ'אטים
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Authentication form
  return (
    <div className={`auth-panel ${!isPopup ? 'fixed right-4 top-20' : ''} bg-white p-4 rounded-lg shadow-lg ${isPopup ? 'w-full' : 'w-80'} z-50`} style={{backgroundColor: 'white', color: '#1f2937'}}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-800" style={{color: '#1f2937'}}>
          {resetPasswordMode 
            ? 'Reset Password' 
            : (isSignUp ? 'Create Account' : 'Sign In')}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      
      {/* Authentication required message */}
      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm">
        <div className="flex items-center mb-1">
          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <strong>Authentication Required</strong>
        </div>
        <p className="ml-7">Please sign in or create an account to use all WordStream features.</p>
      </div>
      
      {/* Success message */}
      {successMessage && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          <div className="flex items-center mb-1">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <strong>Success</strong>
          </div>
          <p className="ml-7">{successMessage}</p>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          <div className="flex items-center mb-1">
            <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <strong>We encountered an issue</strong>
          </div>
          <p className="ml-7">{error}</p>
          
          {/* Show password reset button if account is locked */}
          {error.includes('account is locked') || error.includes('temporarily locked') ? (
            <div className="mt-3 flex flex-col gap-2">
              <button 
                onClick={() => switchToResetMode()}
                className="w-full text-sm bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded-md transition-colors"
              >
                Reset Password
              </button>
              <button 
                onClick={() => {
                  setEmail('');
                  setPassword('');
                  signOut();
                }}
                className="w-full text-sm bg-white border border-red-300 text-red-700 py-1.5 px-3 rounded-md hover:bg-red-50 transition-colors"
              >
                Clear and Try Different Account
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setEmail('');
                setPassword('');
                signOut();
              }}
              className="w-full mt-2 text-sm bg-white border border-red-300 text-red-700 py-1.5 px-3 rounded-md hover:bg-red-50 transition-colors"
            >
              Clear and Try Again
            </button>
          )}
        </div>
      )}
      
      {/* Additional reset password explanation message when in reset mode */}
      {resetPasswordMode && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <strong className="block mb-1">Password Reset Instructions</strong>
              <p>Enter your email address below and we'll send you a link to reset your password. This will also unlock your account if it was locked due to too many failed attempts.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={isSignUp ? "grid grid-cols-2 gap-2" : ""}>
          <div className={`mb-2 ${isSignUp ? "col-span-2" : ""}`}>
            <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          
          {!resetPasswordMode && (
            <div className={`mb-2 ${isSignUp ? "col-span-2" : ""}`}>
              <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  minLength={isSignUp ? 8 : 6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7A9.97 9.97 0 014.02 8.971m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              {isSignUp && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Password must have at least 8 characters, including uppercase, number, and special character.
                </div>
              )}
            </div>
          )}
          
          {/* Confirm password field - only show during sign up */}
          {isSignUp && !resetPasswordMode && (
            <div className="mb-2 col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    passwordError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7A9.97 9.97 0 014.02 8.971m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-500 text-xs mt-1 flex items-start">
                  <svg className="w-3.5 h-3.5 mr-1 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{passwordError}</span>
                </p>
              )}
            </div>
          )}
          
          {/* Additional fields for registration */}
          {isSignUp && (
            <>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
                  Gender
                </label>
                <select
                  value={gender}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  onInvalid={(e: React.InvalidEvent<HTMLSelectElement>) => {
                    e.preventDefault();
                    if (e.target.validity.valueMissing) {
                      e.target.setCustomValidity("Please select your gender");
                    } else {
                      e.target.setCustomValidity("");
                    }
                  }}
                  onInput={(e: React.FormEvent<HTMLSelectElement>) => e.currentTarget.setCustomValidity("")}
                  onChange={(e) => {
                    setGender(e.target.value);
                    e.currentTarget.setCustomValidity("");
                  }}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
                  Age
                </label>
                <input
                  type="number"
                  value={age}
                  min="13"
                  max="120"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  onInvalid={(e: React.InvalidEvent<HTMLInputElement>) => {
                    e.preventDefault();
                    if (e.target.validity.valueMissing) {
                      e.target.setCustomValidity("Please enter your age");
                    } else if (e.target.validity.rangeUnderflow) {
                      e.target.setCustomValidity("You must be at least 13 years old");
                    } else if (e.target.validity.rangeOverflow) {
                      e.target.setCustomValidity("Please enter a valid age");
                    } else {
                      e.target.setCustomValidity("");
                    }
                  }}
                  onInput={(e: React.FormEvent<HTMLInputElement>) => e.currentTarget.setCustomValidity("")}
                  onChange={(e) => {
                    setAge(e.target.value);
                    e.currentTarget.setCustomValidity("");
                  }}
                />
              </div>
              
              <div className="mb-2 col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1" style={{color: '#374151'}}>
                  Country
                </label>
                <select
                  value={country}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  onInvalid={(e: React.InvalidEvent<HTMLSelectElement>) => {
                    e.preventDefault();
                    if (e.target.validity.valueMissing) {
                      e.target.setCustomValidity("Please select your country");
                    } else {
                      e.target.setCustomValidity("");
                    }
                  }}
                  onInput={(e: React.FormEvent<HTMLSelectElement>) => e.currentTarget.setCustomValidity("")}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    e.currentTarget.setCustomValidity("");
                  }}
                >
                  <option value="">Select country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading || (isSignUp && passwordError !== null)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded mb-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoading 
            ? 'Processing...' 
            : (resetPasswordMode 
                ? 'Send Reset Link' 
                : (isSignUp ? 'Create Account' : 'Sign In'))}
        </button>
      
        <div className="text-center text-xs">
          {resetPasswordMode ? (
            <button
              type="button"
              onClick={() => setResetPasswordMode(false)}
              className="text-blue-500 hover:text-blue-700"
            >
              Back to Sign In
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => switchToResetMode()}
                className="text-blue-500 hover:text-blue-700 mr-3"
              >
                Forgot Password?
              </button>
              
              <button
                type="button"
                onClick={toggleSignUp}
                className="text-blue-500 hover:text-blue-700"
              >
                {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
} 