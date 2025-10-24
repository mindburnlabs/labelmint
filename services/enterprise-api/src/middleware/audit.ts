import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth'
import { logger } from '../utils/logger'

export function auditMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now()

  // Log request details
  logger.info('API Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    organizationId: req.user?.organizationId
  })

  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(chunk: any, encoding?: any) {
    const duration = Date.now() - startTime
    logger.info('API Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    })

    return originalEnd.call(this, chunk, encoding)
  }

  next()
}