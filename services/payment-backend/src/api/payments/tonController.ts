import { Request, Response } from 'express';
import { TonWalletService } from '../../services/ton/TonWalletService';
import { PaymentProcessor } from '../../services/PaymentProcessor';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const tonService = new TonWalletService();
const paymentProcessor = new PaymentProcessor('testnet');

// Validation schemas
const createWalletSchema = z.object({
  network: z.enum(['mainnet', 'testnet']).default('testnet'),
  version: z.enum(['v4R2', 'v3R2']).default('v4R2'),
  saveMnemonic: z.boolean().default(true)
});

const sendTransactionSchema = z.object({
  toAddress: z.string().min(66).max(66),
  amount: z.string().min(1),
  tokenType: z.enum(['TON', 'USDT']),
  message: z.string().optional(),
  network: z.enum(['mainnet', 'testnet']).default('testnet')
});

const internalTransferSchema = z.object({
  toUserId: z.number().positive(),
  amount: z.number().positive(),
  description: z.string().optional()
});

const connectTelegramWalletSchema = z.object({
  walletAddress: z.string().min(66).max(66),
  signature: z.string()
});

/**
 * Create new TON wallet
 */
export const createWallet = [
  validateRequest(createWalletSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { network, version, saveMnemonic } = req.body;

      // Check if user already has a wallet for this network
      try {
        const existingWallet = await tonService.getUserWallet(userId, network);
        return res.json({
          success: true,
          message: 'Wallet already exists',
          wallet: {
            address: existingWallet.wallet_address,
            version: existingWallet.wallet_version,
            publicKey: existingWallet.public_key
          }
        });
      } catch {
        // Wallet doesn't exist, create new one
      }

      const wallet = await tonService.createWallet({
        userId,
        network,
        version,
        saveMnemonic
      });

      res.json({
        success: true,
        message: 'Wallet created successfully',
        wallet: {
          address: wallet.address,
          version: wallet.version,
          publicKey: wallet.publicKey
        }
      });

    } catch (error) {
      console.error('Create wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create wallet'
      });
    }
  }
];

/**
 * Get user's wallet information
 */
export const getWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const network = (req.query.network as string) || 'testnet';

    const wallet = await tonService.getUserWallet(userId, network);
    const balances = await tonService.updateWalletBalance(userId, network);

    res.json({
      success: true,
      wallet: {
        address: wallet.wallet_address,
        version: wallet.wallet_version,
        balances: {
          ton: wallet.balance_ton,
          usdt: wallet.balance_usdt
        },
        lastSync: wallet.last_sync_at
      }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(404).json({
      success: false,
      error: 'Wallet not found'
    });
  }
};

/**
 * Send transaction
 */
export const sendTransaction = [
  validateRequest(sendTransactionSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { toAddress, amount, tokenType, message, network } = req.body;

      // Validate recipient address
      if (!tonService.isValidAddress(toAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid recipient address'
        });
      }

      // Check balance
      const wallet = await tonService.getUserWallet(userId, network);
      const balanceField = tokenType === 'TON' ? 'balance_ton' : 'balance_usdt';
      const balance = wallet[balanceField];

      if (balance < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance'
        });
      }

      // Send transaction
      const txHash = await tonService.sendTransaction(userId, {
        toAddress,
        amount,
        tokenType,
        message
      }, network);

      res.json({
        success: true,
        message: 'Transaction sent successfully',
        txHash
      });

    } catch (error) {
      console.error('Send transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send transaction'
      });
    }
  }
];

/**
 * Connect Telegram Wallet
 */
export const connectTelegramWallet = [
  validateRequest(connectTelegramWalletSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { walletAddress, signature } = req.body;

      const wallet = await tonService.connectTelegramWallet(userId, walletAddress, signature);

      // Update balance
      await tonService.updateWalletBalance(userId, 'mainnet');

      res.json({
        success: true,
        message: 'Telegram wallet connected successfully',
        wallet: {
          address: wallet.wallet_address,
          version: wallet.wallet_version
        }
      });

    } catch (error) {
      console.error('Connect Telegram wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect Telegram wallet'
      });
    }
  }
];

/**
 * Internal transfer between users
 */
export const internalTransfer = [
  validateRequest(internalTransferSchema),
  async (req: Request, res: Response) => {
    try {
      const fromUserId = req.user!.id;
      const { toUserId, amount, description } = req.body;

      // Check if recipient exists
      const recipientQuery = await req.db.query(
        'SELECT id, email FROM users WHERE id = $1',
        [toUserId]
      );

      if (!recipientQuery.rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Recipient not found'
        });
      }

      // Perform internal transfer
      const transfer = await tonService.internalTransfer(
        fromUserId,
        toUserId,
        amount,
        description
      );

      res.json({
        success: true,
        message: 'Internal transfer completed successfully',
        transfer: {
          id: transfer.id,
          amount: transfer.amount,
          toUserId: transfer.to_user_id,
          description: transfer.description,
          completedAt: transfer.completed_at
        }
      });

    } catch (error) {
      console.error('Internal transfer error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete internal transfer'
      });
    }
  }
];

/**
 * Get transaction history
 */
