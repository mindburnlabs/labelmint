import dotenv from 'dotenv';
import { GatewayConfig } from '@types/index';

dotenv.config();

const config: GatewayConfig = {
  port: parseInt(process.env.GATEWAY_PORT || '3002', 10),

  services: [
    {
      name: 'labeling',
      target: process.env.LABELING_SERVICE_URL || 'http://localhost:3001',
      path: '/api/v1/labeling',
      healthCheck: process.env.LABELING_HEALTH_CHECK || 'http://localhost:3001/health',
      timeout: 30000,
      retries: 3,
      circuitBreaker: {
        threshold: 5,
        timeout: 60000,
        resetTimeout: 30000
      },
      auth: true,
      rateLimit: {
        max: 1000,
        windowMs: 60000
      }
    },
    {
      name: 'payment',
      target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3000',
      path: '/api/v1/payment',
      healthCheck: process.env.PAYMENT_HEALTH_CHECK || 'http://localhost:3000/health',
      timeout: 30000,
      retries: 3,
      circuitBreaker: {
        threshold: 5,
        timeout: 60000,
        resetTimeout: 30000
      },
      auth: true,
      rateLimit: {
        max: 500,
        windowMs: 60000
      }
    },
    {
      name: 'public',
      target: process.env.LABELING_SERVICE_URL || 'http://localhost:3001',
      path: '/api/v1/public',
      healthCheck: process.env.LABELING_HEALTH_CHECK || 'http://localhost:3001/health',
      timeout: 10000,
      retries: 1,
      circuitBreaker: {
        threshold: 3,
        timeout: 30000,
        resetTimeout: 15000
      },
      auth: false,
      rateLimit: {
        max: 100,
        windowMs: 60000
      },
      cache: {
        enabled: true,
        ttl: 300
      }
    }
  ],

  rateLimit: {
    windowMs: 60000,
    max: 100,
    message: {
      error: 'Too many requests',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      algorithms: ['HS256'],
      audience: process.env.JWT_AUDIENCE || 'labelmint',
      issuer: process.env.JWT_ISSUER || 'labelmint-api'
    },
    apiKeys: {
      headerName: 'X-API-Key',
      queryParam: 'api_key'
    },
    oauth: {
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenURL: 'https://oauth2.googleapis.com/token',
          userInfoURL: 'https://www.googleapis.com/oauth2/v2/userinfo',
          scopes: ['openid', 'email', 'profile']
        }
      }
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    colorize: process.env.NODE_ENV !== 'production',
    timestamp: true,
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      filename: process.env.LOG_FILE_PATH || './logs/gateway.log',
      maxSize: '10m',
      maxFiles: 5
    },
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false'
    }
  },

  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '300', 10),
    prefix: process.env.CACHE_PREFIX || 'labelmint:',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'gateway:'
    }
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Correlation-ID'
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
  },

  compression: {
    level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10)
  },

  helmet: {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false
  }
};

export default config;