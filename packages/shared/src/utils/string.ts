// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return capitalize(toCamelCase(str));
}

/**
 * Truncate string to specified length
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Check if string is empty or whitespace
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string contains only alphanumeric characters
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Check if string contains only numeric characters
 */
export function isNumeric(str: string): boolean {
  return /^[0-9]+$/.test(str);
}

/**
 * Generate random string
 */
export function random(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate UUID v4
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Escape HTML characters
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
}

/**
 * Unescape HTML characters
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (match) => htmlUnescapes[match]);
}

/**
 * Pad string to specified length
 */
export function padStart(str: string, length: number, fillString: string = ' '): string {
  return str.padStart(length, fillString);
}

/**
 * Pad string to specified length from the end
 */
export function padEnd(str: string, length: number, fillString: string = ' '): string {
  return str.padEnd(length, fillString);
}

/**
 * Remove whitespace from both ends of string
 */
export function trim(str: string): string {
  return str.trim();
}

/**
 * Remove whitespace from left side of string
 */
export function trimStart(str: string): string {
  return str.trimStart();
}

/**
 * Remove whitespace from right side of string
 */
export function trimEnd(str: string): string {
  return str.trimEnd();
}

/**
 * Repeat string n times
 */
export function repeat(str: string, n: number): string {
  return str.repeat(n);
}

/**
 * Check if string starts with prefix
 */
export function startsWith(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

/**
 * Check if string ends with suffix
 */
export function endsWith(str: string, suffix: string): boolean {
  return str.endsWith(suffix);
}

/**
 * Check if string includes substring
 */
export function includes(str: string, substring: string): boolean {
  return str.includes(substring);
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex + 1);
}

/**
 * Get filename without extension
 */
export function getFileName(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Slugify string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/-+/g, '-'); // collapse multiple dashes
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Check if string is a valid URL
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if string is a valid email
 */
export function isEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Mask string for display (e.g., credit card numbers)
 */
export function mask(str: string, startChars: number = 4, endChars: number = 4, maskChar: string = '*'): string {
  if (str.length <= startChars + endChars) return str;
  const start = str.slice(0, startChars);
  const end = str.slice(-endChars);
  const middle = maskChar.repeat(str.length - startChars - endChars);
  return start + middle + end;
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Extract emails from text
 */
export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

/**
 * Count words in string
 */
export function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count characters in string (excluding whitespace)
 */
export function countChars(str: string, includeWhitespace: boolean = false): number {
  return includeWhitespace ? str.length : str.replace(/\s/g, '').length;
}

/**
 * Reverse string
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Check if string is a palindrome
 */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}