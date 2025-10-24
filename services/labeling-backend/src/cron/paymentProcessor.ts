import { micropaymentSystem } from '../services/micropaymentSystem.js';
import { query } from '../database/connection.js';

/**
 * Payment processing cron jobs
 */
export class PaymentProcessor {
  /**
   * Process batch withdrawals every 5 minutes
   */
  async processBatchWithdrawals(): Promise<void> {
    try {
      console.log('🔄 Processing batch withdrawals...');

      const result = await micropaymentSystem.processBatchWithdrawals();

      if (result.processed > 0) {
        console.log(`✅ Processed ${result.processed} withdrawals totaling $${result.totalAmount.toFixed(2)}`);

        // Send notifications to workers
        await this.sendWithdrawalNotifications(result);
      } else {
        console.log('ℹ️ No pending withdrawals to process');
      }

      if (result.errors.length > 0) {
        console.error('❌ Errors during batch processing:', result.errors);
      }
    } catch (error) {
      console.error('Failed to process batch withdrawals:', error);
    }
  }

  /**
   * Auto-withdrawals for workers with enabled auto-withdrawal
   */
  async processAutoWithdrawals(): Promise<void> {
    try {
      console.log('🔄 Checking auto-withdrawals...');

      const result = await query('SELECT process_auto_withdrawals() as count');
      const count = parseInt(result.rows[0].count);

      if (count > 0) {
        console.log(`✅ Created ${count} auto-withdrawals`);
      }
    } catch (error) {
      console.error('Failed to process auto-withdrawals:', error);
    }
  }

  /**
   * Clean up old completed transactions
   */
  async cleanupOldTransactions(): Promise<void> {
    try {
      console.log('🧹 Cleaning up old transactions...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Archive completed transactions older than 30 days
      const result = await query(
        `UPDATE worker_transactions
         SET archived = true
         WHERE status = 'completed'
           AND created_at < $1`,
        [thirtyDaysAgo]
      );

      console.log(`✅ Archived ${result.rowCount} old transactions`);
    } catch (error) {
      console.error('Failed to cleanup old transactions:', error);
    }
  }

  /**
   * Send withdrawal notifications to workers
   */
  private async sendWithdrawalNotifications(result: any): Promise<void> {
    try {
      // Get batch details
      const batchResult = await query(
        `SELECT w.id, w.worker_id, w.amount, t.username
         FROM withdrawals w
         LEFT JOIN workers t ON w.worker_id = t.telegram_id
         WHERE w.status = 'completed'
           AND w.created_at >= NOW() - INTERVAL '5 minutes'`,
        []
      );

      for (const withdrawal of batchResult.rows) {
        // Send notification via bot (this would be implemented with the actual bot)
        console.log(`Notification: Withdrawal of $${withdrawal.amount} completed for worker ${withdrawal.worker_id}`);

        // Here you would integrate with your bot to send notifications
        // await bot.api.sendMessage(withdrawal.worker_id, `✅ Withdrawal of $${withdrawal.amount} USDT has been sent to your wallet!`);
      }
    } catch (error) {
      console.error('Failed to send withdrawal notifications:', error);
    }
  }

  /**
   * Generate daily payment report
   */
  async generateDailyReport(): Promise<void> {
    try {
      console.log('📊 Generating daily payment report...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const report = await query(
        `SELECT
           COUNT(DISTINCT cp.id) as client_payments,
           COALESCE(SUM(cp.total_amount), 0) as total_client_volume,
           COUNT(DISTINCT wt.id) as worker_transactions,
           COUNT(DISTINCT w.id) as withdrawals,
           COALESCE(SUM(w.amount), 0) as total_withdrawals,
           COUNT(DISTINCT CASE WHEN wt.type = 'earning' THEN wt.worker_id END) as active_workers
         FROM client_payments cp
         FULL OUTER JOIN worker_transactions wt ON DATE(cp.created_at) = DATE(wt.created_at)
         FULL OUTER JOIN withdrawals w ON DATE(cp.created_at) = DATE(w.created_at)
         WHERE DATE(cp.created_at) = $1 OR DATE(wt.created_at) = $1 OR DATE(w.created_at) = $1`,
        [yesterday]
      );

      const stats = report.rows[0];

      console.log('📈 Daily Payment Report:');
      console.log(`   Client Payments: ${stats.client_payments} ($${stats.total_client_volume.toFixed(2)})`);
      console.log(`   Worker Earnings: ${stats.worker_transactions} transactions`);
      console.log(`   Withdrawals: ${stats.withdrawals} ($${stats.total_withdrawals.toFixed(2)})`);
      console.log(`   Active Workers: ${stats.active_workers}`);
    } catch (error) {
      console.error('Failed to generate daily report:', error);
    }
  }
}

// Setup cron jobs
export function setupPaymentCronJobs(): void {
  const processor = new PaymentProcessor();

  // Process batch withdrawals every 5 minutes
  setInterval(() => {
    processor.processBatchWithdrawals();
  }, 5 * 60 * 1000);

  // Check auto-withdrawals every hour
  setInterval(() => {
    processor.processAutoWithdrawals();
  }, 60 * 60 * 1000);

  // Cleanup old transactions daily at 2 AM
  const cleanupJob = () => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      processor.cleanupOldTransactions();
    }
  };
  setInterval(cleanupJob, 60 * 1000);

  // Generate daily report at 8 AM
  const reportJob = () => {
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
      processor.generateDailyReport();
    }
  };
  setInterval(reportJob, 60 * 1000);

  console.log('🕐 Payment cron jobs scheduled');
  console.log('   - Batch withdrawals: Every 5 minutes');
  console.log('   - Auto-withdrawals: Every hour');
  console.log('   - Cleanup: Daily at 2 AM');
  console.log('   - Daily report: Daily at 8 AM');
}

export const paymentProcessor = new PaymentProcessor();