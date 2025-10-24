import React, { useState } from 'react';
import { usePerformance } from '../hooks/usePerformance';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { cn } from '../lib/utils';

export interface PerformanceMonitorProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function PerformanceMonitor({
  className,
  showDetails = false,
  compact = false,
}: PerformanceMonitorProps) {
  const { metrics, score, isMonitoring, startMonitoring, stopMonitoring } = usePerformance();
  const [showFullDetails, setShowFullDetails] = useState(showDetails);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  };

  const formatMetric = (value: number, unit: string = 'ms'): string => {
    if (value === 0) return 'N/A';
    return `${Math.round(value)}${unit}`;
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge
          variant={score >= 90 ? 'success' : score >= 70 ? 'warning' : 'error'}
          className="text-xs"
        >
          {score}/100
        </Badge>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {getScoreLabel(score)}
        </span>
      </div>
    );
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Performance Monitor</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFullDetails(!showFullDetails)}
          >
            {showFullDetails ? 'Hide' : 'Show'} Details
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Performance Score</span>
          <Badge
            variant={score >= 90 ? 'success' : score >= 70 ? 'warning' : 'error'}
            className={getScoreColor(score)}
          >
            {score}/100
          </Badge>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {getScoreLabel(score)}
        </p>
      </div>

      {/* Core Web Vitals */}
      {metrics && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                First Contentful Paint
              </div>
              <div className="text-lg font-semibold">
                {formatMetric(metrics.firstContentfulPaint)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Largest Contentful Paint
              </div>
              <div className="text-lg font-semibold">
                {formatMetric(metrics.largestContentfulPaint)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                First Input Delay
              </div>
              <div className="text-lg font-semibold">
                {formatMetric(metrics.firstInputDelay)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Cumulative Layout Shift
              </div>
              <div className="text-lg font-semibold">
                {metrics.cumulativeLayoutShift.toFixed(3)}
              </div>
            </div>
          </div>

          {showFullDetails && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Load Time
                  </div>
                  <div className="text-lg font-semibold">
                    {formatMetric(metrics.loadTime)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Time to Interactive
                  </div>
                  <div className="text-lg font-semibold">
                    {formatMetric(metrics.timeToInteractive)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!metrics && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-sm">No performance data available</div>
          <div className="text-xs mt-1">Start monitoring to see metrics</div>
        </div>
      )}
    </Card>
  );
}

export default PerformanceMonitor;
