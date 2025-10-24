/**
 * Metrics Collection and Export
 * Provides Prometheus-compatible metrics collection
 */

import { EventEmitter } from 'events';
import {
  MetricValue,
  MetricType,
  HistogramBucket,
  MetricSummary,
  MetricsConfig,
  QuantileValue
} from './types';

export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private metrics: Map<string, MetricValue> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private summaries: Map<string, Summary> = new Map();

  constructor(config: MetricsConfig) {
    super();
    this.config = {
      enabled: true,
      prefix: '',
      labels: {},
      ...config
    };
  }

  // Counter metrics
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metricName = this.prefixName(name);
    let counter = this.counters.get(metricName);

    if (!counter) {
      counter = new Counter(metricName, this.config.labels);
      this.counters.set(metricName, counter);
    }

    counter.inc(value, labels);
    this.emit('metricUpdate', metricName, counter.getValue());
  }

  // Gauge metrics
  set(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metricName = this.prefixName(name);
    let gauge = this.gauges.get(metricName);

    if (!gauge) {
      gauge = new Gauge(metricName, this.config.labels);
      this.gauges.set(metricName, gauge);
    }

    gauge.set(value, labels);
    this.emit('metricUpdate', metricName, gauge.getValue());
  }

  gauge(name: string, labels?: Record<string, string>): Gauge | undefined {
    const metricName = this.prefixName(name);
    return this.gauges.get(metricName);
  }

  // Histogram metrics
  observe(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metricName = this.prefixName(name);
    let histogram = this.histograms.get(metricName);

    if (!histogram) {
      const buckets = this.config.bucketer?.duration || [0.1, 0.5, 1, 2.5, 5, 10];
      histogram = new Histogram(metricName, buckets, this.config.labels);
      this.histograms.set(metricName, histogram);
    }

    histogram.observe(value, labels);
    this.emit('metricUpdate', metricName, histogram.getValue());
  }

  // Timer convenience method
  timer(name: string, labels?: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.observe(name, duration, labels);
    };
  }

  // Summary metrics
  summary(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metricName = this.prefixName(name);
    let summary = this.summaries.get(metricName);

    if (!summary) {
      summary = new Summary(metricName, this.config.labels);
      this.summaries.set(metricName, summary);
    }

    summary.observe(value, labels);
    this.emit('metricUpdate', metricName, summary.getValue());
  }

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    let output = '';

    // Export counters
    for (const [name, counter] of this.counters) {
      output += counter.toPrometheus();
    }

    // Export gauges
    for (const [name, gauge] of this.gauges) {
      output += gauge.toPrometheus();
    }

    // Export histograms
    for (const [name, histogram] of this.histograms) {
      output += histogram.toPrometheus();
    }

    // Export summaries
    for (const [name, summary] of this.summaries) {
      output += summary.toPrometheus();
    }

    return output;
  }

  // Get all metrics as JSON
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, counter] of this.counters) {
      result[name] = counter.getValue();
    }

    for (const [name, gauge] of this.gauges) {
      result[name] = gauge.getValue();
    }

    for (const [name, histogram] of this.histograms) {
      result[name] = histogram.getValue();
    }

    for (const [name, summary] of this.summaries) {
      result[name] = summary.getValue();
    }

    return result;
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.metrics.clear();
  }

  private prefixName(name: string): string {
    return this.config.prefix ? `${this.config.prefix}_${name}` : name;
  }
}

// Counter implementation
class Counter {
  private value: number = 0;
  private values: Map<string, number> = new Map();
  private name: string;
  private defaultLabels: Record<string, string>;

  constructor(name: string, defaultLabels: Record<string, string>) {
    this.name = name;
    this.defaultLabels = defaultLabels;
  }

  inc(value: number = 1, labels?: Record<string, string>): void {
    if (labels) {
      const key = this.serializeLabels(labels);
      this.values.set(key, (this.values.get(key) || 0) + value);
    } else {
      this.value += value;
    }
  }

  getValue(): MetricValue {
    return {
      name: this.name,
      value: this.value,
      type: MetricType.COUNTER
    };
  }

  getLabeledValues(): Map<string, MetricValue> {
    const result = new Map<string, MetricValue>();
    for (const [labels, value] of this.values) {
      result.set(labels, {
        name: this.name,
        value,
        labels: this.deserializeLabels(labels)
      });
    }
    return result;
  }

  toPrometheus(): string {
    let output = `# HELP ${this.name} Total counter\n`;
    output += `# TYPE ${this.name} counter\n`;

    if (this.value > 0) {
      output += `${this.name} ${this.value}\n`;
    }

    for (const [labels, value] of this.values) {
      output += `${this.name}{${labels}} ${value}\n`;
    }

    return output;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    return Object.entries(allLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  private deserializeLabels(serialized: string): Record<string, string> {
    const labels: Record<string, string> = {};
    serialized.split(',').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        labels[key] = value.replace(/"/g, '');
      }
    });
    return labels;
  }
}

// Gauge implementation
class Gauge {
  private value: number = 0;
  private values: Map<string, number> = new Map();
  private name: string;
  private defaultLabels: Record<string, string>;

  constructor(name: string, defaultLabels: Record<string, string>) {
    this.name = name;
    this.defaultLabels = defaultLabels;
  }

  set(value: number, labels?: Record<string, string>): void {
    if (labels) {
      const key = this.serializeLabels(labels);
      this.values.set(key, value);
    } else {
      this.value = value;
    }
  }

