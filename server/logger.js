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

// Exactly two files: success.log (info-level, meaningful business events)
// and error.log (warn + error, including client-reported errors and any
// uncaught exceptions/rejections — no longer fragmented across 5 files).
const logger = createLogger({
  level: 'info',
  format: combine(
    errors({ stack: true }),   // capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fileFormat
  ),
  transports: [
    // Info level only → success.log
    new transports.File({
      filename: path.join(logsDir, 'success.log'),
      level: 'info',
      maxsize: 5 * 1024 * 1024,   // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Warnings and errors → error.log
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'warn',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
  // Don't crash on uncaught exceptions — log them instead (into error.log)
  exceptionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'error.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'error.log') }),
  ],
});

// The success.log transport is set to level:'info', but Winston's file
// transport with a `level` still lets everything AT OR ABOVE that level
// through by default severity ordering (error < warn < info < ...), so
// without a filter, warn/error would also land in success.log. Add an
// explicit filter so success.log only ever receives 'info'.
logger.transports[0].format = combine(
  format((info) => (info.level === 'info' ? info : false))(),
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  fileFormat
);

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({ format: consoleFormat }));
}

// Convenience method for logging client-sent events — routed to error.log
// (via warn level) same as any other warning/error.
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
