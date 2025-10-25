import dotenv from 'dotenv';

dotenv.config();

export interface SecurityConfig {
  // JWT Configuration
  jwt: {
    secret: string;
    algorithms: string[];
    audience: string;
    issuer: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    keyRotationDays: number;
    issuerKeys: string[];
  };

  // API Key Configuration
  apiKeys: {
    headerName: string;
    queryParam: string;
    keyLength: number;
    enableRotation: boolean;
    rotationDays: number;
    encryptionKey: string;
    allowedPrefixes: string[];
  };

  // Rate Limiting Configuration
  rateLimit: {
    enabled: boolean;
    globalLimit: number;
    windowMs: number;
    enableDistributed: boolean;
    enableBurstProtection: boolean;
    enableAdaptiveLimiting: boolean;
    enableBlocklisting: boolean;
    blocklistDuration: number;
    userTiers: {
      anonymous: { max: number; windowMs: number };
      authenticated: { max: number; windowMs: number };
      premium: { max: number; windowMs: number };
      enterprise: { max: number; windowMs: number };
      admin: { max: number; windowMs: number };
    };
  };

  // Input Validation Configuration
  validation: {
    enableInputSanitization: boolean;
    maxRequestSize: number;
    maxUrlLength: number;
    maxHeaderSize: number;
    allowedMethods: string[];
    allowedContentTypes: string[];
    enableXSSProtection: boolean;
    enableSQLInjectionProtection: boolean;
    enableCSRFProtection: boolean;
    csrfTokenExpiry: number;
  };

  // CORS Configuration
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
    preflightContinue: boolean;
    optionsSuccessStatus: number;
  };

  // SSL/TLS Configuration
  tls: {
    enabled: boolean;
    forceHTTPS: boolean;
    hstsMaxAge: number;
    hstsIncludeSubDomains: boolean;
    hstsPreload: boolean;
    cipherSuites: string[];
    minVersion: string;
    maxVersion: string;
  };

  // Security Headers Configuration
  headers: {
    contentSecurityPolicy: boolean;
    contentSecurityPolicyConfig: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      frameSrc: string[];
    };
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
    crossOriginResourcePolicy: boolean;
    referrerPolicy: string;
    permissionsPolicy: Record<string, boolean[]>;
  };

  // IP Filtering Configuration
  ipFiltering: {
    enabled: boolean;
    allowlist: string[];
    blocklist: string[];
    enableGeolocation: boolean;
    allowedCountries: string[];
    blockedCountries: string[];
    enableProxyDetection: boolean;
    blockTorExitNodes: boolean;
  };

  // Authentication Configuration
  auth: {
    enableJWT: boolean;
    enableAPIKeys: boolean;
    enableOAuth: boolean;
    enableMultiFactor: boolean;
    sessionTimeout: number;
    maxConcurrentSessions: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      preventCommonPasswords: boolean;
      preventUserInfoInclusion: boolean;
    };
  };

  // Audit and Logging Configuration
  audit: {
    enabled: boolean;
    logAllRequests: boolean;
    logFailedRequests: boolean;
    logSuccessfulRequests: boolean;
    logRequestBodies: boolean;
    logResponseBodies: boolean;
    sensitiveFields: string[];
    retentionDays: number;
    enableRealTimeAlerts: boolean;
    alertThresholds: {
      errorRate: number;
      failedAuthRate: number;
      unusualActivity: number;
    };
  };

  // Encryption Configuration
  encryption: {
    algorithm: string;
    keySize: number;
    ivSize: number;
    tagSize: number;
    keyRotationDays: number;
    enableFieldLevelEncryption: boolean;
    encryptedFields: string[];
  };

  // Webhook Security Configuration
  webhooks: {
    enabled: boolean;
    secretRotationDays: number;
    signatureAlgorithm: string;
    signatureHeader: string;
    toleranceSeconds: number;
    enableIPWhitelisting: boolean;
    allowedIPs: string[];
  };

  // API Gateway Specific Security
  gateway: {
    enableRequestSigning: boolean;
    enableResponseEncryption: boolean;
    enableServiceToServiceAuth: boolean;
    enableCircuitBreaker: boolean;
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
    enableRetry: boolean;
    maxRetries: number;
    retryDelay: number;
  };
}

