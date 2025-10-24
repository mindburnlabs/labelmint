import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { afterAll, afterEach, beforeAll } from 'vitest'

// Mock Service Worker setup for API mocking
export function setupMSW() {
  const handlers = [
    // Auth endpoints
    rest.post('/api/auth/login', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          token: 'mock-jwt-token',
          user: {
            id: 'user_test_123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'annotator',
          },
        })
      )
    }),

    rest.post('/api/auth/register', (req, res, ctx) => {
      return res(
        ctx.status(201),
        ctx.json({
          user: {
            id: 'user_new_123',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'annotator',
          },
          token: 'mock-new-jwt-token',
        })
      )
    }),

    rest.post('/api/auth/refresh', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          token: 'mock-refreshed-jwt-token',
        })
      )
    }),

    // User endpoints
    rest.get('/api/user/profile', (req, res, ctx) => {
      const authHeader = req.headers.get('authorization')
      if (!authHeader || !authHeader.includes('Bearer mock')) {
        return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
      }

      return res(
        ctx.status(200),
        ctx.json({
          id: 'user_test_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'annotator',
          balance: {
            usdt: 1000,
            ton: 5.5,
          },
          stats: {
            completedTasks: 25,
            earnedAmount: 25.0,
            accuracy: 0.95,
          },
        })
      )
    }),

    // Task endpoints
    rest.get('/api/tasks/available', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          tasks: [
            {
              id: 'task_1',
              type: 'image_classification',
              imageUrl: 'https://example.com/task1.jpg',
              instructions: 'Classify this image',
              labels: ['cat', 'dog', 'bird'],
              paymentPerLabel: 0.01,
              timeLimit: 300,
            },
            {
              id: 'task_2',
              type: 'text_annotation',
              text: 'Sample text to annotate',
              instructions: 'Annotate this text',
              labels: ['positive', 'negative', 'neutral'],
              paymentPerLabel: 0.02,
              timeLimit: 600,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        })
      )
    }),

    rest.post('/api/tasks/:taskId/submit', (req, res, ctx) => {
      const taskId = req.params.taskId
      return res(
        ctx.status(200),
        ctx.json({
          submissionId: 'submission_123',
          taskId,
          status: 'submitted',
          timestamp: new Date().toISOString(),
        })
      )
    }),

    rest.get('/api/tasks/user/:userId/history', (req, res, ctx) => {
      const userId = req.params.userId
      return res(
        ctx.status(200),
        ctx.json({
          tasks: [
            {
              id: 'task_1',
              type: 'image_classification',
              status: 'completed',
              submittedAt: new Date().toISOString(),
              earnedAmount: 0.01,
              labels: ['cat'],
              confidence: 95,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        })
      )
    }),

    // Payment endpoints
    rest.get('/api/payments/balance', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          usdtBalance: 1000.5,
          tonBalance: 5.25,
          totalEarned: 1250.75,
          totalWithdrawn: 250.25,
        })
      )
    }),

    rest.post('/api/payments/withdraw', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          withdrawalId: 'withdrawal_123',
          status: 'pending',
          amount: 100,
          currency: 'USDT',
          address: 'EQWithdrawalAddress123',
          createdAt: new Date().toISOString(),
        })
      )
    }),

    rest.get('/api/payments/history', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          transactions: [
            {
              id: 'payment_1',
              type: 'earn',
              amount: 0.01,
              currency: 'USDT',
              status: 'completed',
              taskId: 'task_1',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'withdrawal_1',
              type: 'withdrawal',
              amount: 100,
              currency: 'USDT',
              status: 'pending',
              address: 'EQWithdrawalAddress123',
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
          },
        })
      )
    }),

    // Project endpoints
    rest.get('/api/projects', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          projects: [
            {
              id: 'project_1',
              name: 'Image Classification Dataset',
              description: 'Classify various images into categories',
              type: 'image_classification',
              status: 'active',
              totalTasks: 10000,
              completedTasks: 7500,
              paymentPerTask: 0.01,
              labels: ['cat', 'dog', 'bird', 'car', 'person'],
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        })
      )
    }),

    // Analytics endpoints
    rest.get('/api/analytics/dashboard', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          overview: {
            totalTasks: 10000,
            completedTasks: 7500,
            activeWorkers: 150,
            totalPayments: 75000,
            averageAccuracy: 0.92,
          },
          trends: {
            daily: [
              { date: '2024-01-01', tasks: 500, earnings: 5.00 },
              { date: '2024-01-02', tasks: 750, earnings: 7.50 },
            ],
            weekly: [
              { week: '2024-W01', tasks: 3500, earnings: 35.00 },
              { week: '2024-W02', tasks: 4000, earnings: 40.00 },
            ],
          },
        })
      )
    }),

    // File upload endpoints
    rest.post('/api/upload/image', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          url: 'https://example.com/uploads/test_image.jpg',
          filename: 'test_image.jpg',
          size: 1024000,
          type: 'image/jpeg',
        })
      )
    }),

    // Error handlers
    rest.get('/api/error/404', (req, res, ctx) => {
      return res(ctx.status(404), ctx.json({ error: 'Not found' }))
    }),

    rest.get('/api/error/500', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Internal server error' }))
    }),

    rest.get('/api/error/timeout', (req, res, ctx) => {
      return res(
        ctx.delay(10000), // 10 second delay to test timeout
        ctx.status(200),
        ctx.json({ message: 'This should timeout' })
      )
    }),
  ]

  const server = setupServer(...handlers)

  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'error',
    })
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  return {
    server,
    // Helper to add custom handlers during tests
    addHandler: (handler: any) => server.use(handler),
    // Helper to override handlers
    overrideHandler: (handler: any) => server.use(handler),
  }
}

// Auto-setup MSW for tests that include this setup file
const { server, addHandler, overrideHandler } = setupMSW()

export { server, addHandler, overrideHandler }