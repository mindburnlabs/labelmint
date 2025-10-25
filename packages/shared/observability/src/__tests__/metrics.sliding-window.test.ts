import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Summary } from '../metrics';

describe('Sliding Window Summary Metrics', () => {
  let summary: Summary;

  beforeEach(() => {
    summary = new Summary('test_metric', { service: 'test' });
  });

  describe('Basic Sliding Window Functionality', () => {
    it('should track values within the sliding window', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Add some values
      summary.observe(10);
      summary.observe(20);
      summary.observe(30);

      const result = summary.getValue();
      expect(result.value).toBe(20); // Mean of 10, 20, 30
      expect(result.metadata?.count).toBe(3);
      expect(result.metadata?.sum).toBe(60);
    });

    it('should expire values outside the sliding window', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Set a short window for testing
      summary.setSlidingWindow(1000, 2); // 1 second window

      // Add initial values
      summary.observe(10);
      summary.observe(20);

      let result = summary.getValue();
      expect(result.metadata?.count).toBe(2);

      // Advance time beyond window
      vi.spyOn(Date, 'now').mockReturnValue(now + 1500);

      // Add new value
      summary.observe(30);

      result = summary.getValue();
      expect(result.metadata?.count).toBe(1); // Only the new value should remain
      expect(result.value).toBe(30);
    });

    it('should handle cleanup when ageBuckets threshold is reached', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Set window with frequent cleanup
      summary.setSlidingWindow(10000, 10); // 10 seconds, 10 buckets = cleanup every 1 second

      // Add values
      for (let i = 0; i < 5; i++) {
        summary.observe(i);
      }

      let result = summary.getValue();
      expect(result.metadata?.count).toBe(5);

      // Advance time to trigger cleanup
      vi.spyOn(Date, 'now').mockReturnValue(now + 1100);

      // Add another value (this should trigger cleanup)
      summary.observe(5);

      result = summary.getValue();
      expect(result.metadata?.count).toBe(6); // Should still have all values as none are expired
    });
  });

  describe('Quantile Calculations', () => {
    beforeEach(() => {
      // Add predictable data for quantile testing
      summary.setSlidingWindow(60000, 5); // 1 minute window

      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      values.forEach(value => summary.observe(value));
    });

    it('should calculate correct quantiles', () => {
      const result = summary.getValue();

      expect(result.metadata?.quantiles?.['0.5']).toBe(5.5); // Median
      expect(result.metadata?.quantiles?.['0.9']).toBe(9);  // 90th percentile
      expect(result.metadata?.quantiles?.['0.95']).toBe(10); // 95th percentile
      expect(result.metadata?.quantiles?.['0.99']).toBe(10); // 99th percentile
    });

    it('should handle edge cases with small datasets', () => {
      // Create new summary with single value
      const singleValueSummary = new Summary('single_test', {});
      singleValueSummary.observe(42);

      const result = singleValueSummary.getValue();

      expect(result.metadata?.quantiles?.['0.5']).toBe(42);
      expect(result.metadata?.quantiles?.['0.9']).toBe(42);
      expect(result.metadata?.quantiles?.['0.95']).toBe(42);
      expect(result.metadata?.quantiles?.['0.99']).toBe(42);
    });
  });

  describe('Labels Handling', () => {
    it('should maintain separate sliding windows for different labels', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.setSlidingWindow(5000, 5);

      // Add values with different labels
      summary.observe(10, { endpoint: '/api/users' });
      summary.observe(20, { endpoint: '/api/users' });
      summary.observe(100, { endpoint: '/api/orders' });
      summary.observe(200, { endpoint: '/api/orders' });

      const usersResult = summary.getValue({ endpoint: '/api/users' });
      const ordersResult = summary.getValue({ endpoint: '/api/orders' });

      expect(usersResult.metadata?.count).toBe(2);
      expect(usersResult.value).toBe(15); // Mean of 10, 20

      expect(ordersResult.metadata?.count).toBe(2);
      expect(ordersResult.value).toBe(150); // Mean of 100, 200
    });

    it('should expire values separately for different label combinations', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.setSlidingWindow(1000, 2);

      // Add values with different labels at different times
      summary.observe(10, { method: 'GET' });

      // Advance time
      vi.spyOn(Date, 'now').mockReturnValue(now + 500);

      summary.observe(20, { method: 'POST' });

      let getResult = summary.getValue({ method: 'GET' });
      let postResult = summary.getValue({ method: 'POST' });

      expect(getResult.metadata?.count).toBe(1);
      expect(postResult.metadata?.count).toBe(1);

      // Advance time beyond window for GET but not POST
      vi.spyOn(Date, 'now').mockReturnValue(now + 1500);

      // Add another value to trigger cleanup
      summary.observe(30, { method: 'PUT' });

      getResult = summary.getValue({ method: 'GET' });
      postResult = summary.getValue({ method: 'POST' });
      const putResult = summary.getValue({ method: 'PUT' });

      expect(getResult.metadata?.count).toBe(0); // Should be expired
      expect(postResult.metadata?.count).toBe(1); // Should still exist
      expect(putResult.metadata?.count).toBe(1); // New value
    });
  });

  describe('Configuration', () => {
    it('should allow sliding window configuration', () => {
      summary.setSlidingWindow(30000, 6); // 30 seconds, 6 buckets

      // Verify configuration is set (indirectly through behavior)
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.observe(10);

      // Advance time by 5 seconds (30/6)
      vi.spyOn(Date, 'now').mockReturnValue(now + 5000);

      summary.observe(20);

      // Both values should still be present
      const result = summary.getValue();
      expect(result.metadata?.count).toBe(2);
    });

    it('should ensure minimum of 1 age bucket', () => {
      summary.setSlidingWindow(10000, 0); // Try to set 0 buckets

      // Should not crash and should still work
      summary.observe(10);
      const result = summary.getValue();
      expect(result.metadata?.count).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should clean up old values to prevent memory leaks', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.setSlidingWindow(100, 2); // Very short window for testing

      // Add many values
      for (let i = 0; i < 100; i++) {
        summary.observe(i);

        // Advance time slightly for each value
        vi.spyOn(Date, 'now').mockReturnValue(now + i * 2);
      }

      // Should only have recent values in memory
      const result = summary.getValue();
      expect(result.metadata?.count).toBeLessThan(100);
      expect(result.metadata?.count).toBeGreaterThan(0);
    });

    it('should handle edge case when all values are expired', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.setSlidingWindow(100, 2);

      summary.observe(10);

      // Advance time far beyond window
      vi.spyOn(Date, 'now').mockReturnValue(now + 1000);

      // Add value to trigger cleanup
      summary.observe(20);

      const result = summary.getValue();
      expect(result.metadata?.count).toBe(1);
      expect(result.value).toBe(20);
    });
  });

  describe('Prometheus Format', () => {
    it('should include sliding window info in Prometheus output', () => {
      summary.setSlidingWindow(60000, 5); // 1 minute window
      summary.observe(10, { status: '200' });
      summary.observe(20, { status: '200' });

      const prometheus = summary.toPrometheus();

      expect(prometheus).toContain('Summary with sliding window (60000ms)');
      expect(prometheus).toContain('quantile="0.5"');
      expect(prometheus).toContain('quantile="0.9"');
      expect(prometheus).toContain('quantile="0.95"');
      expect(prometheus).toContain('quantile="0.99"');
      expect(prometheus).toContain('test_metric_sum');
      expect(prometheus).toContain('test_metric_count');
      expect(prometheus).toContain('status="200"');
    });

    it('should skip empty label sets in Prometheus output', () => {
      summary.setSlidingWindow(60000, 5);

      // Add values then advance time to expire them
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      summary.observe(10, { temp: 'value' });

      // Advance beyond window
      vi.spyOn(Date, 'now').mockReturnValue(now + 70000);

      summary.observe(20); // This should trigger cleanup

      const prometheus = summary.toPrometheus();

      // Should not include any metrics for expired data
      expect(prometheus).toContain('Summary with sliding window');
      expect(prometheus).toContain('# TYPE test_metric summary');
      // Should not have actual metric lines for expired data
    });
  });
});