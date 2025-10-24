/**
 * Redis Cluster Health Checker
 * Monitors cluster and node health with configurable checks
 */

import { EventEmitter } from 'events';
import { Cluster, Node } from 'ioredis';
import {
  HealthCheckConfig,
  Logger,
  NodeMetrics,
  MemoryMetrics,
  ThroughputMetrics,
  ErrorMetrics
} from './types';

export class HealthChecker extends EventEmitter {
  private cluster: Cluster | null = null;
  private interval: NodeJS.Timeout | null = null;
  private nodeStatuses: Map<string, boolean> = new Map();
  private nodeMetrics: Map<string, NodeMetrics> = new Map();
  private lastClusterCheck = 0;
  private clusterHealthy = true;
  private config: HealthCheckConfig;
  private logger: Logger;

  constructor(config: HealthCheckConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  start(cluster: Cluster): void {
    if (!this.config.enabled) {
      this.logger.debug('Health checking disabled');
      return;
    }

    this.cluster = cluster;
    this.logger.info('Starting health checker', { interval: this.config.interval });

    // Run initial check
    this.performHealthCheck();

    // Set up periodic checks
    this.interval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('Health checker stopped');
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.cluster) return;

    const startTime = Date.now();
    let clusterHealthy = true;

    try {
      const nodes = this.cluster.nodes();
      const nodePromises = nodes.map(node => this.checkNode(node));

      const results = await Promise.allSettled(nodePromises);

      results.forEach((result, index) => {
        const node = nodes[index];
        const nodeId = `${node.options.host}:${node.options.port}`;

        if (result.status === 'fulfilled') {
          const isHealthy = result.value;
          const wasHealthy = this.nodeStatuses.get(nodeId) ?? true;

          if (isHealthy !== wasHealthy) {
            this.nodeStatuses.set(nodeId, isHealthy);
            this.emit('nodeHealthChange', nodeId, isHealthy);

            this.logger.info(`Node health changed: ${nodeId}`, {
              from: wasHealthy,
              to: isHealthy
            });
          }
        } else {
          this.logger.error('Node health check failed', result.reason, { node });
          this.nodeStatuses.set(nodeId, false);
          clusterHealthy = false;
        }
      });

      // Check overall cluster health
      if (clusterHealthy !== this.clusterHealthy) {
        this.clusterHealthy = clusterHealthy;
        this.emit('clusterHealthChange', clusterHealthy);

        this.logger.info(`Cluster health changed`, {
          from: !clusterHealthy,
          to: clusterHealthy
        });
      }

      this.lastClusterCheck = Date.now();

    } catch (error) {
      this.logger.error('Health check failed', error);
      this.clusterHealthy = false;
      this.emit('clusterHealthChange', false);
    }

    const duration = Date.now() - startTime;
    this.logger.debug('Health check completed', { duration, clusterHealthy });
  }

  private async checkNode(node: Node): Promise<boolean> {
    const nodeId = `${node.options.host}:${node.options.port}`;
    const startTime = Date.now();

    try {
      // Check basic connectivity
      await Promise.race([
        node.ping(),
        this.timeout(this.config.timeout)
      ]);

      // Collect node metrics
      const metrics = await this.collectNodeMetrics(node, startTime);
      this.nodeMetrics.set(nodeId, metrics);

      return true;
    } catch (error) {
      this.logger.debug(`Node health check failed: ${nodeId}`, error);

      // Update error metrics
      const existingMetrics = this.nodeMetrics.get(nodeId);
      if (existingMetrics) {
        existingMetrics.errors.connectionErrors++;
        this.nodeMetrics.set(nodeId, existingMetrics);
      }

      return false;
    }
  }

