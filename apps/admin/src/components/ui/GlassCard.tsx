'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  shimmer?: boolean;
  glow?: boolean;
}

export function GlassCard({
  children,
  className,
  hover = true,
  shimmer = false,
  glow = false
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card',
        {
          'hover-lift': hover,
          'animate-shimmer': shimmer,
          'animate-glow': glow,
        },
        className
      )}
    >
      {children}
    </div>
  );
}

export default GlassCard;