/**
 * Redis Cluster Types and Interfaces
 */

export interface RedisClusterConfig {
  nodes: RedisNode[];
  options?: RedisClusterOptions;
  healthCheck?: HealthCheckConfig;
  metrics?: MetricsConfig;
  cache?: CacheConfig;
}

export interface RedisNode {
  host: string;
  port: number;
  password?: string;
  db?: number;
  priority?: number;
}

export interface RedisClusterOptions {
  enableOfflineQueue?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  enableReadyCheck?: boolean;
  maxRedirections?: number;
  retryDelayOnClusterDown?: number;
  family?: 4 | 6;
  tls?: TLSOptions;
}

export interface TLSOptions {
  key?: string;
  cert?: string;
  ca?: string;
  rejectUnauthorized?: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  command?: string;
}

export interface MetricsConfig {
  enabled: boolean;
  collectInterval: number;
  retentionPeriod: number;
  labels?: Record<string, string>;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize?: number;
  compressionThreshold?: number;
  compressionAlgorithm?: 'gzip' | 'deflate' | 'brotli';
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl?: number;
  tags?: string[];
  version?: number;
  compressed?: boolean;
  created: Date;
  accessed: Date;
  accessCount: number;
}

export interface SessionOptions {
  sessionId: string;
  data: Record<string, any>;
  ttl?: number;
  rolling?: boolean;
  touchAfter?: number;
}

export interface ClusterMetrics {
  nodeMetrics: Map<string, NodeMetrics>;
  clusterMetrics: ClusterWideMetrics;
  timestamp: Date;
}

export interface NodeMetrics {
  nodeId: string;
  status: 'connected' | 'disconnected' | 'failed';
  latency: number;
  memory: MemoryMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
}

export interface MemoryMetrics {
  used: number;
  max: number;
  usedPercentage: number;
  peak: number;
  fragmentation: number;
}

export interface ThroughputMetrics {
  commandsPerSecond: number;
  readsPerSecond: number;
  writesPerSecond: number;
  connectionsPerSecond: number;
}

export interface ErrorMetrics {
  connectionErrors: number;
  commandErrors: number;
  timeoutErrors: number;
  clusterErrors: number;
}

export interface ClusterWideMetrics {
  totalCommands: number;
  totalOperations: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  uptime: number;
  activeNodes: number;
  failedNodes: number;
}

export interface DistributionStrategy {
  name: string;
  getNode(key: string): RedisNode | null;
  addNode(node: RedisNode): void;
  removeNode(nodeId: string): void;
  getNodes(): RedisNode[];
}

export interface FailoverStrategy {
  name: string;
  detectFailure(node: RedisNode): boolean;
  promoteNode(nodes: RedisNode[]): RedisNode | null;
  handleFailover(failedNode: RedisNode, replacementNode?: RedisNode): Promise<void>;
}

export interface ConsistencyLevel {
  level: 'eventual' | 'strong' | 'weak';
  replicationFactor?: number;
  quorum?: number;
  writeConcern?: number;
  readConcern?: number;
}

export interface RedisCommand {
  command: string;
  args: any[];
  options?: CommandOptions;
}

export interface CommandOptions {
  consistencyLevel?: ConsistencyLevel;
  timeout?: number;
  retries?: number;
  node?: RedisNode;
  bypassCache?: boolean;
}

export interface LockOptions {
  ttl: number;
  retryDelay: number;
  maxRetries: number;
  autoExtend?: boolean;
}

export interface DistributedLock {
  acquire(key: string, options?: LockOptions): Promise<boolean>;
  release(key: string): Promise<boolean>;
  extend(key: string, ttl: number): Promise<boolean>;
  isLocked(key: string): Promise<boolean>;
}

export interface PubSubMessage {
  channel: string;
  message: any;
  timestamp: Date;
  publisherId?: string;
  messageId: string;
}

export interface PubSubOptions {
  subscribeToPatterns?: boolean;
  bufferSize?: number;
  acknowledgeMessages?: boolean;
  messageRetention?: number;
}

export enum ClusterState {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  MAINTENANCE = 'maintenance'
}

export enum NodeType {
  PRIMARY = 'primary',
  REPLICA = 'replica',
  ARBITER = 'arbiter'
}

export interface PartitionInfo {
  slotRanges: SlotRange[];
  nodeMap: Map<string, RedisNode>;
  isStable: boolean;
  migrationInProgress: boolean;
}

export interface SlotRange {
  start: number;
  end: number;
  nodeId: string;
  migratingTo?: string;
  importingFrom?: string;
}