export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const network = (req.query.network as string) || 'testnet';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await tonService.getTransactionHistory(
      userId,
      network,
      limit,
      offset
    );

    // Also get internal transfers
    const internalQuery = `
      SELECT it.*, u.email as recipient_email
      FROM internal_transfers it
      LEFT JOIN users u ON (CASE
        WHEN it.from_user_id = $1 THEN it.to_user_id
        ELSE it.from_user_id
      END) = u.id
      WHERE it.from_user_id = $1 OR it.to_user_id = $1
      ORDER BY it.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const internalResult = await req.db.query(internalQuery, [userId, limit, offset]);

    res.json({
      success: true,
      data: {
        onChain: transactions,
        internal: internalResult.rows.map(tx => ({
          ...tx,
          type: tx.from_user_id === userId ? 'sent' : 'received'
        }))
      }
    });

  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history'
    });
  }
};

/**
 * Update wallet balance
 */
export const updateBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const network = (req.query.network as string) || 'testnet';

    const balances = await tonService.updateWalletBalance(userId, network);

    res.json({
      success: true,
      balances
    });

  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update balance'
    });
  }
};

/**
 * Get payment request for deposit
 */
export const createPaymentRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, description } = req.body;

    // Create payment request
    const query = `
      INSERT INTO payment_requests (user_id, amount, description, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
      RETURNING *
    `;

    const result = await req.db.query(query, [userId, amount, description]);

    // Get user's wallet address
    const wallet = await tonService.getUserWallet(userId, 'mainnet');

    res.json({
      success: true,
      paymentRequest: {
        id: result.rows[0].id,
        amount: result.rows[0].amount,
        description: result.rows[0].description,
        expiresAt: result.rows[0].expires_at,
        walletAddress: wallet.wallet_address
      }
    });

  } catch (error) {
    console.error('Create payment request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment request'
    });
  }
};

/**
 * Get TON network status
 */
export const getNetworkStatus = async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as string) || 'testnet';
    const { TonApiManager } = await import('../../services/ton/TonApiManager');

    const apiManager = new TonApiManager();
    const client = await apiManager.getClient(network);

    // Get masterchain info
    const masterchainInfo = await client.getMasterchainInfo();

    res.json({
      success: true,
      network,
      status: {
        lastBlock: masterchainInfo.last.seqno,
        lastLt: masterchainInfo.last.lt,
        stateRootHash: masterchainInfo.last.stateRootHash.toString(),
        now: masterchainInfo.now
      }
    });

  } catch (error) {
    console.error('Get network status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network status'
    });
  }
};

/**
 * Get user's balance history
 */
export const getBalanceHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const query = `
      SELECT *
      FROM balance_snapshots
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at ASC
    `;

    const result = await req.db.query(query, [userId]);

    res.json({
      success: true,
      history: result.rows
    });

  } catch (error) {
    console.error('Get balance history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance history'
    });
  }
};

// Validation schemas for new endpoints
const processPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['TON', 'USDT']),
  toAddress: z.string().optional(),
  toUserId: z.number().positive().optional(),
  description: z.string().optional(),
  isInternal: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

const getPaymentStatusSchema = z.object({
  paymentId: z.string().min(1)
});

/**
 * Process payment using PaymentProcessor
 */
export const processPayment = [
  validateRequest(processPaymentSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { amount, currency, toAddress, toUserId, description, isInternal, metadata } = req.body;

      const paymentRequest = {
        userId,
        amount,
        currency,
        toAddress: isInternal ? undefined : toAddress,
        toUserId: isInternal ? toUserId : undefined,
        description,
        isInternal,
        metadata
      };

      const result = await paymentProcessor.processPayment(paymentRequest);

      if (result.success) {
        res.json({
          success: true,
          message: 'Payment processed successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          data: result
        });
      }

    } catch (error) {
      console.error('Process payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process payment'
      });
    }
  }
];

/**
 * Get payment status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await paymentProcessor.getPaymentStatus(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
};

/**
 * Get payment history
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await paymentProcessor.getPaymentHistory(userId, limit, offset);

    res.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

/**
 * Batch process payments
 */
export const batchProcessPayments = [
  validateRequest(z.object({
    payments: z.array(processPaymentSchema)
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { payments } = req.body;

      // Add userId to each payment request
      const paymentRequests = payments.map((p: any) => ({
        ...p,
        userId
      }));

      const results = await paymentProcessor.batchProcessPayments(paymentRequests);

      res.json({
        success: true,
        message: 'Batch payments processed',
        results
      });

    } catch (error) {
      console.error('Batch process payments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process batch payments'
      });
    }
  }
];

/**
 * Monitor transaction status
 */
export const monitorTransaction = async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const network = (req.query.network as string) || 'testnet';

    const status = await tonService.monitorTransaction(txHash, network);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Monitor transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to monitor transaction'
    });
  }
};

/**
 * Get payment statistics
 */
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const statsQuery = `
      SELECT
        COUNT(*) as total_payments,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_sent,
        COALESCE(SUM(CASE WHEN status = 'completed' AND currency = 'TON' THEN amount ELSE 0 END), 0) as total_ton,
        COALESCE(SUM(CASE WHEN status = 'completed' AND currency = 'USDT' THEN amount ELSE 0 END), 0) as total_usdt,
        COALESCE(SUM(gas_fee + service_fee), 0) as total_fees,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
      FROM payments
      WHERE user_id = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await req.db.query(statsQuery, [userId]);
    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        totalPayments: parseInt(stats.total_payments),
        totalSent: parseFloat(stats.total_sent),
        totalTon: parseFloat(stats.total_ton),
        totalUsdt: parseFloat(stats.total_usdt),
        totalFees: parseFloat(stats.total_fees),
        completedPayments: parseInt(stats.completed_payments),
        pendingPayments: parseInt(stats.pending_payments),
        failedPayments: parseInt(stats.failed_payments),
        successRate: stats.total_payments > 0
          ? (stats.completed_payments / stats.total_payments * 100).toFixed(2) + '%'
          : '0%'
      }
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment statistics'
    });
  }
};