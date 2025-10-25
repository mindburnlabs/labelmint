/**
 * Observability Types and Interfaces
 */

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  service: string;
  version?: string;
  environment?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: ErrorInfo;
  tags?: string[];
  duration?: number;
  component?: string;
  operation?: string;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  context?: Record<string, any>;
  cause?: ErrorInfo;
}

export interface LoggerConfig {
  service: string;
  version?: string;
  environment?: string;
  level?: LogLevel;
  format?: LogFormat;
  outputs?: LogOutput[];
  correlationId?: CorrelationConfig;
  sampling?: SamplingConfig;
  redaction?: RedactionConfig;
  metrics?: MetricsConfig;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export enum LogFormat {
  JSON = 'json',
  TEXT = 'text',
  STRUCTURED = 'structured'
}

export interface LogOutput {
  type: 'console' | 'file' | 'http' | 'stream';
  config: any;
  level?: LogLevel;
  format?: LogFormat;
}

export interface CorrelationConfig {
  enabled: boolean;
  headerName?: string;
  generateIfMissing?: boolean;
  includeInResponse?: boolean;
  propagateToDownstream?: boolean;
}

export interface SamplingConfig {
  enabled: boolean;
  rate: number; // 0.0 to 1.0
  decisionPoints?: SamplingDecisionPoint[];
}

export enum SamplingDecisionPoint {
  REQUEST_START = 'request_start',
  LOG_WRITE = 'log_write',
  METRIC_RECORD = 'metric_record',
  SPAN_START = 'span_start'
}

export interface RedactionConfig {
  enabled: boolean;
  fields: string[];
  patterns: RedactionPattern[];
  strategy: RedactionStrategy;
}

export interface RedactionPattern {
  pattern: RegExp;
  replacement: string;
}

export enum RedactionStrategy {
  MASK = 'mask',
  REMOVE = 'remove',
  HASH = 'hash'
}

export interface MetricsConfig {
  enabled: boolean;
  prefix?: string;
  labels?: Record<string, string>;
  bucketer?: BucketConfig;
}

export interface BucketConfig {
  duration: number[];
  size: number[];
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
  samplingDecision?: SamplingDecision;
}

export interface SamplingDecision {
  sampled: boolean;
  decisionPoint: SamplingDecisionPoint;
  attributes?: Record<string, any>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: SpanStatus;
  tags?: Record<string, any>;
  logs?: LogEntry[];
  events?: SpanEvent[];
  service: string;
  resource?: Record<string, any>;
}

export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  ALREADY_EXISTS = 'already_exists',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  FAILED_PRECONDITION = 'failed_precondition',
  ABORTED = 'aborted',
  OUT_OF_RANGE = 'out_of_range',
  UNIMPLEMENTED = 'unimplemented',
  INTERNAL = 'internal',
  UNAVAILABLE = 'unavailable',
  DATA_LOSS = 'data_loss',
  UNAUTHENTICATED = 'unauthenticated'
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, any>;
}

export interface TracerConfig {
  service: string;
  version?: string;
  environment?: string;
  enabled: boolean;
  sampling?: SamplingConfig;
  exporter?: TraceExporterConfig;
  propagator?: PropagatorConfig;
}

export interface TraceExporterConfig {
  type: 'jaeger' | 'zipkin' | 'otlp' | 'stdout';
  config: any;
}

export interface PropagatorConfig {
  type: 'trace-context' | 'baggage' | 'custom';
  headers?: string[];
}

export interface MetricValue {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
  type?: MetricType;
  unit?: string;
  description?: string;
  metadata?: {
    count?: number;
    sum?: number;
    quantiles?: Record<string, number>;
  };
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export interface HistogramBucket {
  upperBound: number;
  count: number;
}

export interface MetricSummary {
  count: number;
  sum: number;
  quantiles: QuantileValue[];
}

export interface QuantileValue {
  quantile: number;
  value: number;
}

export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  checks: HealthCheck[];
  uptime: number;
  version: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  timestamp: Date;
}

export interface ServiceMetrics {
  service: string;
  version: string;
  timestamp: Date;
  performance: PerformanceMetrics;
  resources: ResourceMetrics;
  business: BusinessMetrics;
}

export interface ResourceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface BusinessMetrics {
  activeUsers: number;
  totalRequests: number;
  successfulOperations: number;
  failedOperations: number;
  revenue?: number;
  custom?: Record<string, number>;
}

export interface AlertConfig {
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  channels: AlertChannel[];
  cooldown: number;
  message?: string;
}

export interface AlertCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  labels?: Record<string, string>;
}

export enum AlertOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  EQ = 'eq',
  NEQ = 'neq'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info'
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  config: any;
}

export interface DashboardConfig {
  name: string;
  panels: DashboardPanel[];
  refreshInterval?: number;
  timeRange?: TimeRange;
}

export interface DashboardPanel {
  title: string;
  type: PanelType;
  metrics: PanelMetric[];
  position: PanelPosition;
  options?: PanelOptions;
}

export enum PanelType {
  GRAPH = 'graph',
  STAT = 'stat',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  GAUGE = 'gauge'
}

export interface PanelMetric {
  name: string;
  query: string;
  alias?: string;
}

export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelOptions {
  legend?: boolean;
  tooltip?: boolean;
  axes?: AxisOptions;
  colors?: string[];
  thresholds?: Threshold[];
}

export interface AxisOptions {
  yMin?: number;
  yMax?: number;
  y2Min?: number;
  y2Max?: number;
  scale?: 'linear' | 'log';
}

export interface Threshold {
  value: number;
  color: string;
  operator?: AlertOperator;
}

export interface TimeRange {
  from: Date;
  to: Date;
  refresh?: boolean;
}