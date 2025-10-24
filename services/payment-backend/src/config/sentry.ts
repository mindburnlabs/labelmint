import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { RewriteFrames } from '@sentry/integrations';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Check if Sentry is enabled
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isEnabled = !!SENTRY_DSN;

if (isEnabled) {
  // Initialize Sentry for error tracking and performance
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment and Release Configuration
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `labelmintit@${process.env.npm_package_version || '1.0.0'}`,

    // Sampling Configuration
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integration Configuration
    integrations: [
      // Enable HTTP request tracing
      new Sentry.Integrations.Http({ tracing: true }),

      // Enable Node.js tracing
      new Tracing.Integrations.Express(),
      new Tracing.Integrations.Postgres(),
      new Tracing.Integrations.Mongo(),

      // Enable profiling
      nodeProfilingIntegration(),

      // Enable source map context
      new RewriteFrames({
        root: process.cwd(),
      }),

      // Enable local variables
      new Sentry.Integrations.LocalVariables({
        captureAllExceptions: true,
        captureAllErrors: true,
      }),

      // Enable context lines
      new Sentry.Integrations.ContextLines(),

      // Enable request data
      new Sentry.Integrations.RequestData({
        include: {
          cookies: true,
          data: true,
          headers: true,
          method: true,
          query_string: true,
          url: true,
          user: {
            id: true,
            email: true,
            username: true,
          },
        },
      }),

      // Enable dedupe
      new Sentry.Integrations.Dedupe(),

      // Enable extra error data
      new Sentry.Integrations.ExtraErrorData(),
    ],

    // Before Send - Filter and enrich errors
    beforeSend(event, hint) {
      // Don't send certain errors
      const error = hint?.originalException as Error;

      if (error?.message?.includes('cancelled') ||
          error?.message?.includes('user cancelled')) {
        return null;
      }

      // Add user context if available
      if (event.user && event.user.id) {
        event.tags = {
          ...event.tags,
          hasUser: true,
        };
      }

      // Add deployment context
      event.tags = {
        ...event.tags,
        deployment: process.env.DEPLOYMENT_ENV || 'unknown',
        service: 'backend',
        version: process.env.npm_package_version || '1.0.0',
      };

      // Add custom context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'node',
          version: process.version,
        },
        service: {
          name: 'labelmintit-backend',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      };

      return event;
    },

    // Before Send Transaction - Filter and enrich performance data
    beforeSendTransaction(transaction) {
      // Add custom tags
      transaction.setTag('service', 'backend');
      transaction.setTag('version', process.env.npm_package_version || '1.0.0');

      // Filter health check transactions
      if (transaction.name?.includes('/health') ||
          transaction.name?.includes('/ready') ||
          transaction.name?.includes('/metrics')) {
        return null;
      }

      return transaction;
    },

    // Ignore Errors
    ignoreErrors: [
      // Axios cancellation errors
      'canceled',
      'Request aborted',
      // Validation errors
      'Validation failed',
      // Authentication errors
      'Unauthorized',
      'Access denied',
      // Network errors
      'Network Error',
      'timeout of 0ms exceeded',
      // Non-critical errors
      'Non Error Promise Rejection',
    ],

    // Ignore Transactions
    ignoreTransactions: [
      '/health',
      '/ready',
      '/metrics',
      '/favicon.ico',
      '/robots.txt',
    ],

    // Debug and Development Options
    debug: process.env.NODE_ENV === 'development',
    attachStacktrace: true,
    maxValueLength: 2500,

    // Transport Options
    transport: Sentry.makeNodeTransport({
      bufferSize: 1000,
    }),

    // Server Name
    serverName: process.env.SENTRY_SERVER_NAME || undefined,
  });

  console.log('✅ Sentry initialized for error tracking and performance monitoring');
}

