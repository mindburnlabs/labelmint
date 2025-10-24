/**
 * Debounce utility function
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Debounce with immediate execution on first call
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  let isFirstCall = true;

  return (...args: Parameters<T>) => {
    if (isFirstCall) {
      func(...args);
      isFirstCall = false;
      return;
    }

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
      isFirstCall = true;
    }, delay);
  };
}

/**
 * Debounce with trailing execution (most recent call)
 */
export function debounceTrailing<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}