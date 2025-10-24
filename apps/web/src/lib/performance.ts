/**
 * Performance Optimization Module for LabelMint PWA
 * Handles lazy loading, virtual scrolling, and performance monitoring
 */

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
}

class PerformanceOptimizer {
  private observers: PerformanceObserver[] = [];
  private metrics: Partial<PerformanceMetrics> = {};
  private resourceTimings: ResourceTiming[] = [];
  private isMonitoring = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize performance monitoring
   */
  private init(): void {
    if (typeof window === 'undefined') return;

    // Observe Core Web Vitals
    this.observeFCP();
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeTTFB();

    // Observe resource timing
    this.observeResourceTiming();

    // Setup lazy loading
    this.setupLazyLoading();

    // Preload critical resources
    this.preloadCriticalResources();

    // Setup Web Workers
    this.setupWebWorkers();

    // Initialize virtual scrolling
    this.initVirtualScroll();

    console.log('Performance optimizer initialized');
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Report metrics periodically
    setInterval(() => {
      this.reportMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Observe First Contentful Paint
   */
  private observeFCP(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcp = entries[0] as PerformancePaintTiming;
      this.metrics.fcp = fcp.startTime;
    });

    observer.observe({ type: 'paint', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Observe Largest Contentful Paint
   */
  private observeLCP(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1];
      this.metrics.lcp = lcp.startTime;
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Observe First Input Delay
   */
  private observeFID(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fid = entries[0];
      this.metrics.fid = (fid as any).processingStart - fid.startTime;
    });

    observer.observe({ type: 'first-input', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Observe Cumulative Layout Shift
   */
  private observeCLS(): void {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.metrics.cls = clsValue;
    });

    observer.observe({ type: 'layout-shift', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Observe Time to First Byte
   */
  private observeTTFB(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const ttfb = entries[0] as PerformanceNavigationTiming;
      this.metrics.ttfb = ttfb.responseStart - ttfb.requestStart;
    });

    observer.observe({ type: 'navigation', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Observe resource timing
   */
  private observeResourceTiming(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          this.resourceTimings.push({
            name: resource.name,
            duration: resource.duration,
            transferSize: resource.transferSize,
            encodedBodySize: resource.encodedBodySize
          });
        }
      }
    });

    observer.observe({ type: 'resource', buffered: true });
    this.observers.push(observer);
  }

  /**
   * Setup lazy loading for images
   */
  private setupLazyLoading(): void {
    if (!('IntersectionObserver' in window)) return;

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          this.loadImage(img);
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px', // Start loading 50px before entering viewport
      threshold: 0.01
    });

    // Observe all images with data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });

    // Setup for dynamically added images
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'IMG' && element.hasAttribute('data-src')) {
              imageObserver.observe(element);
            } else {
              element.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
              });
            }
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Load an image
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (!src) return;

    // Create new image to preload
    const newImg = new Image();
    newImg.onload = () => {
      img.src = src;
      img.classList.remove('lazy');
      img.classList.add('loaded');
    };

    newImg.onerror = () => {
      img.classList.add('error');
    };

    newImg.src = src;
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources(): void {
    const criticalResources = [
      { url: '/fonts/inter-v12-latin-regular.woff2', as: 'font', type: 'font/woff2' },
      { url: '/fonts/inter-v12-latin-bold.woff2', as: 'font', type: 'font/woff2' },
      { url: '/api/user/profile', as: 'fetch' },
      { url: '/api/projects/active', as: 'fetch' }
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.url;
      link.as = resource.as;
      if (resource.type) link.type = resource.type;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  /**
   * Setup Web Workers for heavy tasks
   */
  private setupWebWorkers(): void {
    if (!('Worker' in window)) return;

    // Create worker pool for image processing
    const imageWorkerPool: Worker[] = [];
    const poolSize = Math.min(navigator.hardwareConcurrency || 4, 4);

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker('/workers/image-processor.js');
      worker.onmessage = this.handleWorkerMessage;
      imageWorkerPool.push(worker);
    }

    // Store worker pool globally
    (window as any).imageWorkerPool = imageWorkerPool;

    // Create worker for data processing
    const dataWorker = new Worker('/workers/data-processor.js');
    dataWorker.onmessage = this.handleWorkerMessage;
    (window as any).dataWorker = dataWorker;
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage = (event: MessageEvent): void => {
    const { type, data, id } = event.data;

    switch (type) {
      case 'IMAGE_PROCESSED':
        this.dispatchCustomEvent('imageProcessed', { id, data });
        break;
      case 'DATA_PROCESSED':
        this.dispatchCustomEvent('dataProcessed', { id, data });
        break;
      case 'PROGRESS':
        this.dispatchCustomEvent('workerProgress', { id, progress: data });
        break;
      case 'ERROR':
        console.error('Worker error:', data);
        this.dispatchCustomEvent('workerError', { id, error: data });
        break;
    }
  };

  /**
   * Initialize virtual scrolling
   */
  private initVirtualScroll(): void {
    // Find all containers with virtual-scroll class
    document.querySelectorAll('.virtual-scroll').forEach(container => {
      this.setupVirtualScroll(container as HTMLElement);
    });
  }

  /**
   * Setup virtual scrolling for a container
   */
  setupVirtualScroll(container: HTMLElement): void {
    const items = JSON.parse(container.dataset.items || '[]');
    const itemHeight = parseInt(container.dataset.itemHeight || '80');
    const buffer = parseInt(container.dataset.buffer || '5');

    const virtualScroll = new VirtualScroll({
      container,
      items,
      itemHeight,
      buffer
    });

    (container as any).virtualScroll = virtualScroll;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get resource timings
   */
  getResourceTimings(): ResourceTiming[] {
    return [...this.resourceTimings];
  }

  /**
   * Report metrics to analytics
   */
  private reportMetrics(): void {
    if (!this.isMonitoring) return;

    // Send metrics to analytics service
    if (navigator.sendBeacon) {
      const data = new Blob([JSON.stringify({
        metrics: this.metrics,
        resources: this.resourceTimings.slice(-10), // Last 10 resources
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })], { type: 'application/json' });

      navigator.sendBeacon('/api/analytics/performance', data);
    }
  }

  /**
   * Dispatch custom event
   */
  private dispatchCustomEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Measure custom performance mark
   */
  static mark(name: string): void {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }

  /**
   * Measure time between marks
   */
  static measure(name: string, startMark: string, endMark?: string): number {
    if ('performance' in window && 'measure' in performance) {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      return entries[entries.length - 1]?.duration || 0;
    }
    return 0;
  }

  /**
   * Debounce function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

/**
 * Virtual Scrolling Implementation
 */
class VirtualScroll {
  private container: HTMLElement;
  private items: any[];
  private itemHeight: number;
  private buffer: number;
  private scrollTop = 0;
  private visibleItems: any[] = [];
  private startIdx = 0;
  private endIdx = 0;

  constructor(options: {
    container: HTMLElement;
    items: any[];
    itemHeight: number;
    buffer: number;
  }) {
    this.container = options.container;
    this.items = options.items;
    this.itemHeight = options.itemHeight;
    this.buffer = options.buffer;

    this.init();
  }

  private init(): void {
    // Create viewport and content elements
    const viewport = document.createElement('div');
    viewport.className = 'virtual-viewport';
    viewport.style.height = '100%';
    viewport.style.overflow = 'auto';

    const content = document.createElement('div');
    content.className = 'virtual-content';
    content.style.height = `${this.items.length * this.itemHeight}px`;
    content.style.position = 'relative';

    const spacer = document.createElement('div');
    spacer.className = 'virtual-spacer';
    spacer.style.position = 'absolute';
    spacer.style.top = '0';
    spacer.style.left = '0';
    spacer.style.right = '0';

    viewport.appendChild(content);
    content.appendChild(spacer);
    this.container.appendChild(viewport);

    // Setup scroll listener
    viewport.addEventListener('scroll', this.handleScroll);

    // Initial render
    this.render();

    // Store references
    (this.container as any).viewport = viewport;
    (this.container as any).content = content;
    (this.container as any).spacer = spacer;
  }

  private handleScroll = PerformanceOptimizer.throttle((): void => {
    this.scrollTop = (this.container as any).viewport.scrollTop;
    this.render();
  }, 16); // 60fps

  private render(): void {
    const containerHeight = this.container.clientHeight;
    const startIdx = Math.floor(this.scrollTop / this.itemHeight);
    const endIdx = Math.min(
      startIdx + Math.ceil(containerHeight / this.itemHeight) + this.buffer * 2,
      this.items.length - 1
    );

    if (startIdx === this.startIdx && endIdx === this.endIdx) {
      return; // No change
    }

    this.startIdx = Math.max(0, startIdx - this.buffer);
    this.endIdx = endIdx;

    // Update spacer height
    (this.container as any).spacer.style.height = `${this.startIdx * this.itemHeight}px`;

    // Render visible items
    this.renderVisibleItems();
  }

  private renderVisibleItems(): void {
    const spacer = (this.container as any).spacer;

    // Clear existing items
    spacer.innerHTML = '';

    // Render visible items
    for (let i = this.startIdx; i <= this.endIdx; i++) {
      const item = this.items[i];
      const itemEl = this.createItemElement(item, i);
      spacer.appendChild(itemEl);
    }
  }

  private createItemElement(item: any, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'virtual-item';
    el.style.height = `${this.itemHeight}px`;
    el.style.position = 'absolute';
    el.style.top = `${(index - this.startIdx) * this.itemHeight}px`;
    el.style.left = '0';
    el.style.right = '0';

    // Render item content
    el.innerHTML = this.renderItemContent(item, index);

    return el;
  }

  private renderItemContent(item: any, index: number): string {
    // Override this method to customize rendering
    return `
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="font-medium text-gray-900 dark:text-white">${item.name || `Item ${index}`}</div>
        ${item.description ? `<div class="text-sm text-gray-500 dark:text-gray-400">${item.description}</div>` : ''}
      </div>
    `;
  }

  /**
   * Update items
   */
  updateItems(items: any[]): void {
    this.items = items;
    (this.container as any).content.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }

  /**
   * Scroll to item
   */
  scrollToIndex(index: number): void {
    const viewport = (this.container as any).viewport;
    viewport.scrollTop = index * this.itemHeight;
  }

  /**
   * Get visible items
   */
  getVisibleItems(): any[] {
    return this.items.slice(this.startIdx, this.endIdx + 1);
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Export classes
export { VirtualScroll };

// Export performance utilities
export const mark = PerformanceOptimizer.mark;
export const measure = PerformanceOptimizer.measure;
export const debounce = PerformanceOptimizer.debounce;
export const throttle = PerformanceOptimizer.throttle;

// Make available globally
if (typeof window !== 'undefined') {
  window.LabelMintPerformance = performanceOptimizer;
}