import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/globals.css';
import AuthWrapper from './AuthWrapper';

const container = document.getElementById('app');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AuthWrapper>
      <Popup />
    </AuthWrapper>
  </React.StrictMode>
); 