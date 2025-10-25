/**
 * Real-time Data Processing Pipeline
 * High-performance stream processing for live analytics
 */

import EventEmitter from 'events';
import {
  AnalyticsEvent,
  AnalyticsConfig,
  RealTimePredictionMetrics
} from '../types/analytics.types';
import { getGlobalMetrics } from '@shared/observability/metrics';

export interface PipelineConfig {
  bufferSize: number;
  batchSize: number;
  flushInterval: number;
  maxConcurrency: number;
  retryAttempts: number;
  backoffMs: number;
}

export interface StreamProcessor {
  name: string;
  process: (events: AnalyticsEvent[]) => Promise<AnalyticsEvent[]>;
}

export interface Sink {
  name: string;
  write: (events: AnalyticsEvent[]) => Promise<void>;
}

export class RealTimePipeline extends EventEmitter {
  private config: PipelineConfig;
  private buffer: AnalyticsEvent[] = [];
  private processors: Map<string, StreamProcessor> = new Map();
  private sinks: Map<string, Sink> = new Map();
  private metrics = getGlobalMetrics();
  private isRunning = false;
  private flushTimer?: NodeJS.Timeout;
  private processingLock = false;

  constructor(config: PipelineConfig) {
    super();
    this.config = {
      bufferSize: 10000,
      batchSize: 100,
      flushInterval: 1000, // 1 second
      maxConcurrency: 10,
      retryAttempts: 3,
      backoffMs: 1000,
      ...config
    };
  }

  /**
   * Start the real-time pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }

    this.isRunning = true;
    this.setupFlushTimer();

    this.emit('started');
    this.metrics.increment('pipeline_started');

    console.log('Real-time analytics pipeline started');
  }

  /**
   * Stop the real-time pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Process any remaining events in buffer
    await this.flush();

    this.emit('stopped');
    this.metrics.increment('pipeline_stopped');

    console.log('Real-time analytics pipeline stopped');
  }

  /**
   * Add an event to the pipeline
   */
  addEvent(event: AnalyticsEvent): void {
    if (!this.isRunning) {
      throw new Error('Pipeline is not running');
    }

    this.buffer.push(event);
    this.metrics.increment('pipeline_events_received');

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      setImmediate(() => this.flush());
    }
  }

  /**
   * Add multiple events to the pipeline
   */
  addEvents(events: AnalyticsEvent[]): void {
    if (!this.isRunning) {
      throw new Error('Pipeline is not running');
    }

    this.buffer.push(...events);
    this.metrics.increment('pipeline_events_received', events.length);

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      setImmediate(() => this.flush());
    }
  }

  /**
   * Register a stream processor
   */
  registerProcessor(processor: StreamProcessor): void {
    this.processors.set(processor.name, processor);
    console.log(`Registered processor: ${processor.name}`);
  }

  /**
   * Register a sink
   */
  registerSink(sink: Sink): void {
    this.sinks.set(sink.name, sink);
    console.log(`Registered sink: ${sink.name}`);
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    bufferSize: number;
    isRunning: boolean;
    processorsCount: number;
    sinksCount: number;
    totalEventsProcessed: number;
    averageProcessingTime: number;
  } {
    return {
      bufferSize: this.buffer.length,
      isRunning: this.isRunning,
      processorsCount: this.processors.size,
      sinksCount: this.sinks.size,
      totalEventsProcessed: this.getMetricValue('pipeline_events_processed'),
      averageProcessingTime: this.getMetricValue('pipeline_processing_time_avg')
    };
  }

  /**
   * Main processing loop
   */
  private async flush(): Promise<void> {
    if (this.processingLock || this.buffer.length === 0) {
      return;
    }

    this.processingLock = true;
    const startTime = Date.now();

    try {
      // Take a batch of events
      const events = this.buffer.splice(0, Math.min(this.config.batchSize, this.buffer.length));

      if (events.length === 0) {
        return;
      }

      // Process events through all registered processors
      let processedEvents = await this.processThroughPipeline(events);

      // Write to all sinks concurrently
      await this.writeToSinks(processedEvents);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.increment('pipeline_events_processed', processedEvents.length);
      this.metrics.observe('pipeline_processing_time_ms', processingTime);
      this.metrics.gauge('pipeline_buffer_size', this.buffer.length);

      this.emit('batch_processed', { events: processedEvents.length, processingTime });

    } catch (error) {
      this.metrics.increment('pipeline_errors');
      this.emit('error', error);
      console.error('Pipeline processing error:', error);
    } finally {
      this.processingLock = false;
    }
  }

  /**
   * Process events through all registered processors
   */
  private async processThroughPipeline(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    let processedEvents = [...events];

    for (const [name, processor] of this.processors) {
      try {
        processedEvents = await this.executeWithRetry(
          () => processor.process(processedEvents),
          name
        );
      } catch (error) {
        this.metrics.increment('pipeline_processor_errors', { processor: name });
        console.error(`Processor ${name} failed:`, error);
        // Continue with other processors even if one fails
      }
    }

    return processedEvents;
  }

  /**
   * Write events to all registered sinks
   */
  private async writeToSinks(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const sinkPromises = Array.from(this.sinks.entries()).map(async ([name, sink]) => {
      try {
        await this.executeWithRetry(
          () => sink.write(events),
          name
        );
      } catch (error) {
        this.metrics.increment('pipeline_sink_errors', { sink: name });
        console.error(`Sink ${name} failed:`, error);
      }
    });

    await Promise.allSettled(sinkPromises);
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    componentName: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retryAttempts) {
          const backoff = this.config.backoffMs * Math.pow(2, attempt - 1);
          await this.sleep(backoff);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Setup automatic flush timer
   */
  private setupFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.isRunning) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get metric value (mock implementation)
   */
  private getMetricValue(name: string): number {
    // In a real implementation, this would query the metrics system
    return 0;
  }
}

