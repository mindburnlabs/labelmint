import React from 'react';
import { Button, ButtonProps } from '../Button';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';

export interface TouchOptimizedButtonProps extends ButtonProps {
  minTouchTarget?: number;
  enableHapticFeedback?: boolean;
  enableTouchRipple?: boolean;
}

export const TouchOptimizedButton: React.FC<TouchOptimizedButtonProps> = ({
  children,
  className = '',
  minTouchTarget = 44,
  enableHapticFeedback = true,
  enableTouchRipple = true,
  onClick,
  ...props
}) => {
  const { isMobile, isTouchDevice, maxTouchPoints } = useMobileOptimization();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Haptic feedback for touch devices
    if (enableHapticFeedback && isTouchDevice && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Touch ripple effect
    if (enableTouchRipple && isTouchDevice) {
      const button = e.currentTarget;
      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    }

    onClick?.(e);
  };

  const getOptimizedClassName = () => {
    let optimizedClassName = className;

    if (isMobile || isTouchDevice) {
      optimizedClassName += ' touch-optimized';
    }

    if (maxTouchPoints > 1) {
      optimizedClassName += ' multi-touch';
    }

    return optimizedClassName;
  };

  const getOptimizedStyle = () => {
    const baseStyle = props.style || {};
    
    if (isMobile || isTouchDevice) {
      return {
        ...baseStyle,
        minHeight: `${minTouchTarget}px`,
        minWidth: `${minTouchTarget}px`,
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      };
    }

    return baseStyle;
  };

  return (
    <Button
      {...props}
      className={getOptimizedClassName()}
      style={getOptimizedStyle()}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
};
