// ============================================================================
// FORMAT UTILITIES
// ============================================================================

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number, locale: string = 'en-US'): string {
  return num.toLocaleString(locale);
}

/**
 * Format number with specified decimal places
 */
export function formatDecimal(num: number, decimals: number = 2, locale: string = 'en-US'): string {
  return num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format number as currency
 */
export function formatCurrency(num: number, currency: string = 'USD', locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(num);
}

/**
 * Format number as percentage
 */
export function formatPercentage(num: number, decimals: number = 1, locale: string = 'en-US'): string {
  return formatDecimal(num * 100, decimals, locale) + '%';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date, baseDate: Date = new Date()): string {
  const diffMs = date.getTime() - baseDate.getTime();
  const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const suffix = diffMs < 0 ? 'ago' : 'in';

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ${suffix}`;
  if (diffHours < 24) return `${diffHours}h ${suffix}`;
  if (diffDays < 7) return `${diffDays}d ${suffix}`;

  return date.toLocaleDateString();
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to title case
 */
export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Mask sensitive data
 */
export function mask(str: string, visible: number = 4, maskChar: string = '*'): string {
  if (str.length <= visible) return str;
  const start = str.slice(0, visible);
  const end = str.slice(-visible);
  const middle = maskChar.repeat(str.length - (visible * 2));
  return start + middle + end;
}