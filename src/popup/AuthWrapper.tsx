import React from 'react';
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
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show authentication panel if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="mb-8 text-center">
          <img 
            src="/icons/icon128.png" 
            alt="WordStream Logo" 
            className="w-16 h-16 mx-auto mb-2"
          />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">WordStream</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Authentication Required to Continue</p>
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

  // If authenticated, render children
  return <>{children}</>;
} 