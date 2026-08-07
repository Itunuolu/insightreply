import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { AppProvider } from './state/AppContext';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

createRoot(container).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);