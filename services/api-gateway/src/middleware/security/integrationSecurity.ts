import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger';
import securityConfig from '../../config/security';

export interface IntegrationConfig {
  name: string;
  type: 'telegram' | 'ton' | 'payment' | 'webhook' | 'oauth';
  enabled: boolean;
  secrets: {
    signingSecret?: string;
    apiKey?: string;
    webhookSecret?: string;
    encryptionKey?: string;
  };
  security: {
    enableSignatureValidation: boolean;
    enableIPWhitelisting: boolean;
    allowedIPs: string[];
    enableRateLimiting: boolean;
    rateLimit: {
      max: number;
      windowMs: number;
    };
    enableEncryption: boolean;
    encryptionAlgorithm: string;
  };
  endpoints: string[];
}

export class IntegrationSecurityManager {
  private integrations: Map<string, IntegrationConfig> = new Map();
  private keyRotationSchedule: Map<string, Date> = new Map();

  constructor() {
    this.initializeIntegrations();
  }

  /**
   * Initialize predefined integrations
   */
  private initializeIntegrations(): void {
    // Telegram Bot API Integration
    this.integrations.set('telegram', {
      name: 'Telegram Bot API',
      type: 'telegram',
      enabled: true,
      secrets: {
        signingSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
        apiKey: process.env.TELEGRAM_BOT_TOKEN
      },
      security: {
        enableSignatureValidation: true,
        enableIPWhitelisting: true,
        allowedIPs: this.getTelegramIPRanges(),
        enableRateLimiting: true,
        rateLimit: {
          max: 30, // 30 requests per second
          windowMs: 1000
        },
        enableEncryption: false,
        encryptionAlgorithm: 'aes-256-gcm'
      },
      endpoints: ['/webhook/telegram']
    });

    // TON Blockchain Integration
    this.integrations.set('ton', {
      name: 'TON Blockchain API',
      type: 'ton',
      enabled: true,
      secrets: {
        apiKey: process.env.TON_API_KEY,
        encryptionKey: process.env.TON_ENCRYPTION_KEY
      },
      security: {
        enableSignatureValidation: false, // TON uses different authentication
        enableIPWhitelisting: false,
        allowedIPs: [],
        enableRateLimiting: true,
        rateLimit: {
          max: 10, // 10 requests per second
          windowMs: 1000
        },
        enableEncryption: true,
        encryptionAlgorithm: 'aes-256-gcm'
      },
      endpoints: ['/api/v1/ton/*']
    });

    // Payment Provider Integration
    this.integrations.set('payment', {
      name: 'Payment Provider API',
      type: 'payment',
      enabled: true,
      secrets: {
        signingSecret: process.env.PAYMENT_WEBHOOK_SECRET,
        apiKey: process.env.PAYMENT_API_KEY,
        webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET
      },
      security: {
        enableSignatureValidation: true,
        enableIPWhitelisting: true,
        allowedIPs: this.getPaymentProviderIPs(),
        enableRateLimiting: true,
        rateLimit: {
          max: 100, // 100 requests per minute
          windowMs: 60000
        },
        enableEncryption: true,
        encryptionAlgorithm: 'aes-256-gcm'
      },
      endpoints: ['/api/v1/payments/*', '/webhook/payment']
    });

    // Generic Webhook Integration
    this.integrations.set('webhook', {
      name: 'Generic Webhook Handler',
      type: 'webhook',
      enabled: true,
      secrets: {
        webhookSecret: process.env.GENERIC_WEBHOOK_SECRET
      },
      security: {
        enableSignatureValidation: true,
        enableIPWhitelisting: false,
        allowedIPs: [],
        enableRateLimiting: true,
        rateLimit: {
          max: 60, // 60 requests per minute
          windowMs: 60000
        },
        enableEncryption: false,
        encryptionAlgorithm: 'aes-256-gcm'
      },
      endpoints: ['/webhook/*']
    });

    // Schedule key rotation
    this.scheduleKeyRotation();
  }

  /**
   * Get Telegram IP ranges for webhook validation
   */
  private getTelegramIPRanges(): string[] {
    // Telegram's current IP ranges (verify these are up to date)
    return [
      '149.154.160.0/20',
      '91.108.4.0/22',
      '91.108.56.0/22',
      '91.108.8.0/22',
      '91.108.12.0/22',
      '149.154.164.0/22',
      '149.154.168.0/22',
      '149.154.172.0/22'
    ];
  }

