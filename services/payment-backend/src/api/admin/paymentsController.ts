import { Request, Response } from 'express';
import { postgresDb } from '../../services/database';
import { WorkerPayoutService } from '../../services/WorkerPayoutService';
import { TonWalletService } from '../../services/ton/TonWalletService';
import { hasRole } from '../middleware/auth';

const payoutService = new WorkerPayoutService();
const tonService = new TonWalletService();

/**
 * Get payment dashboard overview
 */
export const getPaymentDashboard = async (req: Request, res: Response) => {
  try {
    // Get total balances
    const balanceQuery = `
      SELECT
        SUM(balance_usdt) as total_usdt,
        SUM(balance_ton) as total_ton,
        COUNT(*) as total_wallets
      FROM user_ton_wallets
      WHERE is_active = true
    `;

    const balanceResult = await postgresDb.query(balanceQuery);

    // Get transaction stats
    const txQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        SUM(amount_usdt) FILTER (WHERE token_type = 'USDT') as total_usdt_volume,
        SUM(amount) FILTER (WHERE token_type = 'TON') as total_ton_volume
      FROM ton_transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    const txResult = await postgresDb.query(txQuery);

    // Get payout stats
    const payoutStats = await payoutService.getPayoutStats({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date()
    });

    // Get daily volume for chart
    const volumeQuery = `
      SELECT
        DATE(created_at) as date,
        SUM(amount_usdt) as usdt_volume,
        SUM(amount) as ton_volume
      FROM ton_transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
      AND status = 'confirmed'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const volumeResult = await postgresDb.query(volumeQuery);

    res.json({
      success: true,
      data: {
        balances: balanceResult.rows[0],
        transactions: txResult.rows[0],
        payouts: payoutStats,
        dailyVolume: volumeResult.rows,
        lastUpdate: new Date()
      }
    });

  } catch (error) {
    console.error('Get payment dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
};

/**
 * Get all pending transactions
 */
export const getPendingTransactions = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const query = `
      SELECT tt.*, u.email as user_email
      FROM ton_transactions tt
      JOIN users u ON tt.user_id = u.id
      WHERE tt.status = 'pending'
      ORDER BY tt.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await postgresDb.query(query, [limit, offset]);

    res.json({
      success: true,
      transactions: result.rows
    });

  } catch (error) {
    console.error('Get pending transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending transactions'
    });
  }
};

/**
 * Get payout management data
 */
export const getPayoutManagement = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string || 'pending';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const query = `
      SELECT wp.*, u.email, u.telegram_username, u.telegram_id
      FROM worker_payouts wp
      JOIN users u ON wp.worker_id = u.id
      WHERE wp.status = $1
      ORDER BY wp.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresDb.query(query, [status, limit, offset]);

    // Get summary stats
    const statsQuery = `
      SELECT
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM worker_payouts
      GROUP BY status
    `;

    const statsResult = await postgresDb.query(statsQuery);

    res.json({
      success: true,
      payouts: result.rows,
      stats: statsResult.rows
    });

  } catch (error) {
    console.error('Get payout management error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payout data'
    });
  }
};

/**
 * Process selected payouts
 */
export const processSelectedPayouts = async (req: Request, res: Response) => {
  try {
    const { payoutIds } = req.body;

    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payout IDs'
      });
    }

    const results = await payoutService.processBatchPayouts(payoutIds);

    res.json({
      success: true,
      message: 'Payouts processed',
      results
    });

  } catch (error) {
    console.error('Process selected payouts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payouts'
    });
  }
};

/**
 * Get user balance details
 */
export const getUserBalanceDetails = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    const query = `
      SELECT
        utw.*,
        u.email,
        u.telegram_username,
        COUNT(tt.id) as transaction_count,
        SUM(tt.amount_usdt) FILTER (WHERE tt.status = 'confirmed') as total_sent_usdt
      FROM user_ton_wallets utw
      JOIN users u ON utw.user_id = u.id
      LEFT JOIN ton_transactions tt ON tt.user_id = u.id
      WHERE utw.user_id = $1
      GROUP BY utw.id, u.email, u.telegram_username
    `;

    const result = await postgresDb.query(query, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Get user balance details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
};

/**
 * Get system fee configuration
 */
export const getFeeConfiguration = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT *
      FROM system_configs
      WHERE category = 'fees'
    `;

    const result = await postgresDb.query(query);

    const fees = result.rows.reduce((acc, row) => {
      acc[row.key] = parseFloat(row.value);
      return acc;
    }, {});

    res.json({
      success: true,
      fees: {
        usdtTransfer: fees.usdt_transfer_fee || 0.1,
        tonTransfer: fees.ton_transfer_fee || 0.001,
        internalTransfer: fees.internal_transfer_fee || 0,
        platformCommission: fees.platform_commission || 0.05,
        minPayout: fees.min_payout || 1,
        maxPayout: fees.max_payout || 10000,
        ...fees
      }
    });

  } catch (error) {
    console.error('Get fee configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee configuration'
    });
  }
};

