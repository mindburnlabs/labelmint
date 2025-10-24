// ============================================================================
// API TYPES
// ============================================================================

import { PaginationResult, SortOptions } from './common';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: {
    pagination?: PaginationResult<T>;
    timestamp: Date;
    requestId?: string;
    version?: string;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: number;
    };
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
  requestId?: string;
}

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  user?: any;
  timestamp: Date;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface RequestContext {
  request: ApiRequest;
  user?: any;
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortQuery {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterQuery {
  [key: string]: any;
}

export interface SearchQuery {
  q?: string;
  fields?: string[];
}

export interface ApiQueryParams extends PaginationQuery, SortQuery, FilterQuery, SearchQuery {
  include?: string[];
  exclude?: string[];
}

export interface EndpointConfig {
  path: string;
  method: string;
  handler: string;
  middleware?: string[];
  permissions?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

export interface RouteConfig {
  prefix: string;
  endpoints: EndpointConfig[];
  middleware?: string[];
  permissions?: string[];
}

export interface SwaggerConfig {
  title: string;
  description: string;
  version: string;
  servers: Array<{
    url: string;
    description: string;
  }>;
  security: Array<{
    type: string;
    scheme: string;
  }>;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  skip?: (req: any) => boolean;
  onLimitReached?: (req: any, res: any) => void;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  keyPrefix: string;
  store?: 'memory' | 'redis' | 'memcached';
  storeOptions?: any;
  skip?: (req: any) => boolean;
  keyGenerator?: (req: any) => string;
}

export interface ValidationConfig {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
  custom?: (req: any) => any;
}

export interface MiddlewareConfig {
  name: string;
  path?: string;
  exclude?: string[];
  options?: any;
}

export interface SecurityConfig {
  cors?: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  helmet?: {
    contentSecurityPolicy?: any;
    crossOriginEmbedderPolicy?: boolean;
    crossOriginOpenerPolicy?: boolean;
    crossOriginResourcePolicy?: boolean;
    dnsPrefetchControl?: boolean;
    frameguard?: boolean;
    hidePoweredBy?: boolean;
    hsts?: any;
    ieNoOpen?: boolean;
    noSniff?: boolean;
    originAgentCluster?: boolean;
    permittedCrossDomainPolicies?: boolean;
    referrerPolicy?: any;
    xssFilter?: boolean;
  };
  compression?: {
    level?: number;
    threshold?: number;
    filter?: (req: any, res: any) => boolean;
  };
  trustProxy?: boolean | string | string[] | number;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'simple' | 'combined';
  streams?: Array<{
    level: string;
    stream: any;
  }>;
  file?: {
    filename: string;
    maxsize?: number;
    maxFiles?: number;
    tailable?: boolean;
  };
  console?: {
    enabled: boolean;
    colorize?: boolean;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  services: Record<string, {
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime?: number;
    error?: string;
    lastChecked: Date;
  }>;
  metrics?: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    eventLoopDelay: number;
  };
}

export interface MetricsData {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  customMetrics: Record<string, number>;
}

export interface ApiDocumentation {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name: string;
      url: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, any>;
    examples?: Record<string, any>;
    requestBodies?: Record<string, any>;
    headers?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<any>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: {
      description: string;
      url: string;
    };
  }>;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface WebSocketEvent {
  type: 'connected' | 'disconnected' | 'message' | 'error';
  data: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketConfig {
  path?: string;
  port?: number;
  server?: any;
  verifyClient?: (info: any) => boolean;
  compression?: boolean;
  maxPayload?: number;
  backpressure?: {
    limit: number;
    strategy: 'drop' | 'buffer' | 'error';
  };
}

export interface GraphQLConfig {
  schema: string;
  resolvers: string;
  context?: (req: any) => any;
  introspection?: boolean;
  playground?: boolean;
  tracing?: boolean;
  cache?: {
    enabled: boolean;
    ttl: number;
  };
  validationRules?: any[];
}

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
  interceptors?: {
    request?: (config: any) => any;
    response?: (response: any) => any;
    error?: (error: any) => any;
  };
}