// ============================================================================
// COMMON TYPES AND UTILITIES
// ============================================================================

export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  message?: string
  pagination?: PaginationInfo
  metadata?: Record<string, any>
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  stack?: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SortOptions {
  field: string
  order: 'asc' | 'desc'
}

export interface FilterOptions {
  [key: string]: any
}

export interface QueryOptions {
  page?: number
  limit?: number
  sort?: SortOptions
  filter?: FilterOptions
  search?: string
  fields?: string[]
}

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  pool?: {
    min: number
    max: number
    idleTimeoutMillis: number
    connectionTimeoutMillis: number
  }
}

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db: number
  keyPrefix?: string
  retryDelayOnFailover: number
  maxRetriesPerRequest: number
}

export interface ServerConfig {
  port: number
  host: string
  cors: {
    origin: string[]
    credentials: boolean
  }
  rateLimit: {
    windowMs: number
    max: number
    message: string
  }
  compression: boolean
  bodyLimit: string
  querystringLimit: string
}

export interface TonConfig {
  testnet: boolean
  apiKey?: string
  endpoint: string
  lsEndpoint: string
  configServer: string
  workchain: number
}

// ============================================================================
// LOGGING AND MONITORING
// ============================================================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: string
  userId?: string
  requestId?: string
  metadata?: Record<string, any>
  error?: {
    name: string
    message: string
    stack: string
  }
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: Date
  uptime: number
  version: string
  services: ServiceHealth[]
  metrics?: {
    memory: MemoryMetrics
    cpu: CpuMetrics
    performance: PerformanceMetrics
  }
}

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  error?: string
  lastCheck: Date
}

export interface MemoryMetrics {
  used: number
  total: number
  percentage: number
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

export interface CpuMetrics {
  usage: number
  loadAverage: number[]
  cores: number
}

export interface PerformanceMetrics {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
  tags?: string[]
  compression?: boolean
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  expiresAt: Date
  createdAt: Date
  accessCount: number
  lastAccessedAt: Date
  tags: string[]
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  TELEGRAM = 'telegram',
  SMS = 'sms'
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  createdAt: Date
  readAt?: Date
  sentAt?: Date
  metadata?: Record<string, any>
}

export interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  channel: NotificationChannel
  subject?: string
  template: string
  variables: string[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface FileInfo {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  hash: string
  path: string
  url: string
  metadata?: Record<string, any>
  uploadedBy: string
  uploadedAt: Date
}

export interface FileUploadOptions {
  maxSize?: number // in bytes
  allowedTypes?: string[]
  generateThumbnail?: boolean
  virusScan?: boolean
  storage?: 'local' | 's3' | 'gcs'
}

// ============================================================================
// SEARCH AND FILTERING
// ============================================================================

export interface SearchQuery {
  query?: string
  filters?: Record<string, any>
  sort?: SortOptions
  facets?: string[]
  page?: number
  limit?: number
}

export interface SearchResult<T = any> {
  items: T[]
  total: number
  facets?: Record<string, any>
  suggestions?: string[]
  took: number // time in milliseconds
}

export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean'
  options?: Array<{ label: string; value: any }>
  defaultValue?: any
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface Webhook {
  id: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  retries: number
  timeout: number
  lastTriggered?: Date
  createdAt: Date
  updatedAt: Date
}

export interface WebhookEvent {
  id: string
  webhookId: string
  event: string
  data: Record<string, any>
  attempts: number
  status: 'pending' | 'delivered' | 'failed'
  response?: {
    statusCode: number
    body: string
    headers: Record<string, string>
  }
  error?: string
  createdAt: Date
  deliveredAt?: Date
}

// ============================================================================
// IMPORT/EXPORT TYPES
// ============================================================================

export interface ImportJob {
  id: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: number
  processedRows: number
  errors: ImportError[]
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface ImportError {
  row: number
  field?: string
  message: string
  value?: any
}

export interface ExportJob {
  id: string
  type: string
  format: 'csv' | 'json' | 'xlsx'
  filters?: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  expiresAt?: Date
  createdAt: Date
  completedAt?: Date
}

// ============================================================================
// GEOGRAPHIC TYPES
// ============================================================================

export interface Country {
  code: string
  name: string
  currency?: string
  timezone?: string
}

export interface Timezone {
  name: string
  offset: string
  currentOffset: string
}

export interface Location {
  country?: string
  region?: string
  city?: string
  timezone?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

// ============================================================================
// MISCELLANEOUS TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type ArrayElement<T> = T extends (infer U)[] ? U : never

export type ValueOf<T> = T[keyof T]

export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>
}

export type Timestamps = {
  createdAt: Date
  updatedAt: Date
}

export type SoftDelete = {
  deletedAt?: Date
  isDeleted: boolean
}