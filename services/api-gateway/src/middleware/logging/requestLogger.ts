import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId;

  // Store original res.end
  const originalEnd = res.end;

  // Override res.end to log response
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;

    // Log request/response
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
      correlationId,
      type: 'request'
    });

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};