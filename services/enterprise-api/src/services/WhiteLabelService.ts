import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as sharp from 'sharp'

export interface BrandingConfig {
  logo?: {
    url?: string
    darkModeUrl?: string
    favicon?: string
    width?: number
    height?: number
  }
  colors: {
    primary: string
    secondary: string
    accent?: string
    background?: string
    surface?: string
    text?: string
    textSecondary?: string
    success?: string
    warning?: string
    error?: string
  }
  typography: {
    fontFamily?: string
    headingFont?: string
    bodyFont?: string
    fontSize?: {
      xs: string
      sm: string
      base: string
      lg: string
      xl: string
      '2xl': string
      '3xl': string
    }
  }
  customCSS?: string
  theme?: 'light' | 'dark' | 'auto'
  layout?: {
    headerStyle?: 'default' | 'minimal' | 'centered'
    sidebarStyle?: 'default' | 'expanded' | 'collapsed'
    borderRadius?: string
    spacing?: string
  }
}

export interface CustomDomain {
  domain: string
  verifyDNS?: boolean
  sslStatus?: 'pending' | 'verified' | 'failed'
  dnsRecords?: Array<{
    type: string
    name: string
    value: string
    ttl?: number
  }>
  customEmail?: boolean
}

export interface WhiteLabelConfig {
  organizationId: string
  branding: BrandingConfig
  customDomain?: CustomDomain
  featureFlags: Record<string, boolean>
  integrations: Record<string, any>
}

