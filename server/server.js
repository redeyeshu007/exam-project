const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const mongoSanitize = require('express-mongo-sanitize'); (Removed due to Express 5 incompatibility)
const connectDB = require('./config/db');
const logger = require('./logger');

// Load env vars early
dotenv.config();

// Connect to database
connectDB();

const app = express();

// ── 1. Security Headers (Helmet) ──────────────────────────────────────────────
// Adds ~15 HTTP headers that harden against XSS, clickjacking, sniffing, etc.
app.use(helmet({
  contentSecurityPolicy: false,   // Disabled: Vite SPA inlines scripts by design
  crossOriginEmbedderPolicy: false,
}));

// Remove X-Powered-By so attackers can't fingerprint Express
app.disable('x-powered-by');

// ── 2. CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── 3. Body Parser (with size limit to block large payload attacks) ───────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ── 4. NoSQL Injection Sanitization (Express 5 Compatible) ────────────────────
// Strips $ and . from keys to prevent NoSQL injection.
const mongoSanitize = (options = {}) => {
  const replaceWith = options.replaceWith;
  const clean = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (key.startsWith('$') || key.includes('.')) {
          if (replaceWith) {
            const newKey = key.replace(/^\$/, replaceWith).replace(/\./g, replaceWith);
            obj[newKey] = val;
            delete obj[key];
            clean(obj[newKey]);
          } else {
            delete obj[key];
          }
        } else {
          clean(val);
        }
      });
    }
    return obj;
  };

  return (req, res, next) => {
    if (req.body) clean(req.body);
    if (req.params) clean(req.params);
    if (req.query) {
      // Create a sanitized copy and redefine the property to bypass Express 5's read-only getter
      const sanitizedQuery = clean(JSON.parse(JSON.stringify(req.query)));
      Object.defineProperty(req, 'query', {
        value: sanitizedQuery,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
    next();
  };
};
app.use(mongoSanitize({ replaceWith: '_' }));

// ── 5. Rate Limiting ──────────────────────────────────────────────────────────
// Global: 200 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.originalUrl });
    res.status(429).json({ message: 'Too many requests. Please try again later.' });
  },
});
app.use(globalLimiter);

// Auth limiter: 200 attempts per 15 min per IP (relaxed for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip });
    res.status(429).json({ message: 'Too many requests. Please try again later.' });
  },
});

// ── 6. Request Logger Middleware ──────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      ip: req.ip,
      ms: duration,
    });
  });
  next();
});

// ── 7. Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/halls', require('./routes/halls'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/drafts', require('./routes/drafts'));

// Client-side error reporting endpoint
app.post('/api/logs/client', (req, res) => {
  const { message, stack, url, userAgent, timestamp } = req.body;
  if (!message) return res.status(400).json({ message: 'No log data' });
  logger.clientError({ message, stack, url, userAgent, timestamp });
  res.status(204).end();
});

// ── 8. 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.originalUrl, ip: req.ip });
  res.status(404).json({ message: 'Route not found' });
});

// ── 9. Global Error Handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });
  const status = err.status || 500;
  res.status(status).json({
    message: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
  });
});

// ── 10. Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});
