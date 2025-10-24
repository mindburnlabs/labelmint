import { Router } from 'express';
import { paymentChannelManager } from '../services/paymentChannel.js';
import { authenticateWorker } from '../middleware/auth.js';
import { query } from '../database/connection.js';

const router = Router();

// Create payment channel for worker
router.post('/create', authenticateWorker, async (req, res) => {
  try {
    const { initialDeposit = 10, workerAddress } = req.body;
    const workerId = req.user?.id;

    if (!workerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check if worker already has active channel
    const existingChannel = await paymentChannelManager.getWorkerChannel(workerId);
    if (existingChannel) {
      return res.json({
        success: true,
        channelId: existingChannel.channelId,
        contractAddress: existingChannel.platformAddress.toString(),
        alreadyExists: true
      });
    }

    // Create new channel
    const result = await paymentChannelManager.createChannel(
      workerAddress || req.user?.tonWallet,
      initialDeposit
    );

    if (result.success) {
      // Update worker preference
      await query(
        'UPDATE workers SET prefers_channel = true WHERE telegram_id = $1',
        [workerId]
      );

      res.json({
        success: true,
        channelId: result.channelId,
        contractAddress: result.contractAddress.toString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to create payment channel'
      });
    }
  } catch (error: any) {
    console.error('Channel creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get worker's channel info
router.get('/worker/:workerId', async (req, res) => {
  try {
    const workerId = parseInt(req.params.workerId);

    const channel = await paymentChannelManager.getWorkerChannel(workerId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'No active channel found'
      });
    }

    // Get channel statistics
    const stats = await paymentChannelManager.getChannelStats(channel.channelId);

    res.json({
      success: true,
      channel: {
        channelId: channel.channelId,
        contractAddress: channel.contractAddress.toString(),
        status: channel.status,
        balance: channel.balance,
        autoSettle: channel.autoSettle,
        settleInterval: channel.settleInterval,
        pendingTransactions: stats.pendingCount
      },
      stats
    });
  } catch (error: any) {
    console.error('Failed to get channel info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process off-chain payment (instant, zero fee)
router.post('/pay', authenticateWorker, async (req, res) => {
  try {
    const { toAddress, amount, taskId, metadata } = req.body;
    const workerId = req.user?.id;

    if (!workerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get worker's active channel
    const channel = await paymentChannelManager.getWorkerChannel(workerId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'No active payment channel found'
      });
    }

    // Process off-chain payment
    const result = await paymentChannelManager.processOffchainPayment(
      channel.channelId,
      channel.workerAddress,
      toAddress,
      amount,
      taskId,
      { ...metadata, workerId }
    );

    res.json(result);
  } catch (error: any) {
    console.error('Off-chain payment failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Instant withdrawal via channel
router.post('/withdraw', authenticateWorker, async (req, res) => {
  try {
    const { amount, destinationAddress } = req.body;
    const workerId = req.user?.id;

    if (!workerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get worker's active channel
    const channel = await paymentChannelManager.getWorkerChannel(workerId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'No active payment channel found'
      });
    }

    // Process instant withdrawal
    const result = await paymentChannelManager.workerInstantWithdrawal(
      channel.channelId,
      workerId,
      amount,
      destinationAddress
    );

    res.json(result);
  } catch (error: any) {
    console.error('Instant withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Settle channel (manually trigger)
router.post('/settle/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const cronKey = req.headers['x-cron-key'];

    // Verify it's a cron job or admin request
    if (cronKey !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await paymentChannelManager.settleChannel(channelId);

    res.json(result);
  } catch (error: any) {
    console.error('Channel settlement failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Auto-settle all channels
router.post('/auto-settle', async (req, res) => {
  try {
    const cronKey = req.headers['x-cron-key'];

    // Verify it's a cron job
    if (cronKey !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await paymentChannelManager.autoSettleAll();

    res.json({
      success: true,
      message: `Settled ${result.totalSettled} channels totaling $${result.totalAmount.toFixed(2)}`,
      ...result
    });
  } catch (error: any) {
    console.error('Auto-settlement failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get channel transactions
router.get('/transactions/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await query(
      `SELECT *
       FROM offchain_transactions
       WHERE channel_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [channelId, limit]
    );

    res.json({
      success: true,
      transactions: result.rows
    });
  } catch (error: any) {
    console.error('Failed to get transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all active channels
router.get('/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM channel_summary
       WHERE status = 'active'
       ORDER BY last_update DESC`
    );

    res.json({
      success: true,
      channels: result.rows
    });
  } catch (error: any) {
    console.error('Failed to get active channels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update channel settings
router.put('/settings/:channelId', authenticateWorker, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { autoSettle, settleInterval, settleThreshold } = req.body;
    const workerId = req.user?.id;

    if (!workerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Verify channel ownership
    const channel = await paymentChannelManager.getWorkerChannel(workerId);
    if (!channel || channel.channelId !== channelId) {
      return res.status(403).json({
        success: false,
        error: 'Channel not found or access denied'
      });
    }

    // Update settings
    await query(
      `UPDATE payment_channels
       SET auto_settle = $1,
           settle_interval = $2,
           settle_threshold = $3
       WHERE channel_id = $4`,
      [autoSettle, settleInterval, settleThreshold, channelId]
    );

    res.json({
      success: true,
      message: 'Channel settings updated'
    });
  } catch (error: any) {
    console.error('Failed to update channel settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create channels for frequent workers automatically
router.post('/auto-create', async (req, res) => {
  try {
    const cronKey = req.headers['x-cron-key'];

    // Verify it's a cron job
    if (cronKey !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await query(
      'SELECT create_worker_channel(telegram_id) as channel_id, telegram_id, ton_wallet ' +
      'FROM workers WHERE ton_wallet IS NOT NULL ' +
      'AND telegram_id NOT IN (SELECT worker_id FROM payment_channels WHERE status = \'active\') ' +
      'AND (SELECT COUNT(*) FROM worker_transactions WHERE worker_id = workers.telegram_id AND created_at >= NOW() - INTERVAL \'7 days\') >= 50'
    );

    res.json({
      success: true,
      created: result.rows.length,
      channels: result.rows
    });
  } catch (error: any) {
    console.error('Auto channel creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;