import type { Transaction } from '@shared/types/database';

// Pre-defined test transactions for consistent testing
export const testTransactions: Record<string, Transaction> = {
  depositTON: {
    id: 'tx-deposit-001',
    userId: 'user-worker-001',
    type: 'deposit',
    status: 'completed',
    amount: 100.0,
    fee: 0.5,
    method: 'ton',
    fromAddress: 'EQSenderAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    toAddress: 'EQBkZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pY',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    blockNumber: 12345678,
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    gasUsed: 21000,
    gasPrice: 1000000000,
    confirmations: 100,
    metadata: {
      description: 'Initial deposit to start working',
      category: 'deposit',
      tags: ['first-deposit'],
    },
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:05:00Z'),
    processedAt: new Date('2024-01-10T10:02:00Z'),
    completedAt: new Date('2024-01-10T10:05:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  depositUSDT: {
    id: 'tx-deposit-002',
    userId: 'user-worker-002',
    type: 'deposit',
    status: 'completed',
    amount: 50.0,
    fee: 1.0,
    method: 'usdt',
    fromAddress: '0xSenderAddress12345678901234567890123456789012345678',
    toAddress: '0xReceiverAddress12345678901234567890123456789012345678',
    txHash: '0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef12',
    blockNumber: 12345679,
    blockHash: '0xbcdef12345678901bcdef12345678901bcdef12345678901bcdef12345678901',
    gasUsed: 50000,
    gasPrice: 2000000000,
    confirmations: 50,
    metadata: {
      description: 'USDT deposit for task payments',
      category: 'deposit',
      tags: ['usdt'],
    },
    createdAt: new Date('2024-01-11T14:00:00Z'),
    updatedAt: new Date('2024-01-11T14:06:00Z'),
    processedAt: new Date('2024-01-11T14:03:00Z'),
    completedAt: new Date('2024-01-11T14:06:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  withdrawalTON: {
    id: 'tx-withdraw-001',
    userId: 'user-worker-001',
    type: 'withdraw',
    status: 'completed',
    amount: 25.0,
    fee: 0.8,
    method: 'ton',
    fromAddress: 'EQBkZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pY',
    toAddress: 'EQExternalAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    txHash: '0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12',
    blockNumber: 12345680,
    blockHash: '0xcdef123456789012cdef123456789012cdef123456789012cdef123456789012',
    gasUsed: 25000,
    gasPrice: 1200000000,
    confirmations: 25,
    metadata: {
      description: 'Withdrawal to personal wallet',
      category: 'withdrawal',
      tags: ['regular-withdrawal'],
    },
    createdAt: new Date('2024-01-12T16:00:00Z'),
    updatedAt: new Date('2024-01-12T16:08:00Z'),
    processedAt: new Date('2024-01-12T16:02:00Z'),
    completedAt: new Date('2024-01-12T16:08:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  pendingWithdrawal: {
    id: 'tx-withdraw-002',
    userId: 'user-worker-002',
    type: 'withdraw',
    status: 'pending',
    amount: 15.0,
    fee: 0.5,
    method: 'usdt',
    fromAddress: '0xReceiverAddress12345678901234567890123456789012345678',
    toAddress: '0xExternalAddress12345678901234567890123456789012345678',
    txHash: null,
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      description: 'Pending withdrawal request',
      category: 'withdrawal',
      tags: ['pending'],
    },
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z'),
    processedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
  },

  taskPayment: {
    id: 'tx-payment-001',
    userId: 'user-requester-001',
    type: 'payment',
    status: 'completed',
    amount: 1.5,
    fee: 0,
    method: 'internal',
    fromAddress: 'user-requester-001',
    toAddress: 'user-worker-001',
    txHash: 'internal-001',
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      taskId: 'task-image-001',
      projectId: 'project-001',
      description: 'Payment for completed image classification task',
      category: 'task_payment',
      tags: ['automated'],
    },
    createdAt: new Date('2024-01-14T15:00:00Z'),
    updatedAt: new Date('2024-01-14T15:01:00Z'),
    processedAt: new Date('2024-01-14T15:00:30Z'),
    completedAt: new Date('2024-01-14T15:01:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  batchPayments: {
    id: 'tx-batch-001',
    userId: 'user-requester-001',
    type: 'payment',
    status: 'completed',
    amount: 10.0,
    fee: 0,
    method: 'internal',
    fromAddress: 'user-requester-001',
    toAddress: 'multiple-workers',
    txHash: 'internal-batch-001',
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      projectId: 'project-002',
      description: 'Batch payment for 20 completed tasks',
      category: 'task_payment',
      tags: ['batch', 'automated'],
      taskIds: ['task-001', 'task-002', 'task-003'],
    },
    createdAt: new Date('2024-01-14T18:00:00Z'),
    updatedAt: new Date('2024-01-14T18:02:00Z'),
    processedAt: new Date('2024-01-14T18:00:30Z'),
    completedAt: new Date('2024-01-14T18:02:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  refund: {
    id: 'tx-refund-001',
    userId: 'user-worker-003',
    type: 'refund',
    status: 'completed',
    amount: 0.5,
    fee: 0,
    method: 'internal',
    fromAddress: 'system',
    toAddress: 'user-worker-003',
    txHash: 'refund-001',
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      taskId: 'task-cancelled-001',
      description: 'Refund for cancelled task',
      category: 'refund',
      tags: ['automatic', 'task-cancelled'],
    },
    createdAt: new Date('2024-01-13T11:00:00Z'),
    updatedAt: new Date('2024-01-13T11:01:00Z'),
    processedAt: new Date('2024-01-13T11:00:30Z'),
    completedAt: new Date('2024-01-13T11:01:00Z'),
    failedAt: null,
    cancelledAt: null,
  },

  rewardBonus: {
    id: 'tx-reward-001',
    userId: 'user-worker-001',
    type: 'reward',
    status: 'completed',
    amount: 5.0,
    fee: 0,
    method: 'internal',
    fromAddress: 'system',
    toAddress: 'user-worker-001',
    txHash: 'reward-001',
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      description: 'Weekly accuracy bonus - 98% accuracy rate',
      category: 'bonus',
      tags: ['weekly-bonus', 'high-accuracy'],
      accuracy: 0.98,
      weekNumber: 2,
      year: 2024,
    },
    createdAt: new Date('2024-01-14T20:00:00Z'),
    updatedAt: new Date('2024-01-14T20:00:30Z'),
    processedAt: new Date('2024-01-14T20:00:15Z'),
    completedAt: new Date('2024-01-14T20:00:30Z'),
    failedAt: null,
    cancelledAt: null,
  },

  failedTransaction: {
    id: 'tx-failed-001',
    userId: 'user-worker-002',
    type: 'withdraw',
    status: 'failed',
    amount: 100.0,
    fee: 0,
    method: 'ton',
    fromAddress: 'EQClZJNrrT2s3x4Y0DqL3VpA4qV1J8B7wF6tH0kY3nM5rS9pZ',
    toAddress: 'EQInvalidAddress',
    txHash: null,
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      description: 'Failed withdrawal - invalid address',
      category: 'error',
      error: 'Invalid recipient address format',
      errorCode: 'INVALID_ADDRESS',
    },
    createdAt: new Date('2024-01-15T08:00:00Z'),
    updatedAt: new Date('2024-01-15T08:05:00Z'),
    processedAt: null,
    completedAt: null,
    failedAt: new Date('2024-01-15T08:05:00Z'),
    cancelledAt: null,
  },

  honeypotPenalty: {
    id: 'tx-penalty-001',
    userId: 'user-worker-003',
    type: 'payment',
    status: 'completed',
    amount: -1.0,
    fee: 0,
    method: 'internal',
    fromAddress: 'user-worker-003',
    toAddress: 'system',
    txHash: 'penalty-001',
    blockNumber: null,
    blockHash: null,
    gasUsed: null,
    gasPrice: null,
    confirmations: null,
    metadata: {
      taskId: 'task-honeypot-001',
      description: 'Penalty for failing honeypot task',
      category: 'penalty',
      tags: ['honeypot', 'penalty'],
      reason: 'Failed honeypot verification',
    },
    createdAt: new Date('2024-01-15T12:00:00Z'),
    updatedAt: new Date('2024-01-15T12:01:00Z'),
    processedAt: new Date('2024-01-15T12:00:30Z'),
    completedAt: new Date('2024-01-15T12:01:00Z'),
    failedAt: null,
    cancelledAt: null,
  },
};

