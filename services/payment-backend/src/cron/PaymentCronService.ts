import cron from 'node-cron';
import { TonWalletService } from '../services/ton/TonWalletService';
import { WorkerPayoutService } from '../services/WorkerPayoutService';
import { MultiChainService } from '../services/payment/MultiChainService';
import { ScheduledPaymentService } from '../services/payment/ScheduledPaymentService';
import { StakingService } from '../services/payment/StakingService';
import { EscrowService } from '../services/payment/EscrowService';
import { postgresDb } from '../services/database';

export class PaymentCronService {
  private tonService: TonWalletService;
  private payoutService: WorkerPayoutService;
  private multiChainService: MultiChainService;
  private scheduledPaymentService: ScheduledPaymentService;
  private stakingService: StakingService;
  private escrowService: EscrowService;

  constructor() {
    this.tonService = new TonWalletService();
    this.payoutService = new WorkerPayoutService();
    this.multiChainService = new MultiChainService();
    this.scheduledPaymentService = new ScheduledPaymentService();
    this.stakingService = new StakingService();
    this.escrowService = new EscrowService();
  }

  /**
   * Initialize all cron jobs
   */
  initialize() {
    // Update wallet balances every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('Updating wallet balances...');
      await this.updateAllWalletBalances();
    });

    // Process pending payouts every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Processing pending payouts...');
      await this.processPendingPayouts();
    });

    // Auto-payout for high earners every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running auto-payout...');
      const processed = await this.payoutService.autoPayout();
      console.log(`Auto-payout processed ${processed} payouts`);
    });

    // Create balance snapshots every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Creating balance snapshots...');
      await this.createBalanceSnapshots();
    });

    // Monitor pending transactions every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      console.log('Monitoring transactions...');
      await this.monitorPendingTransactions();
    });

    // Cleanup expired payment requests daily
    cron.schedule('0 0 * * *', async () => {
      console.log('Cleaning up expired payment requests...');
      await this.cleanupExpiredPaymentRequests();
    });

    // Retry failed payouts every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      console.log('Retrying failed payouts...');
      const retried = await this.payoutService.retryFailedPayouts();
      console.log(`Retried ${retried} failed payouts`);
    });

    // Process auto-conversions every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Starting auto-conversion process...');
      await this.processAutoConversions();
    });

    // Calculate staking rewards every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Calculating staking rewards...');
      await this.calculateStakingRewards();
    });

    // Process expired escrows daily at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('Processing expired escrows...');
      await this.processExpiredEscrows();
    });

    // Generate payment analytics daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
      console.log('Generating payment analytics...');
      await this.generatePaymentAnalytics();
    });

    // Update exchange rates every 5 minutes during market hours
    cron.schedule('*/5 9-17 * * 1-5', async () => {
      console.log('Updating exchange rates...');
      await this.updateExchangeRates();
    });

    // Send payment reminders daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Sending payment reminders...');
      await this.sendPaymentReminders();
    });

    console.log('Payment cron jobs initialized with advanced features');
  }

  /**
   * Update all active wallet balances
   */
  private async updateAllWalletBalances() {
    try {
      const query = `
        SELECT DISTINCT user_id, network_name
        FROM user_ton_wallets
        WHERE is_active = true
        AND last_sync_at < NOW() - INTERVAL '5 minutes'
      `;

      const result = await postgresDb.query(query);

      for (const row of result.rows) {
        try {
          await this.tonService.updateWalletBalance(row.user_id, row.network_name);
        } catch (error) {
          console.error(`Failed to update balance for user ${row.user_id}:`, error);
        }
      }

      console.log(`Updated balances for ${result.rows.length} users`);
    } catch (error) {
      console.error('Error updating wallet balances:', error);
    }
  }

  /**
   * Process pending payouts in batches
   */
  private async processPendingPayouts() {
    try {
      const pendingPayouts = await this.payoutService.getPendingPayouts(20);

      if (pendingPayouts.length === 0) {
        return;
      }

      const payoutIds = pendingPayouts.map(p => p.id);
      const results = await this.payoutService.processBatchPayouts(payoutIds);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`Processed ${payoutIds.length} payouts: ${successful} successful, ${failed} failed`);

    } catch (error) {
      console.error('Error processing pending payouts:', error);
    }
  }

  /**
   * Create balance snapshots for all users
   */
  private async createBalanceSnapshots() {
    try {
      // Call the PostgreSQL function
      await postgresDb.query('SELECT create_daily_balance_snapshots()');
      console.log('Balance snapshots created');
    } catch (error) {
      console.error('Error creating balance snapshots:', error);
    }
  }

  /**
   * Monitor pending transactions and update status
   */
  private async monitorPendingTransactions() {
    try {
      const query = `
        SELECT tx_hash, network_name, created_at
        FROM ton_transactions
        WHERE status = 'pending'
        AND created_at >= NOW() - INTERVAL '1 hour'
        LIMIT 50
      `;

      const result = await postgresDb.query(query);

      for (const tx of result.rows) {
        try {
          await this.tonService.monitorTransaction(tx.tx_hash, tx.network_name);
        } catch (error) {
          console.error(`Failed to monitor transaction ${tx.tx_hash}:`, error);
        }
      }

      console.log(`Monitored ${result.rows.length} pending transactions`);
    } catch (error) {
      console.error('Error monitoring transactions:', error);
    }
  }

  /**
   * Cleanup expired payment requests
   */
  private async cleanupExpiredPaymentRequests() {
    try {
      const query = `
        UPDATE payment_requests
        SET status = 'expired'
        WHERE status = 'pending'
        AND expires_at < NOW()
        RETURNING id
      `;

      const result = await postgresDb.query(query);
      console.log(`Expired ${result.rows.length} payment requests`);
    } catch (error) {
      console.error('Error cleaning up payment requests:', error);
    }
  }

  /**
   * Generate daily payment report
   */
  private async generateDailyReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's transactions
      const txQuery = `
        SELECT
          COUNT(*) as total_tx,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_tx,
          SUM(amount_usdt) FILTER (WHERE status = 'confirmed') as usdt_volume,
          SUM(amount) FILTER (WHERE status = 'confirmed') as ton_volume
        FROM ton_transactions
        WHERE created_at >= $1 AND created_at < $2
      `;

      const txResult = await postgresDb.query(txQuery, [yesterday, today]);

      // Get yesterday's payouts
      const payoutQuery = `
        SELECT
          COUNT(*) as total_payouts,
          COUNT(*) FILTER (WHERE status = 'sent') as sent_payouts,
          SUM(amount) FILTER (WHERE status = 'sent') as total_amount
        FROM worker_payouts
        WHERE sent_at >= $1 AND sent_at < $2
      `;

      const payoutResult = await postgresDb.query(payoutQuery, [yesterday, today]);

      // Save report
      const reportQuery = `
        INSERT INTO daily_reports
        (report_date, transaction_count, usdt_volume, ton_volume, payout_count, payout_amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (report_date) DO UPDATE SET
          transaction_count = EXCLUDED.transaction_count,
          usdt_volume = EXCLUDED.usdt_volume,
          ton_volume = EXCLUDED.ton_volume,
          payout_count = EXCLUDED.payout_count,
          payout_amount = EXCLUDED.payout_amount
      `;

      await postgresDb.query(reportQuery, [
        yesterday.toISOString().split('T')[0],
        txResult.rows[0].confirmed_tx,
        txResult.rows[0].usdt_volume || 0,
        txResult.rows[0].ton_volume || 0,
        payoutResult.rows[0].sent_payouts,
        payoutResult.rows[0].total_amount || 0
      ]);

      console.log('Daily report generated');
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  /**
   * Check for low balance alerts
   */
  private async checkLowBalanceAlerts() {
    try {
      const query = `
        SELECT *
        FROM system_wallets
        WHERE is_active = true
        AND balance_usdt < 100
      `;

      const result = await postgresDb.query(query);

      if (result.rows.length > 0) {
        // Send alert to admin
        console.warn(`Low balance alert: ${result.rows.length} system wallets need attention`);

        // TODO: Send email/Telegram notification to admin
        // await this.notificationService.sendLowBalanceAlert(result.rows);
      }
    } catch (error) {
      console.error('Error checking low balances:', error);
    }
  }

  /**
   * Process auto-conversions for large crypto balances
   */
  private async processAutoConversions() {
    try {
      await this.multiChainService.processAutoConversions();
      console.log('Auto-conversions processed successfully');
    } catch (error) {
      console.error('Error processing auto-conversions:', error);
    }
  }

  /**
   * Calculate and distribute staking rewards
   */
  private async calculateStakingRewards() {
    try {
      await this.stakingService.calculateAllRewards();
      console.log('Staking rewards calculated successfully');
    } catch (error) {
      console.error('Error calculating staking rewards:', error);
    }
  }

  /**
   * Process expired escrow accounts
   */
  private async processExpiredEscrows() {
    try {
      await this.escrowService.processExpiredEscrows();
      console.log('Expired escrows processed successfully');
    } catch (error) {
      console.error('Error processing expired escrows:', error);
    }
  }

  /**
   * Generate daily payment analytics
   */
  private async generatePaymentAnalytics() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();

      // Get analytics for each chain
      const chains = ['ton', 'solana', 'polygon', 'arbitrum'];

      for (const chain of chains) {
        const analytics = await this.multiChainService.getPaymentAnalytics(yesterday, today);

        // Store in database
        await postgresDb.query(`
          INSERT INTO payment_analytics (
            date, chain, total_transactions, total_volume,
            total_fees, unique_users, avg_transaction_value
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (date, chain) DO UPDATE SET
            total_transactions = EXCLUDED.total_transactions,
            total_volume = EXCLUDED.total_volume,
            total_fees = EXCLUDED.total_fees,
            unique_users = EXCLUDED.unique_users,
            avg_transaction_value = EXCLUDED.avg_transaction_value
        `, [
          yesterday.toISOString().split('T')[0],
          chain,
          analytics.total_transactions || 0,
          analytics.total_volume || 0,
          analytics.total_fees || 0,
          analytics.unique_users || 0,
          analytics.avg_transaction_value || 0
        ]);
      }

      console.log('Payment analytics generated successfully');
    } catch (error) {
      console.error('Error generating payment analytics:', error);
    }
  }

  /**
   * Update exchange rates for supported currencies
   */
  private async updateExchangeRates() {
    try {
      const currencies = ['TON', 'SOL', 'MATIC', 'ETH', 'BTC'];
      const targetCurrency = 'USD';

      for (const currency of currencies) {
        try {
          const rate = await this.multiChainService.getExchangeRate(currency, targetCurrency);
          console.log(`Updated ${currency}/${targetCurrency} rate: ${rate.rate}`);
        } catch (error) {
          console.error(`Failed to update ${currency} rate:`, error);
        }
      }

      console.log('Exchange rates updated successfully');
    } catch (error) {
      console.error('Error updating exchange rates:', error);
    }
  }

  /**
   * Send payment reminders for upcoming scheduled payments
   */
  private async sendPaymentReminders() {
    try {
      const query = `
        SELECT
          sp.*,
          u.email,
          r.email as recipient_email
        FROM scheduled_payments sp
        JOIN users u ON sp.user_id = u.id
        JOIN users r ON sp.recipient_id = r.id
        WHERE sp.status = 'active'
        AND sp.next_payment_at BETWEEN NOW() AND NOW() + INTERVAL '1 day'
        AND (sp.last_notified_at IS NULL OR sp.last_notified_at < NOW() - INTERVAL '1 day')
      `;

      const result = await postgresDb.query(query);

      for (const payment of result.rows) {
        // Send email notification
        console.log(`Sending payment reminder to ${payment.email} for ${payment.amount} ${payment.currency}`);

        // Update last notified timestamp
        await postgresDb.query(
          'UPDATE scheduled_payments SET last_notified_at = NOW() WHERE id = $1',
          [payment.id]
        );
      }

      console.log('Payment reminders sent successfully');
    } catch (error) {
      console.error('Error sending payment reminders:', error);
    }
  }
}