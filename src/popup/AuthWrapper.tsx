import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPanel } from '@/components/auth/AuthPanel';

interface AuthWrapperProps {
  children: React.ReactNode;
}

/**
 * Authentication wrapper component
 * Shows login screen if user is not authenticated
 * Renders children only when authenticated
 */
export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, currentUser } = useAuth();
  // Add state to manage smooth transition
  const [showContent, setShowContent] = useState<boolean>(false);
  const [showAuth, setShowAuth] = useState<boolean>(false);
  
  // Handle smooth transitions
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (!isAuthenticated) {
      // If not authenticated, show auth panel after a delay
      timer = setTimeout(() => {
        setShowAuth(true);
        setShowContent(false);
      }, 400); // Slightly longer delay to avoid flicker
    } else {
      // If authenticated, show content after a small delay
      timer = setTimeout(() => {
        setShowContent(true);
        setShowAuth(false);
      }, 300); // Short delay for smooth transition
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated]);

  // Reset dark mode when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      // Force light mode for login screen by removing dark class and adding explicit styles
      document.documentElement.classList.remove('dark');
      
      // Add explicit styles to override dark mode
      document.documentElement.style.backgroundColor = '#ffffff';
      document.body.style.backgroundColor = '#ffffff';
      document.body.classList.add('wordstream-light-theme');
    } else {
      // Remove explicit styles when authenticated
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      document.body.classList.remove('wordstream-light-theme');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    console.log('WordStream Authentication state:', { isAuthenticated, currentUser });
  }, [isAuthenticated, currentUser]);

  // Render loading spinner while checking authentication
  // or waiting for transitions to complete
  if (isAuthenticated) {
    return (
      <div className="opacity-0 animate-fadeIn">
        {children}
      </div>
    );
  }

  // Show authentication panel if not authenticated
  if (!isAuthenticated && showAuth) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen bg-white p-4 opacity-0 animate-fadeIn" style={{backgroundColor: 'white'}}>
        <div className="mb-8 text-center">
          <img 
            src="/icons/icon128.png" 
            alt="WordStream Logo" 
            className="w-16 h-16 mx-auto mb-2"
          />
          <h1 className="text-2xl font-bold text-gray-800" style={{color: '#1f2937'}}>WordStream</h1>
          <p className="text-gray-600 mt-2" style={{color: '#4b5563'}}>Authentication Required to Continue</p>
        </div>
        
        <div className="w-full max-w-md">
          <AuthPanel 
            isVisible={true} 
            onClose={() => {}} // No-op since we always want to show this
            isPopup={true} // Indicate this is being used in popup mode
          />
        </div>
      </div>
    );
  }

  // If authenticated and ready to show content, render children
  // with a fade-in animation
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <img 
        src="/icons/icon48.png" 
        alt="WordStream Logo" 
        className="w-16 h-16 mb-4 animate-pulse"
      />
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mt-4"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading WordStream...</p>
    </div>
  );
} 