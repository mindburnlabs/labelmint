import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { createHash, timingSafeEqual } from 'crypto';
import securityConfig from '../../config/security';
import { logger } from '../../utils/logger';

/**
 * Security Middleware Factory
 * Provides comprehensive security middleware for API Gateway
 */
export class SecurityMiddleware {
  private config = securityConfig;

  /**
   * Apply Helmet.js security headers
   */
  helmet() {
    return helmet({
      contentSecurityPolicy: this.config.headers.contentSecurityPolicy ? {
        directives: {
          defaultSrc: this.config.headers.contentSecurityPolicyConfig.defaultSrc,
          scriptSrc: this.config.headers.contentSecurityPolicyConfig.scriptSrc,
          styleSrc: this.config.headers.contentSecurityPolicyConfig.styleSrc,
          imgSrc: this.config.headers.contentSecurityPolicyConfig.imgSrc,
          connectSrc: this.config.headers.contentSecurityPolicyConfig.connectSrc,
          fontSrc: this.config.headers.contentSecurityPolicyConfig.fontSrc,
          objectSrc: this.config.headers.contentSecurityPolicyConfig.objectSrc,
          mediaSrc: this.config.headers.contentSecurityPolicyConfig.mediaSrc,
          frameSrc: this.config.headers.contentSecurityPolicyConfig.frameSrc,
          upgradeInsecureRequests: this.config.tls.forceHTTPS ? [] : undefined
        }
      } : false,
      crossOriginEmbedderPolicy: this.config.headers.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: this.config.headers.crossOriginOpenerPolicy,
      crossOriginResourcePolicy: this.config.headers.crossOriginResourcePolicy ? { policy: "cross-origin" } : false,
      referrerPolicy: { policy: this.config.headers.referrerPolicy as any },
      permissionsPolicy: this.config.headers.permissionsPolicy,
      hsts: this.config.tls.enabled ? {
        maxAge: this.config.tls.hstsMaxAge,
        includeSubDomains: this.config.tls.hstsIncludeSubDomains,
        preload: this.config.tls.hstsPreload
      } : false
    });
  }

