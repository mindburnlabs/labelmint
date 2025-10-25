/**
 * Advanced Stream Processing Framework
 * High-performance stream processing for real-time analytics
 */

import { AnalyticsEvent, AnalyticsConfig } from '../types/analytics.types';
import { getGlobalMetrics } from '@shared/observability/metrics';

export interface StreamConfig {
  maxConcurrency: number;
  bufferSize: number;
  timeoutMs: number;
  retryAttempts: number;
  enableMetrics: boolean;
}

export interface ProcessingResult {
  success: boolean;
  processedEvents: AnalyticsEvent[];
  failedEvents: AnalyticsEvent[];
  errors: Error[];
  metrics: ProcessingMetrics;
}

export interface ProcessingMetrics {
  inputCount: number;
  outputCount: number;
  processingTimeMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

export abstract class BaseStreamProcessor {
  protected config: StreamConfig;
  protected metrics = getGlobalMetrics();
  protected isRunning = false;
  protected eventQueue: AnalyticsEvent[] = [];
  protected processing = false;

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      maxConcurrency: 4,
      bufferSize: 10000,
      timeoutMs: 30000,
      retryAttempts: 3,
      enableMetrics: true,
      ...config
    };
  }

  /**
   * Start the stream processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stream processor is already running');
    }

    this.isRunning = true;
    await this.onStarted();
    this.metrics.increment('stream_processor_started', { processor: this.constructor.name });
  }

  /**
   * Stop the stream processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Wait for current processing to complete
    while (this.processing) {
      await this.sleep(100);
    }

    await this.onStopped();
    this.metrics.increment('stream_processor_stopped', { processor: this.constructor.name });
  }

  /**
   * Add events to the processing queue
   */
  addEvent(event: AnalyticsEvent): void {
    if (!this.isRunning) {
      throw new Error('Stream processor is not running');
    }

    if (this.eventQueue.length >= this.config.bufferSize) {
      this.metrics.increment('stream_processor_buffer_overflow');
      throw new Error('Event buffer is full');
    }

    this.eventQueue.push(event);

    // Trigger processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Add multiple events to the processing queue
   */
  addEvents(events: AnalyticsEvent[]): void {
    if (!this.isRunning) {
      throw new Error('Stream processor is not running');
    }

    if (this.eventQueue.length + events.length > this.config.bufferSize) {
      this.metrics.increment('stream_processor_buffer_overflow');
      throw new Error('Event buffer would overflow');
    }

    this.eventQueue.push(...events);

    // Trigger processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    isRunning: boolean;
    queueSize: number;
    bufferSize: number;
    config: StreamConfig;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.eventQueue.length,
      bufferSize: this.config.bufferSize,
      config: this.config
    };
  }

  /**
   * Abstract method to process events
   */
  protected abstract processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]>;

  /**
   * Hook called when processor starts
   */
  protected async onStarted(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Hook called when processor stops
   */
  protected async onStopped(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    const startTime = Date.now();

    try {
      while (this.eventQueue.length > 0 && this.isRunning) {
        const batchSize = Math.min(this.config.maxConcurrency, this.eventQueue.length);
        const batch = this.eventQueue.splice(0, batchSize);

        try {
          const result = await this.processBatchWithMetrics(batch);
          await this.handleProcessingResult(result);
        } catch (error) {
          this.metrics.increment('stream_processor_batch_errors');
          console.error('Batch processing error:', error);
        }
      }
    } finally {
      const processingTime = Date.now() - startTime;
      this.metrics.observe('stream_processor_queue_processing_time_ms', processingTime);
      this.processing = false;
    }
  }

  /**
   * Process a batch of events with metrics collection
   */
  private async processBatchWithMetrics(events: AnalyticsEvent[]): Promise<ProcessingResult> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();
    const startCpu = this.getCpuUsage();

    let processedEvents: AnalyticsEvent[] = [];
    let failedEvents: AnalyticsEvent[] = [];
    let errors: Error[] = [];

    try {
      processedEvents = await this.processEvents(events);
    } catch (error) {
      errors.push(error as Error);
      failedEvents = events;
    }

    const endTime = Date.now();
    const endMemory = this.getMemoryUsage();
    const endCpu = this.getCpuUsage();

    const metrics: ProcessingMetrics = {
      inputCount: events.length,
      outputCount: processedEvents.length,
      processingTimeMs: endTime - startTime,
      memoryUsageMB: Math.max(0, endMemory - startMemory),
      cpuUsagePercent: Math.max(0, endCpu - startCpu)
    };

    if (this.config.enableMetrics) {
      this.updateProcessingMetrics(metrics);
    }

    return {
      success: errors.length === 0,
      processedEvents,
      failedEvents,
      errors,
      metrics
    };
  }

  /**
   * Handle processing result
   */
  protected async handleProcessingResult(result: ProcessingResult): Promise<void> {
    if (result.success) {
      this.metrics.increment('stream_processor_batches_success');
    } else {
      this.metrics.increment('stream_processor_batches_failed');
      // Retry failed events if configured
      if (this.config.retryAttempts > 0) {
        await this.retryFailedEvents(result.failedEvents);
      }
    }
  }

  /**
   * Retry failed events with exponential backoff
   */
  private async retryFailedEvents(events: AnalyticsEvent[]): Promise<void> {
    for (const event of events) {
      let success = false;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        try {
          const result = await this.processEvents([event]);
          if (result.length > 0) {
            success = true;
            break;
          }
        } catch (error) {
          lastError = error as Error;
          if (attempt < this.config.retryAttempts) {
            const backoff = Math.pow(2, attempt - 1) * 1000;
            await this.sleep(backoff);
          }
        }
      }

      if (!success && lastError) {
        this.metrics.increment('stream_processor_event_permanently_failed');
        console.error('Event permanently failed after retries:', lastError);
      }
    }
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(metrics: ProcessingMetrics): void {
    this.metrics.increment('stream_processor_events_input', metrics.inputCount);
    this.metrics.increment('stream_processor_events_output', metrics.outputCount);
    this.metrics.observe('stream_processor_batch_processing_time_ms', metrics.processingTimeMs);
    this.metrics.gauge('stream_processor_memory_usage_mb', metrics.memoryUsageMB);
    this.metrics.gauge('stream_processor_cpu_usage_percent', metrics.cpuUsagePercent);
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Get current CPU usage (mock implementation)
   */
  private getCpuUsage(): number {
    // In a real implementation, this would use system metrics
    return Math.random() * 100;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Window-based aggregation processor
 */
export class WindowAggregationProcessor extends BaseStreamProcessor {
  private windows: Map<string, Window> = new Map();
  private windowSizeMs: number;

  constructor(windowSizeMs: number = 60000, config?: Partial<StreamConfig>) {
    super(config);
    this.windowSizeMs = windowSizeMs;
  }

  protected async processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    const aggregatedEvents: AnalyticsEvent[] = [];
    const now = Date.now();

    for (const event of events) {
      const windowKey = this.getWindowKey(event);
      let window = this.windows.get(windowKey);

      if (!window) {
        window = {
          key: windowKey,
          startTime: event.timestamp.getTime(),
          endTime: event.timestamp.getTime(),
          events: [],
          aggregatedAt: now
        };
        this.windows.set(windowKey, window);
      }

      window.events.push(event);
      window.endTime = Math.max(window.endTime, event.timestamp.getTime());

      // Check if window should be closed
      if (now - window.aggregatedAt >= this.windowSizeMs) {
        const aggregatedEvent = this.createAggregatedEvent(window);
        aggregatedEvents.push(aggregatedEvent);
        this.windows.delete(windowKey);
      }
    }

    return aggregatedEvents;
  }

  protected async onStarted(): Promise<void> {
    // Start window cleanup timer
    setInterval(() => this.cleanupOldWindows(), 60000); // Every minute
  }

  private getWindowKey(event: AnalyticsEvent): string {
    const date = new Date(event.timestamp);
    const windowStart = Math.floor(date.getTime() / this.windowSizeMs) * this.windowSizeMs;
    return `${event.eventType}_${windowStart}`;
  }

  private createAggregatedEvent(window: Window): AnalyticsEvent {
    const eventType = window.key.split('_')[0];
    const count = window.events.length;
    const uniqueUsers = new Set(window.events.map(e => e.userId)).size;

    // Calculate aggregated properties
    const properties: Record<string, any> = {
      count,
      uniqueUsers,
      windowStart: new Date(window.startTime).toISOString(),
      windowEnd: new Date(window.endTime).toISOString(),
      duration: window.endTime - window.startTime
    };

    // Add type-specific aggregations
    if (eventType === 'user_action') {
      properties.actionCounts = this.aggregateActions(window.events);
    } else if (eventType === 'payment') {
      properties.totalAmount = window.events.reduce((sum, e) => sum + (e.properties.amount || 0), 0);
      properties.successRate = window.events.filter(e => e.properties.success).length / count;
    }

    return {
      id: `agg_${window.key}`,
      timestamp: new Date(window.endTime),
      eventType: `aggregated_${eventType}`,
      properties,
      metadata: {
        source: 'stream-processor',
        version: '1.0',
        platform: 'aggregator',
        windowSize: this.windowSizeMs
      }
    };
  }

  private aggregateActions(events: AnalyticsEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const action = event.properties.action || 'unknown';
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private cleanupOldWindows(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now - window.aggregatedAt > this.windowSizeMs * 2) {
        // Window is stale, close it
        this.windows.delete(key);
      }
    }
  }
}

