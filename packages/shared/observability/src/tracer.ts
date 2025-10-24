/**
 * Distributed Tracer Implementation
 * Provides OpenTelemetry-compatible distributed tracing
 */

import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import {
  TracerConfig,
  Span,
  TraceContext,
  SpanStatus,
  SpanEvent,
  TraceExporterConfig,
  SamplingDecision,
  SamplingDecisionPoint
} from './types';

export class Tracer {
  private config: TracerConfig;
  private activeSpans: Map<string, Span> = new Map();
  private exporters: TraceExporter[] = [];

  constructor(config: TracerConfig) {
    this.config = {
      enabled: true,
      sampling: { enabled: true, rate: 1.0 },
      ...config
    };

    this.initializeExporters();
  }

  private initializeExporters(): void {
    if (this.config.exporter) {
      switch (this.config.exporter.type) {
        case 'stdout':
          this.exporters.push(new StdoutExporter(this.config.exporter.config));
          break;
        case 'jaeger':
          this.exporters.push(new JaegerExporter(this.config.exporter.config));
          break;
        case 'zipkin':
          this.exporters.push(new ZipkinExporter(this.config.exporter.config));
          break;
        case 'otlp':
          this.exporters.push(new OTLPExporter(this.config.exporter.config));
          break;
      }
    }
  }

  startSpan(operationName: string, options?: {
    parentSpanId?: string;
    traceId?: string;
    tags?: Record<string, any>;
    startTime?: Date;
  }): Span {
    if (!this.config.enabled) {
      // Return a no-op span if tracing is disabled
      return this.createNoOpSpan(operationName);
    }

    const traceId = options?.traceId || randomUUID();
    const spanId = randomUUID();
    const parentSpanId = options?.parentSpanId;
    const startTime = options?.startTime || new Date();

    // Check sampling decision
    const samplingDecision = this.makeSamplingDecision(traceId, operationName);
    if (!samplingDecision.sampled) {
      return this.createNoOpSpan(operationName);
    }

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime,
      status: SpanStatus.OK,
      tags: {
        'service.name': this.config.service,
        'service.version': this.config.version,
        'service.environment': this.config.environment,
        ...options?.tags
      },
      logs: [],
      events: [],
      service: this.config.service
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  finishSpan(spanId: string, endTime?: Date, status?: SpanStatus): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = endTime || new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    if (status) {
      span.status = status;
    }

    // Export the span
    this.exportSpan(span);

    // Remove from active spans
    this.activeSpans.delete(spanId);
  }

  private exportSpan(span: Span): void {
    for (const exporter of this.exporters) {
      try {
        exporter.export(span);
      } catch (error) {
        console.error('Failed to export span:', error);
      }
    }
  }

  private makeSamplingDecision(traceId: string, operationName: string): SamplingDecision {
    if (!this.config.sampling?.enabled) {
      return { sampled: true, decisionPoint: SamplingDecisionPoint.SPAN_START };
    }

    const rate = this.config.sampling.rate || 1.0;
    const sampled = Math.random() < rate;

    return {
      sampled,
      decisionPoint: SamplingDecisionPoint.SPAN_START,
      attributes: {
        traceId,
        operationName,
        samplingRate: rate
      }
    };
  }

  private createNoOpSpan(operationName: string): Span {
    const startTime = new Date();
    const endTime = new Date();

    return {
      traceId: randomUUID(),
      spanId: randomUUID(),
      operationName,
      startTime,
      endTime,
      duration: 0,
      status: SpanStatus.OK,
      service: this.config.service
    };
  }

  // Convenience methods
  withSpan<T>(
    operationName: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      parentSpanId?: string;
      traceId?: string;
      tags?: Record<string, any>;
    }
  ): Promise<T> {
    const span = this.startSpan(operationName, options);

    try {
      const result = fn(span);

      if (result instanceof Promise) {
        return result
          .then(value => {
            this.finishSpan(span.spanId, undefined, SpanStatus.OK);
            return value;
          })
          .catch(error => {
            span.tags = { ...span.tags, error: true };
            span.status = SpanStatus.ERROR;
            this.finishSpan(span.spanId, undefined, SpanStatus.ERROR);
            throw error;
          });
      } else {
        this.finishSpan(span.spanId, undefined, SpanStatus.OK);
        return Promise.resolve(result);
      }
    } catch (error) {
      span.tags = { ...span.tags, error: true };
      span.status = SpanStatus.ERROR;
      this.finishSpan(span.spanId, undefined, SpanStatus.ERROR);
      throw error;
    }
  }

  // Get active span by ID
  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  // Get all active spans
  getActiveSpans(): Map<string, Span> {
    return new Map(this.activeSpans);
  }
}

// Base exporter interface
abstract class TraceExporter {
  abstract export(span: Span): void;
}

// Console exporter for development
class StdoutExporter extends TraceExporter {
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  export(span: Span): void {
    console.log('TRACE:', JSON.stringify(span, null, 2));
  }
}

// Jaeger exporter (placeholder implementation)
class JaegerExporter extends TraceExporter {
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  export(span: Span): void {
    // In production, this would send to Jaeger agent
    console.log('JAEG:', JSON.stringify({
      traceID: span.traceId,
      spanID: span.spanId,
      operationName: span.operationName,
      startTime: span.startTime.getTime(),
      duration: span.duration,
      tags: span.tags,
      status: span.status
    }));
  }
}

// Zipkin exporter (placeholder implementation)
class ZipkinExporter extends TraceExporter {
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  export(span: Span): void {
    // In production, this would send to Zipkin endpoint
    console.log('ZIPKIN:', JSON.stringify({
      traceId: span.traceId,
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.operationName,
      timestamp: span.startTime.getTime() * 1000, // Microseconds
      duration: span.duration! * 1000, // Microseconds
      localEndpoint: {
        serviceName: span.service
      },
      tags: span.tags
    }));
  }
}

// OTLP exporter (placeholder implementation)
class OTLPExporter extends TraceExporter {
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  export(span: Span): void {
    // In production, this would send to OTLP endpoint (e.g., Jaeger, Tempo)
    console.log('OTLP:', JSON.stringify({
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: span.service } },
            { key: 'service.version', value: { stringValue: this.config.version } }
          ]
        },
        scopeSpans: [{
          spans: [{
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            name: span.operationName,
            kind: 1, // SPAN_KIND_SERVER
            startTimeUnixNano: span.startTime.getTime() * 1000000,
            endTimeUnixNano: span.endTime!.getTime() * 1000000,
            attributes: Object.entries(span.tags || {}).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) }
            })),
            status: {
              code: span.status === SpanStatus.OK ? 1 : 2,
              message: span.status
            }
          }]
        }]
      }]
    }));
  }
}

// Utility functions
export function createTracer(config: TracerConfig): Tracer {
  return new Tracer(config);
}

// Global tracer instance
let globalTracer: Tracer | null = null;

export function getGlobalTracer(): Tracer {
  if (!globalTracer) {
    globalTracer = new Tracer({
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enabled: process.env.TRACING_ENABLED !== 'false'
    });
  }
  return globalTracer;
}