// Helper to get transactions by status
export const getTransactionsByStatus = (status: Transaction['status']): Transaction[] => {
  return Object.values(testTransactions).filter(tx => tx.status === status);
};

// Helper to get transactions by type
export const getTransactionsByType = (type: Transaction['type']): Transaction[] => {
  return Object.values(testTransactions).filter(tx => tx.type === type);
};

// Helper to get transactions by user
export const getTransactionsByUser = (userId: string): Transaction[] => {
  return Object.values(testTransactions).filter(tx => tx.userId === userId);
};

// Helper to get completed deposits
export const getCompletedDeposits = (): Transaction[] => {
  return Object.values(testTransactions).filter(
    tx => tx.type === 'deposit' && tx.status === 'completed'
  );
};

// Helper to get pending withdrawals
export const getPendingWithdrawals = (): Transaction[] => {
  return Object.values(testTransactions).filter(
    tx => tx.type === 'withdraw' && tx.status === 'pending'
  );
};

// Helper to calculate total balance for user
export const calculateUserBalance = (userId: string): number => {
  const transactions = getTransactionsByUser(userId);
  return transactions.reduce((balance, tx) => {
    if (tx.status !== 'completed') return balance;

    switch (tx.type) {
      case 'deposit':
      case 'reward':
        return balance + tx.amount;
      case 'withdraw':
      case 'payment':
      case 'penalty':
        return balance - tx.amount;
      case 'refund':
        return balance + tx.amount;
      default:
        return balance;
    }
  }, 0);
};