interface Window {
  key: string;
  startTime: number;
  endTime: number;
  events: AnalyticsEvent[];
  aggregatedAt: number;
}

/**
 * Session-based processor
 */
export class SessionProcessor extends BaseStreamProcessor {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeoutMs: number;

  constructor(sessionTimeoutMs: number = 1800000, config?: Partial<StreamConfig>) { // 30 minutes default
    super(config);
    this.sessionTimeoutMs = sessionTimeoutMs;
  }

  protected async processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    const sessionEvents: AnalyticsEvent[] = [];
    const now = Date.now();

    for (const event of events) {
      if (!event.sessionId) {
        continue; // Skip events without session ID
      }

      let session = this.sessions.get(event.sessionId);

      if (!session) {
        session = {
          id: event.sessionId,
          startTime: event.timestamp.getTime(),
          lastActivity: event.timestamp.getTime(),
          events: [],
          userId: event.userId,
          properties: {
            device: event.metadata.device,
            platform: event.metadata.platform,
            userAgent: event.metadata.userAgent
          }
        };
        this.sessions.set(event.sessionId, session);
      }

      session.events.push(event);
      session.lastActivity = Math.max(session.lastActivity, event.timestamp.getTime());

      // Check if session should be closed
      if (now - session.lastActivity >= this.sessionTimeoutMs) {
        const sessionEvent = this.createSessionEvent(session);
        sessionEvents.push(sessionEvent);
        this.sessions.delete(event.sessionId);
      }
    }

