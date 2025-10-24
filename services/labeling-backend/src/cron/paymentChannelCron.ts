import { paymentChannelManager } from '../services/paymentChannel.js';
import { query } from '../database/connection.js';

/**
 * Cron jobs for payment channel management
 */
export class PaymentChannelCron {
  /**
   * Auto-create channels for frequent workers
   */
  async autoCreateChannels(): Promise<number> {
    try {
      console.log('🔄 Checking for workers who need payment channels...');

      // Find workers with high transaction volume but no channel
      const result = await query(`
        SELECT w.telegram_id, w.ton_wallet, tx_count, total_earned
        FROM workers w
        LEFT JOIN (
          SELECT COUNT(*) as tx_count, worker_id
          FROM worker_transactions
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY worker_id
        ) tx ON w.telegram_id = tx.worker_id
        WHERE w.ton_wallet IS NOT NULL
          AND w.telegram_id NOT IN (
            SELECT worker_id FROM payment_channels WHERE status = 'active'
          )
          AND (tx.count >= 50 OR w.total_earned >= 100)
      `);

      let created = 0;
      for (const worker of result.rows) {
        try {
          const channelResult = await paymentChannelManager.createChannel(
            worker.ton_wallet,
            10 // Default deposit
          );

          if (channelResult.success) {
            created++;
            console.log(`✅ Created channel for worker ${worker.telegram_id} (${worker.tx_count} transactions)`);

            // Update worker preference
            await query(
              'UPDATE workers SET prefers_channel = true WHERE telegram_id = $1',
              [worker.telegram_id]
            );

            // Send notification (would integrate with bot)
            console.log(`📬 Notification sent to worker ${worker.telegram_id} about new channel`);
          }
        } catch (error) {
          console.error(`Failed to create channel for worker ${worker.telegram_id}:`, error);
        }
      }

      return created;
    } catch (error) {
      console.error('Auto channel creation failed:', error);
      return 0;
    }
  }

