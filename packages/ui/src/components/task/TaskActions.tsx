import React from 'react';
import { Button } from '../Button';
import { Card } from '../Card';
import { TaskTimer } from './TaskTimer';
import { cn } from '../../lib/utils';
import { ComponentProps, AccessibilityProps } from '../../types/common';

interface TaskActionsProps extends ComponentProps, AccessibilityProps {
  timeSpent: number;
  taskValue: number;
  isSubmitting: boolean;
  canSubmit: boolean;
  canSkip?: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  submitText?: string;
  skipText?: string;
  showTimer?: boolean;
  showValue?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export function TaskActions({
  timeSpent,
  taskValue,
  isSubmitting,
  canSubmit,
  canSkip = true,
  onSubmit,
  onSkip,
  submitText = 'Submit',
  skipText = 'Skip',
  showTimer = true,
  showValue = true,
  className,
  variant = 'default',
  ...props
}: TaskActionsProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex justify-between items-center', className)} {...props}>
        <div className="flex items-center gap-4">
          {showTimer && <TaskTimer timeSpent={timeSpent} variant="compact" />}
          {showValue && (
            <span className="text-sm text-muted-foreground">
              ${(taskValue / 100).toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {canSkip && (
            <Button
              mode="outline"
              onClick={onSkip}
              disabled={isSubmitting}
              size="sm"
              aria-label="Skip this task"
            >
              {skipText}
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            size="sm"
            aria-label="Submit your answer"
          >
            {submitText}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('p-4', className)} {...props}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          {showTimer && (
            <TaskTimer
              timeSpent={timeSpent}
              showLabel={variant === 'default'}
            />
          )}
          {showValue && (
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-success"
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <div className="text-xs text-muted-foreground">Value</div>
                <div className="text-sm font-medium">
                  ${(taskValue / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {canSkip && (
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={isSubmitting}
              aria-label={skipText}
            >
              {skipText}
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            loadingText="Submitting..."
            aria-label={submitText}
          >
            {submitText}
          </Button>
        </div>
      </div>
    </Card>
  );
}