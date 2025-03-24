import React, { useState, useEffect } from 'react';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface Subscription {
  active: boolean;
  plan: string;
  expiresAt: number;
  features: string[];
}

interface SignInButtonProps {
  onSignInStateChange?: (isSignedIn: boolean, user?: User, subscription?: Subscription) => void;
  className?: string;
}

export function SignInButton({ onSignInStateChange, className = '' }: SignInButtonProps) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    // Check authentication status on component mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_auth_status' });
      
      if (response?.success) {
        setIsSignedIn(true);
        setUser(response.user);
        setSubscription(response.subscription);
        
        if (onSignInStateChange) {
          onSignInStateChange(true, response.user, response.subscription);
        }
      } else {
        setIsSignedIn(false);
        setUser(null);
        setSubscription(null);
        
        if (onSignInStateChange) {
          onSignInStateChange(false);
        }
        
        // If not first run but not authenticated, attempt silent auth
        const firstRunCheck = await chrome.storage.local.get('firstRun');
        if (!firstRunCheck.firstRun) {
          silentAuthentication();
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  const silentAuthentication = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'initial_auth_check',
        interactive: false
      });
      
      if (response?.success) {
        setIsSignedIn(true);
        setUser(response.user);
        setSubscription(response.subscription);
        
        if (onSignInStateChange) {
          onSignInStateChange(true, response.user, response.subscription);
        }
      }
    } catch (error) {
      console.error('Silent auth error:', error);
      // No need to show error for silent auth attempts
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'initial_auth_check',
        interactive: true
      });
      
      if (response?.success) {
        setIsSignedIn(true);
        setUser(response.user);
        setSubscription(response.subscription);
        
        if (onSignInStateChange) {
          onSignInStateChange(true, response.user, response.subscription);
        }
      } else {
        setError(response?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'sign_out' });
      
      if (response?.success) {
        setIsSignedIn(false);
        setUser(null);
        setSubscription(null);
        
        if (onSignInStateChange) {
          onSignInStateChange(false);
        }
      } else {
        setError(response?.error || 'Sign out failed');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  // Render different states
  if (error) {
    return (
      <div className="auth-error">
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={checkAuthStatus}
          disabled={isLoading}
        >
          {isLoading ? 'Checking...' : 'Retry'}
        </button>
      </div>
    );
  }

  if (isSignedIn && user) {
    return (
      <div className={`auth-user-info ${className}`}>
        <div className="user-profile">
          {user.photoURL && (
            <img 
              src={user.photoURL} 
              alt={user.displayName || 'User'} 
              className="user-avatar"
            />
          )}
          <div className="user-details">
            <span className="user-name">{user.displayName || user.email}</span>
            {subscription && (
              <span className="subscription-status">
                {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </span>
            )}
          </div>
        </div>
        <button 
          className="sign-out-button"
          onClick={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <button 
      className={`auth-button ${className}`}
      onClick={handleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="loading-spinner"></span>
      ) : (
        <>
          <span className="auth-icon google-icon">G</span>
          <span>Sign In</span>
        </>
      )}
    </button>
  );
}

export default SignInButton; 