'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlassNavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface GlassNavigationProps {
  items: GlassNavigationItem[];
  className?: string;
}

export function GlassNavigation({ items, className }: GlassNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('space-y-2', className)}>
      {items.map((item, index) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'glass-nav-item flex items-center gap-3 relative overflow-hidden group',
              {
                'active': isActive,
                'animate-slide-in': true,
              }
            )}
            style={{
              animationDelay: `${index * 100}ms`
            }}
          >
            {/* Animated background gradient */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                {
                  'opacity-100': isActive,
                }
              )}
              style={{
                background: isActive ? 'var(--gradient-primary)' : 'transparent'
              }}
            />

            {/* Content */}
            <div className="relative z-10 flex items-center gap-3 w-full">
              <item.icon
                className={cn(
                  'w-5 h-5 transition-colors duration-300',
                  {
                    'text-white': isActive,
                    'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white': !isActive
                  }
                )}
              />

              <span
                className={cn(
                  'font-medium transition-colors duration-300',
                  {
                    'text-white': isActive,
                    'text-gray-700 dark:text-gray-300': !isActive
                  }
                )}
              >
                {item.name}
              </span>

              {/* Badge */}
              {item.badge && (
                <span
                  className={cn(
                    'ml-auto glass-badge text-xs',
                    {
                      'bg-white/20 text-white': isActive,
                      'bg-gray-500/20 text-gray-600 dark:text-gray-400': !isActive
                    }
                  )}
                >
                  {item.badge}
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </div>

            {/* Hover shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          </Link>
        );
      })}
    </nav>
  );
}

export default GlassNavigation;