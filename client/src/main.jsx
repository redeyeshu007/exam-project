import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import logger from './services/logger.js';

// Global JS error handler (uncaught errors outside React tree)
window.onerror = (message, source, lineno, colno, error) => {
  logger.error('Uncaught global error', {
    message, source, lineno, colno,
    stack: error?.stack,
  });
};

// Unhandled promise rejections (e.g. failed fetch calls not caught)
window.onunhandledrejection = (event) => {
  logger.error('Unhandled promise rejection', {
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  });
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
