import { Router } from 'express';
import {
  // Multi-chain endpoints
  getSupportedChains,
  getUserWallets,
  addOrUpdateWallet,
  getChainBalance,
  convertToUSDT,
  getConversionHistory,
  getTransactionStatus,

  // Scheduled payments
  createScheduledPayment,
  getScheduledPayments,
  updateScheduledPayment,
  pauseScheduledPayment,
  resumeScheduledPayment,
  cancelScheduledPayment,
  getPaymentStats,

  // Referral system
  createReferral,
  getReferralStats,
  getReferredUsers,
  getUserPaymentSplits,

  // Escrow system
  createEscrow,
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  createDispute,
  getUserEscrows,

  // Staking system
  getStakingPools,
  createStake,
  getUserStakes,
  unstake,
  claimRewards,
  getRewardHistory,
  getStakingStats,

  // Analytics
  getPaymentAnalytics,

  // Admin endpoints
  resolveDispute,
  getGlobalStakingStats
} from './advancedPaymentsController';

const router = Router();

// Multi-chain routes
router.get('/chains', getSupportedChains);
router.get('/wallets', getUserWallets);
router.post('/wallets', addOrUpdateWallet);
router.get('/balance/:chain', getChainBalance);
router.post('/convert', convertToUSDT);
router.get('/conversions', getConversionHistory);
router.get('/transaction/:txHash/status', getTransactionStatus);

// Scheduled payments routes
router.post('/scheduled', createScheduledPayment);
router.get('/scheduled', getScheduledPayments);
router.put('/scheduled/:id', updateScheduledPayment);
router.post('/scheduled/:id/pause', pauseScheduledPayment);
router.post('/scheduled/:id/resume', resumeScheduledPayment);
router.post('/scheduled/:id/cancel', cancelScheduledPayment);
router.get('/scheduled/stats', getPaymentStats);

// Referral system routes
router.post('/referrals', createReferral);
router.get('/referrals/stats', getReferralStats);
router.get('/referrals/referred', getReferredUsers);
router.get('/splits', getUserPaymentSplits);

// Escrow system routes
router.post('/escrow', createEscrow);
router.post('/escrow/:id/fund', fundEscrow);
router.post('/escrow/:id/release', releaseEscrow);
router.post('/escrow/:id/refund', refundEscrow);
router.post('/escrow/:id/dispute', createDispute);
router.get('/escrow', getUserEscrows);

// Staking system routes
router.get('/staking/pools', getStakingPools);
router.post('/staking', createStake);
router.get('/staking', getUserStakes);
router.post('/staking/:id/unstake', unstake);
router.post('/staking/:id/claim', claimRewards);
router.get('/staking/rewards', getRewardHistory);
router.get('/staking/stats', getStakingStats);

// Analytics routes
router.get('/analytics', getPaymentAnalytics);

// Admin routes (require admin middleware)
router.post('/escrow/:id/resolve', resolveDispute);
router.get('/staking/global/stats', getGlobalStakingStats);

export default router;