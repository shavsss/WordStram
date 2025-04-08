import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function AuthUI() {
  const { user, isAuthenticated, isLoading, error, signInWithGoogle, signOut } = useAuth();

  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (!user) {
        throw new Error('Sign in failed');
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {isAuthenticated ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Signed in as</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <Button 
              onClick={handleSignOut}
              variant="outline"
              className="bg-white/10 backdrop-blur-sm border border-white/20"
            >
              Sign Out
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleSignIn}
          className="w-full bg-gradient-to-br from-blue-500/80 to-indigo-600/80 hover:from-blue-600/80 hover:to-indigo-700/80"
        >
          Sign in with Google
        </Button>
      )}
    </div>
  );
} 