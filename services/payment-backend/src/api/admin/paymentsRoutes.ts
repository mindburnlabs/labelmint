import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getPaymentDashboard,
  getPendingTransactions,
  getPayoutManagement,
  processSelectedPayouts,
  getUserBalanceDetails,
  getFeeConfiguration,
  updateFeeConfiguration,
  exportPaymentReport,
  getSystemWallets,
  adjustBalance
} from './paymentsController';

const router = Router();

// Apply authentication
router.use(authenticateToken);

// Dashboard
router.get('/dashboard', getPaymentDashboard);

// Transaction management
router.get('/transactions/pending', getPendingTransactions);

// Payout management
router.get('/payouts', getPayoutManagement);
router.post('/payouts/process', processSelectedPayouts);

// User management
router.get('/users/:userId/balance', getUserBalanceDetails);

// Fee configuration
router.get('/fees', getFeeConfiguration);
router.put('/fees', updateFeeConfiguration);

// System wallets
router.get('/wallets', getSystemWallets);

// Balance adjustment (admin only)
router.post('/balance/adjust', adjustBalance);

// Reports
router.get('/export', exportPaymentReport);

export default router;