/**
 * Update fee configuration
 */
export const updateFeeConfiguration = async (req: Request, res: Response) => {
  try {
    const { fees } = req.body;

    for (const [key, value] of Object.entries(fees)) {
      await postgresDb.query(`
        INSERT INTO system_configs (category, key, value)
        VALUES ('fees', $1, $2)
        ON CONFLICT (category, key) DO UPDATE SET
        value = EXCLUDED.value
      `, [key, value]);
    }

    res.json({
      success: true,
      message: 'Fee configuration updated'
    });

  } catch (error) {
    console.error('Update fee configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fee configuration'
    });
  }
};

/**
 * Export payment reports
 */
export const exportPaymentReport = async (req: Request, res: Response) => {
  try {
    const {
      type = 'transactions',
      startDate,
      endDate,
      format = 'csv'
    } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    let data: string;
    let filename: string;

    switch (type) {
      case 'transactions':
        const txQuery = `
          SELECT
            tt.*,
            u.email as user_email
          FROM ton_transactions tt
          JOIN users u ON tt.user_id = u.id
          WHERE tt.created_at BETWEEN $1 AND $2
          ORDER BY tt.created_at DESC
        `;

        const txResult = await postgresDb.query(txQuery, [start, end]);
        data = format === 'csv'
          ? convertToCSV(txResult.rows)
          : JSON.stringify(txResult.rows, null, 2);
        filename = `transactions_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.${format}`;
        break;

      case 'payouts':
        data = await payoutService.exportPayoutReport(start, end, format);
        filename = `payouts_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.${format}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type'
        });
    }

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);

  } catch (error) {
    console.error('Export payment report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report'
    });
  }
};

/**
 * Get system wallet balances
 */
export const getSystemWallets = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT *
      FROM system_wallets
      WHERE is_active = true
    `;

    const result = await postgresDb.query(query);

    const wallets = await Promise.all(
      result.rows.map(async (wallet) => {
        const balances = await tonService.getWalletBalance(
          wallet.address,
          wallet.network
        );
        return {
          ...wallet,
          balances
        };
      })
    );

    res.json({
      success: true,
      wallets
    });

  } catch (error) {
    console.error('Get system wallets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system wallets'
    });
  }
};

/**
 * Manual balance adjustment (admin only)
 */
export const adjustBalance = [
  hasRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { userId, amount, reason, network = 'testnet' } = req.body;

      await postgresDb.query('BEGIN');

      // Update user balance
      const updateQuery = `
        UPDATE user_ton_wallets
        SET balance_usdt = balance_usdt + $1,
            updated_at = NOW()
        WHERE user_id = $2 AND network_name = $3
        RETURNING *
      `;

      const result = await postgresDb.query(updateQuery, [amount, userId, network]);

      if (!result.rows.length) {
        await postgresDb.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'User wallet not found'
        });
      }

      // Record adjustment
      await postgresDb.query(`
        INSERT INTO balance_adjustments
        (user_id, amount, reason, network_name, adjusted_by)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, amount, reason, network, req.user!.id]);

      // Create balance snapshot
      await postgresDb.query(`
        INSERT INTO balance_snapshots (user_id, balance_usdt, balance_ton)
        SELECT user_id, balance_usdt, balance_ton
        FROM user_ton_wallets
        WHERE id = $1
      `, [result.rows[0].id]);

      await postgresDb.query('COMMIT');

      res.json({
        success: true,
        message: 'Balance adjusted successfully',
        newBalance: result.rows[0].balance_usdt
      });

    } catch (error) {
      await postgresDb.query('ROLLBACK');
      console.error('Adjust balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to adjust balance'
      });
    }
  }
];

// Helper function
function convertToCSV(data: any[]): string {
  if (!data.length) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',')
        ? `"${value}"`
        : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}