/**
 * Device viewport utilities
 */

/**
 * Get current viewport dimensions
 */
export function getViewport(): { width: number; height: number } {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

/**
 * Get viewport width
 */
export function getViewportWidth(): number {
  return window.innerWidth || document.documentElement.clientWidth;
}

/**
 * Get viewport height
 */
export function getViewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight;
}

/**
 * Check if viewport matches mobile breakpoint
 */
export function isMobileViewport(): boolean {
  return getViewportWidth() < 768;
}

/**
 * Check if viewport matches tablet breakpoint
 */
export function isTabletViewport(): boolean {
  const width = getViewportWidth();
  return width >= 768 && width < 1024;
}

/**
 * Check if viewport matches desktop breakpoint
 */
export function isDesktopViewport(): boolean {
  return getViewportWidth() >= 1024;
}

/**
 * Get the current breakpoint
 */
export function getBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
  const width = getViewportWidth();

  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

/**
 * Get the current device orientation
 */
export function getOrientation(): 'portrait' | 'landscape' {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * Check if device is in portrait orientation
 */
export function isPortrait(): boolean {
  return getOrientation() === 'portrait';
}

/**
 * Check if device is in landscape orientation
 */
export function isLandscape(): boolean {
  return getOrientation() === 'landscape';
}