// Performance optimization utilities for LabelMint

export interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: Array<{
    name: string;
    size: number;
    gzippedSize: number;
  }>;
  unusedCode: number;
  duplicateCode: number;
}

/**
 * Performance monitoring and optimization utilities
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics | null = null;
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Monitor Core Web Vitals
    this.observeCoreWebVitals();
    
    // Monitor resource loading
    this.observeResourceTiming();
    
    // Monitor navigation timing
    this.observeNavigationTiming();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  /**
   * Observe Core Web Vitals
   */
  private observeCoreWebVitals(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (this.metrics) {
          this.metrics.largestContentfulPaint = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (this.metrics) {
            this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        if (this.metrics) {
          this.metrics.cumulativeLayoutShift = clsValue;
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }
  }

  /**
   * Observe resource timing
   */
  private observeResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          // Log slow resources
          if (entry.duration > 1000) {
            console.warn('Slow resource detected:', {
              name: entry.name,
              duration: entry.duration,
              size: entry.transferSize,
            });
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }
  }

  /**
   * Observe navigation timing
   */
  private observeNavigationTiming(): void {
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics = {
            loadTime: entry.loadEventEnd - entry.loadEventStart,
            firstContentfulPaint: entry.responseEnd - entry.requestStart,
            largestContentfulPaint: 0, // Set by LCP observer
            firstInputDelay: 0, // Set by FID observer
            cumulativeLayoutShift: 0, // Set by CLS observer
            timeToInteractive: entry.domInteractive - entry.navigationStart,
          };
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    }
  }

  /**
   * Analyze bundle size
   */
  async analyzeBundle(): Promise<BundleAnalysis> {
    // This would typically be done at build time
    // For runtime analysis, we can estimate based on loaded resources
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const totalSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
    const gzippedSize = Math.round(totalSize * 0.3); // Estimate 70% compression

    return {
      totalSize,
      gzippedSize,
      chunks: resources.map(resource => ({
        name: resource.name.split('/').pop() || 'unknown',
        size: resource.transferSize || 0,
        gzippedSize: Math.round((resource.transferSize || 0) * 0.3),
      })),
      unusedCode: 0, // Would need build-time analysis
      duplicateCode: 0, // Would need build-time analysis
    };
  }

  /**
   * Get performance score
   */
  getPerformanceScore(): number {
    if (!this.metrics) return 0;

    let score = 100;

    // LCP scoring (0-100)
    if (this.metrics.largestContentfulPaint > 4000) score -= 30;
    else if (this.metrics.largestContentfulPaint > 2500) score -= 15;

    // FID scoring (0-100)
    if (this.metrics.firstInputDelay > 300) score -= 25;
    else if (this.metrics.firstInputDelay > 100) score -= 10;

    // CLS scoring (0-100)
    if (this.metrics.cumulativeLayoutShift > 0.25) score -= 25;
    else if (this.metrics.cumulativeLayoutShift > 0.1) score -= 10;

    return Math.max(0, score);
  }
}

/**
 * Image optimization utilities
 */
export class ImageOptimizer {
  /**
   * Generate responsive image srcset
   */
  static generateSrcSet(baseUrl: string, widths: number[]): string {
    return widths
      .map(width => `${baseUrl}?w=${width} ${width}w`)
      .join(', ');
  }

  /**
   * Lazy load images
   */
  static lazyLoadImages(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Preload critical images
   */
  static preloadCriticalImages(urls: string[]): void {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  }
}

/**
 * Code splitting utilities
 */
export class CodeSplitter {
  /**
   * Dynamic import with error handling
   */
  static async loadComponent<T>(
    importFn: () => Promise<{ default: T }>,
    fallback?: T
  ): Promise<T> {
    try {
      const module = await importFn();
      return module.default;
    } catch (error) {
      console.error('Failed to load component:', error);
      if (fallback) return fallback;
      throw error;
    }
  }

  /**
   * Preload route components
   */
  static preloadRoute(routePath: string): void {
    // This would be implemented based on your routing system
    console.log(`Preloading route: ${routePath}`);
  }
}

/**
 * Memory optimization utilities
 */
export class MemoryOptimizer {
  private static cleanupFunctions: (() => void)[] = [];

  /**
   * Register cleanup function
   */
  static registerCleanup(cleanup: () => void): void {
    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Run all cleanup functions
   */
  static cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup function failed:', error);
      }
    });
    this.cleanupFunctions = [];
  }

  /**
   * Monitor memory usage
   */
  static getMemoryUsage(): any {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }
}

/**
 * Mobile optimization utilities
 */
export class MobileOptimizer {
  /**
   * Detect mobile device
   */
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Detect touch device
   */
  static isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get viewport dimensions
   */
  static getViewportDimensions(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * Optimize for mobile viewport
   */
  static optimizeViewport(): void {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }
  }

  /**
   * Add mobile-specific optimizations
   */
  static addMobileOptimizations(): void {
    // Prevent zoom on input focus
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
          );
        }
      });

      input.addEventListener('blur', () => {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0'
          );
        }
      });
    });
  }
}

// Default performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  performanceMonitor.startMonitoring();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    performanceMonitor.stopMonitoring();
    MemoryOptimizer.cleanup();
  });

  // Mobile optimizations
  if (MobileOptimizer.isMobile()) {
    MobileOptimizer.optimizeViewport();
    MobileOptimizer.addMobileOptimizations();
  }
}

export default performanceMonitor;
