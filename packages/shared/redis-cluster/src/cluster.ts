/**
 * Redis Cluster Implementation
 * Provides Redis clustering with automatic failover and management
 */

import { Cluster } from 'ioredis';
import { EventEmitter } from 'events';
import {
  RedisClusterConfig,
  RedisNode,
  ClusterMetrics,
  ClusterState,
  NodeType,
  PartitionInfo,
  HealthCheckConfig,
  MetricsConfig,
  Logger
} from './types';
import { HealthChecker } from './health-checker';
import { MetricsCollector } from './metrics';
import { DefaultLogger } from './logger';

export class RedisClusterManager extends EventEmitter {
  private cluster: Cluster | null = null;
  private nodes: Map<string, RedisNode> = new Map();
  private state: ClusterState = ClusterState.INITIALIZING;
  private healthChecker: HealthChecker;
  private metricsCollector: MetricsCollector;
  private logger: Logger;
  private config: RedisClusterConfig;

  constructor(config: RedisClusterConfig, logger?: Logger) {
    super();
    this.config = config;
    this.logger = logger || new DefaultLogger('redis-cluster');
    this.healthChecker = new HealthChecker(
      config.healthCheck || { enabled: true, interval: 30000, timeout: 5000, retries: 3 },
      this.logger
    );
    this.metricsCollector = new MetricsCollector(
      config.metrics || { enabled: true, collectInterval: 10000, retentionPeriod: 3600000 },
      this.logger
    );

    this.initializeNodes();
    this.setupEventHandlers();
  }

  private initializeNodes(): void {
    for (const node of this.config.nodes) {
      const nodeId = `${node.host}:${node.port}`;
      this.nodes.set(nodeId, {
        ...node,
        priority: node.priority || 1
      });
    }
  }