export class WhiteLabelService {
  /**
   * Configure white-label branding
   */
  static async configureBranding(
    organizationId: string,
    branding: BrandingConfig,
    userId: string
  ): Promise<any> {
    try {
      // Verify user has permission
      await this.verifyPermission(organizationId, userId, 'branding.configure')

      // Save branding configuration
      const config = await prisma.brandingConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          config: branding,
          createdBy: userId
        },
        update: {
          config: branding,
          updatedBy: userId
        }
      })

      // Generate custom CSS if needed
      if (branding.customCSS || branding.colors || branding.typography) {
        await this.generateCustomCSS(organizationId, branding)
      }

      // Cache the configuration
      await this.cacheConfiguration(organizationId, { branding })

      await AuditService.log({
        organizationId,
        userId,
        action: 'branding.configured',
        resourceType: 'branding_config',
        resourceId: config.id,
        details: { colors: branding.colors, hasLogo: !!branding.logo }
      })

      logger.info('Branding configured', {
        organizationId,
        userId,
        colors: branding.colors.primary
      })

      return config
    } catch (error) {
      logger.error('Failed to configure branding', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Upload and process logo
   */
  static async uploadLogo(
    organizationId: string,
    logoFile: Buffer,
    fileName: string,
    isDarkMode: boolean = false,
    userId: string
  ): Promise<{ url: string; width: number; height: number }> {
    try {
      await this.verifyPermission(organizationId, userId, 'branding.upload_logo')

      // Process image with sharp
      const processed = await sharp(logoFile)
        .resize(300, 100, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ quality: 90, compressionLevel: 9 })
        .toBuffer()

      // Generate unique filename
      const ext = path.extname(fileName).toLowerCase()
      const baseName = path.basename(fileName, ext)
      const uniqueName = `${organizationId}-${baseName}-${Date.now()}.png`

      // Save to storage (S3, local, etc.)
      const logoUrl = await this.saveLogoFile(
        organizationId,
        uniqueName,
        processed
      )

      // Update branding config
      const existing = await this.getBrandingConfig(organizationId)
      const branding: BrandingConfig = existing?.config || {
        colors: {
          primary: '#0066CC',
          secondary: '#666666'
        },
        typography: {}
      }

      if (isDarkMode) {
        branding.logo = branding.logo || {}
        branding.logo.darkModeUrl = logoUrl
      } else {
        branding.logo = branding.logo || {}
        branding.logo.url = logoUrl
      }

      // Get image dimensions
      const metadata = await sharp(processed).metadata()

      if (metadata.width && metadata.height) {
        branding.logo.width = metadata.width
        branding.logo.height = metadata.height
      }

      await this.configureBranding(organizationId, branding, userId)

      return {
        url: logoUrl,
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    } catch (error) {
      logger.error('Failed to upload logo', {
        organizationId,
        fileName,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Configure custom domain
   */
  static async configureCustomDomain(
    organizationId: string,
    domainConfig: CustomDomain,
    userId: string
  ): Promise<any> {
    try {
      await this.verifyPermission(organizationId, userId, 'branding.configure_domain')

      // Validate domain
      const isValidDomain = this.validateDomain(domainConfig.domain)
      if (!isValidDomain) {
        throw new Error('Invalid domain format')
      }

      // Check if domain is already taken
      const existing = await prisma.customDomain.findFirst({
        where: {
          domain: domainConfig.domain,
          organizationId: { not: organizationId }
        }
      })

      if (existing) {
        throw new Error('Domain is already configured by another organization')
      }

      // Save domain configuration
      const config = await prisma.customDomain.upsert({
        where: { organizationId },
        create: {
          organizationId,
          domain: domainConfig.domain,
          sslStatus: 'pending',
          dnsRecords: domainConfig.dnsRecords || [],
          customEmail: domainConfig.customEmail || false,
          createdBy: userId
        },
        update: {
          domain: domainConfig.domain,
          dnsRecords: domainConfig.dnsRecords,
          customEmail: domainConfig.customEmail,
          updatedBy: userId
        }
      })

      // Generate DNS records
      const dnsRecords = this.generateDNSRecords(domainConfig.domain)

      // Update with generated records
      await prisma.customDomain.update({
        where: { id: config.id },
        data: { dnsRecords }
      })

      // Initiate domain verification
      await this.initiateDomainVerification(config.id, domainConfig.domain)

      await AuditService.log({
        organizationId,
        userId,
        action: 'custom_domain.configured',
        resourceType: 'custom_domain',
        resourceId: config.id,
        details: { domain: domainConfig.domain }
      })

      return {
        ...config,
        dnsRecords
      }
    } catch (error) {
      logger.error('Failed to configure custom domain', {
        organizationId,
        domain: domainConfig.domain,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Verify custom domain ownership
   */
  static async verifyDomain(
    organizationId: string,
    domainId: string,
    userId: string
  ): Promise<{ verified: boolean; dnsStatus: any }> {
    try {
      await this.verifyPermission(organizationId, userId, 'branding.verify_domain')

      const domain = await prisma.customDomain.findFirst({
        where: { id: domainId, organizationId }
      })

      if (!domain) {
        throw new Error('Domain not found')
      }

      // Perform DNS verification
      const verification = await this.performDNSVerification(domain.domain)

      // Update status
      await prisma.customDomain.update({
        where: { id: domainId },
        data: {
          sslStatus: verification.verified ? 'verified' : 'failed',
          verifiedAt: verification.verified ? new Date() : null,
          updatedBy: userId
        }
      })

      await AuditService.log({
        organizationId,
        userId,
        action: 'custom_domain.verified',
        resourceType: 'custom_domain',
        resourceId: domainId,
        details: { verified: verification.verified }
      })

      return {
        verified: verification.verified,
        dnsStatus: verification.dnsStatus
      }
    } catch (error) {
      logger.error('Failed to verify domain', {
        organizationId,
        domainId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Configure feature flags for white-label instance
   */
  static async configureFeatureFlags(
    organizationId: string,
    flags: Record<string, boolean>,
    userId: string
  ): Promise<any> {
    try {
      await this.verifyPermission(organizationId, userId, 'branding.configure_features')

      // Save feature flags
      const config = await prisma.featureFlagConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          flags,
          createdBy: userId
        },
        update: {
          flags,
          updatedBy: userId
        }
      })

      // Cache feature flags
      await this.cacheFeatureFlags(organizationId, flags)

      await AuditService.log({
        organizationId,
        userId,
        action: 'feature_flags.configured',
        resourceType: 'feature_flag_config',
        resourceId: config.id,
        details: { flags: Object.keys(flags) }
      })

      return config
    } catch (error) {
      logger.error('Failed to configure feature flags', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Generate custom CSS based on branding
   */
  private static async generateCustomCSS(
    organizationId: string,
    branding: BrandingConfig
  ): Promise<string> {
    const css = `
      /* Custom branding styles for ${organizationId} */
      :root {
        --lm-primary: ${branding.colors.primary};
        --lm-secondary: ${branding.colors.secondary};
        ${branding.colors.accent ? `--lm-accent: ${branding.colors.accent};` : ''}
        ${branding.colors.background ? `--lm-background: ${branding.colors.background};` : ''}
        ${branding.colors.surface ? `--lm-surface: ${branding.colors.surface};` : ''}
        ${branding.colors.text ? `--lm-text: ${branding.colors.text};` : ''}
        ${branding.colors.textSecondary ? `--lm-text-secondary: ${branding.colors.textSecondary};` : ''}
        ${branding.colors.success ? `--lm-success: ${branding.colors.success};` : ''}
        ${branding.colors.warning ? `--lm-warning: ${branding.colors.warning};` : ''}
        ${branding.colors.error ? `--lm-error: ${branding.colors.error};` : ''}

        ${branding.typography.fontFamily ? `--lm-font-family: ${branding.typography.fontFamily};` : ''}
        ${branding.typography.headingFont ? `--lm-heading-font: ${branding.typography.headingFont};` : ''}
        ${branding.typography.bodyFont ? `--lm-body-font: ${branding.typography.bodyFont};` : ''}

        ${branding.layout?.borderRadius ? `--lm-border-radius: ${branding.layout.borderRadius};` : ''}
        ${branding.layout?.spacing ? `--lm-spacing: ${branding.layout.spacing};` : ''}
      }

      ${branding.customCSS || ''}
    `

    // Save CSS file
    const cssDir = path.join(process.cwd(), 'public', 'branding', organizationId)
    await fs.mkdir(cssDir, { recursive: true })
    await fs.writeFile(path.join(cssDir, 'custom.css'), css)

    return css
  }

  /**
   * Generate DNS records for domain verification
   */
  private static generateDNSRecords(domain: string): Array<{
    type: string
    name: string
    value: string
    ttl: number
  }> {
    const verificationToken = this.generateVerificationToken()

    return [
      {
        type: 'CNAME',
        name: '_labelmint-challenge.' + domain,
        value: 'verify.labelmint.io',
        ttl: 300
      },
      {
        type: 'TXT',
        name: '_labelmint-verify.' + domain,
        value: `labelmint-verification=${verificationToken}`,
        ttl: 300
      },
      {
        type: 'A',
        name: domain,
        value: '52.52.52.52', // Example IP
        ttl: 600
      }
    ]
  }

  /**
   * Validate domain format
   */
  private static validateDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return domainRegex.test(domain)
  }

  /**
   * Generate verification token
   */
  private static generateVerificationToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  /**
   * Save logo file to storage
   */
  private static async saveLogoFile(
    organizationId: string,
    fileName: string,
    buffer: Buffer
  ): Promise<string> {
    // This would typically save to S3, CloudFront, or CDN
    // For now, save to local storage
    const logoDir = path.join(process.cwd(), 'public', 'branding', organizationId, 'logos')
    await fs.mkdir(logoDir, { recursive: true })
    await fs.writeFile(path.join(logoDir, fileName), buffer)

    // Return URL
    return `${process.env.CDN_URL || ''}/branding/${organizationId}/logos/${fileName}`
  }

  /**
   * Initiate domain verification
   */
  private static async initiateDomainVerification(
    domainId: string,
    domain: string
  ): Promise<void> {
    // Schedule DNS check job
    // This would typically use a job queue like Bull or Agenda
    logger.info('Domain verification initiated', { domainId, domain })
  }

  /**
   * Perform DNS verification
   */
  private static async performDNSVerification(
    domain: string
  ): Promise<{ verified: boolean; dnsStatus: any }> {
    // This would perform actual DNS checks
    // For now, return mock response
    return {
      verified: true,
      dnsStatus: {
        cname: 'verified',
        txt: 'verified',
        a: 'verified'
      }
    }
  }

  /**
   * Get branding configuration
   */
  static async getBrandingConfig(organizationId: string): Promise<any> {
    return await prisma.brandingConfig.findUnique({
      where: { organizationId }
    })
  }

  /**
   * Get custom domain configuration
   */
  static async getCustomDomain(organizationId: string): Promise<any> {
    return await prisma.customDomain.findUnique({
      where: { organizationId }
    })
  }

  /**
   * Get feature flags
   */
  static async getFeatureFlags(organizationId: string): Promise<Record<string, boolean>> {
    const config = await prisma.featureFlagConfig.findUnique({
      where: { organizationId }
    })
    return config?.flags || {}
  }

  /**
   * Cache configuration
   */
  private static async cacheConfiguration(
    organizationId: string,
    config: any
  ): Promise<void> {
    // Cache in Redis for fast access
    // Implementation depends on your Redis setup
  }

  /**
   * Cache feature flags
   */
  private static async cacheFeatureFlags(
    organizationId: string,
    flags: Record<string, boolean>
  ): Promise<void> {
    // Cache in Redis for fast access
  }

  /**
   * Verify user permission
   */
  private static async verifyPermission(
    organizationId: string,
    userId: string,
    permission: string
  ): Promise<void> {
    // This would check user permissions
    // For now, assume all users have permission
  }
}