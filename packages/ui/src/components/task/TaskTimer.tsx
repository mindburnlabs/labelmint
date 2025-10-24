import React from 'react';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface TaskTimerProps extends ComponentProps {
  timeSpent: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  timeLimit?: number;
}

export function TaskTimer({
  timeSpent,
  className,
  showLabel = true,
  variant = 'default',
  timeLimit,
  ...props
}: TaskTimerProps) {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate percentage of time used if limit is set
  const timePercentage = timeLimit ? (timeSpent / timeLimit) * 100 : 0;
  const isWarning = timeLimit && timePercentage > 80;
  const isDanger = timeLimit && timePercentage > 95;

  const renderTimer = () => {
    switch (variant) {
      case 'compact':
        return (
          <span
            className={cn(
              'text-sm tabular-nums',
              isDanger && 'text-error',
              isWarning && !isDanger && 'text-warning',
              !isWarning && !isDanger && 'text-foreground'
            )}
          >
            {formatTime(timeSpent)}
          </span>
        );

      case 'detailed':
        return (
          <div className={cn('text-center', className)}>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                isDanger && 'text-error',
                isWarning && !isDanger && 'text-warning',
                !isWarning && !isDanger && 'text-foreground'
              )}
            >
              {formatTime(timeSpent)}
            </div>
            {timeLimit && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.max(0, timeLimit - timeSpent)}s remaining
              </div>
            )}
            {timeLimit && (
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-1000',
                    isDanger && 'bg-error',
                    isWarning && !isDanger && 'bg-warning',
                    !isWarning && !isDanger && 'bg-success'
                  )}
                  style={{ width: `${Math.min(100, timePercentage)}%` }}
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className={cn('flex items-center gap-2', className)}>
            {showLabel && (
              <span className="text-sm text-muted-foreground">Time:</span>
            )}
            <div className="flex items-center gap-2">
              {/* Timer Icon */}
              <svg
                className={cn(
                  'w-4 h-4',
                  isDanger && 'text-error',
                  isWarning && !isDanger && 'text-warning',
                  !isWarning && !isDanger && 'text-muted-foreground'
                )}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span
                className={cn(
                  'text-sm tabular-nums font-medium',
                  isDanger && 'text-error',
                  isWarning && !isDanger && 'text-warning',
                  !isWarning && !isDanger && 'text-foreground'
                )}
                aria-live="polite"
                aria-label={`Time elapsed: ${formatTime(timeSpent)}`}
              >
                {formatTime(timeSpent)}
              </span>
            </div>
          </div>
        );
    }
  };

  return <div {...props}>{renderTimer()}</div>;
}