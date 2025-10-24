import { productionEmailService } from '../email/ProductionEmailService';
import { Logger } from '../../utils/logger';

const logger = new Logger('NotificationService');

export interface NotificationChannel {
  type: 'email' | 'telegram';
  enabled: boolean;
}

export interface NotificationRecipient {
  email?: string;
  telegramId?: string;
  channels: NotificationChannel[];
}

export interface LowBalanceAlertData {
  wallets: Array<{
    address: string;
    balance: string;
    currency: string;
    threshold: string;
  }>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemAlertData {
  type: 'low_balance' | 'payment_failure' | 'security_alert' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  data?: any;
  timestamp: Date;
}

export class NotificationService {
  private emailService = productionEmailService;
  private adminRecipients: NotificationRecipient[] = [];

  constructor() {
    this.loadAdminRecipients();
    this.setupEmailTemplates();
  }

  /**
   * Load admin recipients from environment variables
   */
  private loadAdminRecipients(): void {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const adminTelegramIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];

    this.adminRecipients = [
      {
        email: adminEmails[0], // Primary admin email
        telegramId: adminTelegramIds[0], // Primary admin telegram
        channels: [
          { type: 'email', enabled: adminEmails.length > 0 },
          { type: 'telegram', enabled: adminTelegramIds.length > 0 }
        ]
      }
    ];

    logger.info(`Loaded ${this.adminRecipients.length} admin recipients`);
  }

