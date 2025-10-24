/**
 * Code splitting utilities and lazy-loaded components
 */

import { lazy } from 'react';
import { createLazyComponent } from '../hooks/useLazyLoad';

// Lazy loading configuration
export const LAZY_LOAD_CONFIG = {
  // Route-based chunks
  routes: {
    // Main app routes
    home: () => import('../routes/Home'),
    dashboard: () => import('../routes/Dashboard'),
    tasks: () => import('../routes/Tasks'),
    earnings: () => import('../routes/Earnings'),
    settings: () => import('../routes/Settings'),
    profile: () => import('../routes/Profile'),
    help: () => import('../routes/Help'),

    // Admin routes
    admin: () => import('../routes/admin/AdminDashboard'),
    adminUsers: () => import('../routes/admin/Users'),
    adminWorkflows: () => import('../routes/admin/Workflows'),
    adminAnalytics: () => import('../routes/admin/Analytics'),
    adminSettings: () => import('../routes/admin/Settings'),

    // Auth routes
    login: () => import('../routes/auth/Login'),
    register: () => import('../routes/auth/Register'),
    forgotPassword: () => import('../routes/auth/ForgotPassword'),
  },

  // Feature-based chunks
  features: {
    // Task components
    taskComponents: () => import('../components/task'),
    boundingBoxTask: () => import('../components/tasks/BoundingBoxTask'),
    transcriptionTask: () => import('../components/tasks/TranscriptionTask'),
    sentimentTask: () => import('../components/tasks/SentimentAnalysisTask'),
    rlhfTask: () => import('../components/tasks/RLHFTask'),

    // Workflow components
    workflowEditor: () => import('../components/workflow/WorkflowEditor'),
    workflowCanvas: () => import('../components/workflow/WorkflowCanvas'),
    workflowNodes: () => import('../components/workflow/nodes'),

    // Admin components
    adminDashboard: () => import('../components/admin/AdminDashboard'),
    userManagement: () => import('../components/admin/UserManagement'),
    analytics: () => import('../components/admin/Analytics'),

    // Charts and visualizations
    charts: () => import('../components/charts'),
    chartsLine: () => import('../components/charts/LineChart'),
    chartsBar: () => import('../components/charts/BarChart'),
    chartsPie: () => import('../components/charts/PieChart'),

    // Forms
    forms: () => import('../components/forms'),
    formBuilder: () => import('../components/forms/FormBuilder'),
    validation: () => import('../components/forms/Validation'),

    // Advanced features
    aiChat: () => import('../components/ai/AIChat'),
    fileUpload: () => import('../components/FileUpload'),
    dataVisualization: () => import('../components/DataVisualization'),
  },

  // Third-party library chunks
  libraries: {
    // Heavy libraries that should be loaded on demand
    konva: () => import('konva'),
    tesseract: () => import('tesseract.js'),
    pdf: () => import('pdf-lib'),
    excel: () => import('xlsx'),
    monaco: () => import('@monaco-editor/react'),
    three: () => import('three'),
    d3: () => import('d3'),
    framerMotion: () => import('framer-motion'),
  },

  // Utility chunks
  utilities: {
    // Service workers and web workers
    imageProcessor: () => import('../workers/imageProcessor'),
    dataProcessor: () => import('../workers/dataProcessor'),
    analytics: () => import('../services/analytics'),
    notifications: () => import('../services/notifications'),
  },
};

// Create lazy components with error boundaries
export const LazyRoutes = {
  Home: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.home,
    'LazyHome'
  ),
  Dashboard: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.dashboard,
    'LazyDashboard'
  ),
  Tasks: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.tasks,
    'LazyTasks'
  ),
  Earnings: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.earnings,
    'LazyEarnings'
  ),
  Settings: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.settings,
    'LazySettings'
  ),
  Profile: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.profile,
    'LazyProfile'
  ),
  Help: createLazyComponent(
    LAZY_LOAD_CONFIG.routes.help,
    'LazyHelp'
  ),
};

export const LazyFeatures = {
  TaskComponents: createLazyComponent(
    LAZY_LOAD_CONFIG.features.taskComponents,
    'LazyTaskComponents'
  ),
  BoundingBoxTask: createLazyComponent(
    LAZY_LOAD_CONFIG.features.boundingBoxTask,
    'LazyBoundingBoxTask'
  ),
  WorkflowEditor: createLazyComponent(
    LAZY_LOAD_CONFIG.features.workflowEditor,
    'LazyWorkflowEditor'
  ),
  AdminDashboard: createLazyComponent(
    LAZY_LOAD_CONFIG.features.adminDashboard,
    'LazyAdminDashboard'
  ),
  Charts: createLazyComponent(
    LAZY_LOAD_CONFIG.features.charts,
    'LazyCharts'
  ),
  AIChat: createLazyComponent(
    LAZY_LOAD_CONFIG.features.aiChat,
    'LazyAIChat'
  ),
  FileUpload: createLazyComponent(
    LAZY_LOAD_CONFIG.features.fileUpload,
    'LazyFileUpload'
  ),
};

