import { Router } from 'express';
import * as tonController from './tonController';

const router = Router();

// TON Wallet endpoints
router.post('/wallet/create', tonController.createWallet);
router.get('/wallet', tonController.getWallet);
router.post('/wallet/connect/telegram', tonController.connectTelegramWallet);
router.put('/wallet/balance', tonController.updateBalance);
router.get('/wallet/balance/history', tonController.getBalanceHistory);

// Transaction endpoints
router.post('/transaction/send', tonController.sendTransaction);
router.get('/transactions', tonController.getTransactionHistory);
router.get('/transaction/:txHash/monitor', tonController.monitorTransaction);

// Internal transfer endpoints
router.post('/transfer/internal', tonController.internalTransfer);

// New PaymentProcessor endpoints
router.post('/process', tonController.processPayment);
router.get('/status/:paymentId', tonController.getPaymentStatus);
router.get('/history', tonController.getPaymentHistory);
router.post('/batch', tonController.batchProcessPayments);
router.get('/stats', tonController.getPaymentStats);

// Payment request endpoints
router.post('/request/create', tonController.createPaymentRequest);

// Network status
router.get('/network/status', tonController.getNetworkStatus);

export default router;