    return sessionEvents;
  }

  protected async onStarted(): Promise<void> {
    // Start session cleanup timer
    setInterval(() => this.cleanupOldSessions(), 300000); // Every 5 minutes
  }

  private createSessionEvent(session: Session): AnalyticsEvent {
    const duration = session.lastActivity - session.startTime;
    const pageViews = session.events.filter(e => e.eventType === 'page_view').length;
    const actions = session.events.filter(e => e.eventType === 'user_action').length;

    return {
      id: `session_${session.id}`,
      timestamp: new Date(session.lastActivity),
      eventType: 'session_completed',
      properties: {
        sessionId: session.id,
        userId: session.userId,
        duration,
        pageViews,
        actions,
        eventsCount: session.events.length,
        device: session.properties.device,
        platform: session.properties.platform,
        startTime: new Date(session.startTime).toISOString(),
        endTime: new Date(session.lastActivity).toISOString()
      },
      metadata: {
        source: 'stream-processor',
        version: '1.0',
        platform: 'session-processor'
      }
    };
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity >= this.sessionTimeoutMs * 2) {
        // Session is stale, close it
        this.sessions.delete(sessionId);
      }
    }
  }
}

interface Session {
  id: string;
  startTime: number;
  lastActivity: number;
  events: AnalyticsEvent[];
  userId?: string;
  properties: Record<string, any>;
}

/**
 * Filtering processor
 */
export class FilteringProcessor extends BaseStreamProcessor {
  constructor(
    private filters: Array<(event: AnalyticsEvent) => boolean>,
    config?: Partial<StreamConfig>
  ) {
    super(config);
  }

  protected async processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    return events.filter(event => this.filters.every(filter => filter(event)));
  }
}

/**
 * Transformation processor
 */
export class TransformationProcessor extends BaseStreamProcessor {
  constructor(
    private transformer: (event: AnalyticsEvent) => AnalyticsEvent,
    config?: Partial<StreamConfig>
  ) {
    super(config);
  }

  protected async processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    return events.map(event => this.transformer(event));
  }
}

/**
 * Enrichment processor
 */
export class EnrichmentProcessor extends BaseStreamProcessor {
  constructor(
    private enrichments: Array<(event: AnalyticsEvent) => Partial<AnalyticsEvent>>,
    config?: Partial<StreamConfig>
  ) {
    super(config);
  }

  protected async processEvents(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    return events.map(event => {
      let enrichedEvent = { ...event };

      for (const enrichment of this.enrichments) {
        const enrichment = enrichment(event);
        enrichedEvent = { ...enrichedEvent, ...enrichment };
      }

      return enrichedEvent;
    });
  }
}