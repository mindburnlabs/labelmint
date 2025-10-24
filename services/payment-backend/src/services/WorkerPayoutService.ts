import { postgresDb } from './database';
import { TonWalletService } from './ton/TonWalletService';
import { WorkerService } from './WorkerService';

export interface PayoutBatch {
  taskBatchId: number;
  totalAmount: number;
  workerCount: number;
  network: 'mainnet' | 'testnet';
}

export class WorkerPayoutService {
  private tonService: TonWalletService;
  private workerService: WorkerService;

  constructor() {
    this.tonService = new TonWalletService();
    this.workerService = new WorkerService();
  }

  /**
   * Create payouts for completed task batch
   */
  async createPayouts(taskBatchId: number): Promise<number[]> {
    // Get all completed tasks in batch
    const tasksQuery = `
      SELECT t.*, u.id as worker_id, u.email
      FROM tasks t
      JOIN task_assignments ta ON t.id = ta.task_id
      JOIN users u ON ta.worker_id = u.id
      WHERE t.batch_id = $1 AND t.status = 'completed'
      AND ta.status = 'completed' AND ta.payout_id IS NULL
    `;

    const tasksResult = await postgresDb.query(tasksQuery, [taskBatchId]);

    if (!tasksResult.rows.length) {
      return [];
    }

    // Group by worker and calculate total
    const workerTotals = new Map<number, number>();
    tasksResult.rows.forEach(task => {
      const current = workerTotals.get(task.worker_id) || 0;
      workerTotals.set(task.worker_id, current + task.worker_payment);
    });

    // Create payout records
    const payoutIds: number[] = [];

    for (const [workerId, amount] of workerTotals) {
      const payoutQuery = `
        INSERT INTO worker_payouts (task_batch_id, worker_id, amount, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id
      `;

      const payoutResult = await postgresDb.query(payoutQuery, [
        taskBatchId,
        workerId,
        amount
      ]);

      payoutIds.push(payoutResult.rows[0].id);
    }

    // Update task assignments with payout IDs
    for (const [workerId, _] of workerTotals) {
      const payout = payoutIds.find(id => {
        // Find the payout ID for this worker
        // This is simplified - in production you'd return the mapping
        return true;
      });

      await postgresDb.query(`
        UPDATE task_assignments
        SET payout_id = $1
        WHERE task_id IN (SELECT id FROM tasks WHERE batch_id = $2)
        AND worker_id = $3
        AND status = 'completed'
      `, [payout, taskBatchId, workerId]);
    }

    return payoutIds;
  }

