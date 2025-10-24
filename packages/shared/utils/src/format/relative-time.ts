/**
 * Relative time formatting utilities
 */

export function formatRelativeTime(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.round((now.getTime() - dateObj.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.round(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.round(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.round(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.round(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.round(diffInSeconds / 31536000), 'year');
  }
}

/**
 * Format relative time in short format (e.g., "2d ago", "3h ago")
 */
export function formatRelativeTimeShort(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.round((now.getTime() - dateObj.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'short'
  });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.round(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.round(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.round(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.round(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.round(diffInSeconds / 31536000), 'year');
  }
}

/**
 * Format time until a future date
 */
export function formatTimeUntil(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.round((dateObj.getTime() - now.getTime()) / 1000);

  if (diffInSeconds < 0) {
    return formatRelativeTime(date, locale);
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(Math.round(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(Math.round(diffInSeconds / 31536000), 'year');
  }
}