  private async collectNodeMetrics(node: Node, startTime: number): Promise<NodeMetrics> {
    const nodeId = `${node.options.host}:${node.options.port}`;
    const latency = Date.now() - startTime;

    try {
      const info = await node.info('memory', 'stats', 'clients');
      const parsed = this.parseRedisInfo(info);

      const memoryMetrics: MemoryMetrics = {
        used: parseInt(parsed.memory_used || '0'),
        max: parseInt(parsed.maxmemory || '0'),
        usedPercentage: parseFloat(parsed.memory_used_human || '0'),
        peak: parseInt(parsed.memory_peak || '0'),
        fragmentation: parseFloat(parsed.mem_fragmentation_ratio || '1')
      };

      const throughputMetrics: ThroughputMetrics = {
        commandsPerSecond: parseFloat(parsed.instantaneous_ops_per_sec || '0'),
        readsPerSecond: parseFloat(parsed.instantaneous_input_kbps || '0'),
        writesPerSecond: parseFloat(parsed.instantaneous_output_kbps || '0'),
        connectionsPerSecond: parseFloat(parsed.total_connections_received || '0')
      };

      const errorMetrics: ErrorMetrics = {
        connectionErrors: 0,
        commandErrors: parseInt(parsed.rejected_commands || '0'),
        timeoutErrors: 0,
        clusterErrors: 0
      };

      return {
        nodeId,
        status: 'connected',
        latency,
        memory: memoryMetrics,
        throughput: throughputMetrics,
        errors: errorMetrics
      };
    } catch (error) {
      this.logger.error('Failed to collect node metrics', error, { nodeId });

      return {
        nodeId,
        status: 'connected',
        latency,
        memory: { used: 0, max: 0, usedPercentage: 0, peak: 0, fragmentation: 0 },
        throughput: { commandsPerSecond: 0, readsPerSecond: 0, writesPerSecond: 0, connectionsPerSecond: 0 },
        errors: { connectionErrors: 0, commandErrors: 0, timeoutErrors: 0, clusterErrors: 0 }
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, ...values] = line.split(':');
        if (key && values.length > 0) {
          result[key] = values.join(':');
        }
      }
    }

    return result;
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  // Public methods

  isHealthy(): boolean {
    return this.clusterHealthy;
  }

  getHealthyNodes(): Map<string, boolean> {
    const healthy = new Map<string, boolean>();
    for (const [nodeId, isHealthy] of this.nodeStatuses) {
      if (isHealthy) {
        healthy.set(nodeId, isHealthy);
      }
    }
    return healthy;
  }

  getNodeMetrics(nodeId: string): NodeMetrics | undefined {
    return this.nodeMetrics.get(nodeId);
  }

  getAllNodeMetrics(): Map<string, NodeMetrics> {
    return new Map(this.nodeMetrics);
  }

  getLastCheckTime(): number {
    return this.lastClusterCheck;
  }

  async performDeepHealthCheck(): Promise<Record<string, any>> {
    if (!this.cluster) {
      throw new Error('Cluster not connected');
    }

    const deepCheck: Record<string, any> = {
      timestamp: new Date(),
      clusterHealthy: this.clusterHealthy,
      nodes: {},
      clusterInfo: {},
      replicationInfo: {}
    };

    try {
      // Get cluster info
      const clusterInfo = await this.cluster.info('cluster');
      deepCheck.clusterInfo = this.parseRedisInfo(clusterInfo);

      // Get replication info
      const replicationInfo = await this.cluster.info('replication');
      deepCheck.replicationInfo = this.parseRedisInfo(replicationInfo);

      // Check each node in detail
      const nodes = this.cluster.nodes();
      for (const node of nodes) {
        const nodeId = `${node.options.host}:${node.options.port}`;
        const metrics = this.nodeMetrics.get(nodeId);

        if (metrics) {
          deepCheck.nodes[nodeId] = {
            ...metrics,
            connected: this.nodeStatuses.get(nodeId) ?? false,
            info: this.parseRedisInfo(await node.info())
          };
        }
      }

    } catch (error) {
      this.logger.error('Deep health check failed', error);
      deepCheck.error = error.message;
    }

    return deepCheck;
  }
}