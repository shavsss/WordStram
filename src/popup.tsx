import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './features/popup';
import './styles/popup.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
  }
}); 