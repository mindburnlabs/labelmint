import nodemailer from 'nodemailer';
import { Logger } from '../../utils/logger';
import { redisManager } from '../../../cache/RedisManager';
import { connectionPool } from '../../../database/ConnectionPool';

const logger = new Logger('ProductionEmailService');

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  rateDelta?: number;
  rateLimit?: number;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailJob {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  data: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
}

export class ProductionEmailService {
  private transporter: nodemailer.Transporter;
  private queue: Map<string, EmailJob> = new Map();
  private processing = false;
  private config: EmailConfig;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      pool: true,
      maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '20'),
      maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '1000'),
      rateDelta: parseInt(process.env.SMTP_RATE_DELTA || '1000'), // 1 second
      rateLimit: parseInt(process.env.SMTP_RATE_LIMIT || '5') // 5 per second
    };

    this.setupTransporter();
    this.loadTemplates();
    this.startQueueProcessor();
  }

  /**
   * Setup nodemailer transporter
   */
  private setupTransporter(): void {
    const transportConfig = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      pool: this.config.pool,
      maxConnections: this.config.maxConnections,
      maxMessages: this.config.maxMessages,
      rateDelta: this.config.rateDelta,
      rateLimit: this.config.rateLimit,
      // TLS settings
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      // Connection settings
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 20000
    };

    this.transporter = nodemailer.createTransport(transportConfig);

    // Verify configuration
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('SMTP configuration error', error);
      } else {
        logger.info('SMTP configuration verified successfully');
      }
    });

    // Handle errors
    this.transporter.on('error', (err) => {
      logger.error('Transporter error', err);
    });

    this.transporter.on('idle', () => {
      logger.debug('Transporter idle');
    });
  }

  /**
   * Load email templates
   */
  private loadTemplates(): void {
    // Email verification template
    this.templates.set('email-verification', {
      subject: 'Verify Your Deligate.it Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Deligate.it</h1>
              <p>Secure Data Labeling Platform</p>
            </div>
            <div class="content">
              <h2>Email Verification Required</h2>
              <p>Click the button below to verify your email address:</p>
              <a href="{{verificationUrl}}" class="button">Verify Email</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p>{{verificationUrl}}</p>
            </div>
            <div class="footer">
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't sign up for Deligate.it, please ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Deligate.it - Email Verification

        Please verify your email address by clicking the link:
        {{verificationUrl}}

        This link will expire in 24 hours.

        If you didn't sign up for Deligate.it, please ignore this email.
      `
    });

    // Password reset template
    this.templates.set('password-reset', {
      subject: 'Reset Your Deligate.it Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404;
                     padding: 10px; border-radius: 5px; margin: 15px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Deligate.it</h1>
              <p>Security Alert</p>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Click the button below to reset your password:</p>
              <a href="{{resetUrl}}" class="button">Reset Password</a>
              <div class="warning">
                <p><strong>Security Notice:</strong> This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
              </div>
            </div>
            <div class="footer">
              <p>For security reasons, please ensure you are on https://labelmint.it</p>
              <p>If you need help, contact support@labelmint.it</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Deligate.it - Password Reset Request

        Click the link below to reset your password:
        {{resetUrl}}

        Security Notice:
        - This link will expire in 1 hour
        - If you didn't request a password reset, please ignore this email
        - For security reasons, please ensure you are on https://labelmint.it
        - If you need help, contact support@labelmint.it
      `
    });

    // Task assignment notification
    this.templates.set('task-assignment', {
      subject: 'New Task Assigned - Deligate.it',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Task</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
            .task-details { background: white; padding: 20px; border-radius: 5px;
                            border-left: 4px solid #28a745; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Task!</h1>
              <p>Deligate.it</p>
            </div>
            <div class="content">
              <h2>Congratulations! You've been assigned a new task.</h2>
              <div class="task-details">
                <h3>{{taskTitle}}</h3>
                <p><strong>Payment:</strong> ${{taskPayment}}</p>
                <p><strong>Deadline:</strong> {{taskDeadline}}</p>
                <a href="{{taskUrl}}" style="color: #28a745; text-decoration: none;">
                  View Task Details →
                </a>
              </div>
            </div>
            <div class="footer">
              <p>Good luck with your task!</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Deligate.it - New Task Assignment

        Congratulations! You've been assigned a new task.

        Task: {{taskTitle}}
        Payment: ${{taskPayment}}
        Deadline: {{taskDeadline}}

        View task details: {{taskUrl}}

        Good luck with your task!
      `
    });

    logger.info(`Loaded ${this.templates.size} email templates`);
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing) return;

      this.processing = true;
      try {
        await this.processQueue();
      } catch (error) {
        logger.error('Error processing email queue', error);
      } finally {
        this.processing = false;
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    const now = new Date();
    const readyJobs: EmailJob[] = [];

    // Find jobs ready to send
    for (const [id, job] of this.queue.entries()) {
      if (job.nextAttemptAt <= now && job.attempts < job.maxAttempts) {
        readyJobs.push(job);
      } else if (job.attempts >= job.maxAttempts) {
        // Remove failed job
        this.queue.delete(id);
        await this.markJobFailed(id, 'Max attempts reached');
      }
    }

    // Process jobs
    for (const job of readyJobs) {
      try {
        await this.sendEmail(job);
        job.attempts++;

        // Update job or remove if successful
        if (job.attempts >= job.maxAttempts) {
          this.queue.delete(job.id);
        } else {
          // Set next attempt time with exponential backoff
          const delay = Math.pow(2, job.attempts) * 10000; // Exponential backoff
          job.nextAttemptAt = new Date(Date.now() + delay);
        }
      } catch (error) {
        logger.error(`Failed to send email ${job.id}`, error);
        job.attempts++;
      }
    }
  }

  /**
   * Send individual email
   */
  private async sendEmail(job: EmailJob): Promise<void> {
    const mailOptions = {
      from: `"Deligate.it" <${process.env.SMTP_FROM || 'noreply@labelmint.it'}>`,
      to: job.to,
      subject: job.subject,
      html: job.html,
      text: job.text,
      // Production settings
      headers: {
        'X-Priority': job.priority === 'high' ? '1' : '3',
        'List-Unsubscribe': '<mailto:unsubscribe@labelmint.it>',
        'X-Mailgun-Tag': job.template
      },
      // DKIM settings (if configured)
      dkim: process.env.DKIM_DOMAIN ? {
        domainName: process.env.DKIM_DOMAIN,
        keySelector: process.env.DKIM_SELECTOR || 'mail',
        privateKey: process.env.DKIM_PRIVATE_KEY
      } : undefined
    };

    await this.transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${job.id} to ${job.to}`);
  }

  /**
   * Send email immediately (high priority)
   */
  async sendEmailImmediate(options: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, any>;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<void> {
    const template = this.templates.get(options.template);
    if (!template) {
      throw new Error(`Email template not found: ${options.template}`);
    }

    // Replace template variables
    const html = this.replaceTemplateVars(template.html, options.data);
    const text = this.replaceTemplateVars(template.text, options.data);

    const job: EmailJob = {
      id: this.generateJobId(),
      to: options.to,
      subject: this.replaceTemplateVars(template.subject, options.data),
      html,
      text,
      template: options.template,
      data: options.data,
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
      createdAt: new Date()
    };

    // For high priority, send immediately
    if (job.priority === 'high') {
      try {
        await this.sendEmail(job);
        await this.markJobSent(job.id);
        logger.info(`High priority email sent: ${job.id}`);
      } catch (error) {
        logger.error(`Failed to send high priority email: ${job.id}`, error);
        // Add to queue for retry
        this.queue.set(job.id, job);
      }
    } else {
      // Add to queue for normal processing
      this.queue.set(job.id, job);
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmail(emails: Array<{
    to: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }>): Promise<void> {
    const jobs = emails.map((email, index) => ({
      id: this.generateJobId(),
      to: email.to,
      subject: email.subject,
      html: this.renderTemplate(email.template, email.data),
      text: this.renderTextTemplate(email.template, email.data),
      template: email.template,
      data: email.data,
      priority: 'normal',
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(Date.now() + index * 1000), // Stagger sends
      createdAt: new Date()
    }));

    // Add all to queue
    for (const job of jobs) {
      this.queue.set(job.id, job);
    }

    logger.info(`Queued ${jobs.length} bulk emails`);
  }

  /**
   * Replace template variables
   */
  private replaceTemplateVars(content: string, data: Record<string, any>): string {
    let result = content;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * Render template with variables
   */
  private renderTemplate(templateName: string, data: Record<string, any>): string {
    const template = this.templates.get(templateName);
    return template ? this.replaceTemplateVars(template.html, data) : '';
  }

  /**
   * Render text template
   */
  private renderTextTemplate(templateName: string, data: Record<string, any>): string {
    const template = this.templates.get(templateName);
    return template ? this.replaceTemplateVars(template.text, data) : '';
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Mark job as sent
   */
  private async markJobSent(jobId: string): Promise<void> {
    try {
      // Store in Redis for analytics
      await redisManager.set(`email:sent:${jobId}`, {
        sentAt: new Date().toISOString()
      }, 86400); // 24 hours TTL
    } catch (error) {
      logger.error('Failed to mark job as sent', error);
    }
  }

  /**
   * Mark job as failed
   */
  private async markJobFailed(jobId: string, reason: string): Promise<void> {
    try {
      await redisManager.set(`email:failed:${jobId}`, {
        reason,
        failedAt: new Date().toISOString()
      }, 86400); // 24 hours TTL

      // Log to database
      await connectionPool.query(
        'INSERT INTO email_delivery_failures (job_id, reason, failed_at) VALUES ($1, $2, NOW())',
        [jobId, reason]
      );
    } catch (error) {
      logger.error('Failed to mark job as failed', error);
    }
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<any> {
    try {
      const result = await connectionPool.query(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(CASE WHEN sent_at > CURRENT_DATE THEN 1 END) as sent_today,
          COUNT(CASE WHEN failed_at > CURRENT_DATE THEN 1 END) as failed_today,
          AVG(CASE WHEN sent_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (sent_at - created_at)) / 1000
          END) as avg_delivery_time_seconds
        FROM email_delivery_log
        WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
      `);

      const queueStats = {
        queued: this.queue.size,
        processing: this.processing,
        failed: Array.from(this.queue.values()).filter(j => j.attempts >= j.maxAttempts).length
      };

      return {
        ...result.rows[0],
        queue: queueStats
      };
    } catch (error) {
      logger.error('Failed to get email stats', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service health check failed', error);
      return false;
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    logger.info('Closing email service...');

    // Stop queue processing
    this.processing = false;
    this.queue.clear();

    // Close transporter
    this.transporter.close();

    logger.info('Email service closed');
  }
}

// Create singleton instance
export const productionEmailService = new ProductionEmailService();