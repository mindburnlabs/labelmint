// ============================================================================
// LOGGER UTILITIES
// ============================================================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: string
  userId?: string
  requestId?: string
  metadata?: Record<string, any>
  error?: {
    name: string
    message: string
    stack: string
  }
}

export class Logger {
  private context?: string
  private defaultMetadata?: Record<string, any>

  constructor(context?: string, defaultMetadata?: Record<string, any>) {
    this.context = context
    this.defaultMetadata = defaultMetadata
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const context = entry.context ? `[${entry.context}]` : ''
    const userId = entry.userId ? `[User:${entry.userId}]` : ''
    const requestId = entry.requestId ? `[Req:${entry.requestId}]` : ''

    let message = `${timestamp} ${entry.level.toUpperCase()} ${context}${userId}${requestId} ${entry.message}`

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`
    }

    if (entry.error) {
      message += `\nError: ${entry.error.name}: ${entry.error.message}`
      if (entry.error.stack) {
        message += `\nStack: ${entry.error.stack}`
      }
    }

    return message
  }

  private createLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date(),
      context: this.context,
      metadata: { ...this.defaultMetadata, ...metadata }
    }
  }

  error(message: string, error?: Error | Record<string, any>, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata)

    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      }
    } else if (error) {
      entry.metadata = { ...entry.metadata, ...error }
    }

    console.error(this.formatMessage(entry))

    // Send to external logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(entry)
    }
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata)
    console.warn(this.formatMessage(entry))
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata)
    console.info(this.formatMessage(entry))
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata)
      console.debug(this.formatMessage(entry))
    }
  }

  private async sendToLogService(entry: LogEntry): Promise<void> {
    // Implementation for sending logs to external service
    // e.g., ELK stack, CloudWatch, Datadog, etc.
    try {
      // Example: Send to your logging service
      // await fetch(`${process.env.LOG_SERVICE_URL}/logs`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // })
    } catch (error) {
      console.error('Failed to send log to external service:', error)
    }
  }

  child(context: string, metadata?: Record<string, any>): Logger {
    return new Logger(
      this.context ? `${this.context}:${context}` : context,
      { ...this.defaultMetadata, ...metadata }
    )
  }
}

// Create default logger instance
export const logger = new Logger()

// Context-specific loggers
export const createLogger = (context: string, metadata?: Record<string, any>): Logger => {
  return new Logger(context, metadata)
}

// Request logger middleware helper
export const createRequestLogger = (requestId: string, userId?: string): Logger => {
  return logger.child('request', { requestId, userId })
}

// Performance logger
export class PerformanceLogger {
  private logger: Logger
  private startTime: number

  constructor(operation: string, context?: string) {
    this.logger = new Logger(`performance:${context || 'app'}`)
    this.startTime = Date.now()

    this.logger.debug(`Starting operation: ${operation}`, { operation })
  }

  end(operation: string, metadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime

    this.logger.info(`Completed operation: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...metadata
    })
  }
}

export const measurePerformance = <T>(
  operation: string,
  fn: () => T | Promise<T>,
  context?: string
): T | Promise<T> => {
  const perfLogger = new PerformanceLogger(operation, context)

  const result = fn()

  if (result instanceof Promise) {
    return result.finally(() => {
      perfLogger.end(operation)
    })
  } else {
    perfLogger.end(operation)
    return result
  }
}