/**
 * Default Logger Implementation
 * Provides structured logging with correlation IDs
 */

import { Logger } from './types';

export class DefaultLogger implements Logger {
  private readonly serviceName: string;
  private readonly level: LogLevel;

  constructor(serviceName: string = 'api-client', level: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.level = level;
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: any, meta?: any): void {
    this.log(LogLevel.ERROR, message, { ...meta, error: this.serializeError(error) });
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (level < this.level) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service: this.serviceName,
      message,
      ...meta,
      correlationId: this.getCorrelationId(meta)
    };

    // Use console methods with appropriate colors for development
    if (process.env.NODE_ENV !== 'production') {
      const color = this.getColor(level);
      console.log(`\x1b[${color}m[${LogLevel[level]}]\x1b[0m`, JSON.stringify(logEntry, null, 2));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  private serializeError(error: any): any {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        statusCode: (error as any).statusCode
      };
    }

    return error;
  }

  private getCorrelationId(meta?: any): string | undefined {
    return meta?.correlationId || meta?.requestId;
  }

  private getColor(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 90; // Gray
      case LogLevel.INFO: return 36; // Cyan
      case LogLevel.WARN: return 33; // Yellow
      case LogLevel.ERROR: return 31; // Red
      default: return 0;
    }
  }
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Create a logger with correlation ID support
 */
export function createLogger(serviceName: string): Logger {
  return new DefaultLogger(serviceName);
}

/**
 * No-op logger for testing
 */
export class NoOpLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}