const securityConfig: SecurityConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    algorithms: ['HS256', 'RS256'],
    audience: process.env.JWT_AUDIENCE || 'labelmint',
    issuer: process.env.JWT_ISSUER || 'labelmint-api',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    keyRotationDays: parseInt(process.env.JWT_KEY_ROTATION_DAYS || '30'),
    issuerKeys: (process.env.JWT_ISSUER_KEYS || '').split(',').filter(key => key.length > 0)
  },

  // API Key Configuration
  apiKeys: {
    headerName: process.env.API_KEY_HEADER || 'X-API-Key',
    queryParam: process.env.API_KEY_QUERY_PARAM || 'api_key',
    keyLength: parseInt(process.env.API_KEY_LENGTH || '32'),
    enableRotation: process.env.API_KEY_ENABLE_ROTATION === 'true',
    rotationDays: parseInt(process.env.API_KEY_ROTATION_DAYS || '90'),
    encryptionKey: process.env.API_KEY_ENCRYPTION_KEY || 'your-api-key-encryption-key-32-chars',
    allowedPrefixes: (process.env.API_KEY_ALLOWED_PREFIXES || 'lm_,prod_,dev_,test_').split(',')
  },

  // Rate Limiting Configuration
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    globalLimit: parseInt(process.env.RATE_LIMIT_GLOBAL || '1000'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    enableDistributed: process.env.RATE_LIMIT_DISTRIBUTED === 'true',
    enableBurstProtection: process.env.RATE_LIMIT_BURST_PROTECTION !== 'false',
    enableAdaptiveLimiting: process.env.RATE_LIMIT_ADAPTIVE === 'true',
    enableBlocklisting: process.env.RATE_LIMIT_BLOCKLISTING !== 'false',
    blocklistDuration: parseInt(process.env.RATE_LIMIT_BLOCKLIST_DURATION || '300000'),
    userTiers: {
      anonymous: {
        max: parseInt(process.env.RATE_LIMIT_ANONYMOUS || '100'),
        windowMs: parseInt(process.env.RATE_LIMIT_ANONYMOUS_WINDOW || '60000')
      },
      authenticated: {
        max: parseInt(process.env.RATE_LIMIT_AUTHENTICATED || '1000'),
        windowMs: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW || '60000')
      },
      premium: {
        max: parseInt(process.env.RATE_LIMIT_PREMIUM || '5000'),
        windowMs: parseInt(process.env.RATE_LIMIT_PREMIUM_WINDOW || '60000')
      },
      enterprise: {
        max: parseInt(process.env.RATE_LIMIT_ENTERPRISE || '10000'),
        windowMs: parseInt(process.env.RATE_LIMIT_ENTERPRISE_WINDOW || '60000')
      },
      admin: {
        max: parseInt(process.env.RATE_LIMIT_ADMIN || '20000'),
        windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW || '60000')
      }
    }
  },

  // Input Validation Configuration
  validation: {
    enableInputSanitization: process.env.VALIDATION_ENABLE_SANITIZATION !== 'false',
    maxRequestSize: parseInt(process.env.VALIDATION_MAX_REQUEST_SIZE || '10485760'), // 10MB
    maxUrlLength: parseInt(process.env.VALIDATION_MAX_URL_LENGTH || '2048'),
    maxHeaderSize: parseInt(process.env.VALIDATION_MAX_HEADER_SIZE || '8192'),
    allowedMethods: (process.env.VALIDATION_ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
    allowedContentTypes: (process.env.VALIDATION_ALLOWED_CONTENT_TYPES || 'application/json,application/x-www-form-urlencoded,multipart/form-data,text/plain').split(','),
    enableXSSProtection: process.env.VALIDATION_XSS_PROTECTION !== 'false',
    enableSQLInjectionProtection: process.env.VALIDATION_SQL_INJECTION_PROTECTION !== 'false',
    enableCSRFProtection: process.env.VALIDATION_CSRF_PROTECTION === 'true',
    csrfTokenExpiry: parseInt(process.env.VALIDATION_CSRF_EXPIRY || '3600')
  },

  // CORS Configuration
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    allowedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
    allowedMethods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
    allowedHeaders: (process.env.CORS_HEADERS || 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-API-Key,X-Correlation-ID').split(','),
    exposedHeaders: (process.env.CORS_EXPOSED_HEADERS || 'X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,X-Total-Count').split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
    preflightContinue: false,
    optionsSuccessStatus: 204
  },

  // SSL/TLS Configuration
  tls: {
    enabled: process.env.TLS_ENABLED === 'true',
    forceHTTPS: process.env.TLS_FORCE_HTTPS === 'true',
    hstsMaxAge: parseInt(process.env.TLS_HSTS_MAX_AGE || '31536000'), // 1 year
    hstsIncludeSubDomains: process.env.TLS_HSTS_INCLUDE_SUBDOMAINS !== 'false',
    hstsPreload: process.env.TLS_HSTS_PRELOAD === 'true',
    cipherSuites: (process.env.TLS_CIPHER_SUITES || 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256').split(','),
    minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
    maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3'
  },

  // Security Headers Configuration
  headers: {
    contentSecurityPolicy: process.env.HEADERS_CSP_ENABLED !== 'false',
    contentSecurityPolicyConfig: {
      defaultSrc: (process.env.CSP_DEFAULT_SRC || "'self'").split(','),
      scriptSrc: (process.env.CSP_SCRIPT_SRC || "'self' 'unsafe-inline' 'unsafe-eval'").split(','),
      styleSrc: (process.env.CSP_STYLE_SRC || "'self' 'unsafe-inline'").split(','),
      imgSrc: (process.env.CSP_IMG_SRC || "'self' data: https:").split(','),
      connectSrc: (process.env.CSP_CONNECT_SRC || "'self'").split(','),
      fontSrc: (process.env.CSP_FONT_SRC || "'self'").split(','),
      objectSrc: (process.env.CSP_OBJECT_SRC || "'none'").split(','),
      mediaSrc: (process.env.CSP_MEDIA_SRC || "'self'").split(','),
      frameSrc: (process.env.CSP_FRAME_SRC || "'none'").split(',')
    },
    crossOriginEmbedderPolicy: process.env.HEADERS_COEP === 'true',
    crossOriginOpenerPolicy: process.env.HEADERS_COOP === 'true',
    crossOriginResourcePolicy: process.env.HEADERS_CORP === 'true',
    referrerPolicy: process.env.HEADERS_REFERRER_POLICY || 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      geolocation: [false],
      camera: [false],
      microphone: [false],
      payment: [false],
      usb: [false],
      magnetometer: [false],
      gyroscope: [false],
      accelerometer: [false]
    }
  },

  // IP Filtering Configuration
  ipFiltering: {
    enabled: process.env.IP_FILTERING_ENABLED === 'true',
    allowlist: (process.env.IP_ALLOWLIST || '').split(',').filter(ip => ip.length > 0),
    blocklist: (process.env.IP_BLOCKLIST || '').split(',').filter(ip => ip.length > 0),
    enableGeolocation: process.env.IP_GEOLOCATION_ENABLED === 'true',
    allowedCountries: (process.env.IP_ALLOWED_COUNTRIES || '').split(',').filter(country => country.length > 0),
    blockedCountries: (process.env.IP_BLOCKED_COUNTRIES || '').split(',').filter(country => country.length > 0),
    enableProxyDetection: process.env.IP_PROXY_DETECTION === 'true',
    blockTorExitNodes: process.env.IP_BLOCK_TOR === 'true'
  },

  // Authentication Configuration
  auth: {
    enableJWT: process.env.AUTH_JWT_ENABLED !== 'false',
    enableAPIKeys: process.env.AUTH_API_KEYS_ENABLED !== 'false',
    enableOAuth: process.env.AUTH_OAUTH_ENABLED === 'true',
    enableMultiFactor: process.env.AUTH_MFA_ENABLED === 'true',
    sessionTimeout: parseInt(process.env.AUTH_SESSION_TIMEOUT || '3600'),
    maxConcurrentSessions: parseInt(process.env.AUTH_MAX_CONCURRENT_SESSIONS || '5'),
    passwordPolicy: {
      minLength: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8'),
      requireUppercase: process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE !== 'false',
      requireNumbers: process.env.AUTH_PASSWORD_REQUIRE_NUMBERS !== 'false',
      requireSpecialChars: process.env.AUTH_PASSWORD_REQUIRE_SPECIAL !== 'false',
      preventCommonPasswords: process.env.AUTH_PASSWORD_PREVENT_COMMON !== 'false',
      preventUserInfoInclusion: process.env.AUTH_PASSWORD_PREVENT_USERINFO !== 'false'
    }
  },

  // Audit and Logging Configuration
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logAllRequests: process.env.AUDIT_LOG_ALL_REQUESTS === 'true',
    logFailedRequests: process.env.AUDIT_LOG_FAILED_REQUESTS !== 'false',
    logSuccessfulRequests: process.env.AUDIT_LOG_SUCCESSFUL_REQUESTS === 'true',
    logRequestBodies: process.env.AUDIT_LOG_REQUEST_BODIES === 'true',
    logResponseBodies: process.env.AUDIT_LOG_RESPONSE_BODIES === 'false',
    sensitiveFields: (process.env.AUDIT_SENSITIVE_FIELDS || 'password,token,secret,key,authorization,credit_card,ssn').split(','),
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
    enableRealTimeAlerts: process.env.AUDIT_REAL_TIME_ALERTS === 'true',
    alertThresholds: {
      errorRate: parseFloat(process.env.AUDIT_ERROR_RATE_THRESHOLD || '0.05'), // 5%
      failedAuthRate: parseFloat(process.env.AUDIT_FAILED_AUTH_RATE_THRESHOLD || '0.1'), // 10%
      unusualActivity: parseFloat(process.env.AUDIT_UNUSUAL_ACTIVITY_THRESHOLD || '0.02') // 2%
    }
  },

  // Encryption Configuration
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    keySize: parseInt(process.env.ENCRYPTION_KEY_SIZE || '32'),
    ivSize: parseInt(process.env.ENCRYPTION_IV_SIZE || '16'),
    tagSize: parseInt(process.env.ENCRYPTION_TAG_SIZE || '16'),
    keyRotationDays: parseInt(process.env.ENCRYPTION_KEY_ROTATION_DAYS || '90'),
    enableFieldLevelEncryption: process.env.ENCRYPTION_FIELD_LEVEL_ENABLED === 'true',
    encryptedFields: (process.env.ENCRYPTION_FIELDS || 'email,phone,address,ssn,credit_card').split(',')
  },

  // Webhook Security Configuration
  webhooks: {
    enabled: process.env.WEBHOOKS_ENABLED === 'true',
    secretRotationDays: parseInt(process.env.WEBHOOKS_SECRET_ROTATION_DAYS || '30'),
    signatureAlgorithm: process.env.WEBHOOKS_SIGNATURE_ALGORITHM || 'sha256',
    signatureHeader: process.env.WEBHOOKS_SIGNATURE_HEADER || 'X-Webhook-Signature',
    toleranceSeconds: parseInt(process.env.WEBHOOKS_TOLERANCE_SECONDS || '300'),
    enableIPWhitelisting: process.env.WEBHOOKS_IP_WHITELISTING === 'true',
    allowedIPs: (process.env.WEBHOOKS_ALLOWED_IPS || '').split(',').filter(ip => ip.length > 0)
  },

  // API Gateway Specific Security
  gateway: {
    enableRequestSigning: process.env.GATEWAY_REQUEST_SIGNING === 'true',
    enableResponseEncryption: process.env.GATEWAY_RESPONSE_ENCRYPTION === 'true',
    enableServiceToServiceAuth: process.env.GATEWAY_SERVICE_AUTH === 'true',
    enableCircuitBreaker: process.env.GATEWAY_CIRCUIT_BREAKER !== 'false',
    circuitBreakerThreshold: parseInt(process.env.GATEWAY_CIRCUIT_THRESHOLD || '5'),
    circuitBreakerTimeout: parseInt(process.env.GATEWAY_CIRCUIT_TIMEOUT || '60000'),
    enableRetry: process.env.GATEWAY_RETRY_ENABLED !== 'false',
    maxRetries: parseInt(process.env.GATEWAY_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.GATEWAY_RETRY_DELAY || '1000')
  }
};

export default securityConfig;