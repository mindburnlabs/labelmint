import { useEffect, useRef, useCallback, useState } from 'react';
import { debounce } from '../lib/utils';

interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  reRenderCount: number;
  memoryUsage?: number;
  lastInteraction?: number;
}

interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  trackRenders?: boolean;
  trackMemory?: boolean;
  trackInteractions?: boolean;
  reportToAnalytics?: boolean;
  threshold?: number;
}

export function usePerformanceMonitor(
  componentName: string,
  options: UsePerformanceMonitorOptions = {}
) {
  const {
    enabled = process.env.NODE_ENV === 'development',
    trackRenders = true,
    trackMemory = true,
    trackInteractions = true,
    reportToAnalytics = false,
    threshold = 100, // ms
  } = options;

  const renderCountRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const lastInteractionRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    reRenderCount: 0,
  });

  // Track component renders
  useEffect(() => {
    if (!enabled || !trackRenders) return;

    renderCountRef.current += 1;
    startTimeRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - startTimeRef.current;

      setMetrics(prev => ({
        ...prev,
        renderTime,
        reRenderCount: renderCountRef.current,
      }));

      // Log slow renders
      if (renderTime > threshold) {
        console.warn(
          `⚡ Slow render in ${componentName}: ${renderTime.toFixed(2)}ms (Render #${renderCountRef.current})`
        );
      }

      // Report to analytics
      if (reportToAnalytics && window.gtag) {
        window.gtag('event', 'component_render', {
          component_name: componentName,
          render_time: renderTime,
          render_count: renderCountRef.current,
          is_slow: renderTime > threshold,
        });
      }
    };
  });

  // Track memory usage
  useEffect(() => {
    if (!enabled || !trackMemory || !(performance as any).memory) return;

    const checkMemory = debounce(() => {
      const memory = (performance as any).memory;
      const usedMemory = memory ? memory.usedJSHeapSize / 1024 / 1024 : 0;

      setMetrics(prev => ({
        ...prev,
        memoryUsage: usedMemory,
      }));

      // Warn about high memory usage
      if (usedMemory > 50) {
        console.warn(
          `⚠️ High memory usage in ${componentName}: ${usedMemory.toFixed(2)}MB`
        );
      }
    }, 1000);

    const interval = setInterval(checkMemory, 5000);
    return () => clearInterval(interval);
  }, [enabled, trackMemory, componentName]);

  // Track user interactions
  const trackInteraction = useCallback(() => {
    if (!enabled || !trackInteractions) return;

    lastInteractionRef.current = performance.now();
    setMetrics(prev => ({
      ...prev,
      lastInteraction: lastInteractionRef.current,
    }));

    if (reportToAnalytics && window.gtag) {
      window.gtag('event', 'component_interaction', {
        component_name: componentName,
        timestamp: lastInteractionRef.current,
      });
    }
  }, [enabled, trackInteractions, reportToAnalytics, componentName]);

  // Get performance report
  const getReport = useCallback(() => {
    return {
      component: componentName,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }, [componentName, metrics]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    renderCountRef.current = 0;
    startTimeRef.current = performance.now();
    setMetrics({
      renderTime: 0,
      componentCount: 0,
      reRenderCount: 0,
      memoryUsage: 0,
    });
  }, []);

  return {
    metrics,
    trackInteraction,
    getReport,
    resetMetrics,
  };
}

// Performance monitoring for routes/pages
export function useRoutePerformanceMonitor(routeName: string) {
  const [loadingTime, setLoadingTime] = useState<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    // Report route change
    if (window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: routeName,
      });
    }

    return () => {
      const loadTime = performance.now() - startTimeRef.current;
      setLoadingTime(loadTime);

      // Log slow routes
      if (loadTime > 1000) {
        console.warn(`🚀 Slow route load: ${routeName} took ${loadTime.toFixed(2)}ms`);
      }

      // Report to analytics
      if (window.gtag) {
        window.gtag('event', 'route_load', {
          route_name: routeName,
          load_time: loadTime,
          is_slow: loadTime > 1000,
        });
      }
    };
  }, [routeName]);

  return {
    loadingTime,
  };
}

// Core Web Vitals monitoring
export function useWebVitals() {
  const [vitals, setVitals] = useState({
    lcp: 0, // Largest Contentful Paint
    fid: 0, // First Input Delay
    cls: 0, // Cumulative Layout Shift
    fcp: 0, // First Contentful Paint
    ttfb: 0, // Time to First Byte
  });

  useEffect(() => {
    // Measure LCP
    const measureLCP = () => {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          setVitals(prev => ({ ...prev, lcp: lastEntry.startTime }));
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    };

    // Measure FID
    const measureFID = () => {
      new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          if (entry.name === 'first-input') {
            const fidEntry = entry as any;
            setVitals(prev => ({ ...prev, fid: fidEntry.processingStart - entry.startTime }));
          }
        });
      }).observe({ entryTypes: ['first-input'] });
    };

    // Measure CLS
    const measureCLS = () => {
      let clsValue = 0;
      new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            setVitals(prev => ({ ...prev, cls: clsValue }));
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    };

    // Measure FCP
    const measureFCP = () => {
      new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            setVitals(prev => ({ ...prev, fcp: entry.startTime }));
          }
        });
      }).observe({ entryTypes: ['paint'] });
    };

    // Measure TTFB
    const measureTTFB = () => {
      if (window.performance.timing) {
        const ttfb = window.performance.timing.responseStart - window.performance.timing.requestStart;
        setVitals(prev => ({ ...prev, ttfb }));
      }
    };

    // Run measurements
    measureLCP();
    measureFID();
    measureCLS();
    measureFCP();
    measureTTFB();
  }, []);

  // Log vitals
  useEffect(() => {
    const logVitals = () => {
      console.log('📊 Core Web Vitals:', {
        LCP: `${vitals.lcp.toFixed(2)}ms`,
        FID: `${vitals.fid.toFixed(2)}ms`,
        CLS: vitals.cls.toFixed(3),
        FCP: `${vitals.fcp.toFixed(2)}ms`,
        TTFB: `${vitals.ttfb}ms`,
      });

      // Report to analytics
      if (window.gtag) {
        Object.entries(vitals).forEach(([metric, value]) => {
          window.gtag('event', 'web_vital', {
            metric_name: metric.toLowerCase(),
            value: Math.round(value),
          });
        });
      }
    };

    // Log after page load
    if (document.readyState === 'complete') {
      logVitals();
    } else {
      window.addEventListener('load', logVitals);
      return () => window.removeEventListener('load', logVitals);
    }
  }, [vitals]);

  return vitals;
}

// Performance scoring
export function getPerformanceScore(metrics: PerformanceMetrics): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Render time scoring
  if (metrics.renderTime > 500) {
    issues.push('Very slow render time (>500ms)');
    score -= 40;
  } else if (metrics.renderTime > 200) {
    issues.push('Slow render time (>200ms)');
    score -= 20;
  }

  // Re-render scoring
  if (metrics.reRenderCount > 10) {
    issues.push('Too many re-renders (>10)');
    score -= 30;
  } else if (metrics.reRenderCount > 5) {
    issues.push('Many re-renders (>5)');
    score -= 15;
  }

  // Memory scoring
  if (metrics.memoryUsage && metrics.memoryUsage > 100) {
    issues.push('High memory usage (>100MB)');
    score -= 25;
  }

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade, issues };
}