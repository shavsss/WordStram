import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './popup/Popup';
import './styles/globals.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
  }
}); 