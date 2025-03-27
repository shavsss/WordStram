import React from 'react';
import { usePaymentStatus } from '../../hooks/usePaymentStatus';

interface SubscriptionStatusProps {
  className?: string;
}

/**
 * Component that displays the user's current subscription status
 */
export function SubscriptionStatus({ className = '' }: SubscriptionStatusProps) {
  const { isLoading, isPaid, userId, error } = usePaymentStatus();

  if (isLoading) {
    return (
      <div className={`subscription-status-loading ${className}`}>
        <div className="loading-spinner"></div>
        <span>Checking subscription...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`subscription-status-error ${className}`}>
        <span>Failed to load subscription status</span>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={`subscription-status-not-logged-in ${className}`}>
        <span>Sign in to view subscription status</span>
      </div>
    );
  }

  return (
    <div className={`subscription-status ${className}`}>
      <div className={`status-badge ${isPaid ? 'premium' : 'free'}`}>
        <span>{isPaid ? 'Premium' : 'Free'}</span>
      </div>
      
      {!isPaid && (
        <button 
          className="upgrade-button"
          onClick={() => window.open('https://wordstream-extension.com/pricing', '_blank')}
        >
          Upgrade to Premium
        </button>
      )}
    </div>
  );
}

export default SubscriptionStatus; 