  /**
   * Setup email templates for notifications
   */
  private setupEmailTemplates(): void {
    // Low balance alert template
    this.emailService['templates'].set('low-balance-alert', {
      subject: '🚨 Low Balance Alert - LabelMint Payment System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Low Balance Alert</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: {{severityColor}}; color: white; padding: 20px; text-align: center; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404;
                    padding: 15px; border-radius: 5px; margin: 20px 0; }
            .critical { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
            .wallet-list { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .wallet-item { background: white; padding: 15px; margin: 10px 0; border-radius: 5px;
                           border-left: 4px solid {{severityColor}}; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; background: {{severityColor}}; color: white; padding: 12px 30px;
                   text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Payment System Alert</h1>
              <p>LabelMint Blockchain Infrastructure</p>
            </div>

            <div class="alert {{severityClass}}">
              <h2>Low Balance Detected</h2>
              <p><strong>Severity:</strong> {{severity}}</p>
              <p><strong>Time:</strong> {{timestamp}}</p>
              <p>{{walletCount}} system wallet(s) need immediate attention to ensure uninterrupted payment processing.</p>
            </div>

            <div class="wallet-list">
              <h3>Affected Wallets:</h3>
              {{#each wallets}}
              <div class="wallet-item">
                <h4>{{currency}} Wallet</h4>
                <p><strong>Address:</strong> <code>{{address}}</code></p>
                <p><strong>Current Balance:</strong> {{balance}} {{currency}}</p>
                <p><strong>Threshold:</strong> {{threshold}} {{currency}}</p>
                <p><strong>Status:</strong> <span style="color: {{severityColor}}">⚠️ Below Minimum</span></p>
              </div>
              {{/each}}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{{adminDashboardUrl}}" class="btn">View in Admin Dashboard</a>
              <a href="{{walletManagementUrl}}" class="btn">Manage Wallets</a>
            </div>

            <div class="footer">
              <p><strong>Immediate Action Required:</strong> Please top up these wallets to prevent service disruption.</p>
              <p>This is an automated message from the LabelMint Payment System.</p>
              <p>If you believe this is an error, contact the development team immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        LabelMint Payment System - Low Balance Alert

        SEVERITY: {{severity}}
        TIME: {{timestamp}}

        {{walletCount}} system wallets need attention:

        {{#each wallets}}
        {{currency}} Wallet:
        Address: {{address}}
        Current Balance: {{balance}} {{currency}}
        Threshold: {{threshold}} {{currency}}
        Status: BELOW MINIMUM

        {{/each}}

        IMMEDIATE ACTION REQUIRED: Please top up these wallets to prevent service disruption.

        Admin Dashboard: {{adminDashboardUrl}}
        Wallet Management: {{walletManagementUrl}}

        This is an automated message from the LabelMint Payment System.
      `
    });

    logger.info('Email notification templates loaded');
  }

  /**
   * Send low balance alert to administrators
   */
  async sendLowBalanceAlert(walletData: LowBalanceAlertData['wallets']): Promise<void> {
    try {
      const severity = this.calculateSeverity(walletData);
      const alertData: LowBalanceAlertData = {
        wallets: walletData,
        timestamp: new Date(),
        severity
      };

      const templateData = {
        severity: severity.toUpperCase(),
        severityClass: severity === 'critical' ? 'critical' : '',
        severityColor: this.getSeverityColor(severity),
        timestamp: alertData.timestamp.toLocaleString(),
        walletCount: walletData.length,
        wallets: walletData,
        adminDashboardUrl: `${process.env.ADMIN_DASHBOARD_URL || 'https://admin.labelmint.it'}/payments`,
        walletManagementUrl: `${process.env.ADMIN_DASHBOARD_URL || 'https://admin.labelmint.it'}/wallets`
      };

      // Send to all admin recipients
      for (const recipient of this.adminRecipients) {
        if (recipient.email && recipient.channels.find(c => c.type === 'email')?.enabled) {
          await this.emailService.sendEmailImmediate({
            to: recipient.email,
            template: 'low-balance-alert',
            data: templateData,
            priority: severity === 'critical' ? 'high' : 'normal'
          });
        }

        // TODO: Add Telegram notification if enabled
        if (recipient.telegramId && recipient.channels.find(c => c.type === 'telegram')?.enabled) {
          await this.sendTelegramAlert(recipient.telegramId, alertData);
        }
      }

      logger.info(`Low balance alert sent to ${this.adminRecipients.length} admins for ${walletData.length} wallets`);
    } catch (error) {
      logger.error('Failed to send low balance alert', error);
      throw error;
    }
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(alertData: SystemAlertData): Promise<void> {
    try {
      // Create template based on alert type
      const templateName = `system-${alertData.type}`;

      // For now, send a simple email alert
      if (this.adminRecipients.length > 0 && this.adminRecipients[0].email) {
        await this.emailService.sendEmailImmediate({
          to: this.adminRecipients[0].email,
          subject: `[${alertData.severity.toUpperCase()}] LabelMint System Alert: ${alertData.type}`,
          template: 'system-alert',
          data: alertData,
          priority: alertData.severity === 'critical' ? 'high' : 'normal'
        });
      }

      logger.info(`System alert sent: ${alertData.type} (${alertData.severity})`);
    } catch (error) {
      logger.error('Failed to send system alert', error);
    }
  }

  /**
   * Send Telegram alert (placeholder for future implementation)
   */
  private async sendTelegramAlert(telegramId: string, alertData: LowBalanceAlertData): Promise<void> {
    try {
      // TODO: Implement Telegram bot integration
      logger.info(`Telegram alert would be sent to ${telegramId} (not yet implemented)`);
    } catch (error) {
      logger.error('Failed to send Telegram alert', error);
    }
  }

  /**
   * Calculate alert severity based on wallet data
   */
  private calculateSeverity(wallets: LowBalanceAlertData['wallets']): LowBalanceAlertData['severity'] {
    if (wallets.length === 0) return 'low';

    // Check if any wallet is completely empty
    const hasEmptyWallet = wallets.some(w => parseFloat(w.balance) === 0);
    if (hasEmptyWallet) return 'critical';

    // Check if multiple wallets are low
    if (wallets.length > 2) return 'high';

    // Check severity based on how low the balances are
    const avgPercentage = wallets.reduce((acc, wallet) => {
      const balance = parseFloat(wallet.balance);
      const threshold = parseFloat(wallet.threshold);
      return acc + (balance / threshold);
    }, 0) / wallets.length;

    if (avgPercentage < 0.1) return 'critical';
    if (avgPercentage < 0.3) return 'high';
    if (avgPercentage < 0.6) return 'medium';
    return 'low';
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: LowBalanceAlertData['severity']): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  /**
   * Test notification system
   */
  async testNotifications(): Promise<{ success: boolean; message: string }> {
    try {
      const testWallets = [
        {
          address: 'EQD_test_address_123...',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }
      ];

      await this.sendLowBalanceAlert(testWallets);
      return {
        success: true,
        message: 'Test notification sent successfully'
      };
    } catch (error) {
      logger.error('Test notification failed', error);
      return {
        success: false,
        message: `Test failed: ${error.message}`
      };
    }
  }

  /**
   * Get notification service status
   */
  async getStatus(): Promise<any> {
    try {
      const emailStats = await this.emailService.getStats();
      return {
        emailService: {
          status: await this.emailService.healthCheck() ? 'healthy' : 'unhealthy',
          stats: emailStats
        },
        adminRecipients: {
          count: this.adminRecipients.length,
          emailEnabled: this.adminRecipients.some(r => r.email && r.channels.find(c => c.type === 'email')?.enabled),
          telegramEnabled: this.adminRecipients.some(r => r.telegramId && r.channels.find(c => c.type === 'telegram')?.enabled)
        },
        templates: {
          loaded: this.emailService['templates'].size,
          available: Array.from(this.emailService['templates'].keys())
        }
      };
    } catch (error) {
      logger.error('Failed to get notification service status', error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
export const notificationService = new NotificationService();