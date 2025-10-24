/**
 * Date formatting utilities
 */

export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);

  // Default options for consistent formatting
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
}

/**
 * Format date with time included
 */
export function formatDateTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return formatDate(date, defaultOptions, locale);
}

/**
 * Format date with short format (MM/DD/YYYY)
 */
export function formatDateShort(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  return formatDate(date, options, locale);
}

/**
 * Format time only (HH:MM AM/PM)
 */
export function formatTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return formatDate(date, defaultOptions, locale);
}

/**
 * Format date with full month name and year (January 2024)
 */
export function formatDateMonthYear(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
  };

  return formatDate(date, options, locale);
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date | string | number): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  return dateObj.toISOString().split('T')[0];
}

/**
 * Format date as readable duration (e.g., "2 days ago")
 */
export function formatDateDuration(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  return formatRelativeTime(date, locale);
}