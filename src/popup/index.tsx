import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import AuthWrapper from './AuthWrapper';
import { FirestoreProvider } from '../contexts/FirestoreContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthManager from '@/core/auth-manager';
import { StoreProvider } from '@/providers/StoreProvider';

// Add a function to refresh the token on startup
function App() {
  useEffect(() => {
    // Try to refresh the authentication token when the application loads
    if (AuthManager.isAuthenticated()) {
      console.log('WordStream: Refreshing authentication token at startup');
      AuthManager.verifyTokenAndRefresh()
        .then((success) => {
          if (success) {
            console.log('WordStream: Authentication token refreshed successfully');
          } else {
            console.warn('WordStream: Failed to refresh token at startup');
          }
        })
        .catch((error) => {
          console.warn('WordStream: Error refreshing token:', error);
        });
    }
  }, []);

  return (
    <FirestoreProvider>
      <StoreProvider>
        <AuthWrapper>
          <Popup />
        </AuthWrapper>
        <ToastContainer 
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </StoreProvider>
    </FirestoreProvider>
  );
}

const container = document.getElementById('app');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 