  /**
   * Get payment provider IP ranges
   */
  private getPaymentProviderIPs(): string[] {
    // Add your payment provider's IP ranges here
    // This is a placeholder - replace with actual payment provider IPs
    return [
      // Stripe: '54.187.174.169', '54.187.174.170', '54.187.174.171', '54.187.174.172'
      // PayPal: Add their IP ranges
    ].filter(ip => ip.length > 0);
  }

  /**
   * Schedule key rotation for all integrations
   */
  private scheduleKeyRotation(): void {
    const rotationDays = securityConfig.webhooks.secretRotationDays;

    this.integrations.forEach((config, name) => {
      const nextRotation = new Date();
      nextRotation.setDate(nextRotation.getDate() + rotationDays);
      this.keyRotationSchedule.set(name, nextRotation);
    });

    // Check for key rotation daily
    setInterval(() => {
      this.checkKeyRotation();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Check if any keys need rotation
   */
  private checkKeyRotation(): void {
    const now = new Date();

    this.keyRotationSchedule.forEach((rotationDate, integrationName) => {
      if (now >= rotationDate) {
        logger.info(`Rotating keys for integration: ${integrationName}`);
        this.rotateIntegrationKeys(integrationName);

        // Schedule next rotation
        const nextRotation = new Date();
        nextRotation.setDate(nextRotation.getDate() + securityConfig.webhooks.secretRotationDays);
        this.keyRotationSchedule.set(integrationName, nextRotation);
      }
    });
  }

  /**
   * Rotate keys for a specific integration
   */
  private rotateIntegrationKeys(integrationName: string): void {
    const config = this.integrations.get(integrationName);
    if (!config) return;

    // Generate new secrets
    const newSecrets = {
      webhookSecret: config.type === 'webhook' || config.type === 'payment' ?
        crypto.randomBytes(32).toString('hex') : undefined,
      signingSecret: config.type === 'telegram' || config.type === 'payment' ?
        crypto.randomBytes(32).toString('hex') : undefined,
      encryptionKey: config.security.enableEncryption ?
        crypto.randomBytes(32).toString('hex') : undefined
    };

    // Update configuration
    Object.assign(config.secrets, newSecrets);

    // Log rotation (in production, store securely and notify relevant teams)
    logger.info(`Keys rotated for ${integrationName}`, {
      integrationName,
      rotatedKeys: Object.keys(newSecrets).filter(key => newSecrets[key as keyof typeof newSecrets])
    });
  }

  /**
   * Get integration configuration by name
   */
  getIntegration(name: string): IntegrationConfig | undefined {
    return this.integrations.get(name);
  }

  /**
   * Get integration by endpoint pattern
   */
  getIntegrationByEndpoint(endpoint: string): IntegrationConfig | undefined {
    for (const config of this.integrations.values()) {
      for (const pattern of config.endpoints) {
        if (this.matchesEndpoint(endpoint, pattern)) {
          return config;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if endpoint matches pattern
   */
  private matchesEndpoint(endpoint: string, pattern: string): boolean {
    // Simple pattern matching (can be enhanced with regex)
    if (pattern.endsWith('*')) {
      const basePattern = pattern.slice(0, -1);
      return endpoint.startsWith(basePattern);
    }
    return endpoint === pattern;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    integration: IntegrationConfig,
    payload: string,
    signature: string,
    timestamp?: string
  ): boolean {
    if (!integration.security.enableSignatureValidation) {
      return true;
    }

    const secret = integration.secrets.signingSecret || integration.secrets.webhookSecret;
    if (!secret) {
      logger.warn(`No signing secret configured for integration: ${integration.name}`);
      return false;
    }

    // Verify timestamp if provided
    if (timestamp) {
      const webhookTime = parseInt(timestamp);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - webhookTime) > securityConfig.webhooks.toleranceSeconds) {
        logger.warn(`Webhook timestamp outside tolerance for ${integration.name}`, {
          webhookTime,
          now,
          tolerance: securityConfig.webhooks.toleranceSeconds
        });
        return false;
      }
    }

    // Generate expected signature
    const expectedSignature = this.generateSignature(payload, secret, integration.type);

    // Secure comparison
    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (error) {
      logger.error(`Signature comparison failed for ${integration.name}:`, error);
      return false;
    }
  }

  /**
   * Generate signature based on integration type
   */
  private generateSignature(payload: string, secret: string, type: string): string {
    const algorithm = securityConfig.webhooks.signatureAlgorithm;

    switch (type) {
      case 'telegram':
        // Telegram uses HMAC-SHA256
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');

      case 'payment':
        // Payment providers may use different schemes
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');

      case 'webhook':
        // Generic webhook
        return crypto.createHmac(algorithm, secret).update(payload).digest('hex');

      default:
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }
  }

  /**
   * Verify IP address against allowed list
   */
  verifyIPAddress(integration: IntegrationConfig, clientIP: string): boolean {
    if (!integration.security.enableIPWhitelisting || integration.security.allowedIPs.length === 0) {
      return true;
    }

    return integration.security.allowedIPs.some(allowedIP =>
      this.isIPInCIDR(clientIP, allowedIP)
    );
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split('/');
    const mask = parseInt(prefixLength, 10);

    if (isNaN(mask)) {
      return ip === network; // Exact match if no CIDR notation
    }

    // Convert to numbers for comparison (simplified IPv4)
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const maskNum = (0xFFFFFFFF << (32 - mask)) >>> 0;

    return (ipNum & maskNum) === (networkNum & maskNum);
  }

  /**
   * Convert IPv4 address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(integration: IntegrationConfig, data: string): { encrypted: string; iv: string; tag: string } {
    if (!integration.security.enableEncryption) {
      return { encrypted: data, iv: '', tag: '' };
    }

    const key = integration.secrets.encryptionKey;
    if (!key) {
      throw new Error(`No encryption key configured for integration: ${integration.name}`);
    }

    const algorithm = integration.security.encryptionAlgorithm;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, Buffer.from(key, 'hex'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag?.();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag ? tag.toString('hex') : ''
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(integration: IntegrationConfig, encryptedData: string, iv: string, tag: string): string {
    if (!integration.security.enableEncryption) {
      return encryptedData;
    }

    const key = integration.secrets.encryptionKey;
    if (!key) {
      throw new Error(`No encryption key configured for integration: ${integration.name}`);
    }

    const algorithm = integration.security.encryptionAlgorithm;
    const decipher = crypto.createDecipher(algorithm, Buffer.from(key, 'hex'));

    if (tag) {
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
    }

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get integration security metrics
   */
  getSecurityMetrics(): any {
    const metrics = {
      totalIntegrations: this.integrations.size,
      enabledIntegrations: Array.from(this.integrations.values()).filter(i => i.enabled).length,
      integrationsWithSignatureValidation: Array.from(this.integrations.values()).filter(i => i.security.enableSignatureValidation).length,
      integrationsWithIPWhitelisting: Array.from(this.integrations.values()).filter(i => i.security.enableIPWhitelisting).length,
      integrationsWithEncryption: Array.from(this.integrations.values()).filter(i => i.security.enableEncryption).length,
      keyRotationSchedule: Object.fromEntries(this.keyRotationSchedule),
      integrations: Array.from(this.integrations.entries()).map(([name, config]) => ({
        name,
        type: config.type,
        enabled: config.enabled,
        securityFeatures: {
          signatureValidation: config.security.enableSignatureValidation,
          ipWhitelisting: config.security.enableIPWhitelisting,
          rateLimiting: config.security.enableRateLimiting,
          encryption: config.security.enableEncryption
        }
      }))
    };

    return metrics;
  }

  /**
   * Middleware factory for integration security
   */
  integrationSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const integration = this.getIntegrationByEndpoint(req.path);

      if (!integration || !integration.enabled) {
        return next();
      }

      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      // IP verification
      if (integration.security.enableIPWhitelisting) {
        if (!this.verifyIPAddress(integration, clientIP)) {
          logger.warn(`IP not allowed for integration ${integration.name}`, {
            ip: clientIP,
            integration: integration.name,
            path: req.path
          });
          return res.status(403).json({
            error: {
              code: 'IP_NOT_ALLOWED',
              message: 'Access denied from this IP address'
            }
          });
        }
      }

      // Signature verification for webhooks
      if (integration.type === 'webhook' || integration.type === 'payment' || integration.type === 'telegram') {
        const signature = req.get('X-Webhook-Signature') || req.get('X-T signature') || req.get('X-Telegram-Bot-Api-Secret-Token');
        const timestamp = req.get('X-Webhook-Timestamp') || req.get('X-Timestamp');

        if (integration.security.enableSignatureValidation && signature) {
          const payload = JSON.stringify(req.body);

          if (!this.verifyWebhookSignature(integration, payload, signature, timestamp)) {
            logger.warn(`Invalid signature for integration ${integration.name}`, {
              ip: clientIP,
              integration: integration.name,
              path: req.path,
              signature: signature?.substring(0, 20) + '...'
            });
            return res.status(401).json({
              error: {
                code: 'INVALID_SIGNATURE',
                message: 'Webhook signature verification failed'
              }
            });
          }
        }
      }

      // Add integration info to request for downstream use
      (req as any).integration = integration;

      next();
    };
  }
}

// Export singleton instance
export const integrationSecurity = new IntegrationSecurityManager();
export default integrationSecurity;