import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// 1. Security Headers Middleware using Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// 2. Rate Limiting Configuration
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message || 'Too many requests',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        limit: options.max,
        windowMs: options.windowMs,
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// Predefined rate limiters
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again later'
});

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
  message: 'Too many requests, please try again later'
});

export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads
  message: 'Too many file uploads, please try again later'
});

export const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute for API
  message: 'API rate limit exceeded'
});

// 3. Input Validation Schemas
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  telegramId: z.string().regex(/^\d+$/, 'Invalid Telegram ID format'),
  address: z.string().min(1, 'Address cannot be empty'),
  amount: z.number().positive('Amount must be positive').max(1000000, 'Amount too large')
};

// 4. Input Validation Middleware
export const validateInput = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);
      req[source] = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
};

// 5. Sanitization Middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Basic XSS prevention
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

// 6. CORS Configuration
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://labelmint.io',
      'https://app.labelmint.io'
    ];

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Limit', 'X-Rate-Limit-Remaining']
};

// 7. IP-based Rate Limiting
const ipRequests = new Map<string, { count: number; resetTime: number }>();

export const ipBasedLimiter = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || '';
    const now = Date.now();
    const windowStart = now - windowMs;

    const ipData = ipRequests.get(ip);

    if (!ipData || ipData.resetTime < now) {
      ipRequests.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (ipData.count >= maxRequests) {
      res.status(429).json({
        error: 'IP rate limit exceeded',
        limit: maxRequests,
        windowMs,
        resetTime: ipData.resetTime
      });
      return;
    }

    ipData.count++;
    next();
  };
};

// 8. API Key Validation
export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    // If no API key, check for JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'API key or Bearer token required' });
      return;
    }
    next();
    return;
  }

  try {
    // Validate API key against database
    const validKey = await validateApiKeyInDb(apiKey);
    if (!validKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Attach user info from API key
    req.user = {
      id: validKey.user_id,
      email: validKey.user?.email || '',
      role: validKey.user?.role || 'user'
    };

    // Update last used timestamp
    await updateApiKeyLastUsed(apiKey);

    next();
  } catch (error) {
    res.status(500).json({ error: 'API key validation failed' });
  }
};

// Helper function to validate API key (implement based on your DB)
async function validateApiKeyInDb(apiKey: string): Promise<any> {
  // Implementation depends on your database setup
  // This is a placeholder
  return null;
}

// Helper function to update API key last used
async function updateApiKeyLastUsed(apiKey: string): Promise<void> {
  // Implementation depends on your database setup
  // This is a placeholder
}

// 9. Request Size Limiter
export const requestSizeLimiter = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength) > maxSize) {
      res.status(413).json({
        error: 'Request entity too large',
        maxSize: maxSize,
        receivedSize: contentLength
      });
      return;
    }

    next();
  };
};

// 10. SQL Injection Prevention
export const preventSqlInjection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UPDATE)\b)/gi,
    /(\b(UNION|OR)\b)/gi,
    /(--|;|\/\*|\*\/)/g,
    /(\b(SCRIPT|OBJECT|XPATH)\b)/gi
  ];

  const checkForSqlInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    } else if (Array.isArray(obj)) {
      return obj.some(checkForSqlInjection);
    } else if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForSqlInjection);
    }
    return false;
  };

  if (checkForSqlInjection(req.body) || checkForSqlInjection(req.query)) {
    res.status(400).json({ error: 'Invalid request detected' });
    return;
  }

  next();
};

// 11. Request Logger for Security Monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log sensitive endpoints
    const sensitivePaths = ['/auth', '/admin', '/api/keys'];
    const isSensitive = sensitivePaths.some(path => req.path.startsWith(path));

    if (isSensitive || res.statusCode >= 400) {
      console.log(`[SECURITY] ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        duration,
        sensitive: isSensitive
      });
    }
  });

  next();
};

// 12. Response Security Headers
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};