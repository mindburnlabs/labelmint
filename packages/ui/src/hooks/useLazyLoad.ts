import { useState, useEffect, useCallback, useRef } from 'react';
import { ComponentProps } from '../types/common';

interface UseLazyLoadOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
  trigger?: boolean;
}

interface LazyLoadState {
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
  element: HTMLElement | null;
}

export function useLazyLoad<T extends () => Promise<any>>(
  importFn: T,
  options: UseLazyLoadOptions = {}
): [
  LazyLoadState & { module: Awaited<ReturnType<T>> | null },
  (trigger?: boolean) => void
] {
  const { root = null, rootMargin = '50px', threshold = 0.1, trigger = true } = options;

  const [state, setState] = useState<LazyLoadState & { module: Awaited<ReturnType<T>> | null }>({
    isLoaded: false,
    isLoading: false,
    error: null,
    element: null,
    module: null,
  });

  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadModule = useCallback(async () => {
    if (state.isLoaded || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const module = await importFn();
      setState({
        isLoaded: true,
        isLoading: false,
        error: null,
        element: elementRef.current,
        module,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoaded: false,
        isLoading: false,
        error: error as Error,
      }));
    }
  }, [importFn, state.isLoaded, state.isLoading]);

  const ref = useCallback((node: HTMLElement | null) => {
    if (node !== elementRef.current) {
      elementRef.current = node;
      setState(prev => ({ ...prev, element: node }));

      // Set up intersection observer
      if (node && observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node && 'IntersectionObserver' in window && trigger) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                loadModule();
                observerRef.current?.disconnect();
              }
            });
          },
          { root, rootMargin, threshold }
        );

        observerRef.current.observe(node);
      }
    }
  }, [loadModule, root, rootMargin, threshold, trigger]);

  // Manual trigger
  const manualTrigger = useCallback((force = true) => {
    if (force && trigger) {
      loadModule();
    }
  }, [loadModule, trigger]);

  // Cleanup
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return [state, manualTrigger];
}

interface LazyComponentProps extends ComponentProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  delay?: number;
  rootMargin?: string;
  threshold?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  displayName: string
): React.FC<LazyComponentProps & React.ComponentProps<T>> {
  const LazyComponent = ({
    fallback,
    errorFallback,
    delay = 200,
    rootMargin = '50px',
    threshold = 0.1,
    onLoad,
    onError,
    ...props
  }: LazyComponentProps & React.ComponentProps<T>) => {
    const [showFallback, setShowFallback] = useState(true);
    const [{ isLoaded, isLoading, error, module }, trigger] = useLazyLoad(importFn, {
      rootMargin,
      threshold,
      trigger: true,
    });

    // Delay fallback to prevent flashing
    useEffect(() => {
      if (isLoading) {
        const timer = setTimeout(() => setShowFallback(true), delay);
        return () => clearTimeout(timer);
      } else {
        setShowFallback(false);
      }
    }, [isLoading, delay]);

    // Load callbacks
    useEffect(() => {
      if (isLoaded && onLoad) {
        onLoad();
      }
    }, [isLoaded, onLoad]);

    useEffect(() => {
      if (error && onError) {
        onError(error);
      }
    }, [error, onError]);

    // Error state
    if (error) {
      if (errorFallback) {
        return <>{errorFallback}</>;
      }
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Failed to load component</h3>
            <button
              onClick={() => trigger()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Loading state
    if (isLoading && showFallback) {
      return <>{fallback || <div className="animate-pulse p-4">Loading...</div>}</>;
    }

    // Loaded state
    if (module && isLoaded) {
      const Component = module.default;
      return <Component {...(props as React.ComponentProps<T>)} />;
    }

    // Default fallback
    return <>{fallback || null}</>;
  };

  LazyComponent.displayName = displayName;

  return LazyComponent;
}

// Preload utility
export function preloadComponent(importFn: () => Promise<any>): void {
  // Start loading the module but don't wait for it
  importFn().catch(() => {
    // Silently ignore preload errors
  });
}

// Prefetch multiple components
export function prefetchComponents(importFns: Array<() => Promise<any>>): void {
  importFns.forEach(importFn => preloadComponent(importFn));
}

// Intersection Observer hook for general lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [(node: HTMLElement | null) => void, boolean] {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    if (node) {
      observer.current = new IntersectionObserver(([entry]) => {
        setEntry(entry);
      }, options);

      observer.current.observe(node);
    } else {
      observer.current?.disconnect();
    }
  }, [options]);

  useEffect(() => {
    return () => {
      observer.current?.disconnect();
    };
  }, []);

  return [ref, entry?.isIntersecting || false];
}