import React from 'react';
import { Card } from '../Card';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface TaskContentProps extends ComponentProps {
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageMaxHeight?: string | number;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'minimal';
}

export function TaskContent({
  title,
  description,
  imageUrl,
  imageAlt = 'Task image',
  imageMaxHeight = '400px',
  children,
  className,
  variant = 'default',
  ...props
}: TaskContentProps) {
  const containerClasses = cn(
    'flex flex-col',
    variant === 'centered' && 'items-center justify-center text-center',
    variant === 'minimal' && 'gap-2',
    className
  );

  const contentClasses = cn(
    'flex-1',
    variant === 'default' && 'p-4',
    variant === 'centered' && 'p-8',
    variant === 'minimal' && 'p-2'
  );

  return (
    <div className={containerClasses} {...props}>
      {title && (
        <h2 className={cn(
          'font-semibold mb-2',
          variant === 'default' && 'text-lg',
          variant === 'centered' && 'text-xl',
          variant === 'minimal' && 'text-base'
        )}>
          {title}
        </h2>
      )}

      {description && (
        <p className={cn(
          'text-muted-foreground mb-4',
          variant === 'minimal' && 'text-sm mb-2'
        )}>
          {description}
        </p>
      )}

      {imageUrl && (
        <div className="w-full mb-4">
          <img
            src={imageUrl}
            alt={imageAlt}
            className={cn(
              'w-full rounded-lg object-contain',
              variant === 'minimal' && 'rounded-md'
            )}
            style={{ maxHeight: imageMaxHeight }}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      <Card className={cn('flex-1', variant === 'minimal' && 'border-none shadow-none bg-transparent')}>
        <div className={contentClasses}>
          {children}
        </div>
      </Card>
    </div>
  );
}