/**
 * Device detection utilities
 */

/**
 * Check if the current device is mobile
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Check if the current device is a tablet
 */
export function isTablet(): boolean {
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
}

/**
 * Check if the current device is a desktop
 */
export function isDesktop(): boolean {
  return !isMobile() && !isTablet();
}

/**
 * Check if the device is an iOS device
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Check if the device is an Android device
 */
export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/**
 * Check if the device is a Safari browser
 */
export function isSafari(): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
}

/**
 * Check if the device is a Chrome browser
 */
export function isChrome(): boolean {
  return /Chrome/.test(navigator.userAgent);
}

/**
 * Check if the device is a Firefox browser
 */
export function isFirefox(): boolean {
  return /Firefox/.test(navigator.userAgent);
}

/**
 * Check if the device supports touch
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get the device type
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isTablet()) return 'tablet';
  if (isMobile()) return 'mobile';
  return 'desktop';
}

/**
 * Get operating system information
 */
export function getOS(): 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown' {
  const userAgent = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Win/.test(userAgent)) return 'windows';
  if (/Mac/.test(userAgent)) return 'macos';
  if (/Linux/.test(userAgent)) return 'linux';

  return 'unknown';
}

/**
 * Get browser information
 */
export function getBrowser(): 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown' {
  const userAgent = navigator.userAgent;

  if (/Chrome/.test(userAgent)) return 'chrome';
  if (/Firefox/.test(userAgent)) return 'firefox';
  if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'safari';
  if (/Edge/.test(userAgent)) return 'edge';

  return 'unknown';
}