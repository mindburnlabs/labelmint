// Comprehensive Payment Workflow Integration Tests
// ===============================================
// End-to-end payment processing tests

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '@api-gateway/src/app'
import { PrismaClient } from '@prisma/client'
import { setupTestDatabase, cleanupTestDatabase } from '@test/helpers/database'
import { createMockUser, createMockTask, createMockProject } from '@test/factories'

describe('Payment Workflow Integration Tests', () => {
  let prisma: PrismaClient
  let authToken: string
  let testUser: any
  let testProject: any
  let testTask: any

  beforeAll(async () => {
    // Setup test database
    prisma = await setupTestDatabase()

    // Start test services
    await startTestServices()
  })

  afterAll(async () => {
    await cleanupTestDatabase(prisma)
    await stopTestServices()
  })

  beforeEach(async () => {
    // Create test user with wallet
    testUser = await createTestUserWithWallet()
    authToken = await generateAuthToken(testUser.id)

    // Create test project and task
    testProject = await createTestProject(testUser.id)
    testTask = await createTestTask(testProject.id)
  })

  afterEach(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  describe('Task Completion and Payment Flow', () => {
    it('should process complete task completion to payment flow', async () => {
      // 1. User accepts task
      const acceptResponse = await request(app)
        .post(`/api/tasks/${testTask.id}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(acceptResponse.body.status).toBe('accepted')
      expect(acceptResponse.body.taskId).toBe(testTask.id)

      // 2. User submits task completion
      const submissionData = {
        data: {
          labels: ['cat', 'animal'],
          coordinates: [{ x: 100, y: 150 }],
          notes: 'Confident about cat classification',
        },
        timeSpent: 120,
      }

      const submitResponse = await request(app)
        .post(`/api/tasks/${testTask.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(200)

      expect(submitResponse.body.submissionId).toBeDefined()
      const submissionId = submitResponse.body.submissionId

      // 3. Wait for consensus evaluation (simulate)
      await simulateConsensusEvaluation(testTask.id, submissionId)

      // 4. Check if payment transaction was created
      const transactionResponse = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ taskId: testTask.id })
        .expect(200)

      expect(transactionResponse.body.transactions).toHaveLength(1)
      const transaction = transactionResponse.body.transactions[0]

      expect(transaction.amount).toBe(testTask.reward)
      expect(transaction.type).toBe('reward')
      expect(transaction.status).toBe('pending')
      expect(transaction.taskId).toBe(testTask.id)
      expect(transaction.userId).toBe(testUser.id)

      // 5. Simulate blockchain confirmation
      await simulateBlockchainConfirmation(transaction.id)

      // 6. Verify transaction status updated
      const updatedTransactionResponse = await request(app)
        .get(`/api/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(updatedTransactionResponse.body.status).toBe('completed')
      expect(updatedTransactionResponse.body.blockchainHash).toBeDefined()

      // 7. Verify user balance updated
      const balanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(balanceResponse.body.TON).toBeGreaterThanOrEqual(testTask.reward)
    })

    it('should handle payment processing failures gracefully', async () => {
      // Submit task completion
      const submissionData = {
        data: { labels: ['cat'] },
        timeSpent: 120,
      }

      await request(app)
        .post(`/api/tasks/${testTask.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(200)

      // Simulate consensus failure (no consensus reached)
      await simulateConsensusFailure(testTask.id)

      // Verify no payment transaction was created
      const transactionResponse = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ taskId: testTask.id })
        .expect(200)

      expect(transactionResponse.body.transactions).toHaveLength(0)

      // Verify task is marked for review
      const taskResponse = await request(app)
        .get(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(taskResponse.body.status).toBe('under_review')
    })
  })

  describe('Wallet Management Integration', () => {
    it('should create and manage user wallets', async () => {
      // Get initial wallets
      const initialWalletsResponse = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(initialWalletsResponse.body.wallets).toHaveLength(1) // Created during user setup

      // Create additional wallet
      const newWalletData = {
        type: 'USDT',
        address: 'EQDTestUSDTAddress...',
      }

      const createWalletResponse = await request(app)
        .post('/api/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newWalletData)
        .expect(201)

      expect(createWalletResponse.body.type).toBe('USDT')
      expect(createWalletResponse.body.address).toBe(newWalletData.address)

      // Verify wallet appears in list
      const updatedWalletsResponse = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(updatedWalletsResponse.body.wallets).toHaveLength(2)
    })

    it('should validate wallet addresses', async () => {
      const invalidWalletData = {
        type: 'TON',
        address: 'INVALID_ADDRESS',
      }

      const response = await request(app)
        .post('/api/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidWalletData)
        .expect(400)

      expect(response.body.error).toContain('Invalid wallet address')
    })
  })

  describe('Withdrawal Processing Integration', () => {
    beforeEach(async () => {
      // Ensure user has sufficient balance for withdrawal tests
      await addTestBalance(testUser.id, 'TON', 100)
    })

    it('should process successful withdrawal', async () => {
      const withdrawalData = {
        amount: 50,
        currency: 'TON',
        toAddress: testUser.tonWallet,
      }

      const response = await request(app)
        .post('/api/withdrawals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(200)

      expect(response.body.transactionId).toBeDefined()
      expect(response.body.status).toBe('pending')

      const transactionId = response.body.transactionId

      // Simulate blockchain processing
      await simulateBlockchainConfirmation(transactionId)

      // Verify withdrawal completed
      const transactionResponse = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(transactionResponse.body.status).toBe('completed')
      expect(transactionResponse.body.type).toBe('withdrawal')
      expect(transactionResponse.body.amount).toBe(50)

      // Verify balance updated
      const balanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(balanceResponse.body.TON).toBeLessThan(100)
    })

    it('should reject withdrawal exceeding balance', async () => {
      const withdrawalData = {
        amount: 200, // Exceeds balance of 100
        currency: 'TON',
        toAddress: testUser.tonWallet,
      }

      const response = await request(app)
        .post('/api/withdrawals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(400)

      expect(response.body.error).toContain('Insufficient balance')
    })

    it('should implement withdrawal limits', async () => {
      const withdrawalData = {
        amount: 1000, // Exceeds daily limit
        currency: 'TON',
        toAddress: testUser.tonWallet,
      }

      const response = await request(app)
        .post('/api/withdrawals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(400)

      expect(response.body.error).toContain('Withdrawal limit exceeded')
    })
  })

  describe('Multi-Currency Support', () => {
    beforeEach(async () => {
      // Setup multi-currency balances
      await addTestBalance(testUser.id, 'TON', 50)
      await addTestBalance(testUser.id, 'USDT', 200)
    })

    it('should handle payments in different currencies', async () => {
      // Create task with USDT reward
      const usdtTask = await createTestTask(testProject.id, {
        reward: 25,
        rewardCurrency: 'USDT',
      })

      // Complete task and receive USDT payment
      await completeTaskWithPayment(usdtTask.id, testUser.id, 'USDT')

      // Verify USDT balance increased
      const balanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(balanceResponse.body.USDT).toBeGreaterThan(200)
    })

    it('should handle currency conversion for withdrawals', async () => {
      const conversionData = {
        fromCurrency: 'USDT',
        toCurrency: 'TON',
        amount: 50,
      }

      const response = await request(app)
        .post('/api/wallet/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conversionData)
        .expect(200)

      expect(response.body.convertedAmount).toBeGreaterThan(0)
      expect(response.body.fromCurrency).toBe('USDT')
      expect(response.body.toCurrency).toBe('TON')

      // Verify balances updated
      const balanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(balanceResponse.body.USDT).toBeLessThan(200)
      expect(balanceResponse.body.TON).toBeGreaterThan(50)
    })
  })

  describe('Payment Security Integration', () => {
    it('should require authentication for all payment endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/transactions' },
        { method: 'POST', path: '/api/withdrawals' },
        { method: 'GET', path: '/api/wallet' },
        { method: 'GET', path: '/api/wallet/balance' },
      ]

      for (const endpoint of protectedEndpoints) {
        await request(app)[endpoint.method.toLowerCase()](endpoint.path)
          .expect(401)
      }
    })

    it('should validate transaction signatures', async () => {
      const transactionData = {
        amount: 10,
        currency: 'TON',
        toAddress: 'EQDTest...',
        signature: 'INVALID_SIGNATURE',
      }

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400)

      expect(response.body.error).toContain('Invalid signature')
    })

    it('should implement rate limiting for payment operations', async () => {
      const withdrawalData = {
        amount: 1,
        currency: 'TON',
        toAddress: testUser.tonWallet,
      }

      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/withdrawals')
          .set('Authorization', `Bearer ${authToken}`)
          .send(withdrawalData)
      )

      const responses = await Promise.all(requests)

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Payment Analytics Integration', () => {
    beforeEach(async () => {
      // Create payment history for analytics
      await createPaymentHistory(testUser.id, {
        count: 20,
        currencies: ['TON', 'USDT'],
        types: ['reward', 'withdrawal'],
      })
    })

    it('should provide comprehensive payment analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
        .expect(200)

      expect(response.body.totalVolume).toBeGreaterThan(0)
      expect(response.body.transactionCount).toBeGreaterThan(0)
      expect(response.body.currencyBreakdown).toBeDefined()
      expect(response.body.transactionTypeBreakdown).toBeDefined()
      expect(response.body.averageTransactionSize).toBeGreaterThan(0)
    })

    it('should track payment processing metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/payment-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.averageProcessingTime).toBeGreaterThan(0)
      expect(response.body.successRate).toBeGreaterThan(0)
      expect(response.body.errorRate).toBeGreaterThanOrEqual(0)
      expect(response.body.blockchainConfirmationTime).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle blockchain network failures', async () => {
      // Simulate blockchain network failure
      await simulateBlockchainFailure()

      const withdrawalData = {
        amount: 10,
        currency: 'TON',
        toAddress: testUser.tonWallet,
      }

      const response = await request(app)
        .post('/api/withdrawals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(503)

      expect(response.body.error).toContain('Blockchain network unavailable')

      // Verify transaction is marked as failed
      const transactionResponse = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      const failedTransaction = transactionResponse.body.transactions.find(
        (t: any) => t.status === 'failed'
      )
      expect(failedTransaction).toBeDefined()
    })

    it('should implement automatic retry for failed transactions', async () => {
      // Create a transaction that initially fails
      const transactionId = await createFailedTransaction(testUser.id)

      // Wait for retry mechanism
      await waitForRetryMechanism(transactionId)

      // Verify transaction status updated
      const response = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(['completed', 'failed']).toContain(response.body.status)
      expect(response.body.retryCount).toBeGreaterThan(0)
    })
  })

  // Helper functions
  async function createTestUserWithWallet() {
    const userData = createMockUser({
      tonWallet: 'EQDTestWalletAddress123...',
    })

    const user = await prisma.user.create({
      data: {
        ...userData,
        wallets: {
          create: {
            type: 'TON',
            address: userData.tonWallet,
            balance: 0,
          },
        },
      },
      include: { wallets: true },
    })

    return user
  }

  async function generateAuthToken(userId: string): Promise<string> {
    // Mock JWT generation
    return `mock-jwt-token-${userId}`
  }

  async function createTestProject(userId: string) {
    const projectData = createMockProject({ createdBy: userId })
    return await prisma.project.create({ data: projectData })
  }

  async function createTestTask(projectId: string, overrides: any = {}) {
    const taskData = createMockTask({
      projectId,
      status: 'available',
      rewardCurrency: 'TON',
      ...overrides
    })
    return await prisma.task.create({ data: taskData })
  }

  async function simulateConsensusEvaluation(taskId: string, submissionId: string) {
    // Mock consensus evaluation process
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'approved',
        consensusScore: 0.9,
        accuracy: 0.95,
      },
    })

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'completed' },
    })
  }

  async function simulateConsensusFailure(taskId: string) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'under_review' },
    })
  }

  async function simulateBlockchainConfirmation(transactionId: string) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'completed',
        blockchainHash: 'test-blockchain-hash-123',
        completedAt: new Date(),
      },
    })
  }

  async function addTestBalance(userId: string, currency: string, amount: number) {
    const wallet = await prisma.wallet.findFirst({
      where: { userId, type: currency },
    })

    if (wallet) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      })
    }
  }

  async function completeTaskWithPayment(taskId: string, userId: string, currency: string) {
    // Accept task
    await prisma.task.update({
      where: { id: taskId },
      data: { assignedTo: userId, status: 'in_progress' },
    })

    // Submit completion
    const submission = await prisma.submission.create({
      data: {
        taskId,
        userId,
        data: { labels: ['test'] },
        status: 'approved',
        consensusScore: 1.0,
      },
    })

    // Complete task
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'completed' },
    })

    // Create payment transaction
    const task = await prisma.task.findUnique({ where: { id: taskId } })

    await prisma.transaction.create({
      data: {
        userId,
        taskId,
        amount: task.reward,
        currency,
        type: 'reward',
        status: 'completed',
        toAddress: 'EQDTest...',
      },
    })
  }

  async function createPaymentHistory(userId: string, options: any) {
    const transactions = []
    for (let i = 0; i < options.count; i++) {
      transactions.push({
        userId,
        amount: Math.random() * 100,
        currency: options.currencies[Math.floor(Math.random() * options.currencies.length)],
        type: options.types[Math.floor(Math.random() * options.types.length)],
        status: 'completed',
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
      })
    }

    await prisma.transaction.createMany({ data: transactions })
  }

  async function cleanupTestData() {
    // Clean up in order to respect foreign key constraints
    await prisma.transaction.deleteMany({
      where: { userId: testUser.id },
    })
    await prisma.submission.deleteMany({
      where: { userId: testUser.id },
    })
    await prisma.task.deleteMany({
      where: { projectId: testProject.id },
    })
    await prisma.project.delete({
      where: { id: testProject.id },
    })
  }

  // Test service management
  async function startTestServices() {
    // Start any required external services for testing
  }

  async function stopTestServices() {
    // Clean up external services
  }

  async function simulateBlockchainFailure() {
    // Mock blockchain failure
  }

  async function createFailedTransaction(userId: string): Promise<string> {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: 10,
        currency: 'TON',
        type: 'withdrawal',
        status: 'failed',
        retryCount: 0,
      },
    })
    return transaction.id
  }

  async function waitForRetryMechanism(transactionId: string) {
    // Wait for async retry process
    await new Promise(resolve => setTimeout(resolve, 100))
  }
})