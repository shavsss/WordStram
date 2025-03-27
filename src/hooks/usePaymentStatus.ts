import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { checkIfUserPaid } from '../services/firebase/user-service';

interface PaymentStatus {
  isLoading: boolean;
  isPaid: boolean;
  userId: string | null;
  error: Error | null;
}

/**
 * Hook to check if the current user has paid for the service
 * @returns Payment status information
 */
export function usePaymentStatus(): PaymentStatus {
  const [status, setStatus] = useState<PaymentStatus>({
    isLoading: true,
    isPaid: false,
    userId: null,
    error: null,
  });

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus({
          isLoading: false,
          isPaid: false,
          userId: null,
          error: null,
        });
        return;
      }
      
      try {
        const isPaid = await checkIfUserPaid(user.uid);
        
        setStatus({
          isLoading: false,
          isPaid,
          userId: user.uid,
          error: null,
        });
      } catch (error) {
        setStatus({
          isLoading: false,
          isPaid: false,
          userId: user.uid,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      }
    });
    
    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  return status;
}

export default usePaymentStatus; 