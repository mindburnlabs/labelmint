import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showRetry?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (retryCount: number) => void;
  fallBackComponent?: React.ComponentType<{ error: Error; errorId: string; retry: () => void }>;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: ErrorBoundary.generateErrorId(),
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: ErrorBoundary.generateErrorId(),
      retryCount: 0,
      isRetrying: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      const errorId = this.state.errorId;

      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
          error_boundary: {
            errorId,
            hasError: this.state.hasError,
            resetKeys: this.props.resetKeys,
            isolate: this.props.isolate,
          },
        },
        tags: {
          errorBoundary: true,
          component: 'ErrorBoundary',
        },
        extra: {
          errorMessage: error.message,
          errorName: error.name,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      });

      // Add user feedback for critical errors
      if (this.props.showRetry !== false) {
        Sentry.showReportDialog({
          eventId: Sentry.lastEventId(),
          title: 'Something went wrong',
          subtitle: 'Our team has been notified. If you\'d like to help, please tell us what happened below.',
          subtitle2: `Error ID: ${errorId}`,
          labelName: 'Name',
          labelEmail: 'Email',
          labelComments: 'What happened?',
          labelClose: 'Close',
          labelSubmit: 'Submit',
          successMessage: 'Thank you for your help!',
          errorGeneric: 'An unknown error occurred while submitting your report. Please try again.',
          errorFormEntry: 'Some fields were invalid. Please correct the errors and try again.',
          onLoad: () => console.log('Sentry report dialog loaded'),
        });
      }
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if resetKeys have changed
    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some((key, index) => key !== prevResetKeys[index]);

      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }

  private static generateErrorId = (): string => {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  private reset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: ErrorBoundary.generateErrorId(),
      retryCount: 0,
      isRetrying: false,
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3, retryDelay = 1000, onRetry } = this.props;
    const { retryCount } = this.state;

    // Check if we've exceeded max retries
    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) exceeded for error ${this.state.errorId}`);
      return;
    }

    // Set retrying state
    this.setState({ isRetrying: true });

    // Call retry callback
    onRetry?.(retryCount + 1);

    // Delay before retry
    setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: ErrorBoundary.generateErrorId(),
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));
    }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
  };

  private handleReportError = async () => {
    const { error, errorInfo, errorId } = this.state;

    if (error) {
      const errorReport = {
        id: errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        buildInfo: {
          version: process.env.NODE_ENV,
          buildTime: process.env.BUILD_TIME || 'unknown',
          gitCommit: process.env.GIT_COMMIT || 'unknown',
        },
      };

      try {
        // Copy error report to clipboard
        await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));

        // Show user-friendly feedback instead of alert
        if (this.props.onError) {
          this.props.onError(error, errorInfo);
        }

        // Optionally open Sentry report dialog in production
        if (process.env.NODE_ENV === 'production' && Sentry.lastEventId()) {
          Sentry.showReportDialog({
            eventId: Sentry.lastEventId(),
            title: 'Something went wrong',
            subtitle: 'Our team has been notified. If you\'d like to help, please tell us what happened below.',
            subtitle2: `Error ID: ${errorId}`,
          });
        }
      } catch (err) {
        console.error('Failed to copy error report:', err);
        // Fallback: create a temporary textarea to copy
        const textarea = document.createElement('textarea');
        textarea.value = JSON.stringify(errorReport, null, 2);
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    }
  };

  render() {
    const { hasError, error, errorInfo, errorId, retryCount, isRetrying } = this.state;
    const {
      children,
      fallback,
      showRetry = true,
      isolate = false,
      maxRetries = 3,
      fallBackComponent: CustomFallback
    } = this.props;

    if (hasError) {
      // Custom fallback component
      if (CustomFallback && error) {
        const CustomFallbackComponent = CustomFallback;
        return <CustomFallbackComponent error={error} errorId={errorId} retry={this.handleRetry} />;
      }

      // Custom fallback JSX
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div
          className={cn(
            'flex items-center justify-center min-h-[200px] p-4',
            !isolate && 'min-h-screen'
          )}
          role="alert"
          aria-live="polite"
        >
          <Card className="w-full max-w-md p-6" variant="elevated">
            <div className="text-center">
              {/* Error Icon */}
              <div className="mx-auto w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-error"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>

              <p className="text-muted-foreground mb-6">
                {process.env.NODE_ENV === 'development'
                  ? `${error?.message || 'An unexpected error occurred'}`
                  : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
              </p>

              {/* Retry indicator */}
              {retryCount > 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Retry attempt {retryCount} of {maxRetries}
                </p>
              )}

              {/* Loading state during retry */}
              {isRetrying && (
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Retrying...</span>
                </div>
              )}

              {/* Error ID for reporting */}
              <p className="text-xs text-muted-foreground mb-6">
                Error ID: <code className="bg-muted px-2 py-1 rounded">{errorId}</code>
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center flex-wrap">
                {showRetry && !isRetrying && retryCount < maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    variant="primary"
                    size="sm"
                    aria-label="Retry the last action"
                    disabled={isRetrying}
                  >
                    {retryCount > 0 ? `Try Again (${retryCount}/${maxRetries})` : 'Try Again'}
                  </Button>
                )}

                {process.env.NODE_ENV === 'production' && (
                  <Button
                    onClick={this.handleReportError}
                    variant="outline"
                    size="sm"
                    aria-label="Copy error details for reporting"
                    disabled={isRetrying}
                  >
                    Report Error
                  </Button>
                )}

                {retryCount >= maxRetries && (
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    aria-label="Reload the page"
                  >
                    Reload Page
                  </Button>
                )}
              </div>

              {/* Development Details */}
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Error Details
                  </summary>
                  <div className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-48">
                    <pre className="whitespace-pre-wrap">
                      <strong>Error:</strong> {error.name}: {error.message}
                      {'\n\n'}
                      <strong>Stack:</strong>
                      {'\n'}
                      {error.stack}
                      {'\n\n'}
                      {errorInfo && (
                        <>
                          <strong>Component Stack:</strong>
                          {'\n'}
                          {errorInfo.componentStack}
                        </>
                      )}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Hook for functional components to catch errors in async operations
export function useErrorHandler() {
  return React.useCallback((error: Error) => {
    // Log the error
    console.error('Caught by useErrorHandler:', error);

    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, {
        contexts: {
          async_operation: {
            hook: 'useErrorHandler',
            timestamp: new Date().toISOString(),
          },
        },
        tags: {
          errorHandler: true,
          type: 'async_error',
        },
      });
    }

    // In development, show the error
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }

    // In production, you could:
    // 1. Show a toast notification
    // 2. Update a global error state
    // 3. Redirect to an error page
  }, []);
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Utility function to import { cn } from '../lib/utils';
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}