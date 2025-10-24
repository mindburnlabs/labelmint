import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { bodyValidator } from 'express-validator';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { SecurityService } from '../services/security';
import { MetricsService } from '../services/metrics';
import config from '../config';

const logger = new Logger('Security');

// Redis client for rate limiting
const redis = new Redis({
  host: config.REDIS_HOST,
  port: parseInt(config.REDIS_PORT || '6379'),
  password: config.REDIS_PASSWORD,
  keyPrefix: 'security:',
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
});

// SQL Injection patterns
const SQL_PATTERNS = [
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|EXEC(UTE)?\s*\(|EXECUTE\s+@\w+|INSERT(\s+INTO)?|REPLACE(\s+INTO)?|SELECT(\s+DISTINCT)?|TRUNCATE|UNION(\s+ALL)?|UPDATE)\b)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /(--|;|\/\*|\*\/|@@|@|CHAR|NCHAR|VARCHAR|NVARCHAR|ALTER|BEGIN|CAST|CREATE|CURSOR|DECLARE|DELETE|DENY|DISK|DROP|END|EXECUTE|FETCH|FILE|FILL|FUNCTION|GRANT|INSERT|KEY|KILL|OPEN|PRINT|READ|RESTORE|REVOKE|ROLLBACK|SAVE|SELECT|SET|SHUTDOWN|TABLE|TRUNCATE|UNION|UPDATE|VIEW|WITH)\b)/gi,
  /((\%27)|(')|(--)|(\)|(\b(OR|AND)\b.*=.*\b(OR|AND)\b.*=)|(\bEXEC\b.*\b(UTL|FILE|INTRA|HTTP|JAVAX|SHELL)))/gi,
  /(\b(OR|AND)\s+(\d+|\'\w+\')\s*=\s*(\d+|\'\w+\'))/gi
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<svg[^>]*on\w+\s*=.*?>/gi,
  /(\(|\)|\{|\}|\[|\])/gi
];

// NoSQL injection patterns
const NOSQL_PATTERNS = [
  /\$where.*\{.*\$.*\}/gi,
  /\$ne.*null/gi,
  /\$in.*\[.*\]/gi,
  /\$regex.*\/.*\/[gimsuy]*/gi,
  /\$where.*\$regex/gi,
  /\{.*\$where.*\}/gi
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/gi,
  /\.\.[\/\\]\.[\/\\]/gi,
  /\.\.[\/\\]\.[\/\\]\.[\/\\]/gi,
  /%2e%2f%2e/i,
  /%2e%5c%2e/i,
  /[\/\\]\.\.[\/\\]/gi,
  /[\/\\]\.\.[\/\\]\.\.[\/\\]/gi
];

class SecurityMiddleware {
  private static readonly maliciousIPs = new Set();
  private static readonly suspiciousUserAgents = new Map<string, number>();

  // Helmet configuration
  static helmetMiddleware() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
            "https://www.google-analytics.com",
            "https://www.googletagmanager.com"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "https://*.labelmintit.com",
            "https://*.amazonaws.com"
          ],
          connectSrc: [
            "'self'",
            "wss:",
            "https://api.stripe.com",
            "https://api.openai.com",
            "https://www.google-analytics.com"
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          childSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          reportTo: [
            "https://sentry.io/api/12345/security/"
          ],
          reportUri: [
            "https://sentry.io/api/12345/security/"
          ]
        },
        reportOnly: process.env.NODE_ENV === 'production' ? false : true
      },

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: { policy: "require-corp" },

      // Cross-Origin Opener Policy
      crossOriginOpenerPolicy: { policy: "same-origin" },

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: [{ policy: "cross-origin" }],

      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },

      // Expected CT
      expectCt: {
        maxAge: 86400,
        enforce: true
      },

      // Feature Policy
      permittedCrossDomainPolicies: false,

      // Hide Powered-By
      hidePoweredBy: true,

      // Hide X-Powered-By
      xPoweredBy: false,

      // HSTS
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // IE Compatibility
      ieNoOpen: true,

      // No Sniff
      noSniff: true,

      // Origin Agent Cluster
      originAgentCluster: true,

      // Referrer Policy
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin"
      },

      // X-Content-Type-Options
      xContentTypeOptions: {
        nosniff: true
      },

      // X-DNS-Prefetch-Control
      xDnsPrefetchControl: {
        allow: false
      },

      // X-Download-Options
      xDownloadOptions: {
        noopen: true
      },

      // X-Frame-Options
      xFrameOptions: {
        action: 'deny'
      },

      // X-Permitted-Cross-Domain-Policies
      permittedCrossDomainPolicies: false,

      // X-XSS-Protection
      xXssProtection: {
        mode: "block",
        reportUri: "/report-xss"
      }
    });
  }

  // Rate limiting with Redis
  static rateLimitMiddleware(options: {
    windowMs?: number;
    max?: number;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: Request) => string;
  } = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      skipSuccessfulRequests = false,
      keyGenerator = (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      }
    } = options;

    return {
      name: 'security-rate-limit',
      async middleware(req: Request, res: Response, next: NextFunction) {
        const key = keyGenerator(req);
        const identifier = `rate-limit:${key}`;

        try {
          const current = await redis.get(identifier);
          const requests = current ? parseInt(current) : 0;

          if (requests >= max) {
            MetricsService.recordError('rate_limit_exceeded', 'warning', 'security');
            logger.warn('Rate limit exceeded', {
              key,
              ip: req.ip,
              requests,
              path: req.path,
              userAgent: req.get('User-Agent')
            });

            // Store attempt for analysis
            await redis.zadd(
              'rate-limit:attempts',
              Date.now(),
              `${key}:${Date.now()}`
            );
            await redis.expire('rate-limit:attempts', 24 * 60 * 60); // 24 hours

            return res.status(429).json({
              error: 'Too many requests',
              message: 'Rate limit exceeded',
              retryAfter: Math.ceil(windowMs / 1000),
              limit: max,
              windowMs
            });
          }

          // Increment counter
          await redis.incr(identifier);
          await redis.expire(identifier, Math.ceil(windowMs / 1000));

          // Add rate limit headers
          res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': Math.max(0, max - requests - 1),
            'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
          });

          next();
        } catch (error) {
          logger.error('Rate limit error', error);
          next();
        }
      }
    };
  }

  // Request validation middleware
  static requestValidation() {
    return {
      name: 'security-request-validation',
      middleware(req: Request, res: Response, next: NextFunction) {
        let isSuspicious = false;
        const violations: string[] = [];

        // Validate request size
        const contentLength = req.headers['content-length'];
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
          violations.push('Request too large');
          isSuspicious = true;
        }

        // Check for common attack patterns in URL
        const url = decodeURIComponent(req.url || '');
        if (this.checkMaliciousPatterns(url)) {
          violations.push('Malicious URL pattern detected');
          isSuspicious = true;
          MetricsService.recordError('malicious_url', 'warning', 'security');
        }

        // Validate headers
        const suspiciousHeaders = this.checkSuspiciousHeaders(req);
        if (suspiciousHeaders.length > 0) {
          violations.push(...suspiciousHeaders);
          isSuspicious = true;
        }

        // Check user agent
        const userAgent = req.get('User-Agent');
        if (userAgent) {
          const count = SecurityMiddleware.suspiciousUserAgents.get(userAgent) || 0;
          SecurityMiddleware.suspiciousUserAgents.set(userAgent, count + 1);

          // Bot detection
          if (this.isBotUserAgent(userAgent)) {
            violations.push('Suspicious user agent');
            isSuspicious = true;
          }
        }

        // Check IP reputation
        const ip = req.ip || req.connection.remoteAddress;
        if (ip && SecurityMiddleware.maliciousIPs.has(ip)) {
          violations.push('Malicious IP');
          isSuspicious = true;
          MetricsService.recordError('malicious_ip', 'critical', 'security', ip);
        }

        // Check for suspicious request patterns
        if (this.checkSuspiciousPatterns(req)) {
          violations.push('Suspicious request pattern');
          isSuspicious = true;
        }

        // Store security context
        (req as any).security = {
          isSuspicious,
          violations,
          riskScore: this.calculateRiskScore(req, violations)
        };

        // Log suspicious requests
        if (isSuspicious) {
          logger.warn('Suspicious request detected', {
            ip,
            userAgent,
            url: req.url,
            method: req.method,
            violations,
            body: req.body ? '[REDACTED]' : undefined
          });

          // Consider blocking or additional verification
          if ((req as any).security.riskScore > 80) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Request blocked by security policy'
            });
          }
        }

        next();
      }
    };
  }

  // SQL Injection protection
  static sqlInjectionProtection() {
    return {
      name: 'security-sql-injection',
      middleware(req: Request, res: Response, next: NextFunction) {
        // Check request parameters
        const suspiciousInputs: string[] = [];

        const checkValue = (value: any, path: string) => {
          if (typeof value === 'string') {
            for (const pattern of SQL_PATTERNS) {
              if (pattern.test(value)) {
                suspiciousInputs.push(`${path}: ${value}`);
                return true;
              }
            }
          } else if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value).split(',').some((v, i) => checkValue(v, `${path}[${i}]`));
          }
          return false;
        };

        // Check query parameters
        for (const [key, value] of Object.entries(req.query)) {
          if (checkValue(value, `query.${key}`)) {
            MetricsService.recordError('sql_injection_attempt', 'critical', 'security', key);
          }
        }

        // Check body parameters
        if (req.body) {
          for (const [key, value] of Object.entries(req.body)) {
            if (checkValue(value, `body.${key}`)) {
              MetricsService.recordError('sql_injection_attempt', 'critical', 'security', key);
            }
          }
        }

        // Check URL parameters
        const urlParts = req.url.split('?')[1];
        if (urlParts) {
          const params = new URLSearchParams(urlParts);
          for (const [key, value] of params) {
            if (checkValue(value, `url.${key}`)) {
              MetricsService.recordError('sql_injection_attempt', 'critical', 'security', key);
            }
          }
        }

        if (suspiciousInputs.length > 0) {
          logger.error('SQL injection attempt detected', {
            ip: req.ip,
            suspiciousInputs,
            url: req.url,
            method: req.method
          });

          return res.status(400).json({
            error: 'Invalid request',
            message: 'SQL injection detected'
          });
        }

        next();
      }
    };
  }

  // XSS Protection
  static xssProtection() {
    return {
      name: 'security-xss',
      middleware(req: Request, res: Response, next: NextFunction) {
        // Check for XSS in request inputs
        const checkForXSS = (value: any, path: string): boolean => {
          if (typeof value === 'string') {
            for (const pattern of XSS_PATTERNS) {
              if (pattern.test(value)) {
                logger.warn('XSS attempt detected', {
                  ip: req.ip,
                  path: `.${path}`,
                  value: value.substring(0, 100)
                });
                MetricsService.recordError('xss_attempt', 'critical', 'security', path);
                return true;
              }
            }
          } else if (typeof value === 'object') {
            return Object.values(value).some(v => checkForXSS(v, path));
          }
          return false;
        };

        let xssDetected = false;

        // Check query parameters
        for (const [key, value] of Object.entries(req.query)) {
          if (checkForXSS(value, `query.${key}`)) {
            xssDetected = true;
          }
        }

        // Check body parameters
        if (req.body) {
          for (const [key, value] of Object.entries(req.body)) {
            if (checkForXSS(value, `body.${key}`)) {
              xssDetected = true;
            }
          }
        }

        if (xssDetected) {
          return res.status(400).json({
            error: 'Invalid request',
            message: 'XSS detected'
          });
        }

        next();
      }
    };
  }

  // Request size limiting
  static requestSizeLimit() {
    return {
      name: 'security-size-limit',
      middleware(req: Request, res: Response, next: NextFunction) {
        const contentLength = req.headers['content-length'];
        const maxSize = config.MAX_REQUEST_SIZE || 10 * 1024 * 1024; // 10MB

        if (contentLength && parseInt(contentLength) > maxSize) {
          logger.warn('Request size limit exceeded', {
            ip: req.ip,
            size: contentLength,
            maxSize
          });

          MetricsService.recordError('request_too_large', 'warning', 'security');

          return res.status(413).json({
            error: 'Request entity too large',
            message: `Maximum request size is ${maxSize} bytes`
          });
        }

        next();
      }
    };
  }

  // Slow request protection
  static slowDownProtection() {
    return slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // Allow 50 fast requests
      delayMs: 500 // Add 500ms delay after limit
    });
  }

  // Private helper methods
  private static checkMaliciousPatterns(input: string): boolean {
    const maliciousPatterns = [
      /\.\.[\/\\]/, // Path traversal
      /(\.\.)/, // Double extension
      /[<>\"'{}|]/, // HTML injection
      /((\%3C)|<)[^\n]+((\%3E)|>)/i, // URL encoded tags
      /((\%27)|')|((\%3D)|=)/i, // URL encoded quotes and equals
      /(\b(CMD|COMMAND|SYSTEM|SHELL|EXEC|EVAL)\b)/i, // Command injection
      /(\b(PASSWORD|PASS|SECRET|KEY|TOKEN)\b)/i, // Password exposure attempts
    ];

    return maliciousPatterns.some(pattern => pattern.test(input));
  }

  private static checkSuspiciousHeaders(req: Request): string[] {
    const suspiciousHeaders: string[] = [];

    // Check for suspicious header values
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i
    ];

    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && suspiciousPatterns.some(p => p.test(value))) {
        suspiciousHeaders.push(`Header ${name} contains suspicious content`);
      }
    }

    return suspiciousHeaders;
  }

  private static isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /go-http/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  private static checkSuspiciousPatterns(req: Request): boolean {
    const suspiciousPatterns = [
      // Check for encoded content
      /(%[0-9A-Fa-f]{2})+/g,
      // Check for comment syntax in URLs
      /\/\*.*?\*\//g,
      // Check for command injection
      /[;&|`]/,
      // Check for null bytes
      /\x00/,
      // Check for Unicode attacks
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/,
      // Check for bypass attempts
      /admin\/?/i,
      /\.php$/.test(req.path),
      /\.asp$/.test(req.path),
      /\.jsp$/.test(req.path)
    ];

    const fullRequest = `${req.method} ${req.url}`;
    return suspiciousPatterns.some(pattern => pattern.test(fullRequest));
  }

  private static calculateRiskScore(req: Request, violations: string[]): number {
    let score = 0;

    // Base score for any violation
    if (violations.length > 0) {
      score += 20 * violations.length;
    }

    // Score based on request method
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      score += 10;
    }

    // Score based on path
    const highRiskPaths = /\/admin|\/api|\/user|\/auth|\/config/i;
    if (highRiskPaths.test(req.path)) {
      score += 15;
    }

    // Score based on time of day (requests at unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 10;
    }

    // Score based on request frequency from IP
    // This would require tracking previous requests
    // For now, we'll assume moderate risk
    score += 5;

    return Math.min(score, 100);
  }
}

export default SecurityMiddleware;