import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import * as nodemailer from 'nodemailer'
import sgTransport from 'nodemailer-sendgrid-transport'
import { SES } from '@aws-sdk/client-ses'
import * as handlebars from 'handlebars'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp' | 'nodemailer'
  from: {
    email: string
    name: string
  }
  replyTo?: string
  config: {
    // SendGrid
    apiKey?: string

    // SES
    region?: string
    accessKeyId?: string
    secretAccessKey?: string

    // SMTP
    host?: string
    port?: number
    secure?: boolean
    auth?: {
      user: string
      pass: string
    }
  }
}

export interface EmailTemplate {
  name: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, any>
}

export interface EmailData {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  template?: string
  templateData?: Record<string, any>
  html?: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  headers?: Record<string, string>
  priority?: 'high' | 'normal' | 'low'
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  provider: string
}

export class EmailService {
  private static transporters: Map<string, nodemailer.Transporter> = new Map()
  private static templates: Map<string, handlebars.TemplateDelegate> = new Map()

  /**
   * Initialize email service
   */
  static async initialize(): Promise<void> {
    try {
      // Load default templates
      await this.loadTemplates()

      // Configure default transporter if environment variables are set
      if (process.env.EMAIL_PROVIDER) {
        const config: EmailConfig = {
          provider: process.env.EMAIL_PROVIDER as any,
          from: {
            email: process.env.EMAIL_FROM!,
            name: process.env.EMAIL_FROM_NAME || 'LabelMint'
          }
        }

        if (process.env.EMAIL_PROVIDER === 'sendgrid') {
          config.config = {
            apiKey: process.env.SENDGRID_API_KEY!
          }
        } else if (process.env.EMAIL_PROVIDER === 'ses') {
          config.config = {
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
          }
        } else if (process.env.EMAIL_PROVIDER === 'smtp') {
          config.config = {
            host: process.env.SMTP_HOST!,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER!,
              pass: process.env.SMTP_PASS!
            }
          }
        }

        await this.createTransporter('default', config)
      }

      logger.info('Email service initialized')
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message })
    }
  }

  /**
   * Create email transporter
   */
  static async createTransporter(name: string, config: EmailConfig): Promise<void> {
    try {
      let transporter: nodemailer.Transporter

      switch (config.provider) {
        case 'sendgrid':
          transporter = nodemailer.createTransporter(
            sgTransport({
              apiKey: config.config.apiKey!
            })
          )
          break

        case 'ses':
          const ses = new SES({
            region: config.config.region,
            credentials: {
              accessKeyId: config.config.accessKeyId!,
              secretAccessKey: config.config.secretAccessKey!
            }
          })
          transporter = nodemailer.createTransporter({
            SES: ses
          })
          break

        case 'smtp':
        case 'nodemailer':
          transporter = nodemailer.createTransporter({
            host: config.config.host,
            port: config.config.port,
            secure: config.config.secure,
            auth: config.config.auth
          })
          break

        default:
          throw new Error(`Unsupported email provider: ${config.provider}`)
      }

      // Set default sender
      transporter.options.from = `"${config.from.name}" <${config.from.email}>`

      if (config.replyTo) {
        transporter.options.replyTo = config.replyTo
      }

      this.transporters.set(name, transporter)
      logger.info(`Email transporter created`, { name, provider: config.provider })
    } catch (error) {
      logger.error('Failed to create email transporter', {
        name,
        provider: config.provider,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Send email
   */
  static async sendEmail(
    organizationId: string | null,
    emailData: EmailData,
    transporterName: string = 'default',
    userId?: string
  ): Promise<EmailResult> {
    try {
      const transporter = this.transporters.get(transporterName)
      if (!transporter) {
        return {
          success: false,
          error: `Email transporter '${transporterName}' not found`,
          provider: transporterName
        }
      }

      let html = emailData.html
      let text = emailData.text
      let subject = emailData.subject

      // Process template if specified
      if (emailData.template) {
        const template = this.templates.get(emailData.template)
        if (!template) {
          return {
            success: false,
            error: `Email template '${emailData.template}' not found`,
            provider: transporterName
          }
        }

        const templateData = emailData.templateData || {}

        // Extract subject from template if not provided
        if (!subject && templateData.subject) {
          subject = templateData.subject
        }

        // Compile template
        if (html) {
          html = handlebars.compile(html)(templateData)
        } else {
          html = template(templateData)
        }

        if (text) {
          text = handlebars.compile(text)(templateData)
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject,
        html,
        text,
        attachments: emailData.attachments,
        headers: emailData.headers
      }

      // Set priority
      if (emailData.priority) {
        const priorityHeaders = {
          high: { 'X-Priority': '1', 'X-MSMail-Priority': 'High' },
          normal: {},
          low: { 'X-Priority': '5', 'X-MSMail-Priority': 'Low' }
        }
        mailOptions.headers = {
          ...mailOptions.headers,
          ...priorityHeaders[emailData.priority]
        }
      }

      const result = await transporter.sendMail(mailOptions)

      // Log email sent
      if (organizationId) {
        await AuditService.log({
          organizationId,
          userId,
          action: 'email.sent',
          resourceType: 'email',
          resourceId: result.messageId,
          details: {
            to: emailData.to,
            subject,
            template: emailData.template
          }
        })
      }

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: emailData.to,
        subject
      })

      return {
        success: true,
        messageId: result.messageId!,
        provider: transporterName
      }
    } catch (error) {
      logger.error('Failed to send email', {
        to: emailData.to,
        subject: emailData.subject,
        error: error.message
      })

      // Log email error
      if (organizationId) {
        await AuditService.log({
          organizationId,
          userId,
          action: 'email.failed',
          resourceType: 'email',
          details: {
            to: emailData.to,
            subject: emailData.subject,
            error: error.message
          }
        })
      }

      return {
        success: false,
        error: error.message,
        provider: transporterName
      }
    }
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(
    organizationId: string,
    to: string,
    userName: string,
    organizationName: string
  ): Promise<EmailResult> {
    return this.sendEmail(
      organizationId,
      {
        to,
        template: 'welcome',
        templateData: {
          userName,
          organizationName,
          loginUrl: `${process.env.FRONTEND_URL}/login`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@labelmint.io'
        },
        subject: `Welcome to ${organizationName} on LabelMint`
      }
    )
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(
    organizationId: string,
    to: string,
    token: string
  ): Promise<EmailResult> {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`

    return this.sendEmail(
      organizationId,
      {
        to,
        template: 'email-verification',
        templateData: {
          verifyUrl,
          token,
          expiresIn: '24 hours'
        },
        subject: 'Verify your email address'
      }
    )
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(
    organizationId: string,
    to: string,
    token: string,
    userName: string
  ): Promise<EmailResult> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

    return this.sendEmail(
      organizationId,
      {
        to,
        template: 'password-reset',
        templateData: {
          userName,
          resetUrl,
          token,
          expiresIn: '1 hour'
        },
        subject: 'Reset your password'
      }
    )
  }

  /**
   * Send organization invitation
   */
  static async sendInvitation(
    organizationId: string,
    to: string,
    invitationToken: string,
    inviterName: string,
    organizationName: string,
    role: string = 'MEMBER'
  ): Promise<EmailResult> {
    const inviteUrl = `${process.env.FRONTEND_URL}/invite?token=${invitationToken}`

    return this.sendEmail(
      organizationId,
      {
        to,
        template: 'invitation',
        templateData: {
          inviterName,
          organizationName,
          role,
          inviteUrl,
          invitationToken
        },
        subject: `You've been invited to join ${organizationName}`
      }
    )
  }

  /**
   * Send SSO login notification
   */
  static async sendSSOLoginNotification(
    organizationId: string,
    to: string,
    provider: string,
    loginTime: Date,
    ipAddress?: string
  ): Promise<EmailResult> {
    return this.sendEmail(
      organizationId,
      {
        to,
        template: 'sso-login-notification',
        templateData: {
          provider,
          loginTime: loginTime.toISOString(),
          ipAddress,
          userAgent: 'Unknown'
        },
        subject: 'New SSO login to your LabelMint account'
      }
    )
  }

  /**
   * Send organization billing notification
   */
  static async sendBillingNotification(
    organizationId: string,
    to: string,
    type: 'invoice' | 'payment_failed' | 'subscription_updated',
    data: Record<string, any>
  ): Promise<EmailResult> {
    const subjects = {
      invoice: 'Your LabelMint invoice is ready',
      payment_failed: 'Payment failed for your LabelMint subscription',
      subscription_updated: 'Your LabelMint subscription has been updated'
    }

    return this.sendEmail(
      organizationId,
      {
        to,
        template: `billing-${type}`,
        templateData: data,
        subject: subjects[type]
      }
    )
  }

  /**
   * Create custom email template
   */
  static async createTemplate(
    organizationId: string,
    template: EmailTemplate,
    userId: string
  ): Promise<any> {
    try {
      const emailTemplate = await prisma.emailTemplate.create({
        data: {
          organizationId,
          name: template.name,
          subject: template.subject,
          html: template.html,
          text: template.text,
          variables: template.variables || {},
          createdBy: userId
        }
      })

      // Cache template
      const compiledTemplate = handlebars.compile(template.html)
      this.templates.set(template.name, compiledTemplate)

      await AuditService.log({
        organizationId,
        userId,
        action: 'email_template.created',
        resourceType: 'email_template',
        resourceId: emailTemplate.id,
        details: { name: template.name }
      })

      return emailTemplate
    } catch (error) {
      logger.error('Failed to create email template', {
        organizationId,
        templateName: template.name,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Load email templates
   */
  private static async loadTemplates(): Promise<void> {
    try {
      const templatesDir = path.join(process.cwd(), 'templates', 'emails')

      // Load built-in templates
      const builtInTemplates = [
        'welcome',
        'email-verification',
        'password-reset',
        'invitation',
        'sso-login-notification',
        'billing-invoice',
        'billing-payment-failed',
        'billing-subscription-updated'
      ]

      for (const templateName of builtInTemplates) {
        try {
          const htmlPath = path.join(templatesDir, `${templateName}.html`)
          const textPath = path.join(templatesDir, `${templateName}.txt`)

          let html = ''
          let text = ''

          try {
            html = await fs.readFile(htmlPath, 'utf-8')
          } catch (e) {
            // Template file doesn't exist, use default
          }

          try {
            text = await fs.readFile(textPath, 'utf-8')
          } catch (e) {
            // Text template doesn't exist
          }

          if (html || text) {
            const compiledTemplate = handlebars.compile(html)
            this.templates.set(templateName, compiledTemplate)
          }
        } catch (error) {
          logger.warn(`Failed to load email template: ${templateName}`, {
            error: error.message
          })
        }
      }

      logger.info(`Loaded ${this.templates.size} email templates`)
    } catch (error) {
      logger.error('Failed to load email templates', { error: error.message })
    }
  }

  /**
   * Update unsubscribe preferences
   */
  static async updateUnsubscribePreferences(
    email: string,
    preferences: Record<string, boolean>
  ): Promise<void> {
    try {
      await prisma.emailPreference.upsert({
        where: { email },
        create: {
          email,
          preferences,
          unsubscribedAt: new Date()
        },
        update: {
          preferences,
          unsubscribedAt: new Date()
        }
      })
    } catch (error) {
      logger.error('Failed to update unsubscribe preferences', {
        email,
        error: error.message
      })
    }
  }

  /**
   * Check if user is unsubscribed
   */
  static async isUnsubscribed(
    email: string,
    category?: string
  ): Promise<boolean> {
    try {
      const preference = await prisma.emailPreference.findUnique({
        where: { email }
      })

      if (!preference) {
        return false
      }

      if (!category) {
        return true // User is globally unsubscribed
      }

      return preference.preferences[category] === false
    } catch (error) {
      logger.error('Failed to check unsubscribe preferences', {
        email,
        category,
        error: error.message
      })
      return false
    }
  }

  /**
   * Handle bounce
   */
  static async handleBounce(
    email: string,
    bounceType: string,
    bounceSubType?: string
  ): Promise<void> {
    try {
      // Update user email status
      await prisma.user.updateMany({
        where: { email },
        data: {
          emailStatus: 'bounced',
          emailBounceType: bounceType,
          emailBounceSubType: bounceSubType,
          emailBouncedAt: new Date()
        }
      })

      // Log bounce
      logger.warn('Email bounced', {
        email,
        bounceType,
        bounceSubType
      })

      // Implement sophisticated bounce handling
      await this.handleBounceProcessing(email, bounceType, bounceSubType, organizationId)
    } catch (error) {
      logger.error('Failed to handle email bounce', {
        email,
        error: error.message
      })
    }
  }

  /**
   * Test email configuration
   */
  static async testConfig(
    config: EmailConfig,
    testEmail: string
  ): Promise<EmailResult> {
    try {
      const tempName = 'test-' + Date.now()
      await this.createTransporter(tempName, config)

      const result = await this.sendEmail(
        null,
        {
          to: testEmail,
          subject: 'LabelMint Email Configuration Test',
          html: `
            <h2>Email Configuration Test</h2>
            <p>This is a test email to verify your email configuration is working correctly.</p>
            <p>Provider: ${config.provider}</p>
            <p>From: ${config.from.email}</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          `,
          text: `
            Email Configuration Test

            This is a test email to verify your email configuration is working correctly.

            Provider: ${config.provider}
            From: ${config.from.email}
            Sent at: ${new Date().toISOString()}
          `
        },
        tempName
      )

      // Clean up test transporter
      this.transporters.delete(tempName)

      return result
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: config.provider
      }
    }
  }

  /**
   * Handle sophisticated bounce processing
   */
  private static async handleBounceProcessing(
    email: string,
    bounceType: string,
    bounceSubType: string,
    organizationId?: string
  ): Promise<void> {
    try {
      const isPermanent = this.isPermanentBounce(bounceType, bounceSubType)
      const isTemporary = this.isTemporaryBounce(bounceType, bounceSubType)

      // Record bounce in database
      await this.recordBounce(email, bounceType, bounceSubType, isPermanent, organizationId)

      if (isPermanent) {
        await this.handlePermanentBounce(email, bounceType, bounceSubType, organizationId)
      } else if (isTemporary) {
        await this.handleTemporaryBounce(email, bounceType, bounceSubType, organizationId)
      } else {
        // Unknown bounce type - treat as permanent after 3 occurrences
        await this.handleUnknownBounce(email, bounceType, bounceSubType, organizationId)
      }

      // Send webhook notification if configured
      await this.sendBounceWebhook(email, bounceType, bounceSubType, isPermanent, organizationId)

    } catch (error) {
      logger.error('Bounce processing failed', {
        email,
        bounceType,
        bounceSubType,
        error: error.message
      })
    }
  }

  /**
   * Determine if bounce is permanent
   */
  private static isPermanentBounce(bounceType: string, bounceSubType: string): boolean {
    const permanentTypes = [
      'Permanent', 'hard', 'undetermined'
    ]
    const permanentSubTypes = [
      'General', 'NoEmail', 'Suppressed', 'OnAccountSuppressionList',
      'MailboxFull', 'MessageTooLarge', 'AttachmentRejected',
      'InvalidAddress', 'InvalidDomain', 'InvalidRecipient'
    ]
    return permanentTypes.includes(bounceType) || permanentSubTypes.includes(bounceSubType)
  }

  /**
   * Determine if bounce is temporary
   */
  private static isTemporaryBounce(bounceType: string, bounceSubType: string): boolean {
    const temporaryTypes = [
      'Transient', 'soft'
    ]
    const temporarySubTypes = [
      'MailboxFull', 'MessageTooLarge', 'Timeout',
      'ConnectionFailed', 'DNSFailure', 'SpamDetected'
    ]
    return temporaryTypes.includes(bounceType) || temporarySubTypes.includes(bounceSubType)
  }

  /**
   * Record bounce in database
   */
  private static async recordBounce(
    email: string,
    bounceType: string,
    bounceSubType: string,
    isPermanent: boolean,
    organizationId?: string
  ): Promise<void> {
    await prisma.emailBounce.create({
      data: {
        email,
        bounceType,
        bounceSubType,
        isPermanent,
        organizationId,
        timestamp: new Date(),
        processed: false
      }
    })
  }

  /**
   * Handle permanent bounce
   */
  private static async handlePermanentBounce(
    email: string,
    bounceType: string,
    bounceSubType: string,
    organizationId?: string
  ): Promise<void> {
    // Mark email as suppressed
    await this.suppressEmail(email, organizationId)

    // Update user status if this is a user email
    if (organizationId) {
      await prisma.organizationMember.updateMany({
        where: {
          organizationId,
          user: { email }
        },
        data: {
          emailStatus: 'bounced',
          emailBounceType: bounceType,
          emailBounceSubType: bounceSubType,
          emailBouncedAt: new Date()
        }
      })
    }

    logger.info('Permanent bounce processed', {
      email,
      bounceType,
      bounceSubType,
      organizationId
    })
  }

  /**
   * Handle temporary bounce with retry logic
   */
  private static async handleTemporaryBounce(
    email: string,
    bounceType: string,
    bounceSubType: string,
    organizationId?: string
  ): Promise<void> {
    // Get bounce count for this email
    const bounceCount = await prisma.emailBounce.count({
      where: {
        email,
        bounceType,
        bounceSubType,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    // If more than 3 temporary bounces in 24 hours, treat as permanent
    if (bounceCount >= 3) {
      await this.handlePermanentBounce(email, 'Converted to Permanent', bounceSubType, organizationId)
      return
    }

    // Schedule retry if appropriate
    const retryDelay = this.calculateRetryDelay(bounceCount)
    if (retryDelay > 0) {
      // In a real implementation, you would add this to a retry queue
      logger.info('Temporary bounce - retry scheduled', {
        email,
        bounceType,
        bounceSubType,
        retryDelayMinutes: retryDelay / 60000
      })
    }

    // Update user status
    if (organizationId) {
      await prisma.organizationMember.updateMany({
        where: {
          organizationId,
          user: { email }
        },
        data: {
          emailStatus: 'temporary_bounce',
          emailBounceType: bounceType,
          emailBounceSubType: bounceSubType,
          lastEmailBounce: new Date()
        }
      })
    }

    logger.info('Temporary bounce processed', {
      email,
      bounceType,
      bounceSubType,
      bounceCount,
      organizationId
    })
  }

  /**
   * Handle unknown bounce type
   */
  private static async handleUnknownBounce(
    email: string,
    bounceType: string,
    bounceSubType: string,
    organizationId?: string
  ): Promise<void> {
    // Get total bounce count
    const bounceCount = await prisma.emailBounce.count({
      where: {
        email,
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    // If more than 5 unknown bounces, treat as permanent
    if (bounceCount >= 5) {
      await this.handlePermanentBounce(email, 'Unknown - Converted to Permanent', bounceSubType, organizationId)
    }

    logger.warn('Unknown bounce type processed', {
      email,
      bounceType,
      bounceSubType,
      bounceCount,
      organizationId
    })
  }

  /**
   * Calculate retry delay for temporary bounces
   */
  private static calculateRetryDelay(bounceCount: number): number {
    // Exponential backoff: 5min, 15min, 45min, 2hours, 6hours
    const delays = [5, 15, 45, 120, 360].map(minutes => minutes * 60 * 1000)
    return delays[Math.min(bounceCount, delays.length - 1)]
  }

  /**
   * Suppress email address
   */
  private static async suppressEmail(email: string, organizationId?: string): Promise<void> {
    await prisma.emailSuppression.create({
      data: {
        email,
        reason: 'bounce',
        organizationId,
        createdAt: new Date(),
        permanent: true
      }
    })

    // Mark existing bounce records as processed
    await prisma.emailBounce.updateMany({
      where: { email },
      data: { processed: true }
    })
  }

  /**
   * Send bounce webhook notification
   */
  private static async sendBounceWebhook(
    email: string,
    bounceType: string,
    bounceSubType: string,
    isPermanent: boolean,
    organizationId?: string
  ): Promise<void> {
    try {
      if (!organizationId) return

      // Get organization's webhook configuration
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          metadata: true,
          name: true
        }
      })

      if (!organization?.metadata) return

      const metadata = JSON.parse(organization.metadata as string)
      const webhookUrl = metadata.bounceWebhookUrl

      if (!webhookUrl) return

      const payload = {
        event: 'email_bounced',
        organization: organization.name,
        organizationId,
        email,
        bounceType,
        bounceSubType,
        isPermanent,
        timestamp: new Date().toISOString()
      }

      // Send webhook (using fetch or axios)
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LabelMint-EmailService/1.0'
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        logger.error('Failed to send bounce webhook', {
          email,
          webhookUrl,
          error: error.message
        })
      })

    } catch (error) {
      logger.error('Bounce webhook processing failed', {
        email,
        error: error.message
      })
    }
  }

  /**
   * Get bounce statistics for organization
   */
  static async getBounceStatistics(organizationId: string, days: number = 30): Promise<{
    totalBounces: number
    permanentBounces: number
    temporaryBounces: number
    bounceRate: number
    topBounceReasons: Array<{ type: string; count: number }>
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [totalBounces, permanentBounces, temporaryBounces, totalEmails] = await Promise.all([
      prisma.emailBounce.count({
        where: {
          organizationId,
          timestamp: { gte: since }
        }
      }),
      prisma.emailBounce.count({
        where: {
          organizationId,
          isPermanent: true,
          timestamp: { gte: since }
        }
      }),
      prisma.emailBounce.count({
        where: {
          organizationId,
          isPermanent: false,
          timestamp: { gte: since }
        }
      }),
      prisma.emailLog.count({
        where: {
          organizationId,
          timestamp: { gte: since }
        }
      })
    ])

    // Get top bounce reasons
    const topBounceReasons = await prisma.emailBounce.groupBy({
      by: ['bounceType'],
      where: {
        organizationId,
        timestamp: { gte: since }
      },
      _count: {
        bounceType: true
      },
      orderBy: {
        _count: {
          bounceType: 'desc'
        }
      },
      take: 5
    })

    const bounceRate = totalEmails > 0 ? (totalBounces / totalEmails) * 100 : 0

    return {
      totalBounces,
      permanentBounces,
      temporaryBounces,
      bounceRate,
      topBounceReasons: topBounceReasons.map(item => ({
        type: item.bounceType,
        count: item._count.bounceType
      }))
    }
  }

  /**
   * Get suppressed emails for organization
   */
  static async getSuppressedEmails(organizationId: string): Promise<string[]> {
    const suppressions = await prisma.emailSuppression.findMany({
      where: {
        organizationId,
        permanent: true
      },
      select: { email: true }
    })

    return suppressions.map(s => s.email)
  }

  /**
   * Remove email from suppression list
   */
  static async unsuppressEmail(email: string, organizationId: string): Promise<void> {
    await prisma.emailSuppression.deleteMany({
      where: {
        email,
        organizationId
      }
    })

    // Reset user email status
    await prisma.organizationMember.updateMany({
      where: {
        organizationId,
        user: { email }
      },
      data: {
        emailStatus: 'active',
        emailBounceType: null,
        emailBounceSubType: null,
        emailBouncedAt: null,
        lastEmailBounce: null
      }
    })

    logger.info('Email unsuppressed', {
      email,
      organizationId
    })
  }
}

// Initialize email service on import
EmailService.initialize().catch(console.error)