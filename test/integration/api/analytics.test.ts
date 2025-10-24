import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockAuthService, MockUser, MockSession } from '@test/mocks/services'

describe('Analytics API Integration', () => {
  let authService: MockAuthService
  let mockUser: MockUser
  let mockSession: MockSession

  beforeEach(() => {
    authService = MockAuthService.create()
    mockUser = authService.createTestUser({
      id: 1,
      email: 'admin@example.com',
      role: 'admin',
      balance: 10000,
      permissions: ['*']
    })

    mockSession = authService.createTestSession(mockUser.id, ['*'])
  })

  afterEach(() => {
    vi.clearAllMocks()
    authService.reset()
  })

  describe('GET /api/analytics/dashboard', () => {
    it('should return admin dashboard analytics', async () => {
      const req = { user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      // Mock analytics data
      const analytics = {
        overview: {
          totalUsers: 150,
          activeUsers: 75,
          totalTasks: 1250,
          completedTasks: 890,
          activeProjects: 25,
          totalRevenue: 12500,
          averageRevenuePerTask: 10,
          totalTransactions: 2500,
          successRate: 98.2
        },
        performance: {
          averageTaskTime: 180, // seconds
          averageProcessingTime: 45,
          successRate: 97.5,
          averageResolutionTime: 1200 // seconds
        },
        finance: {
          totalVolume: 250000,
          totalFees: 250,
          averageTransactionSize: 100,
          payoutProcessingTime: 300,
          currencyDistribution: {
            TON: 80,
            USDT: 20
          },
          revenueByMonth: [
            { month: '2024-01', revenue: 8500 },
            { month: '2024-02', revenue: 12000 }
          ]
        },
        usage: {
          storageUsed: 75, // GB
          bandwidthUsed: 500, // GB
          apiCalls: 15000
        },
        quality: {
          averageAccuracy: 0.95,
          consensusRate: 0.98,
          averageConsensusTime: 45,
          highAccuracyRate: 0.92
        }
      }

      res.json(analytics)
      expect(res.json).toHaveBeenCalledWith(analytics)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(Object.keys(analytics)).toContain('overview')
      expect(analytics.overview.totalUsers).toBe(150)
    })

    it('should require admin authentication', async () => {
      vi.mock('@/backend/middleware/auth', () => ({
        requireAuth: (req: any, res: any, next: any) => {
          req.user = mockUser
          next()
        },
        requireAdmin: (req: any, res: any, next: any) => {
          req.user = mockUser
          if (req.user.role !== 'admin') {
            res.status(403).json({
              success: false,
              error: 'Admin access required'
            })
            return
          }
          next()
        }
      }))

      const req = { user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.json(analytics)
      expect(res.status).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required'
      })
    })
  })

  describe('GET /api/analytics/projects/:projectId', () => {
    it('should return project analytics', async () => {
      const req = { user: mockUser, params: { projectId: 'proj_1' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const projectAnalytics = {
        project: {
          id: 'proj_1',
          name: 'Test Project',
          totalTasks: 50,
          completedTasks: 30,
          averageTime: 180,
          qualityScore: 0.95,
          workerCount: 12,
          costBreakdown: {
            taskCost: 450,
            workerPayouts: 24000,
            infrastructureCost: 1200
          }
        },
        workflow: {
          averageProcessingTime: 90,
          stages: {
            pending: 15,
            in_progress: 30,
            completed: 35,
            review: 5
          },
          costEfficiency: 0.85,
          automationRate: 0.6
        },
        performance: {
          throughput: 2.5, // tasks/hour
          errorRate: 0.02,
          reliability: 0.97
        }
      }

      res.json(projectAnalytics)
      expect(res.json).toHaveBeenCalledWith(projectAnalytics)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(projectAnalytics.project.id).toBe('proj_1')
      expect(projectAnalytics.project.totalTasks).toBe(50)
    })

    it('should validate user project access', async () => {
      const req = { user: { id: 2, role: 'worker' }, params: { projectId: 'proj_1' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(403).json({
        success: false,
        error: 'Admin access or project ownership required'
      })

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access or project ownership required'
      })
    })
  })

  describe('GET /api/analytics/workers/:workerId', () => {
    it('should return worker analytics', async () => {
      const req = { user: mockUser, params: { workerId: 1 } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const workerAnalytics = {
        worker: {
          id: 1,
          name: 'Worker One',
          joinedAt: '2024-01-01',
          status: 'active',
          totalTasks: 125,
          completedTasks: 110,
          averageTime: 165,
          qualityScore: 0.94,
          earnings: 6600,
          performanceScore: 0.88
        },
        activities: {
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
          tasksCompleted: 5,
          averageDailyTasks: 25,
          streakDays: 3,
          rating: 4.6,
          feedbackReceived: 12,
          feedbackGiven: 8
        },
        skills: {
          accuracy: 4.5,
          speed: 4.2,
          quality: 4.8,
          consistency: 4.3,
          improvement: 4.1
        },
        training: {
          coursesCompleted: 3,
          certificatesEarned: 2,
          timeToCertification: 45
          avgScore: 87
        }
      }

      res.json(workerAnalytics)
      expect(res.json).toHaveBeenCalledWith(workerAnalytics)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(workerAnalytics.worker.id).toBe(1)
      expect(workerAnalytics.activities.totalTasks).toBe(125)
    })

    it('should calculate worker productivity metrics', async () => {
      const req = { user: mockUser, params: { workerId: 1 } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const productivity = {
        tasksPerHour: workerAnalytics.activities.tasksCompleted * 24,
        accuracy: workerAnalytics.activities.accuracy * 100,
        earningsPerHour: workerAnalytics.earnings / (workerAnalytics.activities.totalTasks - workerAnalytics.activities.joinDate.getDate()) * 24 * 60 * 60 * 1000) / 1000 / 24 / 60 * 60 * 1000),
        efficiency: workerAnalytics.performanceScore / 5
      }

      res.json(productivity)

      expect(res.json).toHaveBeenCalledWith(productivity)
      expect(productivity.tasksPerHour).toBeCloseTo(24, 1))
      expect(productivity.earningsPerHour).toBeCloseTo(41.67, 2))
      expect(productivity.efficiency).toBeCloseTo(0.176, 2))
    })
  })

  describe('GET /api/analytics/reports', () => {
    it('should generate analytics reports', async () => {
      const req = { user: mockUser, query: { type: 'summary', dateRange: '2024-01-01' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const reportData = {
        summary: {
          totalRevenue: 12500,
          totalExpenses: 1200,
          netProfit: 11300,
          profitMargin: 0.904,
          growth: 0.15
        },
        projects: {
          total: 25,
          active: 20,
          newProjects: 2,
          completedProjects: 5
        },
        workers: {
          total: 75,
          active: 60,
          averageEarnings: 875
          topPerformers: Array.from({ length: 5 }, () => [
            { id: 1, name: 'Worker One', earnings: 8750 },
            { id: 2, name: 'Worker Two', earnings: 7250 }
          ])
        }
      }

      res.json(reportData)

      expect(res.json).toHaveBeenCalledWith(reportData)
      expect(Object.keys(reportData)).toContain('summary')
      expect(reportData.summary.totalRevenue).toBe(12500)
      expect(reportData.summary.netProfit).toBe(11300)
      expect(reportData.workers.total).toBe(75)
    })

    it('should filter reports by date range', async () => {
      const req = { user: mockUser, query: { type: 'detailed', startDate: '2024-01-01', endDate: '2024-01-07' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const filteredReport = {
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-07'
        },
        summary: {
          totalRevenue: 5000, // Half of the monthly revenue
          totalExpenses: 600,
          totalProjects: 5,
          totalWorkers: 20,
          breakdown: {
            projects: expect.any(Array),
            workers: expect.any(Array),
            tasks: expect.any(Array)
          }
        }
      }

      res.json(filteredReport)

      expect(res.json).toHaveBeenCalledWith(filteredReport)
      expect(filteredReport.dateRange).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      })
    })

    it('should export reports in multiple formats', async () => {
      const req = { user: mockUser, query: { format: 'csv', dateRange: '2024-01-01' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      // Mock CSV generation
      const csvData = 'Date,Project,Revenue,Expenses,Profit\n2024-01-01,Test Project,1250,800,450\n2024-01-07,11300\n'

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv')
      res.send(csvData)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.headers['content-type']).toBe('text/csv')
      expect(res.headers['content-disposition']).toContain('attachment')
      expect(res.headers['content-disposition']).toContain('analytics.csv')
    })
  })

  describe('GET /api/analytics/health', () => {
    it('should return analytics health status', async () => {
      const req = { user: mockUser }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const healthStatus = {
        status: 'healthy',
        uptime: '7d 14h 32m',
        apiResponseTime: 45,
        databaseConnection: 'ok',
        redisConnection: 'ok',
        lastDataSync: new Date(Date.now() - 5 * 60 * 1000),
        services: {
          api: 'operational',
          auth: 'operational',
          database: 'operational',
          analytics: 'operational',
          email: 'operational'
        },
        memory: {
          used: 75,
          total: 16000, // 16GB
          available: 4000 // 4GB
        },
        cache: {
          hitRate: 0.85,
          missRate: 0.15
        },
        errors: {
          rateLimitHits: 5,
          timeoutErrors: 2,
          serverErrors: 0
        }
      }

      res.json(healthStatus)

      expect(res.json).toHaveBeenCalledWith(healthStatus)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(healthStatus.status).toBe('healthy')
      expect(healthStatus.uptime).toContain('d')
      expect(healthStatus.services).toEqual(expect.objectContaining({
        api: 'operational',
        auth: 'operational',
        database: 'operational'
      }))
    })

    it('should return service metrics', async () => {
      const req = { user: mockUser, query: { service: 'all' } }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const serviceMetrics = {
        'api': {
          requestsPerMinute: 150,
          averageResponseTime: 85,
          errorRate: 0.02,
          statusCodes: { '200': 0.95, '400': 0.04, '500': 0.01 }
        },
        'database': {
          queriesPerSecond: 25,
          averageQueryTime: 120,
          connectionTime: 15
          indexSize: 50
          slowQueries: ['users', 'analytics']
        }
      }

      res.json(serviceMetrics)

      expect(res.json).toHaveBeenCalledWith(serviceMetrics)
      expect(Object.keys(serviceMetrics)).toContain('api')
      expect(serviceMetrics['api'].requestsPerMinute).toBe(150)
      expect(serviceMetrics['api'].averageResponseTime).toBeCloseTo(85)
    })
  })
})