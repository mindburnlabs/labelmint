/**
 * Correlation ID Management
 * Handles correlation ID propagation across service boundaries
 */

import { randomUUID } from 'crypto';
import { CorrelationConfig, TraceContext } from './types';

export class CorrelationManager {
  private config: CorrelationConfig;
  private correlationId?: string;
  private traceContext?: TraceContext;

  constructor(config: CorrelationConfig) {
    this.config = {
      enabled: true,
      headerName: 'x-correlation-id',
      generateIfMissing: true,
      includeInResponse: true,
      propagateToDownstream: true,
      ...config
    };
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  setCorrelationId(correlationId: string): void {
    if (this.config.enabled) {
      this.correlationId = correlationId;
    }
  }

  generateCorrelationId(): string {
    const correlationId = randomUUID();
    this.setCorrelationId(correlationId);
    return correlationId;
  }

  ensureCorrelationId(): string {
    if (!this.correlationId && this.config.generateIfMissing) {
      this.generateCorrelationId();
    }
    return this.correlationId || '';
  }

  getTraceId(): string | undefined {
    return this.traceContext?.traceId;
  }

  getSpanId(): string | undefined {
    return this.traceContext?.spanId;
  }

  getTraceContext(): TraceContext | null {
    return this.traceContext || null;
  }

  setTraceContext(traceContext: TraceContext): void {
    if (this.config.enabled) {
      this.traceContext = traceContext;
      // Also set correlation ID from trace context if not already set
      if (!this.correlationId && traceContext.traceId) {
        this.correlationId = traceContext.traceId;
      }
    }
  }

  clear(): void {
    this.correlationId = undefined;
    this.traceContext = undefined;
  }

  // Get headers for downstream calls
  getDownstreamHeaders(): Record<string, string> {
    if (!this.config.enabled || !this.config.propagateToDownstream) {
      return {};
    }

    const headers: Record<string, string> = {};

    if (this.correlationId) {
      headers[this.config.headerName!] = this.correlationId;
    }

    if (this.traceContext) {
      headers['x-trace-id'] = this.traceContext.traceId;
      headers['x-span-id'] = this.traceContext.spanId;
      if (this.traceContext.parentSpanId) {
        headers['x-parent-span-id'] = this.traceContext.parentSpanId;
      }

      // Add baggage headers
      if (this.traceContext.baggage) {
        const baggageItems = Object.entries(this.traceContext.baggage)
          .map(([key, value]) => `${key}=${value}`)
          .join(',');
        headers['baggage'] = baggageItems;
      }

      // Add W3C trace-context header
      headers['traceparent'] = `00-${this.traceContext.traceId}-${this.traceContext.spanId}-01`;
    }

    return headers;
  }

  // Extract context from incoming headers
  extractFromHeaders(headers: Record<string, string>): void {
    if (!this.config.enabled) return;

    // Extract correlation ID
    const correlationId = headers[this.config.headerName!] || headers['correlation-id'];
    if (correlationId) {
      this.correlationId = correlationId;
    }

    // Extract trace context from W3C traceparent header
    const traceparent = headers['traceparent'];
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 4) {
        const [, version, traceId, spanId, flags] = parts;
        this.traceContext = {
          traceId,
          spanId,
          baggage: this.extractBaggage(headers)
        };
      }
    }

    // Extract trace context from custom headers
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];

    if (traceId && spanId && !this.traceContext) {
      this.traceContext = {
        traceId,
        spanId,
        parentSpanId,
        baggage: this.extractBaggage(headers)
      };
    }
  }

  private extractBaggage(headers: Record<string, string>): Record<string, string> {
    const baggageHeader = headers['baggage'];
    const baggage: Record<string, string> = {};

    if (baggageHeader) {
      baggageHeader.split(',').forEach(item => {
        const [key, ...valueParts] = item.split('=');
        if (key && valueParts.length > 0) {
          baggage[key.trim()] = valueParts.join('=').trim();
        }
      });
    }

    return baggage;
  }

  // Create a child context with new span ID
  createChildContext(operationName?: string): TraceContext | null {
    if (!this.traceContext) {
      return null;
    }

    return {
      ...this.traceContext,
      spanId: randomUUID(),
      parentSpanId: this.traceContext.spanId
    };
  }

  // Update baggage
  addBaggage(key: string, value: string): void {
    if (this.traceContext) {
      this.traceContext.baggage = {
        ...this.traceContext.baggage,
        [key]: value
      };
    }
  }

  getBaggage(key?: string): string | Record<string, string> | undefined {
    if (!this.traceContext?.baggage) {
      return undefined;
    }

    if (key) {
      return this.traceContext.baggage[key];
    }

    return this.traceContext.baggage;
  }
}

// AsyncLocalStorage for context propagation (Node.js 12+)
import { AsyncLocalStorage } from 'async_hooks';

export class CorrelationContext {
  private static als = new AsyncLocalStorage<{
    correlationId?: string;
    traceContext?: TraceContext;
  }>();

  static run<T>(
    context: { correlationId?: string; traceContext?: TraceContext },
    fn: () => T
  ): T {
    return this.als.run(context, fn);
  }

  static getCorrelationId(): string | undefined {
    const store = this.als.getStore();
    return store?.correlationId;
  }

  static getTraceContext(): TraceContext | undefined {
    const store = this.als.getStore();
    return store?.traceContext;
  }

  static setCorrelationId(correlationId: string): void {
    const store = this.als.getStore();
    if (store) {
      store.correlationId = correlationId;
    }
  }

  static setTraceContext(traceContext: TraceContext): void {
    const store = this.als.getStore();
    if (store) {
      store.traceContext = traceContext;
    }
  }
}