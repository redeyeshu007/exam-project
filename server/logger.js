const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = format;

// Log line format for files
const fileFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' | ' + JSON.stringify(meta) : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}${metaStr}`;
});

// Log line format for console (coloured)
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp, stack }) =>
    `${timestamp} ${level}: ${stack || message}`
  )
);

const logger = createLogger({
  level: 'info',
  format: combine(
    errors({ stack: true }),   // capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fileFormat
  ),
  transports: [
    // All levels → combined.log
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,   // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Errors only → error.log
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    // Client-sent errors → client-error.log
    new transports.File({
      filename: path.join(logsDir, 'client-error.log'),
      level: 'warn',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
  // Don't crash on uncaught exceptions — log them instead
  exceptionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'rejections.log') }),
  ],
});

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({ format: consoleFormat }));
}

// Convenience method for logging client-sent events
logger.clientError = (data) => {
  logger.warn('CLIENT_ERROR', {
    source: 'client',
    url: data.url,
    message: data.message,
    stack: data.stack,
    userAgent: data.userAgent,
    timestamp: data.timestamp,
  });
};

module.exports = logger;
