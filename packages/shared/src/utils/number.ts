// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Check if value is a valid number
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Convert string to number, return null if invalid
 */
export function toNumber(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Round number to specified decimal places
 */
export function round(num: number, decimals: number = 0): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(num * multiplier) / multiplier;
}

/**
 * Round number up to specified decimal places
 */
export function ceil(num: number, decimals: number = 0): number {
  const multiplier = Math.pow(10, decimals);
  return Math.ceil(num * multiplier) / multiplier;
}

/**
 * Round number down to specified decimal places
 */
export function floor(num: number, decimals: number = 0): number {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(num * multiplier) / multiplier;
}

/**
 * Clamp number between min and max values
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Check if number is in range (inclusive)
 */
export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * Generate random number between min and max (inclusive)
 */
export function random(min: number = 0, max: number = 1): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(random(min, max + 1));
}

/**
 * Format number with specified number of decimal places
 */
export function formatNumber(num: number, decimals: number = 0, locale?: string): string {
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
export function formatPercentage(num: number, decimals: number = 1, locale?: string): string {
  return formatNumber(num * 100, decimals, locale) + '%';
}

/**
 * Add separator to large numbers (e.g., 1,000,000)
 */
export function formatWithSeparator(num: number, separator: string = ','): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Convert number to ordinal string (1st, 2nd, 3rd, etc.)
 */
export function toOrdinal(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const lastTwoDigits = num % 100;
  const suffix = suffixes[(lastTwoDigits - 20) % 10] || suffixes[lastTwoDigits] || suffixes[0];
  return num + suffix;
}

/**
 * Calculate percentage change between two numbers
 */
export function percentageChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : Infinity;
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Calculate percentage of total
 */
export function percentageOf(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Find greatest common divisor (GCD)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Find least common multiple (LCM)
 */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Check if number is prime
 */
export function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Generate fibonacci sequence up to n terms
 */
export function fibonacci(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];

  const sequence = [0, 1];
  for (let i = 2; i < n; i++) {
    sequence.push(sequence[i - 1] + sequence[i - 2]);
  }
  return sequence;
}

/**
 * Calculate factorial of a number
 */
export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calculate power of number
 */
export function pow(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/**
 * Calculate square root
 */
export function sqrt(num: number): number {
  return Math.sqrt(num);
}

/**
 * Calculate absolute value
 */
export function abs(num: number): number {
  return Math.abs(num);
}

/**
 * Find minimum value in array
 */
export function min(values: number[]): number {
  return Math.min(...values);
}

/**
 * Find maximum value in array
 */
export function max(values: number[]): number {
  return Math.max(...values);
}

/**
 * Calculate average of array values
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate sum of array values
 */
export function sum(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate median of array values
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate standard deviation of array values
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Interpolate between two values
 */
export function interpolate(start: number, end: number, progress: number): number {
  progress = clamp(progress, 0, 1);
  return start + (end - start) * progress;
}

/**
 * Ease-in-out interpolation
 */
export function easeInOut(progress: number): number {
  progress = clamp(progress, 0, 1);
  return progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress;
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Map value from one range to another
 */
export function mapValue(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  const fromRange = fromMax - fromMin;
  const toRange = toMax - toMin;
  return toMin + ((value - fromMin) / fromRange) * toRange;
}