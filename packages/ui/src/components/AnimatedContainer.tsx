import React, { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface AnimatedContainerProps {
  children: ReactNode;
  animation?: 'fadeIn' | 'slideIn' | 'scaleIn' | 'bounce' | 'pulse';
  delay?: number;
  duration?: number;
  className?: string;
  trigger?: boolean;
}

export function AnimatedContainer({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration = 300,
  className,
  trigger = true,
}: AnimatedContainerProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  const animationClasses = {
    fadeIn: 'animate-fade-in',
    slideIn: 'animate-slide-in',
    scaleIn: 'animate-scale-in',
    bounce: 'animate-bounce',
    pulse: 'animate-pulse',
  };

  return (
    <div
      className={cn(
        'transition-all',
        isVisible && animationClasses[animation],
        className
      )}
      style={{
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default AnimatedContainer;

