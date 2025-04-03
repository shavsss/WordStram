import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import AuthWrapper from './AuthWrapper';
import { FirestoreProvider } from '../contexts/FirestoreContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const container = document.getElementById('app');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <FirestoreProvider>
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
    </FirestoreProvider>
  </React.StrictMode>
); 