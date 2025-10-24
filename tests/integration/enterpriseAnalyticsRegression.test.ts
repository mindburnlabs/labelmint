import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { AnalyticsService } from '../../../services/enterprise-api/src/services/AnalyticsService';
import { AnalyticsController } from '../../../services/enterprise-api/src/controllers/AnalyticsController';

// Mock server setup for analytics API
const analyticsServer = setupServer(
  // Mock overview endpoint
  rest.get('/organizations/:organizationId/analytics/overview', (req, res, ctx) => {
    const organizationId = req.params.organizationId;
    const startDate = req.url.searchParams.get('startDate');
    const endDate = req.url.searchParams.get('endDate');

    if (!organizationId) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: 'Organization ID required' })
      );
    }

    // Return different data based on date range to test caching
    const cacheKey = `${organizationId}-${startDate}-${endDate}`;
    const mockData = {
      success: true,
      data: {
        totalUsers: 150,
        activeUsers: 75,
        totalProjects: 25,
        completedTasks: 1250,
        totalRevenue: 50000,
        averageRevenuePerTask: 40,
        currencyDistribution: {
          TON: 80,
          USDT: 20
        },
        growthMetrics: {
          userGrowth: 15.5,
          revenueGrowth: 22.3,
          projectGrowth: 8.7
        },
        performanceMetrics: {
          averageTaskTime: 180,
          completionRate: 89.2,
          qualityScore: 94.5
        }
      },
      cached: cacheKey === 'org-123-2024-01-01-2024-01-31' // Simulate cache hit
    };

    return res(ctx.status(200), ctx.json(mockData));
  }),

  // Mock user analytics endpoint
  rest.get('/organizations/:organizationId/analytics/users', (req, res, ctx) => {
    const organizationId = req.params.organizationId;

    const mockData = {
      success: true,
      data: {
        totalUsers: 150,
        activeUsers: 75,
        newUsers: 25,
        churnedUsers: 5,
        userSegments: {
          workers: 120,
          managers: 25,
          admins: 5
        },
        userActivity: {
          dailyActive: 45,
          weeklyActive: 65,
          monthlyActive: 75
        },
        userPerformance: {
          averageTasksPerUser: 8.3,
          averageAccuracy: 0.92,
          averageEarnings: 250.50
        },
        userRetention: {
          day1: 0.85,
          day7: 0.72,
          day30: 0.58,
          day90: 0.41
        }
      }
    };

    return res(ctx.status(200), ctx.json(mockData));
  }),

  // Mock project analytics endpoint
  rest.get('/organizations/:organizationId/analytics/projects', (req, res, ctx) => {
    const mockData = {
      success: true,
      data: {
        totalProjects: 25,
        activeProjects: 20,
        completedProjects: 15,
        cancelledProjects: 3,
        projectTypes: {
          'image-classification': 8,
          'text-labeling': 6,
          'data-annotation': 7,
          'audio-transcription': 4
        },
        projectPerformance: {
          averageCompletionTime: 45, // hours
          averageCost: 500,
          averageQuality: 0.91,
          completionRate: 0.88
        },
        projectRevenue: {
          totalRevenue: 50000,
          revenueByType: {
            'image-classification': 20000,
            'text-labeling': 15000,
            'data-annotation': 10000,
            'audio-transcription': 5000
          }
        },
        topProjects: [
          {
            id: 'proj-1',
            name: 'E-commerce Image Classification',
            revenue: 8500,
            tasks: 425,
            workers: 12
          },
          {
            id: 'proj-2',
            name: 'Sentiment Analysis',
            revenue: 6200,
            tasks: 310,
            workers: 8
          }
        ]
      }
    };

    return res(ctx.status(200), ctx.json(mockData));
  }),

  // Mock workflow analytics endpoint
  rest.get('/organizations/:organizationId/analytics/workflows', (req, res, ctx) => {
    const mockData = {
      success: true,
      data: {
        totalWorkflows: 15,
        activeWorkflows: 12,
        workflowEfficiency: 0.87,
        automationRate: 0.65,
        workflowStages: {
          'data-ingestion': { avgTime: 5, successRate: 0.98 },
          'task-distribution': { avgTime: 2, successRate: 0.95 },
          'quality-control': { avgTime: 15, successRate: 0.92 },
          'payment-processing': { avgTime: 3, successRate: 0.99 }
        },
        bottlenecks: [
          {
            stage: 'quality-control',
            avgTime: 25,
            targetTime: 15,
            impact: 'high'
          }
        ],
        workflowMetrics: {
          averageProcessingTime: 180,
          throughput: 50, // tasks/hour
          errorRate: 0.03,
          reworkRate: 0.08
        }
      }
    };

    return res(ctx.status(200), ctx.json(mockData));
  }),

  // Mock specific metric endpoint
  rest.get('/organizations/:organizationId/analytics/metric', (req, res, ctx) => {
    const metric = req.url.searchParams.get('metric');
    const organizationId = req.params.organizationId;

    if (!metric) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: 'Metric parameter required' })
      );
    }

    const metrics: Record<string, any> = {
      'revenue': {
        total: 50000,
        monthly: [4000, 4500, 4200, 4800, 5200, 5500],
        growth: 15.5
      },
      'users': {
        total: 150,
        active: 75,
        new: 25,
        retention: 0.72
      },
      'tasks': {
        total: 1250,
        completed: 1100,
        pending: 125,
        failed: 25,
        averageTime: 180
      },
      'invalid-metric': null
    };

    if (metric === 'invalid-metric') {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: 'Unsupported metric: invalid-metric' })
      );
    }

    const data = metrics[metric];
    if (!data) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: 'Unsupported metric' })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          metric,
          value: data,
          organizationId,
          timestamp: new Date().toISOString()
        }
      })
    );
  }),

  // Mock export endpoint
  rest.post('/organizations/:organizationId/analytics/export', (req, res, ctx) => {
    const { startDate, endDate, metrics } = req.body as any;

    if (!startDate || !endDate || !metrics) {
      return res(
        ctx.status(400),
        ctx.json({ success: false, error: 'Missing required export parameters' })
      );
    }

    const csvContent = `Date,Revenue,Users,Tasks\n${startDate},${metrics.includes('revenue') ? '50000' : 'N/A'},${metrics.includes('users') ? '150' : 'N/A'},${metrics.includes('tasks') ? '1250' : 'N/A'}`;

    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/csv'),
      ctx.set('Content-Disposition', `attachment; filename="analytics-${startDate}-${endDate}.csv"`),
      ctx.body(csvContent)
    );
  })
);

