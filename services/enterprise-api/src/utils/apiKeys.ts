import crypto from 'crypto';

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'lm_'): string {
  const bytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${bytes}`;
}

/**
 * Generate API key with organization prefix
 */
export function generateOrganizationApiKey(organizationId: string): string {
  const orgPrefix = organizationId.substring(0, 8).toLowerCase();
  const randomPart = crypto.randomBytes(24).toString('hex');
  return `lm_${orgPrefix}_${randomPart}`;
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  // Basic validation: starts with 'lm_' and has reasonable length
  return /^lm_[a-f0-9_]{40,}$/i.test(apiKey);
}

/**
 * Extract organization ID from API key (if format allows)
 */
export function extractOrgIdFromApiKey(apiKey: string): string | null {
  const match = apiKey.match(/^lm_([a-f0-9]{8})_[a-f0-9]+$/i);
  return match ? match[1] : null;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify API key against stored hash
 */
export function verifyApiKey(apiKey: string, hashedKey: string): boolean {
  const computedHash = hashApiKey(apiKey);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hashedKey, 'hex')
  );
}