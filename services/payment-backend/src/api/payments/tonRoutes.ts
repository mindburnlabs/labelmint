import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createWallet,
  getWallet,
  sendTransaction,
  connectTelegramWallet,
  internalTransfer,
  getTransactionHistory,
  updateBalance,
  createPaymentRequest,
  getNetworkStatus,
  getBalanceHistory
} from './tonController';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Wallet management
router.post('/wallet/create', createWallet);
router.get('/wallet', getWallet);
router.post('/wallet/telegram/connect', connectTelegramWallet);

// Transactions
router.post('/transaction/send', sendTransaction);
router.post('/transfer/internal', internalTransfer);
router.get('/transactions', getTransactionHistory);

// Balance operations
router.post('/balance/update', updateBalance);
router.get('/balance/history', getBalanceHistory);

// Payment requests
router.post('/payment-request', createPaymentRequest);

// Network information
router.get('/network/status', getNetworkStatus);

export default router;