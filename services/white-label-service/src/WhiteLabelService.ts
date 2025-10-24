import { Express, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from './utils/logger';
import path from 'path';
import fs from 'fs/promises';

interface TenantConfig {
  tenantId: string;
  branding: {
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    tertiaryColor: string;
    theme: 'light' | 'dark' | 'auto';
    customCSS?: string;
  };
  domain: {
    customDomain: string;
    sslEnabled: boolean;
    cname?: string;
  };
  features: {
    enabledFeatures: string[];
    disabledFeatures: string[];
    customWorkflows: boolean;
    customIntegrations: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
  localization: {
    defaultLanguage: string;
    supportedLanguages: string[];
    customTranslations: Record<string, Record<string, string>>;
    customTerms: Record<string, string>;
  };
  api: {
    rateLimitOverrides: Record<string, number>;
    customEndpoints: Array<{
      path: string;
      method: string;
      handler: string;
      auth: boolean;
    }>;
    webhooks: Array<{
      event: string;
      url: string;
      secret: string;
    }>;
  };
  notifications: {
    emailTemplates: Record<string, string>;
    smsTemplates?: Record<string, string>;
    webhookTemplates?: Record<string, any>;
    customBranding: boolean;
    fromEmail: string;
    fromName: string;
  };
}

export class WhiteLabelService {
  private prisma: PrismaClient;
  private redis: Redis;
  private app: Express;
  private tenantConfigs: Map<string, TenantConfig> = new Map();
  private staticAssetsBase = '/var/lib/labelmint/tenant-assets';

  constructor(prisma: PrismaClient, redis: Redis, app: Express) {
    this.prisma = prisma;
    this.redis = redis;
    this.app = app;
    this.setupMiddleware();
    this.ensureStaticDirectories();
  }

  /**
   * Setup middleware for tenant routing
   */
  private setupMiddleware(): void {
    // Tenant identification middleware
    this.app.use(async (req: Request, res: Response, next) => {
      // Extract tenant from subdomain or header
      const tenantId = await this.extractTenantId(req);

      if (tenantId) {
        req.tenantId = tenantId;

        // Load or get tenant config
        let config = this.tenantConfigs.get(tenantId);
        if (!config) {
          config = await this.loadTenantConfig(tenantId);
          this.tenantConfigs.set(tenantId, config);
        }

        req.tenantConfig = config;

        // Apply tenant-specific middleware
        await this.applyTenantMiddleware(req, res, config);
      }

      next();
    });
  }

  /**
   * Extract tenant ID from request
   */
  private async extractTenantId(req: Request): Promise<string | null> {
    // 1. Check for custom domain
    const host = req.headers.host;
    if (host && host !== 'app.labelmint.org' && host !== 'localhost:3000') {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          OR: [
            { domain: host },
            { cname: host }
          ]
        }
      });
      return tenant?.tenantId || null;
    }

    // 2. Check for X-Tenant-ID header
    const headerTenant = req.headers['x-tenant-id'] as string;
    if (headerTenant) {
      return headerTenant;
    }

    // 3. Check for subdomain
    if (host && host.includes('.')) {
      const subdomain = host.split('.')[0];
      const tenant = await this.prisma.tenant.findFirst({
        where: { subdomain }
      });
      return tenant?.tenantId || null;
    }

    // 4. Check query parameter for testing
    const queryTenant = req.query.tenant as string;
    if (queryTenant && queryTenant.length > 0) {
      return queryTenant;
    }

    return null;
  }

  /**
   * Load tenant configuration
   */
  private async loadTenantConfig(tenantId: string): Promise<TenantConfig> {
    try {
      // Get tenant from database
      const tenant = await this.prisma.tenant.findUnique({
        where: { tenantId },
        include: {
          settings: true
        }
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Get custom theme if exists
      let customTheme = {};
      if (tenant.settings?.themeId) {
        customTheme = await this.prisma.customTheme.findUnique({
          where: { id: tenant.settings.themeId }
        });
      }

      // Build configuration
      const config: TenantConfig = {
        tenantId,
        branding: {
          logo: tenant.logo || '/default/logo.png',
          primaryColor: tenant.settings?.primaryColor || '#4F46E5',
          secondaryColor: tenant.settings?.secondaryColor || '#6B7280',
          tertiaryColor: tenant.settings?.tertiaryColor || '#9CA3AF',
          theme: tenant.settings?.defaultTheme || 'light',
          customCSS: customTheme?.css || null
        },
        domain: {
          customDomain: tenant.domain || null,
          sslEnabled: tenant.sslEnabled || false,
          cname: tenant.cname || null
        },
        features: {
          enabledFeatures: tenant.settings?.enabledFeatures || [],
          disabledFeatures: tenant.settings?.disabledFeatures || [],
          customWorkflows: tenant.settings?.customWorkflows || false,
          customIntegrations: tenant.settings?.customIntegrations || false,
          advancedAnalytics: tenant.settings?.advancedAnalytics || false,
          prioritySupport: tenant.settings?.prioritySupport || false
        },
        localization: {
          defaultLanguage: tenant.settings?.defaultLanguage || 'en',
          supportedLanguages: tenant.settings?.supportedLanguages || ['en'],
          customTranslations: tenant.settings?.customTranslations || {},
          customTerms: tenant.settings?.customTerms || {}
        },
        api: {
          rateLimitOverrides: tenant.settings?.rateLimitOverrides || {},
          customEndpoints: tenant.settings?.customEndpoints || [],
          webhooks: tenant.settings?.webhooks || []
        },
        notifications: {
          emailTemplates: tenant.settings?.emailTemplates || {},
          smsTemplates: tenant.settings?.smsTemplates || {},
          webhookTemplates: tenant.settings?.webhookTemplates || {},
          customBranding: tenant.settings?.emailBranding || false,
          fromEmail: tenant.settings?.fromEmail || null,
          fromName: tenant.settings?.fromName || tenant.name
        }
      };

      // Cache configuration
      await this.redis.setex(
        `tenant-config:${tenantId}`,
        300, // 5 minutes
        JSON.stringify(config)
      );

      return config;
    } catch (error) {
      logger.error(`Failed to load tenant config for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Apply tenant-specific middleware
   */
  private async applyTenantMiddleware(
    req: Request,
    res: Response,
    config: TenantConfig
  ): Promise<void> {
    // 1. Apply custom CORS if custom domain
    if (config.domain.customDomain) {
      res.setHeader('Access-Control-Allow-Origin', `https://${config.domain.customDomain}`);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // 2. Apply rate limiting overrides
    if (Object.keys(config.api.rateLimitOverrides).length > 0) {
      // Implementation for custom rate limiting
    }

    // 3. Set locale for internationalization
    if (req.headers['accept-language']) {
      const preferredLanguage = req.headers['accept-language'].split(',')[0];
      if (config.localization.supportedLanguages.includes(preferredLanguage)) {
        req.locale = preferredLanguage;
      } else {
        req.locale = config.localization.defaultLanguage;
      }
    } else {
      req.locale = config.localization.defaultLanguage;
    }

    // 4. Set theme preferences
    const userTheme = req.headers['x-theme'] as string;
    req.theme = userTheme && ['light', 'dark'].includes(userTheme)
      ? userTheme
      : config.branding.theme;
  }

  /**
   * Setup static asset serving for tenant
   */
  public async setupTenantAssets(tenantId: string): Promise<void> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      config = await this.loadTenantConfig(tenantId);
      this.tenantConfigs.set(tenantId, config);
    }

    const tenantDir = path.join(this.staticAssetsBase, tenantId);
    await fs.mkdir(tenantDir, { recursive: true });

    // Create custom CSS file
    const cssPath = path.join(tenantDir, 'custom.css');
    const css = this.generateCustomCSS(config);
    await fs.writeFile(cssPath, css);

    // Copy or create custom logo
    if (config.branding.logo && !config.branding.logo.startsWith('/default/')) {
      const logoPath = path.join(tenantDir, 'logo.png');
      // Implementation for logo processing
    }

    // Generate manifest.json for PWA
    const manifest = {
      name: config.localization.customTerms?.appName || 'LabelMint',
      short_name: config.localization.customTerms?.shortName || 'LabelMint',
      theme_color: config.branding.primaryColor,
      background_color: config.branding.secondaryColor,
      display: 'standalone',
      scope: `/${config.tenantId}`,
      start_url: `/${config.tenantId}`,
      icons: [
        {
          src: `/${config.tenantId}/logo.png`,
          sizes: '192x192',
          type: 'image/png'
        }
      ]
    };

    await fs.writeFile(
      path.join(tenantDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  /**
   * Generate custom CSS for tenant
   */
  private generateCustomCSS(config: TenantConfig): string {
    return `
      :root {
        --primary-color: ${config.branding.primaryColor};
        --secondary-color: ${config.branding.secondaryColor};
        --tertiary-color: ${config.branding.tertiaryColor};
        --logo-path: "${config.branding.logo}";
      }

      ${config.branding.customCSS || ''}

      /* Custom scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: var(--secondary-color);
      }

      ::-webkit-scrollbar-thumb {
        background: var(--primary-color);
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: var(--tertiary-color);
      }

      /* Custom loading animations */
      .loading-spinner {
        border-top-color: var(--primary-color);
        border-right-color: var(--primary-color);
      }

      /* Custom hover effects */
      .btn-primary {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
      }

      .btn-primary:hover {
        background-color: var(--tertiary-color);
        border-color: var(--tertiary-color);
      }

      /* Custom focus styles */
      .form-input:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(${this.hexToRgb(config.branding.primaryColor)}, 0.2);
      }

      /* Hide default LabelMint branding */
      .branding-default {
        display: none !important;
      }

      /* Show custom branding */
      .branding-custom {
        display: block !important;
      }
    `;
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  }

  /**
   * Update tenant configuration
   */
  public async updateTenantConfig(
    tenantId: string,
    updates: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const currentConfig = this.tenantConfigs.get(tenantId) ||
      await this.loadTenantConfig(tenantId);

    // Update configuration
    const newConfig = { ...currentConfig, ...updates };
    this.tenantConfigs.set(tenantId, newConfig);

    // Update database
    await this.prisma.tenant.update({
      where: { tenantId },
      data: {
        settings: {
          update: {
            primaryColor: updates.branding?.primaryColor,
            secondaryColor: updates.branding?.secondaryColor,
            tertiaryColor: updates.branding?.tertiaryColor,
            defaultTheme: updates.branding?.theme,
            enabledFeatures: updates.features?.enabledFeatures,
            disabledFeatures: updates.features?.disabledFeatures,
            customWorkflows: updates.features?.customWorkflows,
            customIntegrations: updates.features?.customIntegrations,
            advancedAnalytics: updates.features?.advancedAnalytics,
            prioritySupport: updates.features?.prioritySupport,
            defaultLanguage: updates.localization?.defaultLanguage,
            supportedLanguages: updates.localization?.supportedLanguages,
            customTranslations: updates.localization?.customTranslations,
            customTerms: updates.localization?.customTerms,
            rateLimitOverrides: updates.api?.rateLimitOverrides,
            emailBranding: updates.notifications?.customBranding,
            fromEmail: updates.notifications?.fromEmail,
            fromName: updates.notifications?.fromName
          }
        }
      }
    });

    // Cache updated config
    await this.redis.setex(
      `tenant-config:${tenantId}`,
      300,
      JSON.stringify(newConfig)
    );

    // Regenerate assets
    await this.setupTenantAssets(tenantId);

    // Clear static cache
    await this.clearTenantCache(tenantId);

    return newConfig;
  }

  /**
   * Setup custom domain
   */
  public async setupCustomDomain(
    tenantId: string,
    domain: string,
    ssl: boolean = true
  ): Promise<void> {
    // Verify domain ownership
    const isVerified = await this.verifyDomainOwnership(domain, tenantId);
    if (!isVerified) {
      throw new Error('Domain ownership verification failed');
    }

    // Update tenant record
    await this.prisma.tenant.update({
      where: { tenantId },
      data: {
        domain,
        cname: domain,
        sslEnabled: ssl,
        verifiedAt: new Date()
      }
    });

    // Generate SSL certificate if needed
    if (ssl) {
      await this.generateSSLCertificate(domain, tenantId);
    }

    // Update DNS configuration
    await this.updateDNSConfiguration(domain, tenantId);

    // Clear cache
    await this.clearTenantCache(tenantId);
  }

  /**
   * Verify domain ownership
   */
  private async verifyDomainOwnership(
    domain: string,
    tenantId: string
  ): Promise<boolean> {
    // Implementation for domain verification
    // 1. DNS TXT record verification
    // 2. File upload verification
    // 3. Email verification
    return true;
  }

  /**
   * Generate SSL certificate
   */
  private async generateSSLCertificate(
    domain: string,
    tenantId: string
  ): Promise<void> {
    // Integration with Let's Encrypt or other CA
  }

  /**
   * Update DNS configuration
   */
  private async updateDNSConfiguration(
    domain: string,
    tenantId: string
  ): Promise<void> {
    // Integration with DNS provider API
  }

  /**
   * Ensure static directories exist
   */
  private async ensureStaticDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.staticAssetsBase, { recursive: true });
    } catch (error) {
      logger.error('Failed to create static assets directory:', error);
    }
  }

  /**
   * Clear tenant cache
   */
  private async clearTenantCache(tenantId: string): Promise<void> {
    const keys = await this.redis.keys(`*:${tenantId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Handle tenant deletion
   */
  public async deleteTenant(tenantId: string): Promise<void> {
    // Delete from database
    await this.prisma.tenant.delete({
      where: { tenantId }
    });

    // Delete static assets
    const tenantDir = path.join(this.staticAssetsBase, tenantId);
    try {
      await fs.rmdir(tenantDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to delete static assets for ${tenantId}:`, error);
    }

    // Clear cache
    await this.clearTenantCache(tenantId);

    // Remove from memory
    this.tenantConfigs.delete(tenantId);
  }

  /**
   * Generate deployment package
   */
  public async generateDeploymentPackage(
    tenantId: string
  ): Promise<string> {
    const config = this.tenantConfigs.get(tenantId) ||
      await this.loadTenantConfig(tenantId);

    // Create deployment package
    const packagePath = `/tmp/deployment-${tenantId}-${Date.now()}.tar.gz`;

    // Implementation for creating deployment package
    // Includes: Docker configuration, environment variables, SSL certificates, etc.

    return packagePath;
  }
}