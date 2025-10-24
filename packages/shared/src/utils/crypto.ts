// ============================================================================
// CRYPTO UTILITIES
// ============================================================================

/**
 * Generate random string of specified length
 */
export function randomString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate random bytes as hex string
 */
export function randomBytes(length: number): string {
  const bytes = new Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return bytes.join('');
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
 * Generate nanoid (shorter than UUID)
 */
export function nanoid(size: number = 21): string {
  const alphabet = '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

/**
 * Simple hash function (for non-cryptographic purposes)
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate deterministic hash from string
 */
export function deterministicHash(str: string, length: number = 8): string {
  const hash = simpleHash(str);
  return hash.toString(16).padStart(length, '0').slice(0, length);
}