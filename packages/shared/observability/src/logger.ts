/**
 * Centralized Logger Implementation
 * Provides structured logging with correlation IDs and distributed tracing
 */

import { randomUUID } from 'crypto';
import {
  LogEntry,
  LogLevel,
  LoggerConfig,
  LogFormat,
  LogOutput,
  CorrelationConfig,
  RedactionConfig,
  RedactionStrategy,
  ErrorInfo,
  TraceContext
} from './types';
import { CorrelationManager } from './correlation';

export class Logger {
  private config: LoggerConfig;
  private correlationManager: CorrelationManager;
  private outputs: LogOutput[] = [];

  constructor(config: LoggerConfig) {
    this.config = {
      level: LogLevel.INFO,
      format: LogFormat.JSON,
      outputs: [{ type: 'console' }],
      correlationId: { enabled: true, generateIfMissing: true },
      redaction: { enabled: true, fields: ['password', 'token', 'secret'], patterns: [], strategy: RedactionStrategy.MASK },
      ...config
    };

    this.correlationManager = new CorrelationManager(this.config.correlationId);
    this.initializeOutputs();
  }

  private initializeOutputs(): void {
    this.outputs = this.config.outputs || [];
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error | ErrorInfo, metadata?: Record<string, any>): void {
    const errorInfo = this.parseError(error);
    this.log(LogLevel.ERROR, message, { ...metadata, error: errorInfo });
  }