  getValue(): MetricValue {
    return {
      name: this.name,
      value: this.value,
      type: MetricType.GAUGE
    };
  }

  toPrometheus(): string {
    let output = `# HELP ${this.name} Current gauge value\n`;
    output += `# TYPE ${this.name} gauge\n`;

    if (this.value !== 0) {
      output += `${this.name} ${this.value}\n`;
    }

    for (const [labels, value] of this.values) {
      output += `${this.name}{${labels}} ${value}\n`;
    }

    return output;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    return Object.entries(allLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

// Histogram implementation
class Histogram {
  private name: string;
  private buckets: number[];
  private bucketCounts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private counts: Map<string, number> = new Map();
  private defaultLabels: Record<string, string>;

  constructor(name: string, buckets: number[], defaultLabels: Record<string, string>) {
    this.name = name;
    this.buckets = [...buckets, Infinity];
    this.defaultLabels = defaultLabels;
  }

  observe(value: number, labels?: Record<string, string>): void {
    const key = labels ? this.serializeLabels(labels) : '';

    // Initialize arrays if needed
    if (!this.bucketCounts.has(key)) {
      this.bucketCounts.set(key, new Array(this.buckets.length).fill(0));
      this.sums.set(key, 0);
      this.counts.set(key, 0);
    }

    const counts = this.bucketCounts.get(key)!;
    const sum = this.sums.get(key)!;
    const count = this.counts.get(key)!;

    // Find appropriate bucket
    let bucketIndex = this.buckets.findIndex(bucket => value <= bucket);
    if (bucketIndex === -1) bucketIndex = this.buckets.length - 1;

    // Update counts
    for (let i = bucketIndex; i < this.buckets.length; i++) {
      counts[i]++;
    }

    this.sums.set(key, sum + value);
    this.counts.set(key, count + 1);
  }

  getValue(): MetricValue {
    return {
      name: this.name,
      value: 0,
      type: MetricType.HISTOGRAM
    };
  }

  toPrometheus(): string {
    let output = `# HELP ${this.name} Histogram\n`;
    output += `# TYPE ${this.name} histogram\n`;

    for (const [labels, counts] of this.bucketCounts) {
      const sum = this.sums.get(labels) || 0;
      const count = this.counts.get(labels) || 0;
      const labelStr = labels ? `{${labels}}` : '';

      // Bucket counts
      this.buckets.forEach((bucket, index) => {
        output += `${this.name}_bucket{le="${bucket}"${labelStr ? ', ' + labelStr : ''}} ${counts[index]}\n`;
      });

      // Sum and count
      output += `${this.name}_sum${labelStr} ${sum}\n`;
      output += `${this.name}_count${labelStr} ${count}\n`;
    }

    return output;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    return Object.entries(allLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

// Summary implementation
class Summary {
  private name: string;
  private values: Map<string, number[]> = new Map();
  private counts: Map<string, number> = new Map();
  private sums: Map<string, number> = new Map();
  private defaultLabels: Record<string, string>;
  private maxAge: number = 600000; // 10 minutes
  private ageBuckets: number = 5;

  constructor(name: string, defaultLabels: Record<string, string>) {
    this.name = name;
    this.defaultLabels = defaultLabels;
  }

  observe(value: number, labels?: Record<string, string>): void {
    const key = labels ? this.serializeLabels(labels) : '';

    if (!this.values.has(key)) {
      this.values.set(key, []);
      this.counts.set(key, 0);
      this.sums.set(key, 0);
    }

    const values = this.values.get(key)!;
    const count = this.counts.get(key)!;
    const sum = this.sums.get(key)!;

    values.push(value);
    this.counts.set(key, count + 1);
    this.sums.set(key, sum + value);

    // TODO: Implement sliding window based on maxAge and ageBuckets
  }

  getValue(): MetricValue {
    return {
      name: this.name,
      value: 0,
      type: MetricType.SUMMARY
    };
  }

  toPrometheus(): string {
    let output = `# HELP ${this.name} Summary\n`;
    output += `# TYPE ${this.name} summary\n`;

    for (const [labels, values] of this.values) {
      const count = this.counts.get(labels) || 0;
      const sum = this.sums.get(labels) || 0;
      const labelStr = labels ? `{${labels}}` : '';

      // Calculate quantiles
      const sorted = [...values].sort((a, b) => a - b);
      const quantiles = [0.5, 0.9, 0.95, 0.99];

      quantiles.forEach(q => {
        const index = Math.floor(q * sorted.length);
        const value = sorted[index] || 0;
        output += `${this.name}{quantile="${q}"${labelStr ? ', ' + labelStr : ''}} ${value}\n`;
      });

      output += `${this.name}_sum${labelStr} ${sum}\n`;
      output += `${this.name}_count${labelStr} ${count}\n`;
    }

    return output;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    return Object.entries(allLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

// Factory function
export function createMetricsCollector(config: MetricsConfig): MetricsCollector {
  return new MetricsCollector(config);
}

// Global metrics collector
let globalMetrics: MetricsCollector | null = null;

export function getGlobalMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector({
      enabled: process.env.METRICS_ENABLED !== 'false',
      prefix: process.env.METRICS_PREFIX || 'labelmint',
      labels: {
        service: process.env.SERVICE_NAME || 'unknown',
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }
  return globalMetrics;
}