  private setupEventHandlers(): void {
    this.healthChecker.on('nodeHealthChange', (nodeId, isHealthy) => {
      this.handleNodeHealthChange(nodeId, isHealthy);
    });

    this.healthChecker.on('clusterHealthChange', (isHealthy) => {
      this.handleClusterHealthChange(isHealthy);
    });

    this.metricsCollector.on('metricsUpdate', (metrics) => {
      this.emit('metricsUpdate', metrics);
    });
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Redis cluster...');

      const clusterNodes = Array.from(this.nodes.entries()).map(([nodeId, node]) => ({
        host: node.host,
        port: node.port,
        password: node.password,
        db: node.db || 0
      }));

      this.cluster = new Cluster(clusterNodes, {
        enableOfflineQueue: this.config.options?.enableOfflineQueue ?? true,
        retryDelayOnFailover: this.config.options?.retryDelayOnFailover ?? 100,
        maxRetriesPerRequest: this.config.options?.maxRetriesPerRequest ?? 3,
        lazyConnect: this.config.options?.lazyConnect ?? false,
        keepAlive: this.config.options?.keepAlive ?? 30000,
        connectTimeout: this.config.options?.connectTimeout ?? 10000,
        commandTimeout: this.config.options?.commandTimeout ?? 5000,
        enableReadyCheck: this.config.options?.enableReadyCheck ?? true,
        maxRedirections: this.config.options?.maxRedirections ?? 16,
        retryDelayOnClusterDown: this.config.options?.retryDelayOnClusterDown ?? 300,
        family: this.config.options?.family ?? 4,
        tls: this.config.options?.tls,
        redisOptions: {
          password: this.config.nodes[0].password
        }
      });

      this.setupClusterEventHandlers();

      await this.cluster.connect();

      this.state = ClusterState.RUNNING;
      this.logger.info('Redis cluster connected successfully');
      this.emit('connected');

      // Start health checking and metrics collection
      this.healthChecker.start(this.cluster);
      this.metricsCollector.start(this.cluster);

    } catch (error) {
      this.state = ClusterState.FAILED;
      this.logger.error('Failed to connect to Redis cluster', error);
      this.emit('error', error);
      throw error;
    }
  }

  private setupClusterEventHandlers(): void {
    if (!this.cluster) return;

    this.cluster.on('connect', () => {
      this.logger.info('Redis cluster connection established');
    });

    this.cluster.on('ready', () => {
      this.logger.info('Redis cluster is ready');
      this.state = ClusterState.RUNNING;
      this.emit('ready');
    });

    this.cluster.on('error', (error) => {
      this.logger.error('Redis cluster error', error);
      this.emit('error', error);
    });

    this.cluster.on('close', () => {
      this.logger.warn('Redis cluster connection closed');
      this.state = ClusterState.DEGRADED;
      this.emit('disconnected');
    });

    this.cluster.on('node error', (error, node) => {
      this.logger.error('Redis node error', error, { node: node.options });
      this.emit('nodeError', error, node);
    });

    this.cluster.on('reconnecting', (ms) => {
      this.logger.info(`Redis cluster reconnecting in ${ms}ms`);
    });

    this.cluster.on('+node', (node) => {
      this.logger.info('New node added to cluster', { node: node.options });
      this.emit('nodeAdded', node);
    });

    this.cluster.on('-node', (node) => {
      this.logger.warn('Node removed from cluster', { node: node.options });
      this.emit('nodeRemoved', node);
    });
  }

  async disconnect(): Promise<void> {
    try {
      this.healthChecker.stop();
      this.metricsCollector.stop();

      if (this.cluster) {
        await this.cluster.disconnect();
        this.cluster = null;
      }

      this.state = ClusterState.INITIALIZING;
      this.logger.info('Redis cluster disconnected');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Redis cluster', error);
      throw error;
    }
  }

  private handleNodeHealthChange(nodeId: string, isHealthy: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (!isHealthy) {
      this.logger.warn(`Node ${nodeId} is unhealthy`, { node });
      this.state = ClusterState.DEGRADED;
      this.emit('nodeUnhealthy', nodeId, node);

      // Trigger failover if needed
      this.considerFailover(nodeId);
    } else {
      this.logger.info(`Node ${nodeId} is healthy again`, { node });
      this.emit('nodeHealthy', nodeId, node);

      // Check if cluster can return to normal state
      this.checkClusterState();
    }
  }

  private handleClusterHealthChange(isHealthy: boolean): void {
    if (!isHealthy && this.state === ClusterState.RUNNING) {
      this.state = ClusterState.DEGRADED;
      this.logger.warn('Cluster health degraded');
      this.emit('clusterDegraded');
    } else if (isHealthy && this.state === ClusterState.DEGRADED) {
      this.state = ClusterState.RUNNING;
      this.logger.info('Cluster health restored');
      this.emit('clusterRestored');
    }
  }

  private async considerFailover(failedNodeId: string): Promise<void> {
    const availableNodes = Array.from(this.nodes.entries())
      .filter(([id, node]) => id !== failedNodeId)
      .sort((a, b) => (b[1].priority || 1) - (a[1].priority || 1));

    if (availableNodes.length === 0) {
      this.logger.error('No available nodes for failover');
      return;
    }

    const [primaryNodeId, primaryNode] = availableNodes[0];
    this.logger.info(`Initiating failover to ${primaryNodeId}`, { primaryNode });
    this.emit('failoverInitiated', failedNodeId, primaryNodeId);
  }

  private checkClusterState(): void {
    // Implementation to check if cluster can return to running state
    const healthyNodes = this.healthChecker.getHealthyNodes();
    const totalNodes = this.nodes.size;

    if (healthyNodes.size === totalNodes) {
      this.state = ClusterState.RUNNING;
    } else if (healthyNodes.size > 0) {
      this.state = ClusterState.DEGRADED;
    } else {
      this.state = ClusterState.FAILED;
    }
  }

  // Public API methods

  getCluster(): Cluster | null {
    return this.cluster;
  }

  getState(): ClusterState {
    return this.state;
  }

  getNodes(): Map<string, RedisNode> {
    return new Map(this.nodes);
  }

  async getMetrics(): Promise<ClusterMetrics> {
    return this.metricsCollector.getCurrentMetrics();
  }

  async getPartitionInfo(): Promise<PartitionInfo> {
    if (!this.cluster) {
      throw new Error('Cluster not connected');
    }

    const nodes = await this.cluster.nodes();
    const slots = await this.cluster.cluster('slots');

    const nodeMap = new Map<string, RedisNode>();
    const slotRanges: any[] = [];

    nodes.forEach(node => {
      nodeMap.set node.options.port, {
        host: node.options.host,
        port: node.options.port,
        priority: 1
      });
    });

    slots.forEach(([start, end, ...nodeIds]) => {
      const nodeId = `${nodeIds[0].host}:${nodeIds[0].port}`;
      slotRanges.push({
        start,
        end,
        nodeId
      });
    });

    return {
      slotRanges,
      nodeMap,
      isStable: this.state === ClusterState.RUNNING,
      migrationInProgress: false
    };
  }

  async addNode(node: RedisNode): Promise<void> {
    const nodeId = `${node.host}:${node.port}`;

    if (this.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} already exists`);
    }

    this.nodes.set(nodeId, node);
    this.logger.info(`Added node ${nodeId} to configuration`);

    if (this.cluster && this.state === ClusterState.RUNNING) {
      // Add node to running cluster
      try {
        await this.cluster.cluster('meet', node.host, node.port);
        this.emit('nodeAdded', node);
      } catch (error) {
        this.logger.error('Failed to add node to cluster', error, { node });
        throw error;
      }
    }
  }

  async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    this.nodes.delete(nodeId);
    this.logger.info(`Removed node ${nodeId} from configuration`);

    if (this.cluster) {
      try {
        // Remove node from cluster
        await this.cluster.cluster('forget', nodeId);
        this.emit('nodeRemoved', node);
      } catch (error) {
        this.logger.error('Failed to remove node from cluster', error, { node });
        throw error;
      }
    }
  }

  async enterMaintenanceMode(): Promise<void> {
    this.state = ClusterState.MAINTENANCE;
    this.logger.info('Cluster entering maintenance mode');
    this.emit('maintenanceMode', true);

    // Stop health checking during maintenance
    this.healthChecker.stop();
  }

  async exitMaintenanceMode(): Promise<void> {
    this.logger.info('Cluster exiting maintenance mode');
    this.emit('maintenanceMode', false);

    // Restart health checking
    if (this.cluster) {
      this.healthChecker.start(this.cluster);
    }

    this.checkClusterState();
  }
}