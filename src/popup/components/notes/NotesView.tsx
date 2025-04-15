import React from 'react';

/**
 * Notes view component for managing learning notes and summaries
 */
export default function NotesView() {
  return (
    <div className="h-full">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        Notes
      </h2>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <div className="mb-4 text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notes Feature Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          This feature will allow you to save notes and summaries while learning.
        </p>
        <button
          disabled
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 opacity-50 cursor-not-allowed"
        >
          Coming Soon
        </button>
      </div>
    </div>
  );
} 