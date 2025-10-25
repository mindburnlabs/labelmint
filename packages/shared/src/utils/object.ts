// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Check if value is an object (not null)
 */
export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Get object keys
 */
export function keys<T extends Record<string, any>>(obj: T): Array<keyof T> {
  return Object.keys(obj);
}

/**
 * Get object values
 */
export function values<T extends Record<string, any>>(obj: T): Array<T[keyof T]> {
  return Object.values(obj);
}

/**
 * Get object entries
 */
export function entries<T extends Record<string, any>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

/**
 * Deep clone object
 */
export function cloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => cloneDeep(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (objObject.prototype.hasOwnProperty.call(key)) {
        cloned[key] = cloneDeep(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Shallow clone object
 */
export function clone<T>(obj: T): T {
  return { ...obj };
}

/**
 * Merge objects (shallow)
 */
export function merge<T extends Record<string, any>>(...objects: Partial<T>[]): T {
  return objects.reduce((result, obj) => ({ ...result, ...obj }), {} as Partial<T>) as T;
}

/**
 * Deep merge objects
 */
export function mergeDeep<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key] as Record<string, any>, source[key] as Record<string, any>);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

/**
 * Pick specific keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Check if object has property
 */
export function has<T extends Record<string, any>>(obj: T, key: string): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Set nested property
 */
export function set(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || !isObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Get nested property
 */
export function get(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Remove nested property
 */
export function unset(obj: any, path: string): boolean {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current == null || typeof current !== 'object' || !(key in current)) {
      return false;
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  if (current && typeof current === 'object' && lastKey in current) {
    delete current[lastKey];
    return true;
  }

  return false;
}

/**
 * Transform object keys
 */
export function mapKeys<T extends Record<string, any>, U extends string>(
  obj: T,
  mapFn: (key: keyof T, value: T[keyof T]) => U
): Record<U, T[keyof T]> {
  const result = {} as Record<U, T[keyof T]>;
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key)) {
      const newKey = mapFn(key, obj[key]);
      result[newKey] = obj[key];
    }
  }
  return result;
}

/**
 * Transform object values
 */
export function mapValues<T extends Record<string, any>, U>(
  obj: T,
  mapFn: (value: T[keyof T], key: keyof T) => U
): Record<keyof T, U> {
  const result = {} as Record<keyof T, U>;
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key)) {
      result[key] = mapFn(obj[key], key);
    }
  }
  return result;
}

/**
 * Filter object properties
 */
export function filter<T extends Record<string, any>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const result = {} as Partial<T>;
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key) && predicate(obj[key], key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Find object property
 */
export function find<T extends Record<string, any>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): { key: keyof T; value: T[keyof T] } | undefined {
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key) && predicate(obj[key], key)) {
      return { key, value: obj[key] };
    }
  }
  return undefined;
}

/**
 * Check if every property satisfies predicate
 */
export function every<T extends Record<string, any>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): boolean {
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key) && !predicate(obj[key], key)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if some property satisfies predicate
 */
export function some<T extends Record<string, any>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): boolean {
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key) && predicate(obj[key], key)) {
      return true;
    }
  }
  return false;
}

/**
 * Freeze object recursively
 */
export function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && isObject(obj[key]) && !Object.isFrozen(obj[key])) {
      deepFreeze(obj[key]);
    }
  }
  return obj;
}

/**
 * Convert object to query string
 */
export function toQueryString(obj: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const key in obj) {
    if (objObject.prototype.hasOwnProperty.call(key) && obj[key] !== undefined && obj[key] !== null) {
      params.append(key, String(obj[key]));
    }
  }
  return params.toString();
}