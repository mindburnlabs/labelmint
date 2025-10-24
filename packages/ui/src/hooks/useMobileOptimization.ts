import { useState, useEffect, useCallback } from 'react';

export interface MobileOptimizationOptions {
  enableTouchOptimization?: boolean;
  enableViewportOptimization?: boolean;
  enablePerformanceOptimization?: boolean;
  enableBatteryOptimization?: boolean;
}

export interface MobileOptimizationReturn {
  // Device info
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  
  // Screen info
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  
  // Performance info
  connectionType: string;
  isSlowConnection: boolean;
  isLowEndDevice: boolean;
  
  // Touch info
  isTouchDevice: boolean;
  maxTouchPoints: number;
  
  // Battery info
  batteryLevel: number | null;
  isCharging: boolean | null;
  
  // Utilities
  optimizeForMobile: () => void;
  optimizeForPerformance: () => void;
  optimizeForBattery: () => void;
}

export function useMobileOptimization(
  options: MobileOptimizationOptions = {}
): MobileOptimizationReturn {
  const {
    enableTouchOptimization = true,
    enableViewportOptimization = true,
    enablePerformanceOptimization = true,
    enableBatteryOptimization = true
  } = options;

  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    deviceType: 'desktop' as 'mobile' | 'tablet' | 'desktop',
    screenWidth: 0,
    screenHeight: 0,
    orientation: 'portrait' as 'portrait' | 'landscape',
    connectionType: 'unknown',
    isSlowConnection: false,
    isLowEndDevice: false,
    isTouchDevice: false,
    maxTouchPoints: 0,
    batteryLevel: null as number | null,
    isCharging: null as boolean | null
  });

  // Detect device type
  const detectDeviceType = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*\bMobile\b)/i.test(userAgent);
    const isDesktop = !isMobile && !isTablet;

    return {
      isMobile: isMobile && !isTablet,
      isTablet,
      isDesktop,
      deviceType: isMobile && !isTablet ? 'mobile' : isTablet ? 'tablet' : 'desktop'
    };
  }, []);

  // Detect screen info
  const detectScreenInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';

    return {
      screenWidth: width,
      screenHeight: height,
      orientation
    };
  }, []);

  // Detect connection info
  const detectConnectionInfo = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const effectiveType = connection.effectiveType || 'unknown';
      const isSlowConnection = ['slow-2g', '2g', '3g'].includes(effectiveType);
      
      return {
        connectionType: effectiveType,
        isSlowConnection
      };
    }

    return {
      connectionType: 'unknown',
      isSlowConnection: false
    };
  }, []);

  // Detect performance info
  const detectPerformanceInfo = useCallback(() => {
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const memory = (performance as any).memory;
    const isLowEndDevice = hardwareConcurrency <= 2 || (memory && memory.jsHeapSizeLimit < 100000000); // 100MB

    return {
      isLowEndDevice
    };
  }, []);

  // Detect touch info
  const detectTouchInfo = useCallback(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    return {
      isTouchDevice,
      maxTouchPoints
    };
  }, []);

  // Detect battery info
  const detectBatteryInfo = useCallback(async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return {
          batteryLevel: battery.level,
          isCharging: battery.charging
        };
      } catch (error) {
        console.warn('Failed to get battery info:', error);
      }
    }

    return {
      batteryLevel: null,
      isCharging: null
    };
  }, []);

  // Update device info
  const updateDeviceInfo = useCallback(async () => {
    const deviceType = detectDeviceType();
    const screenInfo = detectScreenInfo();
    const connectionInfo = detectConnectionInfo();
    const performanceInfo = detectPerformanceInfo();
    const touchInfo = detectTouchInfo();
    const batteryInfo = await detectBatteryInfo();

    setDeviceInfo({
      ...deviceType,
      ...screenInfo,
      ...connectionInfo,
      ...performanceInfo,
      ...touchInfo,
      ...batteryInfo
    });
  }, [detectDeviceType, detectScreenInfo, detectConnectionInfo, detectPerformanceInfo, detectTouchInfo, detectBatteryInfo]);

  // Optimize for mobile
  const optimizeForMobile = useCallback(() => {
    if (!deviceInfo.isMobile) return;

    // Add mobile-specific optimizations
    document.body.classList.add('mobile-optimized');
    
    // Optimize touch interactions
    if (enableTouchOptimization) {
      document.body.style.touchAction = 'manipulation';
      document.body.style.webkitTouchCallout = 'none';
      document.body.style.webkitUserSelect = 'none';
    }

    // Optimize viewport
    if (enableViewportOptimization) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    }
  }, [deviceInfo.isMobile, enableTouchOptimization, enableViewportOptimization]);

  // Optimize for performance
  const optimizeForPerformance = useCallback(() => {
    if (!enablePerformanceOptimization) return;

    // Reduce animations on low-end devices
    if (deviceInfo.isLowEndDevice) {
      document.body.classList.add('reduced-motion');
      document.documentElement.style.setProperty('--animation-duration', '0.1s');
    }

    // Optimize for slow connections
    if (deviceInfo.isSlowConnection) {
      document.body.classList.add('slow-connection');
      // Lazy load images
      const images = document.querySelectorAll('img[data-src]');
      images.forEach(img => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLImageElement;
              target.src = target.dataset.src || '';
              target.classList.remove('lazy');
              observer.unobserve(target);
            }
          });
        });
        observer.observe(img);
      });
    }
  }, [deviceInfo.isLowEndDevice, deviceInfo.isSlowConnection, enablePerformanceOptimization]);

  // Optimize for battery
  const optimizeForBattery = useCallback(() => {
    if (!enableBatteryOptimization || deviceInfo.batteryLevel === null) return;

    // Reduce activity when battery is low
    if (deviceInfo.batteryLevel < 0.2) {
      document.body.classList.add('low-battery');
      // Reduce polling frequency
      const intervals = document.querySelectorAll('[data-polling]');
      intervals.forEach(interval => {
        const element = interval as HTMLElement;
        const currentInterval = parseInt(element.dataset.polling || '1000');
        element.dataset.polling = (currentInterval * 2).toString();
      });
    }

    // Optimize when not charging
    if (deviceInfo.isCharging === false) {
      document.body.classList.add('not-charging');
      // Reduce background activity
      document.body.classList.add('battery-saver');
    }
  }, [deviceInfo.batteryLevel, deviceInfo.isCharging, enableBatteryOptimization]);

  // Initialize
  useEffect(() => {
    updateDeviceInfo();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      updateDeviceInfo();
    };

    // Listen for resize events
    const handleResize = () => {
      updateDeviceInfo();
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateDeviceInfo]);

  // Apply optimizations
  useEffect(() => {
    optimizeForMobile();
    optimizeForPerformance();
    optimizeForBattery();
  }, [optimizeForMobile, optimizeForPerformance, optimizeForBattery]);

  return {
    ...deviceInfo,
    optimizeForMobile,
    optimizeForPerformance,
    optimizeForBattery
  };
}