describe('Enterprise Analytics Regression Tests', () => {
  let analyticsService: AnalyticsService;
  let mockCache: Map<string, any>;
  let mockLogger: any;

  beforeAll(() => {
    analyticsServer.listen({
      onUnhandledRequest: 'error'
    });
  });

  beforeEach(() => {
    // Reset mocks
    mockCache = new Map();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Mock cache implementation
    vi.mock('../../../services/enterprise-api/src/utils/cache', () => ({
      get: vi.fn().mockImplementation((key: string) => mockCache.get(key)),
      set: vi.fn().mockImplementation((key: string, value: any, ttl?: number) => {
        mockCache.set(key, value);
      }),
      del: vi.fn().mockImplementation((key: string) => mockCache.delete(key))
    }));

    // Mock logger
    vi.mock('../../../services/enterprise-api/src/utils/logger', () => ({
      logger: mockLogger
    }));
  });

  afterEach(() => {
    analyticsServer.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    analyticsServer.close();
  });

  describe('Overview Analytics Regression', () => {
    it('should return consistent overview data structure', async () => {
      const organizationId = 'org-123';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const result = await AnalyticsService.getOverview(organizationId, {
        startDate,
        endDate
      });

      expect(result).toMatchObject({
        data: expect.objectContaining({
          totalUsers: expect.any(Number),
          activeUsers: expect.any(Number),
          totalProjects: expect.any(Number),
          completedTasks: expect.any(Number),
          totalRevenue: expect.any(Number),
          averageRevenuePerTask: expect.any(Number),
          currencyDistribution: expect.objectContaining({
            TON: expect.any(Number),
            USDT: expect.any(Number)
          }),
          growthMetrics: expect.objectContaining({
            userGrowth: expect.any(Number),
            revenueGrowth: expect.any(Number),
            projectGrowth: expect.any(Number)
          }),
          performanceMetrics: expect.objectContaining({
            averageTaskTime: expect.any(Number),
            completionRate: expect.any(Number),
            qualityScore: expect.any(Number)
          })
        }),
        cached: expect.any(Boolean)
      });

      // Verify data consistency
      expect(result.data.totalUsers).toBeGreaterThan(0);
      expect(result.data.activeUsers).toBeLessThanOrEqual(result.data.totalUsers);
      expect(result.data.totalRevenue).toBeGreaterThan(0);
      expect(result.data.currencyDistribution.TON + result.data.currencyDistribution.USDT).toBe(100);
    });

    it('should cache overview responses appropriately', async () => {
      const organizationId = 'org-123';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      // First call - should fetch from API
      const result1 = await AnalyticsService.getOverview(organizationId, {
        startDate,
        endDate
      });

      // Second call with same parameters - should use cache
      const result2 = await AnalyticsService.getOverview(organizationId, {
        startDate,
        endDate
      });

      // Results should be identical
      expect(result1.data).toEqual(result2.data);
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);

      // Verify cache was used
      expect(mockCache.size).toBeGreaterThan(0);
    });

    it('should handle invalid date ranges gracefully', async () => {
      const organizationId = 'org-123';

      await expect(
        AnalyticsService.getOverview(organizationId, {
          startDate: 'invalid-date',
          endDate: '2024-01-31'
        })
      ).rejects.toThrow('Invalid date format');

      await expect(
        AnalyticsService.getOverview(organizationId, {
          startDate: '2024-01-31',
          endDate: '2024-01-01' // End before start
        })
      ).rejects.toThrow('End date must be after start date');
    });

    it('should maintain data consistency across different date ranges', async () => {
      const organizationId = 'org-123';

      const weeklyResult = await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      });

      const monthlyResult = await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // Monthly values should be greater or equal to weekly values
      expect(monthlyResult.data.totalRevenue).toBeGreaterThanOrEqual(weeklyResult.data.totalRevenue);
      expect(monthlyResult.data.completedTasks).toBeGreaterThanOrEqual(weeklyResult.data.completedTasks);
      expect(monthlyResult.data.totalProjects).toBeGreaterThanOrEqual(weeklyResult.data.totalProjects);

      // Structure should be consistent
      expect(Object.keys(weeklyResult.data)).toEqual(Object.keys(monthlyResult.data));
    });
  });

  describe('User Analytics Regression', () => {
    it('should return consistent user analytics structure', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getUserAnalytics(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(result).toMatchObject({
        totalUsers: expect.any(Number),
        activeUsers: expect.any(Number),
        newUsers: expect.any(Number),
        churnedUsers: expect.any(Number),
        userSegments: expect.objectContaining({
          workers: expect.any(Number),
          managers: expect.any(Number),
          admins: expect.any(Number)
        }),
        userActivity: expect.objectContaining({
          dailyActive: expect.any(Number),
          weeklyActive: expect.any(Number),
          monthlyActive: expect.any(Number)
        }),
        userPerformance: expect.objectContaining({
          averageTasksPerUser: expect.any(Number),
          averageAccuracy: expect.any(Number),
          averageEarnings: expect.any(Number)
        }),
        userRetention: expect.objectContaining({
          day1: expect.any(Number),
          day7: expect.any(Number),
          day30: expect.any(Number),
          day90: expect.any(Number)
        })
      });

      // Verify data consistency
      expect(result.data.totalUsers).toBeGreaterThan(0);
      expect(result.data.activeUsers).toBeLessThanOrEqual(result.data.totalUsers);
      expect(result.data.userActivity.dailyActive).toBeLessThanOrEqual(result.data.userActivity.monthlyActive);
      expect(result.data.userRetention.day1).toBeGreaterThanOrEqual(result.data.userRetention.day90));
      expect(result.data.userRetention.day1).toBeLessThanOrEqual(1.0);
    });

    it('should calculate user segment percentages correctly', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getUserAnalytics(organizationId, {});

      const { userSegments, totalUsers } = result;
      const segmentSum = userSegments.workers + userSegments.managers + userSegments.admins;

      expect(segmentSum).toBe(totalUsers);

      const workerPercentage = (userSegments.workers / totalUsers) * 100;
      expect(workerPercentage).toBeGreaterThan(70); // Workers should be majority
    });

    it('should maintain consistency between activity metrics', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getUserAnalytics(organizationId, {});

      const { userActivity, activeUsers } = result;

      // Daily should be <= weekly <= monthly
      expect(userActivity.dailyActive).toBeLessThanOrEqual(userActivity.weeklyActive);
      expect(userActivity.weeklyActive).toBeLessThanOrEqual(userActivity.monthlyActive);
      expect(userActivity.monthlyActive).toBe(activeUsers);
    });
  });

  describe('Project Analytics Regression', () => {
    it('should return consistent project analytics structure', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getProjectAnalytics(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(result).toMatchObject({
        totalProjects: expect.any(Number),
        activeProjects: expect.any(Number),
        completedProjects: expect.any(Number),
        cancelledProjects: expect.any(Number),
        projectTypes: expect.objectContaining({
          'image-classification': expect.any(Number),
          'text-labeling': expect.any(Number),
          'data-annotation': expect.any(Number),
          'audio-transcription': expect.any(Number)
        }),
        projectPerformance: expect.objectContaining({
          averageCompletionTime: expect.any(Number),
          averageCost: expect.any(Number),
          averageQuality: expect.any(Number),
          completionRate: expect.any(Number)
        }),
        projectRevenue: expect.objectContaining({
          totalRevenue: expect.any(Number),
          revenueByType: expect.objectContaining({
            'image-classification': expect.any(Number),
            'text-labeling': expect.any(Number),
            'data-annotation': expect.any(Number),
            'audio-transcription': expect.any(Number)
          })
        }),
        topProjects: expect.any(Array)
      });

      // Verify data consistency
      expect(result.data.totalProjects).toBeGreaterThan(0);
      expect(result.data.activeProjects).toBeLessThanOrEqual(result.data.totalProjects);
      expect(result.data.completedProjects).toBeLessThanOrEqual(result.data.totalProjects);
      expect(result.data.projectPerformance.completionRate).toBeGreaterThan(0);
      expect(result.data.projectPerformance.completionRate).toBeLessThanOrEqual(1.0);
    });

    it('should ensure project type consistency', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getProjectAnalytics(organizationId, {});

      const { projectTypes, totalProjects } = result;
      const typeSum = Object.values(projectTypes).reduce((sum: number, count: number) => sum + count, 0);

      expect(typeSum).toBe(totalProjects);
      expect(Object.keys(projectTypes)).toContain('image-classification');
      expect(Object.keys(projectTypes)).toContain('text-labeling');
    });

    it('should maintain revenue consistency across project types', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getProjectAnalytics(organizationId, {});

      const { projectRevenue, revenueByType } = result;
      const revenueSum = Object.values(revenueByType).reduce((sum: number, revenue: number) => sum + revenue, 0);

      expect(revenueSum).toBe(projectRevenue.totalRevenue);
      expect(projectRevenue.totalRevenue).toBeGreaterThan(0);
    });

    it('should validate top projects ordering', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getProjectAnalytics(organizationId, {});

      const { topProjects } = result;

      expect(topProjects).toHaveLength(2);
      expect(topProjects[0].revenue).toBeGreaterThanOrEqual(topProjects[1].revenue);
      expect(topProjects[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        revenue: expect.any(Number),
        tasks: expect.any(Number),
        workers: expect.any(Number)
      });
    });
  });

  describe('Workflow Analytics Regression', () => {
    it('should return consistent workflow analytics structure', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getWorkflowAnalytics(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(result).toMatchObject({
        totalWorkflows: expect.any(Number),
        activeWorkflows: expect.any(Number),
        workflowEfficiency: expect.any(Number),
        automationRate: expect.any(Number),
        workflowStages: expect.objectContaining({
          'data-ingestion': expect.objectContaining({
            avgTime: expect.any(Number),
            successRate: expect.any(Number)
          }),
          'task-distribution': expect.objectContaining({
            avgTime: expect.any(Number),
            successRate: expect.any(Number)
          }),
          'quality-control': expect.objectContaining({
            avgTime: expect.any(Number),
            successRate: expect.any(Number)
          }),
          'payment-processing': expect.objectContaining({
            avgTime: expect.any(Number),
            successRate: expect.any(Number)
          })
        }),
        bottlenecks: expect.any(Array),
        workflowMetrics: expect.objectContaining({
          averageProcessingTime: expect.any(Number),
          throughput: expect.any(Number),
          errorRate: expect.any(Number),
          reworkRate: expect.any(Number)
        })
      });

      // Verify data consistency
      expect(result.data.totalWorkflows).toBeGreaterThan(0);
      expect(result.data.activeWorkflows).toBeLessThanOrEqual(result.data.totalWorkflows);
      expect(result.data.workflowEfficiency).toBeGreaterThan(0);
      expect(result.data.workflowEfficiency).toBeLessThanOrEqual(1.0);
      expect(result.data.automationRate).toBeGreaterThan(0);
      expect(result.data.automationRate).toBeLessThanOrEqual(1.0);
    });

    it('should validate workflow stage performance', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getWorkflowAnalytics(organizationId, {});

      const { workflowStages } = result;

      Object.entries(workflowStages).forEach(([stageName, stage]: [string, any]) => {
        expect(stage.avgTime).toBeGreaterThan(0);
        expect(stage.successRate).toBeGreaterThan(0);
        expect(stage.successRate).toBeLessThanOrEqual(1.0);
      });
    });

    it('should identify and validate bottlenecks', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getWorkflowAnalytics(organizationId, {});

      const { bottlenecks, workflowStages } = result;

      if (bottlenecks.length > 0) {
        bottlenecks.forEach((bottleneck: any) => {
          expect(bottleneck).toMatchObject({
            stage: expect.any(String),
            avgTime: expect.any(Number),
            targetTime: expect.any(Number),
            impact: expect.any(String)
          });

          expect(bottleneck.avgTime).toBeGreaterThan(bottleneck.targetTime);
          expect(['low', 'medium', 'high']).toContain(bottleneck.impact);
        });
      }
    });
  });

  describe('Specific Metric Regression', () => {
    it('should return consistent metric data structure', async () => {
      const organizationId = 'org-123';
      const metric = 'revenue';

      const result = await AnalyticsService.getMetric(organizationId, metric, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(result).toMatchObject({
        metric: 'revenue',
        value: expect.any(Object),
        organizationId: 'org-123',
        timestamp: expect.any(String)
      });

      expect(result.value).toMatchObject({
        total: expect.any(Number),
        monthly: expect.any(Array),
        growth: expect.any(Number)
      });
    });

    it('should handle invalid metric requests gracefully', async () => {
      const organizationId = 'org-123';
      const invalidMetric = 'invalid-metric';

      await expect(
        AnalyticsService.getMetric(organizationId, invalidMetric, {})
      ).rejects.toThrow('Unsupported metric: invalid-metric');
    });

    it('should validate metric data consistency', async () => {
      const organizationId = 'org-123';

      // Test different metrics
      const metrics = ['revenue', 'users', 'tasks'];

      for (const metric of metrics) {
        const result = await AnalyticsService.getMetric(organizationId, metric, {});

        expect(result.metric).toBe(metric);
        expect(result.organizationId).toBe(organizationId);
        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

        // Metric-specific validations
        if (metric === 'revenue') {
          expect(result.value.total).toBeGreaterThan(0);
          expect(Array.isArray(result.value.monthly)).toBe(true);
        } else if (metric === 'users') {
          expect(result.value.total).toBeGreaterThan(0);
          expect(result.value.active).toBeLessThanOrEqual(result.value.total);
          expect(result.value.retention).toBeGreaterThan(0);
          expect(result.value.retention).toBeLessThanOrEqual(1.0);
        } else if (metric === 'tasks') {
          expect(result.value.total).toBeGreaterThan(0);
          expect(result.value.completed).toBeLessThanOrEqual(result.value.total);
        }
      }
    });
  });

  describe('Data Export Regression', () => {
    it('should export data in correct CSV format', async () => {
      const organizationId = 'org-123';
      const exportOptions = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        metrics: ['revenue', 'users', 'tasks']
      };

      const result = await AnalyticsService.exportToCsv(organizationId, exportOptions);

      expect(result).toMatchObject({
        filename: expect.stringMatching(/^analytics-.*\.csv$/),
        content: expect.stringContaining('Date,Revenue,Users,Tasks')
      });

      // Verify CSV structure
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('Date,Revenue,Users,Tasks'); // Header
      expect(lines[1]).toContain('2024-01-01');
      expect(lines[1]).toContain('50000');
      expect(lines[1]).toContain('150');
      expect(lines[1]).toContain('1250');
    });

    it('should handle export validation errors', async () => {
      const organizationId = 'org-123';

      // Missing required parameters
      await expect(
        AnalyticsService.exportToCsv(organizationId, {
          startDate: '2024-01-01'
        } as any)
      ).rejects.toThrow('Missing required export parameters');

      await expect(
        AnalyticsService.exportToCsv(organizationId, {
          endDate: '2024-01-31',
          metrics: ['revenue']
        } as any)
      ).rejects.toThrow('Missing required export parameters');

      await expect(
        AnalyticsService.exportToCsv(organizationId, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        } as any)
      ).rejects.toThrow('Missing required export parameters');
    });

    it('should export only requested metrics', async () => {
      const organizationId = 'org-123';

      const limitedExport = await AnalyticsService.exportToCsv(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        metrics: ['revenue']
      });

      expect(limitedExport.content).toContain('Date,Revenue');
      expect(limitedExport.content).not.toContain('Users');
      expect(limitedExport.content).not.toContain('Tasks');
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain acceptable response times', async () => {
      const organizationId = 'org-123';
      const startTime = Date.now();

      await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const organizationId = 'org-123';
      const concurrentRequests = 10;

      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill(null).map(() =>
        AnalyticsService.getOverview(organizationId, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.data).toBeDefined();
        expect(result.cached).toBeDefined();
      });

      // Should handle concurrent requests efficiently (less than 2x the single request time)
      expect(totalTime).toBeLessThan(10000);
    });

    it('should use cache effectively for repeated requests', async () => {
      const organizationId = 'org-123';
      const options = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      // First request - no cache
      const startTime1 = Date.now();
      const result1 = await AnalyticsService.getOverview(organizationId, options);
      const time1 = Date.now() - startTime1;

      // Second request - should use cache
      const startTime2 = Date.now();
      const result2 = await AnalyticsService.getOverview(organizationId, options);
      const time2 = Date.now() - startTime2;

      // Cached request should be faster
      expect(time2).toBeLessThan(time1);
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result1.data).toEqual(result2.data);
    });
  });

  describe('Error Handling Regression', () => {
    it('should handle network failures gracefully', async () => {
      // Mock network failure
      analyticsServer.use(
        rest.get('/organizations/:organizationId/analytics/overview', (req, res, ctx) => {
          return res.networkError('Network connection failed');
        })
      );

      const organizationId = 'org-123';

      await expect(
        AnalyticsService.getOverview(organizationId, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      ).rejects.toThrow();

      // Should log the error
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response
      analyticsServer.use(
        rest.get('/organizations/:organizationId/analytics/overview', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.set('Content-Type', 'application/json'),
            ctx.body('invalid json response')
          );
        })
      );

      const organizationId = 'org-123';

      await expect(
        AnalyticsService.getOverview(organizationId, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      ).rejects.toThrow();
    });

    it('should handle rate limiting gracefully', async () => {
      // Mock rate limiting
      analyticsServer.use(
        rest.get('/organizations/:organizationId/analytics/overview', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              success: false,
              error: 'Too many requests, please try again later.'
            })
          );
        })
      );

      const organizationId = 'org-123';

      await expect(
        AnalyticsService.getOverview(organizationId, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      ).rejects.toThrow('Too many requests');
    });
  });

  describe('Data Integrity Regression', () => {
    it('should maintain numerical precision in financial data', async () => {
      const organizationId = 'org-123';
      const result = await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // Financial values should be precise
      expect(typeof result.data.totalRevenue).toBe('number');
      expect(result.data.totalRevenue).toBeGreaterThan(0);
      expect(Number.isInteger(result.data.totalRevenue)).toBe(true);

      // Percentages should be within valid range
      expect(result.data.currencyDistribution.TON).toBeGreaterThanOrEqual(0);
      expect(result.data.currencyDistribution.TON).toBeLessThanOrEqual(100);
    });

    it('should validate business logic constraints', async () => {
      const organizationId = 'org-123';

      // Get multiple data types
      const [overview, userAnalytics, projectAnalytics] = await Promise.all([
        AnalyticsService.getOverview(organizationId, {}),
        AnalyticsService.getUserAnalytics(organizationId, {}),
        AnalyticsService.getProjectAnalytics(organizationId, {})
      ]);

      // Business logic validations
      expect(overview.data.activeUsers).toBeLessThanOrEqual(userAnalytics.data.totalUsers);
      expect(overview.data.completedTasks).toBeGreaterThan(0);
      expect(projectAnalytics.data.completedProjects).toBeLessThanOrEqual(projectAnalytics.data.totalProjects);
      expect(userAnalytics.data.userRetention.day1).toBeGreaterThanOrEqual(userAnalytics.data.userRetention.day90);
    });

    it('should ensure temporal consistency', async () => {
      const organizationId = 'org-123';

      // Get data for different time periods
      const weeklyData = await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-07'
      });

      const monthlyData = await AnalyticsService.getOverview(organizationId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      // Monthly data should encompass weekly data
      expect(monthlyData.data.totalRevenue).toBeGreaterThanOrEqual(weeklyData.data.totalRevenue);
      expect(monthlyData.data.completedTasks).toBeGreaterThanOrEqual(weeklyData.data.completedTasks);

      // Growth rates should be reasonable
      expect(monthlyData.data.growthMetrics.revenueGrowth).toBeGreaterThan(-100);
      expect(monthlyData.data.growthMetrics.revenueGrowth).toBeLessThan(1000);
    });
  });
});