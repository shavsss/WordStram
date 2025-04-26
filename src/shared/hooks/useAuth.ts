import { useState, useEffect } from 'react';
import authService from '../../services/firebase/auth-service';
import type { User } from 'firebase/auth';

/**
 * Hook for authentication state and methods
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    
    // Listen for auth state changes
    const unsubscribe = authService.addAuthStateListener((newUser) => {
      setUser(newUser);
      setLoading(false);
    });
    
    // Cleanup subscription
    return unsubscribe;
  }, []);
  
  return {
    user,
    isAuthenticated: !!user,
    loading,
    signInWithEmail: (email: string, password: string) => authService.signIn(email, password),
    signInWithGoogle: () => authService.signInWithGoogle(),
    signOut: () => authService.signOut()
  };
} 