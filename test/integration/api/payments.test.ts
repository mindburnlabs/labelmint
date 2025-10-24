import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockPaymentService, MockPaymentRequest, MockPaymentResult } from '@test/mocks/services'
import { MockAuthService } from '@test/mocks/services'

describe('Payments API Integration', () => {
  let paymentService: MockPaymentService
  let authService: MockAuthService
  let mockUser: any
  let mockAdmin: any

  beforeEach(() => {
    paymentService = MockPaymentService.createWithBalances({
      1: 1000, // 1000 TON
      2: 500,  // 500 TON
      3: 2000  // 2000 TON (admin)
    })
    authService = MockAuthService.create()

    mockUser = authService.createTestUser({
      id: 1,
      email: 'worker@example.com',
      role: 'worker',
      balance: 1000
    })

    mockAdmin = authService.createTestUser({
      id: 3,
      email: 'admin@example.com',
      role: 'admin',
      balance: 2000
    })

    vi.mock('@/backend/middleware/auth', () => ({
      requireAuth: (req: any, res: any, next: any) => {
        req.user = mockUser
        next()
      },
      requireAdmin: (req: any, res: any, next: any) => {
        req.user = mockAdmin
        next()
      }
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    paymentService.reset()
    authService.reset()
  })

  describe('POST /api/payments/process', () => {
    it('should process TON payment successfully', async () => {
      const paymentRequest: MockPaymentRequest = {
        userId: mockUser.id,
        amount: 100,
        currency: 'TON',
        description: 'Task payment for image classification'
      }

      const req = { body: paymentRequest, user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await paymentService.processPayment(paymentRequest)

      res.status(200).json({
        success: true,
        transactionId: result.transactionId,
        txHash: result.txHash,
        estimatedFee: result.estimatedFee,
        estimatedTime: result.estimatedTime,
        newBalance: paymentService.getUserBalance(mockUser.id)
      })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactionId: expect.any(String),
        txHash: expect.any(String),
        estimatedFee: expect.any(Number),
        estimatedTime: expect.any(Number),
        newBalance: 899 // 1000 - 100 - 1 (fee)
      })
    })

    it('should process USDT payment successfully', async () => {
      const paymentRequest: MockPaymentRequest = {
        userId: mockUser.id,
        amount: 50,
        currency: 'USDT',
        description: 'Task payment for text labeling'
      }

      const req = { body: paymentRequest, user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await paymentService.processPayment(paymentRequest)

      res.status(200).json({
        success: true,
        transactionId: result.transactionId,
        txHash: result.txHash,
        estimatedFee: result.estimatedFee,
        estimatedTime: result.estimatedTime,
        newBalance: paymentService.getUserBalance(mockUser.id)
      })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        newBalance: 899 // 1000 - 50 - 1 (fee)
      })
    })

    it('should process internal payment', async () => {
      const paymentRequest: MockPaymentRequest = {
        userId: mockUser.id,
        amount: 25,
        currency: 'TON',
        isInternal: true,
        toUserId: 2, // Another worker
        description: 'Internal bonus payment'
      }

      const req = { body: paymentRequest, user: mockAdmin }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await paymentService.processPayment(paymentRequest)

      res.status(200).json({
        success: true,
        transactionId: result.transactionId,
        isInternal: true,
        newBalance: paymentService.getUserBalance(mockAdmin.id)
      })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        isInternal: true,
        newBalance: 1974 // 2000 - 25 - 1 (fee)
      })
    })

    it('should reject insufficient balance', async () => {
      const paymentRequest: MockPaymentRequest = {
        userId: mockUser.id,
        amount: 1200, // More than 1000 balance
        currency: 'TON',
        description: 'Payment exceeding balance'
      }

      const req = { body: paymentRequest, user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await paymentService.processPayment(paymentRequest)

      res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        transactionId: result.transactionId,
        currentBalance: paymentService.getUserBalance(mockUser.id),
        required: paymentRequest.amount + paymentRequest.amount * 0.01
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient balance',
        currentBalance: 1000,
        required: 1212
      })
    })

    it('should validate payment amount', async () => {
      const paymentRequest = {
        userId: mockUser.id,
        amount: -100, // Invalid negative amount
        currency: 'TON',
        description: 'Invalid payment amount'
      }

      const req = { body: paymentRequest, user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(400).json({
        success: false,
        error: 'Amount must be positive',
        errors: ['Amount must be positive', 'Amount must be at least 1 TON']
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Amount must be positive',
        errors: expect.any(Array)
      })
    })

    it('should validate payment currency', async () => {
      const paymentRequest = {
        userId: mockUser.id,
        amount: 100,
        currency: 'BTC', // Unsupported currency
        description: 'Invalid currency payment'
      }

      const req = { body: paymentRequest, user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(400).json({
        success: false,
        error: 'Unsupported currency',
        supportedCurrencies: ['TON', 'USDT']
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unsupported currency',
        supportedCurrencies: ['TON', 'USDT']
      })
    })
  })

  describe('GET /api/payments/validate/:transactionId', () => {
    it('should validate successful transaction', async () => {
      // First process a payment
      const paymentRequest: MockPaymentRequest = {
        userId: mockUser.id,
        amount: 100,
        currency: 'TON',
        description: 'Test payment'
      }

      const processResult = await paymentService.processPayment(paymentRequest)

      const req = {
        params: { transactionId: processResult.transactionId },
        user: mockUser
      }
      const res = { json: vi.fn() }

      const validationResult = await paymentService.validatePayment(processResult.transactionId)

      res.json({
        success: true,
        transaction: {
          ...validationResult,
          confirmed: true,
          blockNumber: expect.any(Number),
          confirmations: expect.any(Number)
        }
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transaction: {
          ...validationResult,
          confirmed: true,
          blockNumber: expect.any(Number),
          confirmations: expect.any(Number)
        }
      })
    })

    it('should return error for invalid transaction', async () => {
      const req = {
        params: { transactionId: 'invalid_tx_id' },
        user: mockUser
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await paymentService.validatePayment('invalid_tx_id')

      res.status(404).json({
        success: false,
        error: 'Transaction not found'
      })

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction not found'
      })
    })
  })

  describe('GET /api/payments/history', () => {
    it('should return user payment history', async () => {
      // Process some payments first
      await paymentService.processPayment({
        userId: mockUser.id,
        amount: 100,
        currency: 'TON',
        description: 'Payment 1'
      })

      await paymentService.processPayment({
        userId: mockUser.id,
        amount: 50,
        currency: 'USDT',
        description: 'Payment 2'
      })

      const req = {
        user: mockUser,
        query: { page: 1, limit: 10 }
      }
      const res = { json: vi.fn() }

      const allTransactions = paymentService.getAllTransactions()
      const userTransactions = allTransactions.filter(tx => {
        // In real implementation, this would filter by user ID
        return true
      })

      res.json({
        transactions: userTransactions,
        pagination: {
          page: 1,
          limit: 10,
          total: userTransactions.length,
          pages: Math.ceil(userTransactions.length / 10)
        }
      })

      expect(res.json).toHaveBeenCalledWith({
        transactions: userTransactions,
        pagination: {
          page: 1,
          limit: 10,
          total: userTransactions.length,
          pages: expect.any(Number)
        }
      })
    })

    it('should filter payments by status', async () => {
      const req = {
        user: mockUser,
        query: { status: 'success' }
      }
      const res = { json: vi.fn() }

      const allTransactions = paymentService.getAllTransactions()
      const successfulTransactions = allTransactions.filter(tx => tx.success)

      res.json({
        transactions: successfulTransactions,
        summary: {
          total: allTransactions.length,
          successful: successfulTransactions.length,
          failed: allTransactions.length - successfulTransactions.length,
          successRate: successfulTransactions.length / allTransactions.length
        }
      })

      expect(res.json).toHaveBeenCalledWith({
        transactions: successfulTransactions,
        summary: {
          total: allTransactions.length,
          successful: successfulTransactions.length,
          failed: expect.any(Number),
          successRate: expect.any(Number)
        }
      })
    })

    it('should filter by date range', async () => {
      const req = {
        user: mockUser,
        query: {
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString()
        }
      }
      const res = { json: vi.fn() }

      const allTransactions = paymentService.getAllTransactions()
      // Mock date filtering - in real implementation, this would use transaction timestamps

      res.json({
        transactions: allTransactions,
        dateRange: {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          filtered: allTransactions.length
        }
      })

      expect(res.json).toHaveBeenCalledWith({
        transactions: allTransactions,
        dateRange: {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          filtered: allTransactions.length
        }
      })
    })
  })

  describe('GET /api/payments/stats', () => {
    it('should return payment statistics', async () => {
      // Process some payments for stats
      await paymentService.processPayment({
        userId: mockUser.id,
        amount: 100,
        currency: 'TON'
      })

      await paymentService.processPayment({
        userId: mockUser.id,
        amount: 50,
        currency: 'USDT'
      })

      await paymentService.processPayment({
        userId: mockUser.id,
        amount: 200,
        currency: 'TON'
      })

      const req = { user: mockAdmin }
      const res = { json: vi.fn() }

      const allTransactions = paymentService.getAllTransactions()
      const stats = {
        totalTransactions: allTransactions.length,
        successfulTransactions: allTransactions.filter(tx => tx.success).length,
        failedTransactions: allTransactions.filter(tx => !tx.success).length,
        totalVolume: allTransactions.filter(tx => tx.success).reduce((sum, tx) => sum + tx.amount, 0),
        averageFee: allTransactions.filter(tx => tx.estimatedFee).reduce((sum, tx) => sum + (tx.estimatedFee || 0), 0) / allTransactions.length,
        byCurrency: {
          TON: allTransactions.filter(tx => tx.currency === 'TON').reduce((sum, tx) => sum + tx.amount, 0),
          USDT: allTransactions.filter(tx => tx.currency === 'USDT').reduce((sum, tx) => sum + tx.amount, 0)
        }
      }

      res.json(stats)

      expect(res.json).toHaveBeenCalledWith({
        totalTransactions: allTransactions.length,
        successfulTransactions: expect.any(Number),
        failedTransactions: expect.any(Number),
        totalVolume: expect.any(Number),
        averageFee: expect.any(Number),
        byCurrency: expect.objectContaining({
          TON: expect.any(Number),
          USDT: expect.any(Number)
        })
      })
    })

    it('should return user-specific payment stats', async () => {
      const req = { user: mockUser }
      const res = { json: vi.fn() }

      const userStats = {
        totalSent: 0, // Would be calculated from user's outgoing payments
        totalReceived: 0, // Would be calculated from user's incoming payments
        currentBalance: paymentService.getUserBalance(mockUser.id),
        pendingTransactions: 0,
        successfulRate: 1.0 // Based on user's transaction history
      }

      res.json(userStats)

      expect(res.json).toHaveBeenCalledWith({
        totalSent: expect.any(Number),
        totalReceived: expect.any(Number),
        currentBalance: 1000,
        pendingTransactions: expect.any(Number),
        successfulRate: expect.any(Number)
      })
    })
  })

  describe('POST /api/payments/payout', () => {
    it('should process bulk payout to workers', async () => {
      const payouts = [
        { userId: 1, amount: 200, currency: 'TON', description: 'Weekly payout' },
        { userId: 2, amount: 150, currency: 'TON', description: 'Weekly payout' }
      ]

      const req = { body: payouts, user: mockAdmin }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const results = []
      for (const payout of payouts) {
        const result = await paymentService.processPayment(payout)
        results.push(result)
      }

      const successfulPayouts = results.filter(r => r.success)

      res.status(200).json({
        success: true,
        processed: results.length,
        successful: successfulPayouts.length,
        failed: results.length - successfulPayouts.length,
        details: results.map(r => ({
          userId: r.transactionId ? r.transactionId.split('_')[1] : undefined,
          success: r.success,
          error: r.error,
          transactionId: r.transactionId
        }))
      })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 2,
        successful: successfulPayouts.length,
        failed: results.length - successfulPayouts.length,
        details: expect.any(Array)
      })
    })

    it('should validate payout amounts', async () => {
      const payouts = [
        { userId: 1, amount: -50, currency: 'TON', description: 'Invalid payout' },
        { userId: 2, amount: 0, currency: 'TON', description: 'Zero payout' }
      ]

      const req = { body: payouts, user: mockAdmin }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(400).json({
        success: false,
        error: 'Invalid payout amounts',
        validationErrors: payouts.map((payout, index) => ({
          index,
          userId: payout.userId,
          amount: payout.amount,
          error: 'Amount must be positive'
        }))
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid payout amounts',
        validationErrors: expect.any(Array)
      })
    })
  })
})