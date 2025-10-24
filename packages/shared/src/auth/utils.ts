// ============================================================================
// AUTH UTILITIES
// ============================================================================

/**
 * Generate random token
 */
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password with bcrypt (placeholder)
 */
export async function hashPassword(password: string): Promise<string> {
  // This would use bcrypt in actual implementation
  return `hashed_${password}`;
}

/**
 * Compare password with hash (placeholder)
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // This would use bcrypt in actual implementation
  return hash === `hashed_${password}`;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return generateSecureToken(64);
}

/**
 * Extract user from token
 */
export function extractUserFromToken(token: string): any {
  // Placeholder implementation
  try {
    // In real implementation, this would decode and verify JWT
    return { id: 'user_id', role: 'user' };
  } catch {
    return null;
  }
}