import React from 'react';
import { cn } from '../lib/utils';

export interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onClose?: () => void;
  className?: string;
}

const variantStyles = {
  info: {
    container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-200',
    text: 'text-blue-800 dark:text-blue-300',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  success: {
    container: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-900 dark:text-green-200',
    text: 'text-green-800 dark:text-green-300',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    title: 'text-yellow-900 dark:text-yellow-200',
    text: 'text-yellow-800 dark:text-yellow-300',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  error: {
    container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-200',
    text: 'text-red-800 dark:text-red-300',
    iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function Alert({
  children,
  variant = 'info',
  title,
  onClose,
  className,
}: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        'relative p-4 border rounded-lg',
        styles.container,
        className
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <svg
          className={cn('w-5 h-5 flex-shrink-0', styles.icon)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d={styles.iconPath} />
        </svg>

        {/* Content */}
        <div className="flex-1">
          {title && (
            <h3 className={cn('font-semibold mb-1', styles.title)}>
              {title}
            </h3>
          )}
          <div className={cn('text-sm', styles.text)}>
            {children}
          </div>
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'flex-shrink-0 ml-2 -mt-1 -mr-1 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
              styles.icon
            )}
            aria-label="Close alert"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Alert;