  /**
   * Process single payout
   */
  async processPayout(payoutId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const result = await this.tonService.processWorkerPayout(payoutId);
      return { success: true, txHash: result.txHash };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process multiple payouts in batch
   */
  async processBatchPayouts(payoutIds: number[]): Promise<Array<{
    payoutId: number;
    success: boolean;
    txHash?: string;
    error?: string;
  }>> {
    const results = [];

    for (const payoutId of payoutIds) {
      const result = await this.processPayout(payoutId);
      results.push({ payoutId, ...result });

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Get pending payouts
   */
  async getPendingPayouts(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT wp.*, u.email as worker_email, u.telegram_id
      FROM worker_payouts wp
      JOIN users u ON wp.worker_id = u.id
      WHERE wp.status = 'pending'
      ORDER BY wp.created_at ASC
      LIMIT $1
    `;

    const result = await postgresDb.query(query, [limit]);
    return result.rows;
  }

  /**
   * Get worker payout history
   */
  async getWorkerPayoutHistory(
    workerId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const query = `
      SELECT wp.*, tb.name as batch_name
      FROM worker_payouts wp
      LEFT JOIN task_batches tb ON wp.task_batch_id = tb.id
      WHERE wp.worker_id = $1
      ORDER BY wp.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresDb.query(query, [workerId, limit, offset]);
    return result.rows;
  }

  /**
   * Get total earnings for worker
   */
  async getWorkerTotalEarnings(workerId: number): Promise<{
    total: number;
    paid: number;
    pending: number;
  }> {
    const query = `
      SELECT
        SUM(amount) FILTER (WHERE status = 'sent') as paid,
        SUM(amount) FILTER (WHERE status = 'pending') as pending,
        SUM(amount) as total
      FROM worker_payouts
      WHERE worker_id = $1
    `;

    const result = await postgresDb.query(query, [workerId]);
    const row = result.rows[0];

    return {
      total: parseFloat(row.total) || 0,
      paid: parseFloat(row.paid) || 0,
      pending: parseFloat(row.pending) || 0
    };
  }

  /**
   * Auto-payout for high-earning workers
   */
  async autoPayout(): Promise<number> {
    // Get workers with pending payouts >= 10 USDT
    const query = `
      SELECT worker_id, SUM(amount) as total_pending
      FROM worker_payouts
      WHERE status = 'pending'
      GROUP BY worker_id
      HAVING SUM(amount) >= 10
    `;

    const result = await postgresDb.query(query);
    let processedCount = 0;

    for (const row of result.rows) {
      // Get worker's payout IDs
      const payoutIdsQuery = `
        SELECT id
        FROM worker_payouts
        WHERE worker_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 20
      `;

      const payoutIdsResult = await postgresDb.query(payoutIdsQuery, [row.worker_id]);
      const payoutIds = payoutIdsResult.rows.map(r => r.id);

      // Process payouts
      const results = await this.processBatchPayouts(payoutIds);
      const successful = results.filter(r => r.success).length;

      processedCount += successful;

      // Notify worker
      await this.workerService.sendNotification(row.worker_id, {
        type: 'payout_sent',
        amount: successful,
        currency: 'USDT',
        txHashes: results.filter(r => r.success).map(r => r.txHash)
      });
    }

    return processedCount;
  }

  /**
   * Calculate platform fees
   */
  async calculatePlatformFee(amount: number): Promise<number> {
    // Platform fee: 5% of payout amount
    const feeRate = 0.05;
    return amount * feeRate;
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats(dateRange?: { from: Date; to: Date }): Promise<{
    totalAmount: number;
    totalPayouts: number;
    avgPayout: number;
    platformFees: number;
  }> {
    let whereClause = 'WHERE status = \'sent\'';
    const params: any[] = [];

    if (dateRange) {
      whereClause += ' AND sent_at BETWEEN $1 AND $2';
      params.push(dateRange.from, dateRange.to);
    }

    const query = `
      SELECT
        SUM(amount) as total_amount,
        COUNT(*) as total_payouts,
        AVG(amount) as avg_payout
      FROM worker_payouts
      ${whereClause}
    `;

    const result = await postgresDb.query(query, params);
    const row = result.rows[0];

    const totalAmount = parseFloat(row.total_amount) || 0;
    const platformFees = await this.calculatePlatformFee(totalAmount);

    return {
      totalAmount,
      totalPayouts: parseInt(row.total_payouts) || 0,
      avgPayout: parseFloat(row.avg_payout) || 0,
      platformFees
    };
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(): Promise<number> {
    const query = `
      UPDATE worker_payouts
      SET status = 'pending', error_message = NULL
      WHERE status = 'failed'
      AND created_at >= NOW() - INTERVAL '24 hours'
      RETURNING id
    `;

    const result = await postgresDb.query(query);
    return result.rows.length;
  }

  /**
   * Export payout report
   */
  async exportPayoutReport(
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    const query = `
      SELECT
        wp.id,
        wp.worker_id,
        u.email,
        u.telegram_username,
        wp.amount,
        wp.status,
        wp.tx_hash,
        wp.created_at,
        wp.sent_at,
        tb.name as batch_name
      FROM worker_payouts wp
      JOIN users u ON wp.worker_id = u.id
      LEFT JOIN task_batches tb ON wp.task_batch_id = tb.id
      WHERE wp.created_at BETWEEN $1 AND $2
      ORDER BY wp.created_at DESC
    `;

    const result = await postgresDb.query(query, [startDate, endDate]);

    if (format === 'json') {
      return JSON.stringify(result.rows, null, 2);
    }

    // CSV format
    const headers = [
      'Payout ID', 'Worker ID', 'Email', 'Telegram', 'Amount (USDT)',
      'Status', 'Transaction Hash', 'Created', 'Sent', 'Batch Name'
    ];

    const csvRows = [
      headers.join(','),
      ...result.rows.map(row => [
        row.id,
        row.worker_id,
        row.email,
        row.telegram_username,
        row.amount,
        row.status,
        row.tx_hash || '',
        row.created_at,
        row.sent_at || '',
        row.batch_name || ''
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}