// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is a valid email
 */
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if value is a valid URL
 */
export function isUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid UUID
 */
export function isUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if value is a valid phone number (basic validation)
 */
export function isPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Check if string contains only letters
 */
export function isAlpha(str: string): boolean {
  return /^[a-zA-Z]+$/.test(str);
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
 * Check if value is a valid number
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is an integer
 */
export function isInteger(value: any): value is number {
  return Number.isInteger(value);
}

/**
 * Check if value is a valid date
 */
export function isValidDate(value: any): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if string meets minimum length
 */
export function minLength(str: string, min: number): boolean {
  return str.length >= min;
}

/**
 * Check if string meets maximum length
 */
export function maxLength(str: string, max: number): boolean {
  return str.length <= max;
}

/**
 * Check if number is within range
 */
export function isInRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * Check if value matches pattern
 */
export function matchesPattern(str: string, pattern: RegExp): boolean {
  return pattern.test(str);
}