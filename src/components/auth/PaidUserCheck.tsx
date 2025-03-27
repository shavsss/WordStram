import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { checkIfUserPaid } from '../../services/firebase/user-service';

interface PaidUserCheckProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * A component that only renders its children if the current user has paid
 * Otherwise, it renders the fallback content
 */
export function PaidUserCheck({ children, fallback }: PaidUserCheckProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPaid, setHasPaid] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Check if the user has paid
        try {
          const isPaid = await checkIfUserPaid(user.uid);
          setHasPaid(isPaid);
        } catch (error) {
          console.error('Error checking payment status:', error);
        }
      } else {
        setUser(null);
        setHasPaid(false);
      }
      
      setIsLoading(false);
    });
    
    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Checking subscription...</p>
      </div>
    );
  }

  // If the user isn't logged in or hasn't paid, render the fallback
  if (!user || !hasPaid) {
    return (
      <div>
        {fallback || (
          <div className="upgrade-prompt">
            <h3>Premium Feature</h3>
            <p>This feature is only available to premium users.</p>
            {user && (
              <button 
                className="upgrade-button"
                onClick={() => window.open('https://wordstream-extension.com/pricing', '_blank')}
              >
                Upgrade Now
              </button>
            )}
            {!user && (
              <p>Please sign in to access premium features.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // User is logged in and has paid, render the children
  return <>{children}</>;
}

export default PaidUserCheck; 