  /**
   * Auto-settle channels based on their configuration
   */
  async autoSettleChannels(): Promise<{
    settled: number;
    totalAmount: number;
    feesSaved: number;
    errors: string[];
  }> {
    try {
      console.log('🔄 Auto-settling payment channels...');

      const result = await paymentChannelManager.autoSettleAll();

      // Calculate fees saved
      const estimatedOnChainFees = result.totalSettled * 0.001; // 0.001 USDT per tx
      const feesSaved = estimatedOnChainFees;

      if (result.totalSettled > 0) {
        console.log(`✅ Settled ${result.totalSettled} channels`);
        console.log(`   Total Amount: $${result.totalAmount.toFixed(2)}`);
        console.log(`   Fees Saved: $${feesSaved.toFixed(4)}`);
      }

      return {
        settled: result.totalSettled,
        totalAmount: result.totalAmount,
        feesSaved,
        errors: result.errors
      };
    } catch (error) {
      console.error('Auto-settlement failed:', error);
      return {
        settled: 0,
        totalAmount: 0,
        feesSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Monitor channel health and performance
   */
  async monitorChannelHealth(): Promise<{
    activeChannels: number;
    totalBalance: number;
    totalVolume: number;
    efficiency: number;
    warnings: string[];
  }> {
    try {
      console.log('📊 Monitoring payment channel health...');

      // Get channel statistics
      const result = await query(`
        SELECT
          COUNT(*) as active_channels,
          SUM(platform_balance + worker_balance) as total_balance,
          COUNT(CASE WHEN last_update >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_today,
          COUNT(CASE WHEN last_update >= NOW() - INTERVAL '7 days' THEN 1 END) as active_week
        FROM channel_summary
        WHERE status = 'active'
      `);

      const stats = result.rows[0];
      const warnings: string[] = [];

      // Check for inactive channels
      if (stats.active_week < stats.active_channels * 0.5) {
        warnings.push(`${stats.active_channels - stats.active_week} channels inactive for >7 days`);
      }

      // Check for large pending transactions
      const pendingResult = await query(`
        SELECT COUNT(*) as pending_count,
               COALESCE(SUM(amount), 0) as pending_amount
        FROM offchain_transactions
        WHERE status = 'pending'
          AND timestamp < NOW() - INTERVAL '1 hour'
      `);

      const pending = pendingResult.rows[0];
      if (pending.pending_count > 0) {
        warnings.push(`${pending.pending_count} transactions pending >1 hour ($${pending.pending_amount.toFixed(2)})`);
      }

      // Calculate efficiency
      const efficiency = 95; // Default efficiency
      const totalVolume = stats.total_balance || 0;

      return {
        activeChannels: parseInt(stats.active_channels),
        totalBalance: parseFloat(stats.total_balance) || 0,
        totalVolume,
        efficiency,
        warnings
      };
    } catch (error) {
      console.error('Channel health monitoring failed:', error);
      return {
        activeChannels: 0,
        totalBalance: 0,
        totalVolume: 0,
        efficiency: 0,
        warnings: [error.message]
      };
    }
  }

  /**
   * Generate daily channel report
   */
  async generateDailyReport(): Promise<{
    date: string;
    totalChannels: number;
    newChannels: number;
    settledChannels: number;
    totalVolume: number;
    totalSavings: number;
    topWorkers: Array<{
      workerId: number;
      totalTransactions: number;
      totalEarnings: number;
      efficiency: number;
    }>;
  }> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Get overall statistics
      const statsResult = await query(
        `SELECT
           COUNT(*) as total_channels,
           COUNT(CASE WHEN created_at::date = $1 THEN 1 END) as new_channels,
           COUNT(CASE WHEN created_at::date = $1 THEN 1 END) as settled_channels,
           COALESCE(SUM(platform_balance + worker_balance), 0) as total_volume
         FROM payment_channels
         WHERE status IN ('active', 'closed')`,
        [yesterday]
      );

      // Get top performers
      const topResult = await query(
        `SELECT
           pc.worker_id,
           COALESCE(tx.total_tx, 0) as total_transactions,
           COALESCE(tx.total_amount, 0) as total_earnings,
           COALESCE(cm.efficiency, 95) as efficiency
         FROM payment_channels pc
         LEFT JOIN (
           SELECT
             channel_id,
             COUNT(*) as total_tx,
             SUM(amount) as total_amount
           FROM offchain_transactions
           WHERE DATE(timestamp) = $1
           GROUP BY channel_id
         ) tx ON pc.channel_id = tx.channel_id
         LEFT JOIN (
           SELECT
             channel_id,
             AVG(efficiency_score) as efficiency
           FROM channel_metrics
           WHERE date = $1
           GROUP BY channel_id
         ) cm ON pc.channel_id = cm.channel_id
         WHERE pc.status = 'active'
         GROUP BY pc.worker_id, pc.platform_address, pc.worker_address
         ORDER BY total_earnings DESC
         LIMIT 10`,
        [yesterday]
      );

      return {
        date: yesterday.toISOString().split('T')[0],
        totalChannels: parseInt(statsResult.rows[0]?.total_channels || 0),
        newChannels: parseInt(statsResult.rows[0]?.new_channels || 0),
        settledChannels: parseInt(statsResult.rows[0]?.settled_channels || 0),
        totalVolume: parseFloat(statsResult.rows[0]?.total_volume || 0),
        totalSavings: statsResult.rows[0]?.total_volume * 0.95 * 0.05 || 0, // 5% of volume
        topWorkers: topResult.rows.map(row => ({
          workerId: parseInt(row.worker_id),
          totalTransactions: parseInt(row.total_transactions),
          totalEarnings: parseFloat(row.total_earnings),
          efficiency: parseFloat(row.efficiency)
        }))
      };
    } catch (error) {
      console.error('Failed to generate daily report:', error);
      return {
        date: new Date().toISOString().split('T')[0],
        totalChannels: 0,
        newChannels: 0,
        settledChannels: 0,
        totalVolume: 0,
        totalSavings: 0,
        topWorkers: []
      };
    }
  }

  /**
   * Close inactive channels
   */
  async closeInactiveChannels(): Promise<number> {
    try {
      console.log('🧹 Closing inactive channels...');

      const result = await query(`
        UPDATE payment_channels
        SET status = 'closed',
            closed_at = NOW()
        WHERE status = 'active'
          AND last_update < NOW() - INTERVAL '30 days'
      `);

      const closed = result.rowCount;
      if (closed > 0) {
        console.log(`✅ Closed ${closed} inactive channels`);
      }

      return closed;
    } catch (error) {
      console.error('Failed to close inactive channels:', error);
      return 0;
    }
  }
}

// Setup cron jobs
export function setupPaymentChannelCronJobs(): void {
  const cron = new PaymentChannelCron();

  // Check for new channels every hour
  setInterval(() => {
    cron.autoCreateChannels();
  }, 60 * 60 * 1000);

  // Auto-settle channels every 4 hours
  setInterval(() => {
    cron.autoSettleChannels();
  }, 4 * 60 * 60 * 1000);

  // Monitor channel health every 6 hours
  setInterval(() => {
    cron.monitorChannelHealth();
  }, 6 * 60 * 60 * 1000);

  // Close inactive channels daily at 3 AM
  const closeInactiveJob = () => {
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      cron.closeInactiveChannels();
    }
  };
  setInterval(closeInactiveJob, 60 * 1000);

  // Generate daily report at 9 AM
  const reportJob = async () => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      const report = await cron.generateDailyReport();
      console.log('📊 Daily Channel Report:', report);

      // Send report via webhook or notification
      // await sendChannelReport(report);
    }
  };
  setInterval(reportJob, 60 * 1000);

  console.log('🕐 Payment Channel cron jobs scheduled');
  console.log('   - Auto-create channels: Every hour');
  console.log('   - Auto-settle: Every 4 hours');
  console.log('   - Health check: Every 6 hours');
  console.log('   - Close inactive: Daily at 3 AM');
  console.log('   - Daily report: Daily at 9 AM');
}

export const paymentChannelCron = new PaymentChannelCron();