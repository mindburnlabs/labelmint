// ============================================================================
// COMMON UTILITY TYPES
// ============================================================================

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  where?: Record<string, any>;
  select?: string[];
  orderBy?: SortOptions[];
  joins?: JoinOption[];
  pagination?: PaginationOptions;
}

export interface JoinOption {
  table: string;
  on: string;
  type: 'LEFT' | 'RIGHT' | 'INNER';
  alias: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    pagination?: PaginationResult<T>;
    timestamp: Date;
    requestId?: string;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
}

export interface AppConfig {
  database: DatabaseConfig;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  jwt?: {
    secret: string;
    expiresIn: string;
  };
  telegram?: {
    botToken: string;
    webhookUrl?: string;
  };
  supabase?: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
}

export interface LogLevel {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface FileUpload {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  path: string;
  url?: string;
  uploaded_by: string;
  created_at: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  country?: string;
  city?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface Metrics {
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventCallback<T = any> = (data: T) => void | Promise<void>;

export interface EventEmitter<T = any> {
  on(event: string, callback: EventCallback<T>): void;
  off(event: string, callback: EventCallback<T>): void;
  emit(event: string, data: T): void;
}