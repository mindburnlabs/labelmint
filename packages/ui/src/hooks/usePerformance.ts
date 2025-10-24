import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../lib/performance';

export interface UsePerformanceReturn {
  metrics: PerformanceMetrics | null;
  score: number;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  getBundleAnalysis: () => Promise<any>;
}

export function usePerformance(): UsePerformanceReturn {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [score, setScore] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // Get initial metrics
    const initialMetrics = performanceMonitor.getMetrics();
    if (initialMetrics) {
      setMetrics(initialMetrics);
      setScore(performanceMonitor.getPerformanceScore());
    }

    // Set up periodic updates
    const interval = setInterval(() => {
      const currentMetrics = performanceMonitor.getMetrics();
      if (currentMetrics) {
        setMetrics(currentMetrics);
        setScore(performanceMonitor.getPerformanceScore());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startMonitoring = useCallback(() => {
    performanceMonitor.startMonitoring();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const getBundleAnalysis = useCallback(async () => {
    return await performanceMonitor.analyzeBundle();
  }, []);

  return {
    metrics,
    score,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getBundleAnalysis,
  };
}

export default usePerformance;