/**
 * Built-in processors for common analytics operations
 */

export class EventEnrichmentProcessor implements StreamProcessor {
  name = 'event-enrichment';

  async process(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    return events.map(event => ({
      ...event,
      properties: {
        ...event.properties,
        enrichedAt: new Date().toISOString(),
        processingVersion: '1.0'
      }
    }));
  }
}

export class AggregationProcessor implements StreamProcessor {
  name = 'aggregation';

  constructor(private windowMs: number = 60000) {} // 1 minute window by default

  private windows: Map<string, { events: AnalyticsEvent[]; lastUpdate: number }> = new Map();

  async process(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    const aggregatedEvents: AnalyticsEvent[] = [];
    const now = Date.now();

    for (const event of events) {
      const windowKey = this.getWindowKey(event);
      const window = this.windows.get(windowKey);

      if (!window || now - window.lastUpdate > this.windowMs) {
        // Create new window or flush old window
        if (window) {
          aggregatedEvents.push(this.createAggregatedEvent(windowKey, window.events));
        }
        this.windows.set(windowKey, { events: [event], lastUpdate: now });
      } else {
        window.events.push(event);
      }
    }

    return aggregatedEvents;
  }

  private getWindowKey(event: AnalyticsEvent): string {
    const date = new Date(event.timestamp);
    return `${event.eventType}_${date.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
  }

  private createAggregatedEvent(windowKey: string, events: AnalyticsEvent[]): AnalyticsEvent {
    const [eventType] = windowKey.split('_');
    const count = events.length;
    const uniqueUsers = new Set(events.map(e => e.userId)).size;

    return {
      id: `agg_${windowKey}`,
      timestamp: new Date(Math.max(...events.map(e => e.timestamp.getTime()))),
      eventType: `aggregated_${eventType}`,
      properties: {
        count,
        uniqueUsers,
        windowStart: new Date(Math.min(...events.map(e => e.timestamp.getTime()))).toISOString(),
        windowEnd: new Date(Math.max(...events.map(e => e.timestamp.getTime()))).toISOString()
      },
      metadata: {
        source: 'real-time-pipeline',
        version: '1.0',
        platform: 'aggregator'
      }
    };
  }
}

export class FilteringProcessor implements StreamProcessor {
  name = 'filtering';

  constructor(private filters: Array<(event: AnalyticsEvent) => boolean>) {}

  async process(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    return events.filter(event => this.filters.every(filter => filter(event)));
  }
}

/**
 * Built-in sinks for common destinations
 */

export class ConsoleSink implements Sink {
  name = 'console';

  async write(events: AnalyticsEvent[]): Promise<void> {
    console.log(`Processing ${events.length} events:`, events);
  }
}

export class DatabaseSink implements Sink {
  name = 'database';

  constructor(private tableName: string) {}

  async write(events: AnalyticsEvent[]): Promise<void> {
    // Mock database write - in real implementation, use actual database client
    console.log(`Writing ${events.length} events to ${this.tableName}`);
  }
}

export class MetricsSink implements Sink {
  name = 'metrics';

  async write(events: AnalyticsEvent[]): Promise<void> {
    // Convert events to metrics and update monitoring system
    const eventCounts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [eventType, count] of Object.entries(eventCounts)) {
      // Update metrics system
      console.log(`Metric: ${eventType} = ${count}`);
    }
  }
}

export class AlertingSink implements Sink {
  name = 'alerting';

  constructor(
    private thresholds: Record<string, number>,
    private alertCallback: (alert: { metric: string; value: number; threshold: number }) => void
  ) {}

  async write(events: AnalyticsEvent[]): Promise<void> {
    const eventCounts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [metric, value] of Object.entries(eventCounts)) {
      const threshold = this.thresholds[metric];
      if (threshold && value > threshold) {
        this.alertCallback({ metric, value, threshold });
      }
    }
  }
}

/**
 * Factory function to create a complete pipeline
 */
export function createRealTimePipeline(config?: Partial<PipelineConfig>): RealTimePipeline {
  const pipeline = new RealTimePipeline({
    bufferSize: 10000,
    batchSize: 100,
    flushInterval: 1000,
    maxConcurrency: 10,
    retryAttempts: 3,
    backoffMs: 1000,
    ...config
  });

  // Register default processors
  pipeline.registerProcessor(new EventEnrichmentProcessor());
  pipeline.registerProcessor(new AggregationProcessor(60000)); // 1 minute windows

  // Register default sinks
  pipeline.registerProcessor(new FilteringProcessor([
    event => event.timestamp <= new Date(), // Filter future events
    event => event.eventType.length > 0 // Filter invalid event types
  ]));

  return pipeline;
}

/**
 * Real-time metrics collector
 */
export class RealTimeMetricsCollector {
  private pipeline: RealTimePipeline;
  private metrics = new Map<string, number>();
  private timeSeries: Map<string, Array<{ timestamp: Date; value: number }>> = new Map();
  private maxDataPoints = 1000;

  constructor(pipeline: RealTimePipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Start collecting metrics from pipeline
   */
  start(): void {
    this.pipeline.on('batch_processed', (data: { events: number; processingTime: number }) => {
      this.updateMetric('events_per_second', data.events);
      this.updateMetric('processing_time_ms', data.processingTime);
    });

    this.pipeline.registerProcessor(this.createMetricsProcessor());
  }

  /**
   * Get current metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeries(metric: string): Array<{ timestamp: Date; value: number }> {
    return this.timeSeries.get(metric) || [];
  }

  /**
   * Create processor that collects metrics from events
   */
  private createMetricsProcessor(): StreamProcessor {
    return {
      name: 'metrics-collection',
      process: async (events: AnalyticsEvent[]) => {
        const eventCounts = events.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        for (const [eventType, count] of Object.entries(eventCounts)) {
          this.updateMetric(eventType, count);
        }

        return events; // Pass through events
      }
    };
  }

  /**
   * Update a metric value
   */
  private updateMetric(name: string, value: number): void {
    this.metrics.set(name, value);

    // Update time series
    const series = this.timeSeries.get(name) || [];
    series.push({ timestamp: new Date(), value });

    // Limit series size
    if (series.length > this.maxDataPoints) {
      series.shift();
    }

    this.timeSeries.set(name, series);
  }
}