import winston from 'winston';
import config from '@config/index';

// Define custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const log = {
      timestamp,
      level,
      message,
      correlationId,
      ...meta
    };
    return JSON.stringify(log);
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { service: 'api-gateway' },
  transports: []
});

// Add console transport for development
if (config.logging.console.enabled) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
        const cid = correlationId ? `[${correlationId}]` : '';
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level} ${cid} ${message}${metaStr}`;
      })
    )
  }));
}

// Add file transport if enabled
if (config.logging.file.enabled) {
  logger.add(new winston.transports.File({
    filename: config.logging.file.filename,
    maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024, // Convert MB to bytes
    maxFiles: config.logging.file.maxFiles,
    format: customFormat
  }));
}

// Create a stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim(), { type: 'http' });
  }
};

export { logger };