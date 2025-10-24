import express from 'express';
import cors from 'cors';
import {
  securityHeaders,
  corsConfig,
  authLimiter,
  generalLimiter,
  uploadLimiter,
  apiLimiter,
  sanitizeInput,
  validateApiKey,
  requestSizeLimiter,
  preventSqlInjection,
  securityLogger,
  addSecurityHeaders
} from '../middleware/security';

/**
 * Initialize comprehensive security middleware for Express app
 */
export function initializeSecurity(app: express.Application): void {
  // 1. Core security headers (should be first)
  app.use(securityHeaders);
  app.use(addSecurityHeaders);

  // 2. CORS configuration
  app.use(cors(corsConfig));

  // 3. Request logging for security monitoring
  app.use(securityLogger);

  // 4. Request size limiting (10MB for file uploads, 1MB for others)
  app.use('/api/upload', requestSizeLimiter(10 * 1024 * 1024));
  app.use(requestSizeLimiter(1 * 1024 * 1024));

  // 5. Input sanitization
  app.use(sanitizeInput);

  // 6. SQL injection prevention
  app.use(preventSqlInjection);

  // 7. Rate limiting by route
  // Auth routes - very strict
  app.use('/api/auth', authLimiter);
  app.use('/auth', authLimiter);

  // File upload routes
  app.use('/api/upload', uploadLimiter);
  app.use('/upload', uploadLimiter);

  // Admin routes
  app.use('/api/admin', generalLimiter);
  app.use('/admin', generalLimiter);

  // General API routes
  app.use('/api/', apiLimiter);

  // 8. API key validation for /api routes
  app.use('/api/', validateApiKey);

  // 9. Disable Express features that could leak information
  app.disable('x-powered-by');

  // 10. Set secure cookie settings
  app.use((req, res, next) => {
    res.cookie('secure-flag', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    next();
  });
}

/**
 * Security middleware configuration for specific routes
 */
export const routeSecurity = {
  // Apply to authentication routes
  auth: [
    authLimiter,
    requestSizeLimiter(10 * 1024), // 10KB for auth
    preventSqlInjection
  ],

  // Apply to file upload routes
  upload: [
    uploadLimiter,
    requestSizeLimiter(10 * 1024 * 1024), // 10MB
    sanitizeInput
  ],

  // Apply to admin routes
  admin: [
    generalLimiter,
    securityLogger
  ],

  // Apply to payment routes
  payment: [
    generalLimiter,
    preventSqlInjection
  ],

  // Apply to API routes
  api: [
    apiLimiter,
    sanitizeInput,
    preventSqlInjection
  ]
};

/**
 * Security response headers for specific responses
 */
export const addSecurityResponseHeaders = (res: express.Response): void => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
};

/**
 * CSRF protection (simplified version)
 */
export const csrfProtection = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfToken = req.get('X-CSRF-Token');
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || csrfToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

/**
 * Content type validation
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const contentType = req.get('Content-Type');

    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        expected: allowedTypes
      });
    }

    next();
  };
};

/**
 * JSON response wrapper with security headers
 */
export const secureJsonResponse = <T>(data: T, message?: string): express.Response => {
  const response: any = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  // Add timestamp for caching
  response.timestamp = new Date().toISOString();

  return response;
};

/**
 * Error response wrapper
 */
export const errorResponse = (
  res: express.Response,
  statusCode: number,
  error: string,
  details?: any
): express.Response => {
  const response: any = {
    success: false,
    error
  };

  if (details) {
    response.details = details;
  }

  response.timestamp = new Date().toISOString();

  return res.status(statusCode).json(response);
};

/**
 * Security check before processing request
 */
export const preRequestSecurityCheck = async (req: express.Request): Promise<{
  valid: boolean;
  reason?: string;
  statusCode?: number;
}> => {
  // Check if IP is blocked
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
  const clientIP = req.ip || req.connection.remoteAddress;

  if (clientIP && blockedIPs.includes(clientIP)) {
    return {
      valid: false,
      reason: 'IP address blocked',
      statusCode: 403
    };
  }

  // Check user agent for suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /curl/i,
    /wget/i
  ];

  // Only block suspicious user agents on non-authenticated routes
  if (!req.headers.authorization && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return {
      valid: false,
      reason: 'Suspicious user agent',
      statusCode: 403
    };
  }

  return { valid: true };
};

// Export all security utilities
export {
  securityHeaders,
  corsConfig,
  authLimiter,
  generalLimiter,
  uploadLimiter,
  apiLimiter,
  sanitizeInput,
  validateApiKey,
  requestSizeLimiter,
  preventSqlInjection,
  securityLogger,
  addSecurityHeaders
};