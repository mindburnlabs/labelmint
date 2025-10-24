import React from 'react';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';

export interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  mobileColumns?: number;
  tabletColumns?: number;
  desktopColumns?: number;
  gap?: number;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className = '',
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = 4
}) => {
  const { isMobile, isTablet, isDesktop } = useMobileOptimization();

  const getGridColumns = () => {
    if (isMobile) return mobileColumns;
    if (isTablet) return tabletColumns;
    return desktopColumns;
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
    gap: `${gap * 0.25}rem`
  };

  return (
    <div 
      className={`responsive-grid ${className}`}
      style={gridStyle}
    >
      {children}
    </div>
  );
};
