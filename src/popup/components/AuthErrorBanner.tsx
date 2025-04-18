import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface AuthErrorBannerProps {
  onRefresh: () => void;
}

/**
 * A banner that shows authentication errors and provides a button to refresh auth
 */
export function AuthErrorBanner({ onRefresh }: AuthErrorBannerProps) {
  return (
    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Authentication Issue</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 mb-2">
            There was a problem with your authentication. You may need to refresh your session.
          </p>
          <Button
            size="sm"
            onClick={onRefresh}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-1 h-8"
          >
            Refresh Authentication
          </Button>
        </div>
      </div>
    </div>
  );
} 