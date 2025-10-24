import { Router } from 'express';
import { micropaymentSystem } from '../services/micropaymentSystem.js';
import { authenticateWorker } from '../middleware/auth.js';

const router = Router();

// Get worker wallet data
router.get('/workers/:workerId/wallet', async (req, res) => {
  try {
    const workerId = parseInt(req.params.workerId);

    if (!workerId) {
      return res.status(400).json({ success: false, error: 'Invalid worker ID' });
    }

    const walletData = await micropaymentSystem.getWorkerWalletData(workerId);

    res.json({
      success: true,
      ...walletData
    });
  } catch (error: any) {
    console.error('Failed to get wallet data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get worker transactions
router.get('/workers/:workerId/transactions', async (req, res) => {
  try {
    const workerId = parseInt(req.params.workerId);
    const limit = parseInt(req.query.limit as string) || 50;

    if (!workerId) {
      return res.status(400).json({ success: false, error: 'Invalid worker ID' });
    }

    const transactions = await micropaymentSystem.getWorkerTransactions(workerId, limit);

    res.json({
      success: true,
      transactions
    });
  } catch (error: any) {
    console.error('Failed to get transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process USDT withdrawal
router.post('/withdraw/usdt', authenticateWorker, async (req, res) => {
  try {
    const { amount, address, workerId } = req.body;

    if (!amount || !address || !workerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, address, workerId'
      });
    }

    if (req.user?.id !== workerId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await micropaymentSystem.processUSDTWithdrawal({
      workerId: parseInt(workerId),
      amount: parseFloat(amount),
      address,
      method: 'usdt'
    });

    res.json(result);
  } catch (error: any) {
    console.error('Withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process Telegram withdrawal
router.post('/withdraw/telegram', authenticateWorker, async (req, res) => {
  try {
    const { amount, workerId } = req.body;

    if (!amount || !workerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, workerId'
      });
    }

    if (req.user?.id !== workerId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await micropaymentSystem.processUSDTWithdrawal({
      workerId: parseInt(workerId),
      amount: parseFloat(amount),
      address: '', // Will use Telegram wallet
      method: 'telegram'
    });

    res.json(result);
  } catch (error: any) {
    console.error('Telegram withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process batch withdrawals (cron job)
router.post('/batch-withdrawals', async (req, res) => {
  try {
    // Verify this is a cron job request (add authentication)
    const cronKey = req.headers['x-cron-key'];
    if (cronKey !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await micropaymentSystem.processBatchWithdrawals();

    res.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} withdrawals totaling $${result.totalAmount.toFixed(2)}`
    });
  } catch (error: any) {
    console.error('Batch withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate client payment link
router.post('/client/payment', async (req, res) => {
  try {
    const { projectId, amountUSDT, description, clientTelegramId } = req.body;

    if (!projectId || !amountUSDT || !clientTelegramId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, amountUSDT, clientTelegramId'
      });
    }

    const result = await micropaymentSystem.generateClientPaymentLink({
      projectId,
      amountUSDT: parseFloat(amountUSDT),
      description,
      clientTelegramId: parseInt(clientTelegramId)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Failed to generate payment link:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify payment completion (webhook from TON)
router.post('/verify-payment', async (req, res) => {
  try {
    const { paymentId, transactionHash } = req.body;

    if (!paymentId || !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing paymentId or transactionHash'
      });
    }

    const success = await micropaymentSystem.verifyPayment(paymentId, transactionHash);

    res.json({
      success,
      message: success ? 'Payment verified' : 'Payment verification failed'
    });
  } catch (error: any) {
    console.error('Payment verification failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process worker payment for completed task
router.post('/worker/payment', async (req, res) => {
  try {
    const { workerId, taskId, amount, bonusAmount } = req.body;

    if (!workerId || !taskId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workerId, taskId, amount'
      });
    }

    const result = await micropaymentSystem.processWorkerPayment({
      workerId: parseInt(workerId),
      taskId,
      amount: parseFloat(amount),
      bonusAmount: bonusAmount ? parseFloat(bonusAmount) : undefined
    });

    res.json(result);
  } catch (error: any) {
    console.error('Worker payment failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;