import { Request, Response } from 'express';

export interface ServiceConfig {
  name: string;
  target: string;
  path: string;
  healthCheck: string;
  timeout: number;
  retries: number;
  circuitBreaker: CircuitBreakerConfig;
  auth: boolean;
  rateLimit?: RateLimitOverride;
  cache?: CacheConfig;
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface RateLimitOverride {
  windowMs?: number;
  max?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    algorithms: string[];
    audience: string;
    issuer: string;
  };
  apiKeys: {
    headerName: string;
    queryParam: string;
  };
  oauth: {
    providers: Record<string, OAuthProvider>;
  };
}

export interface OAuthProvider {
  clientId: string;
  clientSecret: string;
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
  scopes: string[];
}

export interface LoggingConfig {
  level: string;
  format: string;
  colorize: boolean;
  timestamp: boolean;
  file: {
    enabled: boolean;
    filename: string;
    maxSize: string;
    maxFiles: number;
  };
  console: {
    enabled: boolean;
  };
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  prefix: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
}

export interface GatewayConfig {
  port: number;
  services: ServiceConfig[];
  rateLimit: RateLimitConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  cache: CacheConfig;
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
  };
  compression: {
    level: number;
    threshold: number;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: RateLimitOverride;
  };
}

export interface ProxyRequest extends AuthenticatedRequest {
  correlationId?: string;
  startTime?: number;
}

export interface ServiceHealth {
  name: string;
  healthy: boolean;
  responseTime: number;
  lastCheck: Date;
  error?: string;
}

export interface APIUsage {
  userId?: string;
  apiKeyId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip: string;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
}

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: Array<Record<string, string[]>>;
}

export interface BillingMetrics {
  userId: string;
  period: string;
  requests: number;
  computeUnits: number;
  cost: number;
  quota: number;
  overage: number;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  enabled: boolean;
  channels: string[];
}

export interface MonitoringMetrics {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
}