// Payment Processing Service Unit Tests
// ====================================
// Comprehensive tests for payment processing logic

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PaymentProcessingService } from '@payment-backend/src/services/PaymentProcessingService'
import { TonWalletStrategy } from '@payment-backend/src/services/payment/strategies/TonWalletStrategy'
import { UsdtStrategy } from '@payment-backend/src/services/payment/strategies/UsdtStrategy'
import { createMockTransaction, createMockUser, createMockTask } from '@test/factories'

describe('PaymentProcessingService', () => {
  let paymentService: PaymentProcessingService
  let mockDatabase: any
  let mockBlockchain: any

  beforeEach(() => {
    mockDatabase = createMockDatabase()
    mockBlockchain = {
      sendTransaction: vi.fn().mockResolvedValue({ hash: 'test-tx-hash' }),
      getTransactionStatus: vi.fn().mockResolvedValue('completed'),
      getBalance: vi.fn().mockResolvedValue('1000.5'),
      validateAddress: vi.fn().mockResolvedValue(true),
    }

    paymentService = new PaymentProcessingService({
      database: mockDatabase,
      blockchain: mockBlockchain,
      strategies: [
        new TonWalletStrategy(mockBlockchain),
        new UsdtStrategy(mockBlockchain),
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Task Reward Payment', () => {
    it('should successfully process TON payment for completed task', async () => {
      const user = createMockUser({ tonWallet: 'EQD123...' })
      const task = createMockTask({ reward: 10, status: 'completed' })
      const transaction = createMockTransaction({
        userId: user.id,
        taskId: task.id,
        amount: 10,
        currency: 'TON',
      })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.transaction.create.mockResolvedValue(transaction)

      const result = await paymentService.processTaskReward(task.id, user.id, 'TON')

      expect(result.success).toBe(true)
      expect(result.transaction).toBeDefined()
      expect(result.transaction.amount).toBe(10)
      expect(result.transaction.currency).toBe('TON')
      expect(mockBlockchain.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.tonWallet,
          amount: expect.any(String),
        })
      )
    })

    it('should successfully process USDT payment for completed task', async () => {
      const user = createMockUser({ tonWallet: 'EQD123...' })
      const task = createMockTask({ reward: 10, status: 'completed' })
      const transaction = createMockTransaction({
        userId: user.id,
        taskId: task.id,
        amount: 10,
        currency: 'USDT',
      })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.transaction.create.mockResolvedValue(transaction)

      const result = await paymentService.processTaskReward(task.id, user.id, 'USDT')

      expect(result.success).toBe(true)
      expect(result.transaction.currency).toBe('USDT')
      expect(mockBlockchain.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.tonWallet,
          tokenContract: expect.any(String), // USDT contract
        })
      )
    })

    it('should reject payment for non-completed task', async () => {
      const user = createMockUser()
      const task = createMockTask({ status: 'pending' })

      mockDatabase.task.findUnique.mockResolvedValue(task)

      const result = await paymentService.processTaskReward(task.id, user.id, 'TON')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Task not completed')
      expect(mockBlockchain.sendTransaction).not.toHaveBeenCalled()
    })

    it('should reject payment for user without wallet', async () => {
      const user = createMockUser({ tonWallet: null })
      const task = createMockTask({ status: 'completed' })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)

      const result = await paymentService.processTaskReward(task.id, user.id, 'TON')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No wallet configured')
    })

    it('should handle insufficient funds gracefully', async () => {
      const user = createMockUser()
      const task = createMockTask({ reward: 1000, status: 'completed' })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockBlockchain.sendTransaction.mockRejectedValue(new Error('Insufficient funds'))

      const result = await paymentService.processTaskReward(task.id, user.id, 'TON')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient funds')
    })
  })

  describe('Withdrawal Processing', () => {
    it('should process successful withdrawal', async () => {
      const user = createMockUser({ tonWallet: 'EQD123...' })
      const transaction = createMockTransaction({
        userId: user.id,
        amount: 50,
        currency: 'TON',
        type: 'withdrawal',
      })

      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.wallet.findFirst.mockResolvedValue({ balance: 100 })
      mockDatabase.transaction.create.mockResolvedValue(transaction)

      const result = await paymentService.processWithdrawal(user.id, 50, 'TON', user.tonWallet)

      expect(result.success).toBe(true)
      expect(result.transaction.type).toBe('withdrawal')
      expect(result.transaction.amount).toBe(50)
      expect(mockBlockchain.sendTransaction).toHaveBeenCalled()
    })

    it('should reject withdrawal exceeding balance', async () => {
      const user = createMockUser({ tonWallet: 'EQD123...' })

      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.wallet.findFirst.mockResolvedValue({ balance: 30 })

      const result = await paymentService.processWithdrawal(user.id, 50, 'TON', user.tonWallet)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient balance')
      expect(mockBlockchain.sendTransaction).not.toHaveBeenCalled()
    })

    it('should validate withdrawal address', async () => {
      const user = createMockUser()
      const invalidAddress = 'INVALID_ADDRESS'

      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockBlockchain.validateAddress.mockResolvedValue(false)

      const result = await paymentService.processWithdrawal(user.id, 50, 'TON', invalidAddress)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid address')
    })
  })

  describe('Transaction Status Updates', () => {
    it('should update transaction status to completed', async () => {
      const transaction = createMockTransaction({ status: 'pending' })

      mockDatabase.transaction.findUnique.mockResolvedValue(transaction)
      mockBlockchain.getTransactionStatus.mockResolvedValue('completed')
      mockDatabase.transaction.update.mockResolvedValue({ ...transaction, status: 'completed' })

      const result = await paymentService.updateTransactionStatus(transaction.id)

      expect(result.status).toBe('completed')
      expect(mockDatabase.transaction.update).toHaveBeenCalledWith({
        where: { id: transaction.id },
        data: { status: 'completed' },
      })
    })

    it('should handle transaction failures', async () => {
      const transaction = createMockTransaction({ status: 'pending' })

      mockDatabase.transaction.findUnique.mockResolvedValue(transaction)
      mockBlockchain.getTransactionStatus.mockResolvedValue('failed')
      mockDatabase.transaction.update.mockResolvedValue({ ...transaction, status: 'failed' })

      const result = await paymentService.updateTransactionStatus(transaction.id)

      expect(result.status).toBe('failed')
    })
  })

  describe('Transaction History', () => {
    it('should retrieve user transaction history', async () => {
      const user = createMockUser()
      const transactions = [
        createMockTransaction({ userId: user.id, amount: 10 }),
        createMockTransaction({ userId: user.id, amount: 20 }),
        createMockTransaction({ userId: user.id, amount: -5 }),
      ]

      mockDatabase.transaction.findMany.mockResolvedValue(transactions)

      const result = await paymentService.getTransactionHistory(user.id, {
        page: 1,
        limit: 10,
      })

      expect(result.transactions).toHaveLength(3)
      expect(result.total).toBe(3)
      expect(result.page).toBe(1)
      expect(mockDatabase.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      })
    })

    it('should filter transactions by status', async () => {
      const user = createMockUser()
      const completedTransactions = [
        createMockTransaction({ userId: user.id, status: 'completed' }),
      ]

      mockDatabase.transaction.findMany.mockResolvedValue(completedTransactions)

      const result = await paymentService.getTransactionHistory(user.id, {
        status: 'completed',
        page: 1,
        limit: 10,
      })

      expect(result.transactions).toHaveLength(1)
      expect(mockDatabase.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.id, status: 'completed' },
        })
      )
    })
  })

  describe('Balance Management', () => {
    it('should get user balance across currencies', async () => {
      const user = createMockUser()
      const wallets = [
        { currency: 'TON', balance: 100.5 },
        { currency: 'USDT', balance: 500.25 },
      ]

      mockDatabase.wallet.findMany.mockResolvedValue(wallets)

      const balance = await paymentService.getUserBalance(user.id)

      expect(balance.TON).toBe(100.5)
      expect(balance.USDT).toBe(500.25)
    })

    it('should handle zero balance correctly', async () => {
      const user = createMockUser()
      mockDatabase.wallet.findMany.mockResolvedValue([])

      const balance = await paymentService.getUserBalance(user.id)

      expect(balance.TON).toBe(0)
      expect(balance.USDT).toBe(0)
    })
  })

  describe('Payment Strategy Selection', () => {
    it('should select TON strategy for TON payments', async () => {
      const strategy = paymentService.getStrategy('TON')
      expect(strategy).toBeInstanceOf(TonWalletStrategy)
    })

    it('should select USDT strategy for USDT payments', async () => {
      const strategy = paymentService.getStrategy('USDT')
      expect(strategy).toBeInstanceOf(UsdtStrategy)
    })

    it('should throw error for unsupported currency', () => {
      expect(() => paymentService.getStrategy('INVALID')).toThrow('Unsupported currency')
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDatabase.task.findUnique.mockRejectedValue(new Error('Database connection failed'))

      await expect(
        paymentService.processTaskReward('task-id', 'user-id', 'TON')
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle blockchain network errors', async () => {
      const user = createMockUser()
      const task = createMockTask({ status: 'completed' })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockBlockchain.sendTransaction.mockRejectedValue(new Error('Network timeout'))

      const result = await paymentService.processTaskReward(task.id, user.id, 'TON')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network timeout')
    })

    it('should validate input parameters', async () => {
      await expect(
        paymentService.processTaskReward('', 'user-id', 'TON')
      ).rejects.toThrow('Invalid task ID')

      await expect(
        paymentService.processTaskReward('task-id', '', 'TON')
      ).rejects.toThrow('Invalid user ID')

      await expect(
        paymentService.processTaskReward('task-id', 'user-id', '')
      ).rejects.toThrow('Invalid currency')
    })
  })

  describe('Payment Validation', () => {
    it('should validate minimum payment amount', async () => {
      const result = await paymentService.validatePayment({
        amount: 0.001, // Below minimum
        currency: 'TON',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Amount below minimum threshold')
    })

    it('should validate maximum payment amount', async () => {
      const result = await paymentService.validatePayment({
        amount: 100000, // Above maximum
        currency: 'TON',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Amount exceeds maximum limit')
    })

    it('should validate supported currencies', async () => {
      const result = await paymentService.validatePayment({
        amount: 10,
        currency: 'INVALID',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unsupported currency')
    })
  })

  describe('Concurrent Payment Processing', () => {
    it('should handle concurrent payment requests safely', async () => {
      const user = createMockUser()
      const task = createMockTask({ status: 'completed', reward: 10 })

      mockDatabase.task.findUnique.mockResolvedValue(task)
      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.transaction.create.mockResolvedValue(createMockTransaction())

      // Simulate concurrent payment requests
      const concurrentRequests = Array.from({ length: 5 }, () =>
        paymentService.processTaskReward(task.id, user.id, 'TON')
      )

      const results = await Promise.all(concurrentRequests)

      // Only one should succeed due to duplicate prevention
      const successfulPayments = results.filter(r => r.success)
      expect(successfulPayments).toHaveLength(1)

      // Others should fail with appropriate error
      const failedPayments = results.filter(r => !r.success)
      expect(failedPayments).toHaveLength(4)
      failedPayments.forEach(result => {
        expect(result.error).toContain('already processed')
      })
    })
  })

  describe('Payment Analytics', () => {
    it('should calculate payment statistics', async () => {
      const transactions = [
        createMockTransaction({ amount: 10, status: 'completed' }),
        createMockTransaction({ amount: 20, status: 'completed' }),
        createMockTransaction({ amount: 5, status: 'pending' }),
        createMockTransaction({ amount: 15, status: 'failed' }),
      ]

      mockDatabase.transaction.findMany.mockResolvedValue(transactions)

      const stats = await paymentService.getPaymentStats({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      })

      expect(stats.totalTransactions).toBe(4)
      expect(stats.completedTransactions).toBe(2)
      expect(stats.totalVolume).toBe(50)
      expect(stats.successRate).toBe(0.5)
    })
  })
})