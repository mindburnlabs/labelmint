/**
 * Express Middleware for Observability
 * Provides request logging, correlation ID propagation, and distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { Tracer } from './tracer';
import { CorrelationManager } from './correlation';
import { TraceContext } from './types';

export interface ObservabilityMiddlewareConfig {
  logger?: Logger;
  tracer?: Tracer;
  excludePaths?: string[];
  includeHeaders?: boolean;
  includeBody?: boolean;
  maxBodySize?: number;
  redactHeaders?: string[];
  redactFields?: string[];
  sampleRate?: number;
}

export function observabilityMiddleware(config: ObservabilityMiddlewareConfig = {}) {
  const logger = config.logger || require('./logger').getDefaultLogger();
  const tracer = config.tracer || new Tracer({ service: 'unknown', enabled: true });
  const correlationManager = new CorrelationManager({
    enabled: true,
    headerName: 'x-correlation-id',
    generateIfMissing: true
  });

  const excludePaths = config.excludePaths || ['/health', '/metrics', '/ready'];
  const includeHeaders = config.includeHeaders || false;
  const includeBody = config.includeBody || false;
  const maxBodySize = config.maxBodySize || 1024;
  const redactHeaders = config.redactHeaders || ['authorization', 'cookie', 'x-api-key'];
  const redactFields = config.redactFields || ['password', 'token', 'secret'];

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = uuidv4();

    // Extract or generate correlation ID
    let correlationId = req.get('x-correlation-id') || req.get('correlation-id');
    if (!correlationId && correlationManager.generateIfMissing) {
      correlationId = uuidv4();
    }

    // Extract trace context from headers
    const traceContext = extractTraceContext(req);

    // Set correlation and trace context
    correlationManager.setCorrelationId(correlationId);
    if (traceContext) {
      correlationManager.setTraceContext(traceContext);
    }

    // Create request-specific logger
    const requestLogger = logger
      .withCorrelationId(correlationId)
      .withTraceContext(traceContext)
      .withContext({
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('user-agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: (req as any).user?.id
      });

    // Add correlation headers to response
    res.set('x-correlation-id', correlationId);
    res.set('x-request-id', requestId);

    // Add trace headers for downstream services
    if (traceContext) {
      res.set('x-trace-id', traceContext.traceId);
      res.set('x-span-id', traceContext.spanId);
    }

    // Log incoming request
    const requestData: any = {
      method: req.method,
      url: req.url,
      query: req.query,
      startTime
    };

    if (includeHeaders) {
      requestData.headers = redactHeaders
        ? redactObject(req.headers, redactHeaders)
        : req.headers;
    }

    if (includeBody && req.body) {
      requestData.body = redactFields
        ? redactObject(req.body, redactFields)
        : req.body;

      // Truncate large bodies
      if (maxBodySize && JSON.stringify(requestData.body).length > maxBodySize) {
        requestData.body = '[TRUNCATED]';
      }
    }

    requestLogger.info('Incoming request', requestData);

    // Start tracing span
    let span;
    if (tracer && tracer.enabled) {
      span = tracer.startSpan(`${req.method} ${req.path}`, {
        parentSpanId: traceContext?.spanId,
        tags: {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.get('user-agent'),
          'http.remote_addr': req.ip,
          'service.name': process.env.SERVICE_NAME || 'unknown',
          'request.id': requestId,
          'correlation.id': correlationId
        }
      });
    }

    // Override res.end to log response
    const originalEnd = res.end;
    let responseBody: any;

    res.end = function(this: Response, ...args: any[]) {
      // Capture response body if it exists
      if (args[0]) {
        responseBody = args[0];
      }

      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      const responseData: any = {
        statusCode,
        duration,
        contentLength: res.get('content-length'),
        contentType: res.get('content-type')
      };

      // Include response body in debug mode
      if (process.env.NODE_ENV === 'development' && responseBody) {
        responseData.body = responseBody;
      }

      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      requestLogger[logLevel](`Request completed`, responseData);

      // Finish tracing span
      if (span) {
        span.setTag('http.status_code', statusCode);
        span.setStatus(statusCode >= 500 ? 'error' : statusCode >= 400 ? 'error' : 'ok');
        span.finish();
      }

      // Call original end
      return originalEnd.apply(this, args);
    };

    // Add error handling
    res.on('error', (error) => {
      requestLogger.error('Response error', error, {
        statusCode: res.statusCode,
        duration: Date.now() - startTime
      });

      if (span) {
        span.setTag('error', true);
        span.logEvent('error', { error: error.message });
        span.finish();
      }
    });

    // Add logger to request object for use in routes
    (req as any).logger = requestLogger;
    (req as any).tracer = tracer;
    (req as any).span = span;

    next();
  };
}

function extractTraceContext(req: Request): TraceContext | null {
  const traceId = req.get('x-trace-id') || req.get('traceparent')?.split('-')[1];
  const spanId = req.get('x-span-id') || req.get('traceparent')?.split('-')[2];

  if (!traceId || !spanId) {
    return null;
  }

  return {
    traceId,
    spanId,
    baggage: extractBaggage(req)
  };
}

function extractBaggage(req: Request): Record<string, string> {
  const baggageHeader = req.get('baggage');
  const baggage: Record<string, string> = {};

  if (baggageHeader) {
    baggageHeader.split(',').forEach(item => {
      const [key, value] = item.split('=');
      if (key && value) {
        baggage[key.trim()] = value.trim();
      }
    });
  }

  return baggage;
}

function redactObject(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const field of fields) {
    if (obj.hasOwnProperty(field)) {
      redacted[field] = '***';
    }
  }

  // Recursively redact nested objects
  for (const key in redacted) {
    if (typeof redacted[key] === 'object') {
      redacted[key] = redactObject(redacted[key], fields);
    }
  }

  return redacted;
}

// Error handling middleware
export function errorHandlingMiddleware(logger?: Logger) {
  const defaultLogger = logger || require('./logger').getDefaultLogger();

  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestLogger = (req as any).logger || defaultLogger;

    requestLogger.error('Request error', error, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    });

    // Set error response headers
    res.set('x-error', 'true');
    res.set('x-error-type', error.constructor.name);

    // Send error response
    const statusCode = (error as any).statusCode || (error as any).status || 500;
    const errorResponse = {
      success: false,
      error: {
        code: (error as any).code || 'INTERNAL_ERROR',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      metadata: {
        requestId: res.get('x-request-id'),
        correlationId: res.get('x-correlation-id'),
        timestamp: new Date().toISOString()
      }
    };

    res.status(statusCode).json(errorResponse);
  };
}

// Performance monitoring middleware
export function performanceMiddleware(logger?: Logger) {
  const defaultLogger = logger || require('./logger').getDefaultLogger();

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    const requestLogger = (req as any).logger || defaultLogger;

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      requestLogger.info('Performance metrics', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length')
      });
    });

    next();
  };
}

// Request ID middleware (standalone)
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.get('x-request-id') || uuidv4();
    res.set('x-request-id', requestId);
    (req as any).requestId = requestId;
    next();
  };
}

// Correlation ID middleware (standalone)
export function correlationIdMiddleware(headerName: string = 'x-correlation-id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.get(headerName) || uuidv4();
    res.set(headerName, correlationId);
    (req as any).correlationId = correlationId;
    next();
  };
}