  /**
   * CORS middleware with production configuration
   */
  cors() {
    if (!this.config.cors.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is allowed
        const allowedOrigins = this.config.cors.allowedOrigins;
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS violation', { origin, allowedOrigins });
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: this.config.cors.allowedMethods,
      allowedHeaders: this.config.cors.allowedHeaders,
      exposedHeaders: this.config.cors.exposedHeaders,
      credentials: this.config.cors.credentials,
      maxAge: this.config.cors.maxAge,
      preflightContinue: this.config.cors.preflightContinue,
      optionsSuccessStatus: this.config.cors.optionsSuccessStatus
    });
  }

  /**
   * Force HTTPS redirect
   */
  forceHTTPS() {
    if (!this.config.tls.forceHTTPS) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      // Check if the request is already HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }

      // Redirect to HTTPS
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.warn('Redirecting HTTP to HTTPS', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        originalUrl: req.url,
        redirectUrl: httpsUrl
      });

      res.redirect(301, httpsUrl);
    };
  }

  /**
   * IP filtering middleware
   */
  ipFiltering() {
    if (!this.config.ipFiltering.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);

      // Check blocklist first
      if (this.config.ipFiltering.blocklist.length > 0) {
        const isBlocked = this.config.ipFiltering.blocklist.some(allowedIP =>
          this.ipMatches(clientIP, allowedIP)
        );

        if (isBlocked) {
          logger.warn('IP blocked by blocklist', { ip: clientIP, userAgent: req.get('User-Agent') });
          return res.status(403).json({
            error: {
              code: 'IP_BLOCKED',
              message: 'Access denied from this IP address'
            }
          });
        }
      }

      // Check allowlist if configured
      if (this.config.ipFiltering.allowlist.length > 0) {
        const isAllowed = this.config.ipFiltering.allowlist.some(allowedIP =>
          this.ipMatches(clientIP, allowedIP)
        );

        if (!isAllowed) {
          logger.warn('IP not in allowlist', { ip: clientIP, userAgent: req.get('User-Agent') });
          return res.status(403).json({
            error: {
              code: 'IP_NOT_ALLOWED',
              message: 'Access denied from this IP address'
            }
          });
        }
      }

      // Geolocation filtering (simplified)
      if (this.config.ipFiltering.enableGeolocation) {
        const country = this.getIPCountry(req);
        if (country) {
          if (this.config.ipFiltering.blockedCountries.includes(country)) {
            logger.warn('Country blocked', { ip: clientIP, country });
            return res.status(403).json({
              error: {
                code: 'COUNTRY_BLOCKED',
                message: 'Access denied from this location'
              }
            });
          }

          if (this.config.ipFiltering.allowedCountries.length > 0 &&
              !this.config.ipFiltering.allowedCountries.includes(country)) {
            logger.warn('Country not allowed', { ip: clientIP, country });
            return res.status(403).json({
              error: {
                code: 'COUNTRY_NOT_ALLOWED',
                message: 'Access denied from this location'
              }
            });
          }
        }
      }

      next();
    };
  }

  /**
   * Request size and method validation
   */
  requestValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate HTTP method
      if (!this.config.validation.allowedMethods.includes(req.method)) {
        logger.warn('Method not allowed', { method: req.method, ip: req.ip });
        return res.status(405).json({
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${req.method} is not allowed`
          }
        });
      }

      // Validate URL length
      if (req.url.length > this.config.validation.maxUrlLength) {
        logger.warn('URL too long', { url: req.url, length: req.url.length, ip: req.ip });
        return res.status(414).json({
          error: {
            code: 'URL_TOO_LONG',
            message: 'Request URL exceeds maximum length'
          }
        });
      }

      // Validate request size
      const contentLength = req.get('Content-Length');
      if (contentLength && parseInt(contentLength) > this.config.validation.maxRequestSize) {
        logger.warn('Request too large', {
          size: contentLength,
          maxSize: this.config.validation.maxRequestSize,
          ip: req.ip
        });
        return res.status(413).json({
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request size exceeds maximum allowed size of ${this.config.validation.maxRequestSize} bytes`
          }
        });
      }

      next();
    };
  }

  /**
   * CSRF protection for state-changing requests
   */
  csrfProtection() {
    if (!this.config.validation.enableCSRFProtection) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for safe methods
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      if (safeMethods.includes(req.method)) {
        return next();
      }

      // Skip CSRF for API requests with proper authentication
      if (req.headers.authorization || req.headers[this.config.apiKeys.headerName]) {
        return next();
      }

      const csrfToken = req.get('X-CSRF-Token') || req.body._csrf;
      const sessionToken = req.session?.csrfToken;

      if (!csrfToken || !sessionToken || !timingSafeEqual(Buffer.from(csrfToken), Buffer.from(sessionToken))) {
        logger.warn('CSRF token validation failed', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.url
        });
        return res.status(403).json({
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token validation failed'
          }
        });
      }

      next();
    };
  }

  /**
   * Webhook signature verification
   */
  webhookVerification() {
    if (!this.config.webhooks.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const signature = req.get(this.config.webhooks.signatureHeader);
      const timestamp = req.get('X-Webhook-Timestamp');

      if (!signature || !timestamp) {
        logger.warn('Missing webhook signature or timestamp', {
          ip: req.ip,
          signature: !!signature,
          timestamp: !!timestamp
        });
        return res.status(401).json({
          error: {
            code: 'WEBHOOK_AUTHENTICATION_FAILED',
            message: 'Missing webhook signature or timestamp'
          }
        });
      }

      // Verify timestamp is within tolerance
      const webhookTime = parseInt(timestamp);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - webhookTime) > this.config.webhooks.toleranceSeconds) {
        logger.warn('Webhook timestamp outside tolerance', {
          webhookTime,
          now,
          tolerance: this.config.webhooks.toleranceSeconds
        });
        return res.status(401).json({
          error: {
            code: 'WEBHOOK_TIMESTAMP_INVALID',
            message: 'Webhook timestamp is outside allowed tolerance'
          }
        });
      }

      // Verify signature (implementation depends on webhook provider)
      if (!this.verifyWebhookSignature(req, signature, timestamp)) {
        logger.warn('Invalid webhook signature', {
          ip: req.ip,
          signature: signature.substring(0, 20) + '...'
        });
        return res.status(401).json({
          error: {
            code: 'WEBHOOK_SIGNATURE_INVALID',
            message: 'Invalid webhook signature'
          }
        });
      }

      next();
    };
  }

  /**
   * Request signing verification for service-to-service communication
   */
  requestSigningVerification() {
    if (!this.config.gateway.enableRequestSigning) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const signature = req.get('X-Request-Signature');
      const timestamp = req.get('X-Request-Timestamp');
      const requestId = req.get('X-Request-ID');

      if (!signature || !timestamp || !requestId) {
        logger.warn('Missing request signing headers', {
          signature: !!signature,
          timestamp: !!timestamp,
          requestId: !!requestId,
          ip: req.ip
        });
        return res.status(401).json({
          error: {
            code: 'REQUEST_SIGNATURE_MISSING',
            message: 'Request signature verification failed'
          }
        });
      }

      // Verify timestamp is recent (prevent replay attacks)
      const requestTime = parseInt(timestamp);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - requestTime) > 300) { // 5 minutes
        logger.warn('Request timestamp too old', { requestTime, now });
        return res.status(401).json({
          error: {
            code: 'REQUEST_TIMESTAMP_INVALID',
            message: 'Request timestamp is too old'
          }
        });
      }

      // Verify signature (simplified implementation)
      const payload = `${requestId}${timestamp}${JSON.stringify(req.body)}`;
      const expectedSignature = this.generateRequestSignature(payload);

      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.warn('Invalid request signature', {
          requestId,
          ip: req.ip
        });
        return res.status(401).json({
          error: {
            code: 'REQUEST_SIGNATURE_INVALID',
            message: 'Invalid request signature'
          }
        });
      }

      next();
    };
  }

  /**
   * Security audit logging middleware
   */
  auditLogging() {
    if (!this.config.audit.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const auditData = {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || this.generateRequestId(),
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        userId: (req as any).user?.id,
        apiKeyId: (req as any).apiKey?.id,
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
      };

      // Log request body if enabled (be careful with sensitive data)
      if (this.config.audit.logRequestBodies && req.body) {
        auditData.body = this.sanitizeLogData(req.body);
      }

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const responseAuditData = {
          ...auditData,
          statusCode: res.statusCode,
          responseTime,
          success: res.statusCode < 400
        };

        // Log response body if enabled
        if (this.config.audit.logResponseBodies && args[0]) {
          responseAuditData.responseBody = this.sanitizeLogData(args[0]);
        }

        // Log based on configuration
        const shouldLog =
          this.config.audit.logAllRequests ||
          (res.statusCode >= 400 && this.config.audit.logFailedRequests) ||
          (res.statusCode < 400 && this.config.audit.logSuccessfulRequests);

        if (shouldLog) {
          logger.info('API request', responseAuditData);
        }

        // Check for suspicious activity
        this.checkSuspiciousActivity(responseAuditData);

        originalEnd.apply(this, args);
      }.bind({ config: this.config.audit, sanitizeLogData: this.sanitizeLogData.bind(this), checkSuspiciousActivity: this.checkSuspiciousActivity.bind(this) });

      next();
    };
  }

  /**
   * Helper methods
   */
  private getClientIP(req: Request): string {
    return (req.get('X-Forwarded-For') as string)?.split(',')[0]?.trim() ||
           req.get('X-Real-IP') ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
  }

  private ipMatches(ip: string, pattern: string): boolean {
    // Simple IP matching (can be enhanced with CIDR support)
    return ip === pattern || pattern === '*' || pattern.endsWith('.0') && ip.startsWith(pattern.slice(0, -1));
  }

  private getIPCountry(req: Request): string | null {
    // Simplified country detection (use proper geolocation service in production)
    return (req.get('CF-IPCountry') || req.get('X-Country') || null);
  }

  private generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      if (this.config.audit.sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private checkSuspiciousActivity(auditData: any): void {
    const suspiciousPatterns = [
      // SQL injection patterns
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,

      // XSS patterns
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,

      // Path traversal
      /\.\.\//,
      /%2e%2e%2f/i,

      // Command injection
      /[;&|`$()]/,
      /\$\(/,
    ];

    const url = auditData.url + JSON.stringify(auditData.query || {});
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

    if (isSuspicious) {
      logger.warn('Suspicious activity detected', {
        ...auditData,
        severity: 'high'
      });

      // In production, you might want to:
      // - Block the IP
      // - Send alerts to security team
      // - Add to monitoring dashboard
    }
  }

  private verifyWebhookSignature(req: Request, signature: string, timestamp: string): boolean {
    // This is a simplified implementation
    // In production, implement proper webhook signature verification
    // based on your webhook provider's specification
    return true;
  }

  private generateRequestSignature(payload: string): string {
    const secret = process.env.REQUEST_SIGNING_SECRET || 'default-secret';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}

export default SecurityMiddleware;