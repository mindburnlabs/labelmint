'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { AnimatedCounter } from './AnimatedCounter';
import { cn } from '@/lib/utils';

interface GlassKPICardProps {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  changeLabel?: string;
  icon: LucideIcon;
  description?: string;
  gradient?: string;
  className?: string;
}

export function GlassKPICard({
  title,
  value,
  change,
  changeType = 'increase',
  changeLabel = 'from last month',
  icon: Icon,
  description,
  gradient = 'var(--gradient-primary)',
  className
}: GlassKPICardProps) {
  const isPositive = changeType === 'increase';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <GlassCard className={cn('kpi-card group', className)}>
      {/* Animated gradient background overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"
        style={{ background: gradient }}
      />

      {/* Main content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {title}
            </p>

            {/* Animated value counter */}
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {typeof value === 'number' ? (
                <AnimatedCounter
                  value={value}
                  prefix={title.includes('Revenue') ? '$' : ''}
                />
              ) : (
                value
              )}
            </div>

            {/* Change indicator */}
            {change !== undefined && (
              <div className="flex items-center gap-2 mb-3">
                <TrendIcon
                  className={cn(
                    'w-4 h-4',
                    isPositive ? 'text-green-500' : 'text-red-500'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {change}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {changeLabel}
                </span>
              </div>
            )}
          </div>

          {/* Icon container with gradient background */}
          <div
            className="p-3 rounded-xl shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
            style={{ background: gradient }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {description}
          </p>
        )}

        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
      </div>
    </GlassCard>
  );
}

export default GlassKPICard;