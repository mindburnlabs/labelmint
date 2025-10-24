/**
 * Math and percentage utilities
 */

/**
 * Calculate percentage
 */
export function calculatePercentage(
  value: number,
  total: number,
  decimals: number = 1
): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number,
  decimals: number = 1
): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100;
  }
  return Number(((newValue - oldValue) / Math.abs(oldValue) * 100).toFixed(decimals));
}

/**
 * Check if a percentage represents an increase
 */
export function isPercentageIncrease(percentage: number): boolean {
  return percentage > 0;
}

/**
 * Check if a percentage represents a decrease
 */
export function isPercentageDecrease(percentage: number): boolean {
  return percentage < 0;
}

/**
 * Calculate percentage with bounds (0-100)
 */
export function calculatePercentageBounded(
  value: number,
  total: number,
  decimals: number = 1
): number {
  const percentage = calculatePercentage(value, total, decimals);
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Calculate progress percentage with min/max bounds
 */
export function calculateProgress(
  value: number,
  min: number,
  max: number,
  decimals: number = 1
): number {
  if (max === min) return 0;
  return Number(((value - min) / (max - min) * 100).toFixed(decimals));
}

/**
 * Convert fraction to percentage
 */
export function fractionToPercentage(
  numerator: number,
  denominator: number,
  decimals: number = 1
): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator * 100).toFixed(decimals));
}

/**
 * Convert percentage to fraction
 */
export function percentageToFraction(percentage: number): number {
  return percentage / 100;
}