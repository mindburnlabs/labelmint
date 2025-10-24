import React from 'react';
import { Card } from '../Card';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';

export interface MobileOptimizedCardProps {
  children: React.ReactNode;
  className?: string;
  enableTouchOptimization?: boolean;
  enablePerformanceOptimization?: boolean;
}

export const MobileOptimizedCard: React.FC<MobileOptimizedCardProps> = ({
  children,
  className = '',
  enableTouchOptimization = true,
  enablePerformanceOptimization = true
}) => {
  const { isMobile, isTouchDevice, isLowEndDevice, isSlowConnection } = useMobileOptimization({
    enableTouchOptimization,
    enablePerformanceOptimization
  });

  const getOptimizedClassName = () => {
    let optimizedClassName = className;

    if (isMobile) {
      optimizedClassName += ' mobile-optimized';
    }

    if (isTouchDevice) {
      optimizedClassName += ' touch-optimized';
    }

    if (isLowEndDevice) {
      optimizedClassName += ' low-end-device';
    }

    if (isSlowConnection) {
      optimizedClassName += ' slow-connection';
    }

    return optimizedClassName;
  };

  return (
    <Card className={getOptimizedClassName()}>
      {children}
    </Card>
  );
};
