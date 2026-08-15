/**
 * Client-side logger
 * - In development: logs to browser console
 * - Always: sends errors/warnings to the server /api/logs/client endpoint
 *   so they land in logs/client-error.log on the server
 */

const IS_DEV = import.meta.env.DEV;

const send = (level, message, extra = {}) => {
  const payload = {
    level,
    message,
    ...extra,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  // Always send errors + warnings to server
  if (level === 'error' || level === 'warn') {
    // Fire-and-forget — don't await, don't block UI
    fetch('/api/logs/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* swallow — logging must never crash the app */ });
  }

  // Console output in development only
  if (IS_DEV) {
    const fn = level === 'error' ? console.error
             : level === 'warn'  ? console.warn
             : console.log;
    fn(`[${level.toUpperCase()}]`, message, extra);
  }
};

const logger = {
  info:  (message, extra) => send('info',  message, extra),
  warn:  (message, extra) => send('warn',  message, extra),
  error: (message, extra) => send('error', message, extra),
};

export default logger;
