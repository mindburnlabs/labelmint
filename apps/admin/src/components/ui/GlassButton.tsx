'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function GlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className
}: GlassButtonProps) {
  const baseClasses = 'glass-button relative overflow-hidden transition-all duration-300';

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base'
  };

  const variantClasses = {
    primary: '',
    secondary: 'bg-gray-500/20 hover:bg-gray-500/30',
    success: 'bg-green-500/20 hover:bg-green-500/30',
    warning: 'bg-yellow-500/20 hover:bg-yellow-500/30'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        {
          'opacity-50 cursor-not-allowed': disabled,
          'animate-pulse': loading,
        },
        className
      )}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
        )}
        {children}
      </span>
    </button>
  );
}

export default GlassButton;