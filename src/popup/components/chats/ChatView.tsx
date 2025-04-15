import React from 'react';

/**
 * Chat view component for Gemini AI conversations
 */
export default function ChatView() {
  return (
    <div className="h-full">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        AI Chat
      </h2>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <div className="mb-4 text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Chat Feature Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Chat with our AI to practice your language skills and get instant answers to your questions.
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