export class SentryService {
  // Capture exceptions
  static captureException(
    error: Error | string,
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      user?: Sentry.User;
      level?: Sentry.SeverityLevel;
      fingerprint?: string[];
    }
  ) {
    if (!isEnabled) return;

    if (typeof error === 'string') {
      error = new Error(error);
    }

    Sentry.withScope((scope) => {
      // Set tags
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Set extra data
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Set user
      if (context?.user) {
        scope.setUser(context.user);
      }

      // Set level
      if (context?.level) {
        scope.setLevel(context.level);
      }

      // Set fingerprint
      if (context?.fingerprint) {
        scope.setFingerprint(context.fingerprint);
      }

      Sentry.captureException(error);
    });
  }

  // Capture messages
  static captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      user?: Sentry.User;
      fingerprint?: string[];
    }
  ) {
    if (!isEnabled) return;

    Sentry.withScope((scope) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      if (context?.user) {
        scope.setUser(context.user);
      }

      if (context?.fingerprint) {
        scope.setFingerprint(context.fingerprint);
      }

      Sentry.captureMessage(message, level);
    });
  }

  // Set user context
  static setUser(user: Sentry.User | null) {
    if (!isEnabled) return;
    Sentry.setUser(user);
  }

  // Set tags
  static setTags(tags: Record<string, string>) {
    if (!isEnabled) return;
    Sentry.setTags(tags);
  }

  // Add breadcrumb
  static addBreadcrumb(
    breadcrumb: Sentry.Breadcrumb,
    level?: Sentry.SeverityLevel
  ) {
    if (!isEnabled) return;

    Sentry.addBreadcrumb({
      ...breadcrumb,
      level: level || breadcrumb.level,
      timestamp: Date.now() / 1000,
    });
  }

  // Create transaction for manual tracing
  static startTransaction(
    name: string,
    op?: string,
    data?: Record<string, any>
  ) {
    if (!isEnabled) return null;
    return Sentry.startTransaction({
      name,
      op,
      data,
    });
  }

  // Set context
  static setContext(
    key: string,
    context: Record<string, any>
  ) {
    if (!isEnabled) return;
    Sentry.setContext(key, context);
  }

  // Configure scope
  static configureScope(callback: (scope: Sentry.Scope) => void) {
    if (!isEnabled) return;
    Sentry.configureScope(callback);
  }

  // Performance monitoring
  static measureTiming(
    name: string,
    operation: () => Promise<any> | any
  ) {
    if (!isEnabled) {
      return operation();
    }

    return Sentry.startTransaction({
      name,
      op: 'function',
    }).wrap(async (transaction) => {
      try {
        const result = await operation();
        if (transaction) {
          transaction.setStatus('ok');
          transaction.finish();
        }
        return result;
      } catch (error) {
        if (transaction) {
          transaction.setStatus('internal_error');
          Sentry.captureException(error);
          transaction.finish();
        }
        throw error;
      }
    })();
  }

  // User feedback integration
  static async sendUserFeedback(
    feedback: {
      email?: string;
      name?: string;
      comments: string;
      eventId?: string;
    }
  ) {
    if (!isEnabled || !process.env.SENTRY_DSN) return;

    try {
      const response = await fetch(
        `https://sentry.io/api/0/projects/${process.env.SENTRY_ORG_SLUG}/${process.env.SENTRY_PROJECT_SLUG}/user-feedback/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(feedback),
        }
      );

      if (!response.ok) {
        console.error('Failed to send user feedback:', await response.text());
      }
    } catch (error) {
      console.error('Error sending user feedback:', error);
    }
  }

  // Release tracking
  static setRelease(release: string) {
    if (!isEnabled) return;
    Sentry.getCurrentHub().getClient()?.setOptions({ release });
  }

  // Environment tracking
  static setEnvironment(environment: string) {
    if (!isEnabled) return;
    Sentry.getCurrentHub().getClient()?.setOptions({ environment });
  }
}

export default SentryService;

// Export Sentry instance for direct usage if needed
export { Sentry };