// Create simple lazy components without error boundaries
export const SimpleLazyComponents = {
  // React.lazy wrappers for components that don't need special handling
  SimpleCharts: lazy(() => import('../components/charts')),
  SimpleForms: lazy(() => import('../components/forms')),
  SimpleModals: lazy(() => import('../components/modals')),
};

// Preloading strategies
export class PreloadManager {
  private static preloadedChunks = new Set<string>();

  // Preload critical routes
  static async preloadCriticalRoutes() {
    const critical = ['home', 'dashboard', 'tasks'];

    await Promise.all(
      critical.map(route => {
        const key = route as keyof typeof LAZY_LOAD_CONFIG.routes;
        if (!this.preloadedChunks.has(key)) {
          this.preloadedChunks.add(key);
          return LAZY_LOAD_CONFIG.routes[key]();
        }
        return Promise.resolve();
      })
    );
  }

  // Preload on hover
  static preloadOnHover(importFn: () => Promise<any>, chunkName: string) {
    let timeoutId: NodeJS.Timeout;

    return () => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Start preload after 200ms delay
      timeoutId = setTimeout(() => {
        if (!this.preloadedChunks.has(chunkName)) {
          this.preloadedChunks.add(chunkName);
          importFn().catch(() => {
            // Silent failure for preload
            this.preloadedChunks.delete(chunkName);
          });
        }
      }, 200);
    };
  }

  // Preload on route change
  static preloadRoute(routeName: string) {
    const key = routeName as keyof typeof LAZY_LOAD_CONFIG.routes;
    if (LAZY_LOAD_CONFIG.routes[key] && !this.preloadedChunks.has(key)) {
      this.preloadedChunks.add(key);
      LAZY_LOAD_CONFIG.routes[key]().catch(() => {
        this.preloadedChunks.delete(key);
      });
    }
  }

  // Get preload status
  static isPreloaded(chunkName: string): boolean {
    return this.preloadedChunks.has(chunkName);
  }
}

// Dynamic import utility for vendor chunks
export const VendorChunks = {
  // Load analytics only when needed
  loadAnalytics: () => import('../services/analytics'),

  // Load heavy charting libraries on demand
  loadD3: () => import('d3'),
  loadThree: () => import('three'),

  // Load file processing libraries
  loadTesseract: () => import('tesseract.js'),
  loadPdfLib: () => import('pdf-lib'),
  loadXLSX: () => import('xlsx'),

  // Load editor libraries
  loadMonaco: () => import('@monaco-editor/react'),
  loadKonva: () => import('konva'),
};

// Webpack/Vite chunk names for monitoring
export const CHUNK_NAMES = {
  // Route chunks
  ROUTE_HOME: 'route-home',
  ROUTE_DASHBOARD: 'route-dashboard',
  ROUTE_TASKS: 'route-tasks',
  ROUTE_EARNINGS: 'route-earnings',
  ROUTE_SETTINGS: 'route-settings',
  ROUTE_PROFILE: 'route-profile',
  ROUTE_HELP: 'route-help',

  // Feature chunks
  FEATURE_TASKS: 'feature-tasks',
  FEATURE_WORKFLOWS: 'feature-workflows',
  FEATURE_ADMIN: 'feature-admin',
  FEATURE_CHARTS: 'feature-charts',
  FEATURE_FORMS: 'feature-forms',
  FEATURE_AI: 'feature-ai',

  // Vendor chunks
  VENDOR_KONVA: 'vendor-konva',
  VENDOR_TESSERACT: 'vendor-tesseract',
  VENDOR_D3: 'vendor-d3',
  VENDOR_THREE: 'vendor-three',
  VENDOR_MONACO: 'vendor-monaco',
  VENDOR_PDF: 'vendor-pdf',
  VENDOR_EXCEL: 'vendor-excel',

  // Utility chunks
  UTIL_WORKERS: 'util-workers',
  UTIL_ANALYTICS: 'util-analytics',
  UTIL_NOTIFICATIONS: 'util-notifications',
};

// Performance monitoring for chunk loading
export class ChunkPerformance {
  private static metrics = new Map<string, number>();

  static recordChunkLoad(chunkName: string, loadTime: number) {
    this.metrics.set(chunkName, loadTime);

    // Log slow chunks
    if (loadTime > 2000) {
      console.warn(`Slow chunk loading detected: ${chunkName} took ${loadTime}ms`);
    }

    // Send metrics to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'chunk_loaded', {
        chunk_name: chunkName,
        load_time: loadTime,
        is_slow: loadTime > 2000,
      });
    }
  }

  static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  static clearMetrics() {
    this.metrics.clear();
  }
}

// Type declarations
declare global {
  interface Window {
    gtag?: (command: string, action: string, options?: any) => void;
  }
}