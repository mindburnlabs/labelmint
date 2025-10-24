import React, { memo, useMemo } from 'react';
import { Card } from '../Card';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

export interface EarningsData {
  balance: number;
  totalEarned: number;
  todayEarned: number;
  weeklyEarnings?: number;
  tasksCompleted?: number;
  accuracy?: number;
  last7Days?: number;
}

export interface EarningsDashboardProps extends ComponentProps {
  earnings: EarningsData;
  isLoading?: boolean;
  showDetails?: boolean;
  showStats?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
  currency?: string;
  onWithdraw?: () => void;
  onRefresh?: () => void;
}

export const EarningsDashboard = memo<EarningsDashboardProps>(({
  earnings,
  isLoading = false,
  showDetails = true,
  showStats = true,
  variant = 'default',
  currency = 'USD',
  onWithdraw,
  onRefresh,
  className,
  ...props
}) => {
  // Memoize formatted values to prevent unnecessary recalculations
  const formattedValues = useMemo(() => ({
    balance: earnings.balance.toFixed(2),
    totalEarned: earnings.totalEarned.toFixed(2),
    todayEarned: earnings.todayEarned.toFixed(2),
    weeklyEarnings: earnings.weeklyEarnings?.toFixed(2) || '0.00',
    accuracyPercentage: earnings.accuracy ? `${earnings.accuracy.toFixed(1)}%` : 'N/A',
    tasksCompleted: earnings.tasksCompleted?.toLocaleString() || '0',
    last7Days: earnings.last7Days?.toFixed(2) || '0.00',
  }), [earnings]);

  // Loading skeleton
  if (isLoading) {
    return <LoadingSkeleton variant={variant} showDetails={showDetails} className={className} {...props} />;
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-4', className)} {...props}>
        <div>
          <span className="text-sm text-muted-foreground">Balance</span>
          <div className="text-2xl font-bold">
            {currency === 'USD' ? '$' : currency}{formattedValues.balance}
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Refresh earnings"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <Card className={cn('p-4', className)} {...props}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="text-xl font-bold">
              {currency === 'USD' ? '$' : currency}{formattedValues.balance}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Today</div>
              <div className="font-medium">
                {currency === 'USD' ? '$' : currency}{formattedValues.todayEarned}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Total</div>
              <div className="font-medium">
                {currency === 'USD' ? '$' : currency}{formattedValues.totalEarned}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Default variant
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {/* Main Balance Card */}
      <Card className="relative overflow-hidden" variant="elevated">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
        <div className="relative p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-sm font-medium opacity-90">Current Balance</h2>
              <p className="text-xs opacity-75">Available for withdrawal</p>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="text-3xl font-bold mb-4">
            {currency === 'USD' ? '$' : currency}{formattedValues.balance}
          </div>

          {onWithdraw && (
            <button
              onClick={onWithdraw}
              className="w-full bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              aria-label="Withdraw funds"
            >
              Withdraw Funds
            </button>
          )}
        </div>
      </Card>

      {/* Additional Details */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <svg className="w-5 h-5 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Earned</div>
                <div className="text-lg font-semibold">
                  {currency === 'USD' ? '$' : currency}{formattedValues.totalEarned}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <svg className="w-5 h-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Today's Earnings</div>
                <div className="text-lg font-semibold">
                  {currency === 'USD' ? '$' : currency}{formattedValues.todayEarned}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Stats */}
      {showStats && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Performance Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-success">
                {currency === 'USD' ? '$' : currency}{formattedValues.last7Days}
              </div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
            <div>
              <div className="text-lg font-semibold">
                {formattedValues.tasksCompleted}
              </div>
              <div className="text-xs text-muted-foreground">Tasks Completed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-warning">
                {formattedValues.accuracyPercentage}
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
});

EarningsDashboard.displayName = 'EarningsDashboard';

// Loading Skeleton Component
const LoadingSkeleton = memo<EarningsDashboardProps & { variant: string; showDetails: boolean }>(({
  variant,
  showDetails,
  className,
  ...props
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-4', className)} {...props}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-12" />
          <div className="h-6 bg-muted rounded w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {/* Balance Skeleton */}
      <div className="p-6 bg-muted rounded-lg animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted/50 rounded w-24" />
            <div className="h-3 bg-muted/50 rounded w-32" />
          </div>
          <div className="w-10 h-10 bg-muted/50 rounded-lg" />
        </div>
        <div className="h-8 bg-muted/50 rounded w-32 mb-4" />
        <div className="h-10 bg-muted/50 rounded w-full" />
      </div>

      {/* Details Skeleton */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted/50 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted/50 rounded w-20" />
                  <div className="h-5 bg-muted/50 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';