  fatal(message: string, error?: Error | ErrorInfo, metadata?: Record<string, any>): void {
    const errorInfo = this.parseError(error);
    this.log(LogLevel.FATAL, message, { ...metadata, error: errorInfo });
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (level < (this.config.level || LogLevel.INFO)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      service: this.config.service,
      version: this.config.version,
      environment: this.config.environment,
      correlationId: this.correlationManager.getCorrelationId(),
      traceId: this.correlationManager.getTraceId(),
      spanId: this.correlationManager.getSpanId(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      requestId: metadata?.requestId,
      metadata: this.redactData(metadata),
      error: metadata?.error,
      tags: metadata?.tags,
      component: metadata?.component,
      operation: metadata?.operation
    };

    // Add duration if available
    if (metadata?.startTime) {
      entry.duration = Date.now() - metadata.startTime;
    }

    // Write to all outputs
    this.writeToOutputs(entry);
  }

  private writeToOutputs(entry: LogEntry): void {
    for (const output of this.outputs) {
      if (output.level && entry.level < output.level) {
        continue;
      }

      const format = output.format || this.config.format || LogFormat.JSON;
      const formattedEntry = this.formatEntry(entry, format);

      switch (output.type) {
        case 'console':
          this.writeToConsole(formattedEntry, entry.level);
          break;
        case 'file':
          this.writeToFile(formattedEntry, output.config);
          break;
        case 'http':
          this.writeToHttp(formattedEntry, output.config);
          break;
        case 'stream':
          this.writeToStream(formattedEntry, output.config);
          break;
      }
    }
  }

  private formatEntry(entry: LogEntry, format: LogFormat): string {
    switch (format) {
      case LogFormat.JSON:
        return JSON.stringify(entry);
      case LogFormat.TEXT:
        return this.formatAsText(entry);
      case LogFormat.STRUCTURED:
        return this.formatAsStructured(entry);
      default:
        return JSON.stringify(entry);
    }
  }

  private formatAsText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const correlation = entry.correlationId ? `[${entry.correlationId}]` : '';
    const component = entry.component ? `[${entry.component}]` : '';

    let message = `${timestamp} ${level} ${this.config.service}${correlation}${component} ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      message += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\nStack: ${entry.error.stack}`;
      }
    }

    return message;
  }

  private formatAsStructured(entry: LogEntry): string {
    const parts = [
      `time=${entry.timestamp.toISOString()}`,
      `level=${LogLevel[entry.level]}`,
      `service=${this.config.service}`
    ];

    if (entry.correlationId) parts.push(`correlation_id=${entry.correlationId}`);
    if (entry.traceId) parts.push(`trace_id=${entry.traceId}`);
    if (entry.spanId) parts.push(`span_id=${entry.spanId}`);
    if (entry.userId) parts.push(`user_id=${entry.userId}`);
    if (entry.component) parts.push(`component=${entry.component}`);
    if (entry.operation) parts.push(`operation=${entry.operation}`);

    parts.push(`msg="${entry.message}"`);

    if (entry.metadata) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        parts.push(`${key}=${JSON.stringify(value)}`);
      }
    }

    return parts.join(' ');
  }

  private writeToConsole(formattedEntry: string, level: LogLevel): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[90m', // Gray
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';

    if (process.env.NODE_ENV === 'production') {
      console.log(formattedEntry);
    } else {
      console.log(`${color}${formattedEntry}${reset}`);
    }
  }

  private writeToFile(formattedEntry: string, config: any): void {
    // Implementation would write to file system
    // This is a placeholder for file writing logic
  }

  private writeToHttp(formattedEntry: string, config: any): void {
    // Implementation would send HTTP request to log aggregation service
    // This is a placeholder for HTTP logging
  }

  private writeToStream(formattedEntry: string, config: any): void {
    // Implementation would write to a stream (e.g., process.stdout)
    if (config.stream) {
      config.stream.write(formattedEntry + '\n');
    }
  }

  private parseError(error?: Error | ErrorInfo): ErrorInfo | undefined {
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

    return error as ErrorInfo;
  }

  private redactData(data?: any): any {
    if (!data || !this.config.redaction?.enabled) {
      return data;
    }

    const redacted = { ...data };
    const fields = this.config.redaction.fields || [];
    const patterns = this.config.redaction.patterns || [];
    const strategy = this.config.redaction.strategy || RedactionStrategy.MASK;

    // Redact specified fields
    for (const field of fields) {
      if (redacted[field]) {
        switch (strategy) {
          case RedactionStrategy.MASK:
            redacted[field] = '***';
            break;
          case RedactionStrategy.REMOVE:
            delete redacted[field];
            break;
          case RedactionStrategy.HASH:
            redacted[field] = this.hashValue(redacted[field]);
            break;
        }
      }
    }

    // Apply pattern-based redaction
    for (const pattern of patterns) {
      this.applyPatternRedaction(redacted, pattern);
    }

    return redacted;
  }

  private applyPatternRedaction(data: any, pattern: any): void {
    if (typeof data === 'string') {
      data = pattern.pattern.test(data) ? pattern.replacement : data;
    } else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        data[key] = this.applyPatternRedaction(data[key], pattern);
      }
    }
  }

  private hashValue(value: any): string {
    // Simple hash implementation - in production, use proper crypto
    return require('crypto')
      .createHash('sha256')
      .update(String(value))
      .digest('hex')
      .substring(0, 8);
  }

  // Public API methods

  withContext(context: Record<string, any>): Logger {
    return new Logger({
      ...this.config,
      metadata: { ...this.config.metadata, ...context }
    });
  }

  withCorrelationId(correlationId: string): Logger {
    this.correlationManager.setCorrelationId(correlationId);
    return this;
  }

  withTraceContext(traceContext: TraceContext): Logger {
    this.correlationManager.setTraceContext(traceContext);
    return this;
  }

  withComponent(component: string): Logger {
    return new Logger({
      ...this.config,
      metadata: { ...this.config.metadata, component }
    });
  }

  withOperation(operation: string): Logger {
    return new Logger({
      ...this.config,
      metadata: { ...this.config.metadata, operation }
    });
  }

  withUser(userId: string): Logger {
    return new Logger({
      ...this.config,
      metadata: { ...this.config.metadata, userId }
    });
  }

  // Performance measurement
  timer(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Timer: ${name}`, { duration, timer: name });
    };
  }

  // Child logger with inherited context
  child(context: Record<string, any>): Logger {
    return this.withContext(context);
  }

  // Get current correlation context
  getCorrelationContext(): TraceContext | null {
    return this.correlationManager.getTraceContext();
  }
}

// Factory function for creating loggers
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

// Default logger instance
let defaultLogger: Logger | null = null;

export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger({
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }
  return defaultLogger;
}

// Convenience methods for default logger
export const logger = {
  debug: (message: string, metadata?: Record<string, any>) =>
    getDefaultLogger().debug(message, metadata),
  info: (message: string, metadata?: Record<string, any>) =>
    getDefaultLogger().info(message, metadata),
  warn: (message: string, metadata?: Record<string, any>) =>
    getDefaultLogger().warn(message, metadata),
  error: (message: string, error?: Error, metadata?: Record<string, any>) =>
    getDefaultLogger().error(message, error, metadata),
  fatal: (message: string, error?: Error, metadata?: Record<string, any>) =>
    getDefaultLogger().fatal(message, error, metadata),
  withContext: (context: Record<string, any>) =>
    getDefaultLogger().withContext(context),
  withCorrelationId: (correlationId: string) =>
    getDefaultLogger().withCorrelationId(correlationId),
  timer: (name: string) => getDefaultLogger().timer(name)
};