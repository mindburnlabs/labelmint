// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Check if value is an array
 */
export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * Create array from iterable
 */
export function from<T>(iterable: Iterable<T>): T[] {
  return Array.from(iterable);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Remove duplicates from array based on key function
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Shuffle array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get random item from array
 */
export function random<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get random items from array
 */
export function randomItems<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Group array items by key
 */
export function groupBy<T, K extends string | number | symbol>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

/**
 * Flatten nested array
 */
export function flatten<T>(array: (T | T[])[]): T[] {
  return array.reduce<T[]>((flat, item) => {
    return flat.concat(Array.isArray(item) ? flatten(item) : item);
  }, []);
}

/**
 * Flatten array to specified depth
 */
export function flattenDepth<T>(array: any[], depth: number = 1): any[] {
  return depth > 0
    ? array.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenDepth(val, depth - 1) : val), [])
    : array.slice();
}

/**
 * Remove falsy values from array
 */
export function compact<T>(array: (T | null | undefined | false | 0 | '')[]): T[] {
  return array.filter(Boolean) as T[];
}

/**
 * Remove null and undefined values from array
 */
export function withoutNulls<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(item => item != null) as T[];
}

/**
 * Check if arrays are equal
 */
export function isEqual<T>(array1: T[], array2: T[]): boolean {
  if (array1.length !== array2.length) return false;
  return array1.every((item, index) => item === array2[index]);
}

/**
 * Find intersection of two arrays
 */
export function intersection<T>(array1: T[], array2: T[]): T[] {
  return array1.filter(item => array2.includes(item));
}

/**
 * Find difference between two arrays
 */
export function difference<T>(array1: T[], array2: T[]): T[] {
  return array1.filter(item => !array2.includes(item));
}

/**
 * Find symmetric difference between two arrays
 */
export function symmetricDifference<T>(array1: T[], array2: T[]): T[] {
  return [
    ...array1.filter(item => !array2.includes(item)),
    ...array2.filter(item => !array1.includes(item))
  ];
}

/**
 * Union of two arrays
 */
export function union<T>(array1: T[], array2: T[]): T[] {
  return unique([...array1, ...array2]);
}

/**
 * Check if array is empty
 */
export function isEmpty<T>(array: T[]): boolean {
  return array.length === 0;
}

/**
 * Get first item of array
 */
export function first<T>(array: T[]): T | undefined {
  return array[0];
}

/**
 * Get last item of array
 */
export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

/**
 * Get item at index (supports negative indices)
 */
export function at<T>(array: T[], index: number): T | undefined {
  if (index >= 0) {
    return array[index];
  }
  return array[array.length + index];
}

/**
 * Sum array of numbers
 */
export function sum(array: number[]): number {
  return array.reduce((total, num) => total + num, 0);
}

/**
 * Find minimum value in array
 */
export function min<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array.reduce((min, current) => current < min ? current : min);
}

/**
 * Find maximum value in array
 */
export function max<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array.reduce((max, current) => current > max ? current : max);
}

/**
 * Find average of array of numbers
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0;
  return sum(array) / array.length;
}

/**
 * Sort array by key function
 */
export function sortBy<T>(array: T[], keyFn: (item: T) => any, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    let comparison = 0;
    if (aVal > bVal) comparison = 1;
    if (aVal < bVal) comparison = -1;
    return direction === 'desc' ? comparison * -1 : comparison;
  });
}

/**
 * Paginate array
 */
export function paginate<T>(array: T[], page: number, pageSize: number): { data: T[]; total: number; page: number; totalPages: number } {
  const total = array.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const data = array.slice(startIndex, endIndex);

  return { data, total, page, totalPages };
}

/**
 * Partition array into two arrays based on predicate
 */
export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];

  for (const item of array) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }

  return [truthy, falsy];
}

/**
 * Find index of item in array
 */
export function indexOf<T>(array: T[], item: T, fromIndex?: number): number {
  return array.indexOf(item, fromIndex);
}

/**
 * Find last index of item in array
 */
export function lastIndexOf<T>(array: T[], item: T, fromIndex?: number): number {
  return array.lastIndexOf(item, fromIndex);
}

/**
 * Check if array includes item
 */
export function includes<T>(array: T[], item: T): boolean {
  return array.includes(item);
}

/**
 * Join array elements with separator
 */
export function join(array: any[], separator: string = ','): string {
  return array.join(separator);
}

/**
 * Slice array
 */
export function slice<T>(array: T[], start?: number, end?: number): T[] {
  return array.slice(start, end);
}

/**
 * Splice array (returns new array, original unchanged)
 */
export function splice<T>(array: T[], start: number, deleteCount?: number, ...items: T[]): T[] {
  const result = [...array];
  result.splice(start, deleteCount, ...items);
  return result;
}