import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../app.js', () => {
  const fn = vi.fn
  return {
    prisma: {
      organizationUser: {
        count: fn(),
        findMany: fn()
      },
      team: {
        findMany: fn()
      },
      project: {
        count: fn(),
        findMany: fn()
      },
      workflow: {
        count: fn(),
        findMany: fn()
      },
      workflowExecution: {
        count: fn(),
        findMany: fn()
      },
    },
    redis: {
      get: fn(),
      setex: fn()
    }
  }
})

vi.mock('../../middleware/multiTenant.js', () => ({
  calculateStorageUsage: vi.fn().mockResolvedValue(12.345)
}))

const { prisma, redis } = await import('../../app.js')
const { calculateStorageUsage } = await import('../../middleware/multiTenant.js')
const { AnalyticsService } = await import('../AnalyticsService.js')

describe('AnalyticsService', () => {
  const defaultRange = {
    start: new Date('2025-01-01T00:00:00.000Z'),
    end: new Date('2025-01-07T00:00:00.000Z')
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cached overview when available', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify({ hello: 'world' }))

    const result = await AnalyticsService.getOverview('org-1', defaultRange)

    expect(result.cached).toBe(true)
    expect(result.data).toEqual({ hello: 'world' })
    expect(prisma.organizationUser.count).not.toHaveBeenCalled()
  })

  it('computes overview metrics and caches result', async () => {
    redis.get.mockResolvedValueOnce(null)

    prisma.organizationUser.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(6) // active
      .mockResolvedValueOnce(3) // new
    prisma.project.count
      .mockResolvedValueOnce(8) // total projects
      .mockResolvedValueOnce(5) // active projects
    prisma.workflow.count.mockResolvedValueOnce(4)
    prisma.workflowExecution.count.mockResolvedValueOnce(2)

    const result = await AnalyticsService.getOverview('org-1', defaultRange)

    expect(result.cached).toBe(false)
    expect(result.data.users.total).toBe(10)
    expect(result.data.projects.active).toBe(5)
    expect(calculateStorageUsage).toHaveBeenCalledWith('org-1')
    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('analytics:org-1:overview'),
      900,
      expect.any(String)
    )
  })

  it('aggregates user analytics across days and roles', async () => {
    prisma.organizationUser.findMany.mockResolvedValueOnce([
      {
        createdAt: new Date('2025-01-02T10:00:00Z'),
        lastLoginAt: new Date('2025-01-03T12:00:00Z'),
        role: 'ADMIN',
        isActive: true
      },
      {
        createdAt: new Date('2025-01-03T09:00:00Z'),
        lastLoginAt: null,
        role: 'MEMBER',
        isActive: true
      }
    ])

    const data = await AnalyticsService.getUserAnalytics('org-1', defaultRange)

    expect(data.newMembers.find(point => point.date === '2025-01-02')?.value).toBe(1)
    expect(data.newMembers.find(point => point.date === '2025-01-03')?.value).toBe(1)
    expect(data.activeMembers.find(point => point.date === '2025-01-03')?.value).toBe(1)
    expect(data.roles).toEqual(
      expect.arrayContaining([
        { role: 'ADMIN', count: 1 },
        { role: 'MEMBER', count: 1 }
      ])
    )
  })

  it('returns metric values and throws for unsupported metric', async () => {
    prisma.organizationUser.count.mockResolvedValueOnce(5)
    const result = await AnalyticsService.getMetric('org-1', 'users_active', defaultRange)
    expect(result.value).toBe(5)

    await expect(
      AnalyticsService.getMetric('org-1', 'unknown_metric' as any, defaultRange)
    ).rejects.toThrow('Unsupported metric')
  })

  it('exports analytics data to CSV', async () => {
    redis.get.mockResolvedValueOnce(null)
    prisma.organizationUser.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
    prisma.project.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
    prisma.workflow.count.mockResolvedValueOnce(1)
    prisma.workflowExecution.count.mockResolvedValueOnce(0)

    prisma.organizationUser.findMany.mockResolvedValueOnce([])
    prisma.project.findMany.mockResolvedValueOnce([])
    prisma.team.findMany.mockResolvedValueOnce([])
    prisma.workflow.findMany.mockResolvedValueOnce([])
    prisma.workflowExecution.findMany.mockResolvedValueOnce([])

    const csv = await AnalyticsService.exportToCsv('org-1', {
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      metrics: ['overview']
    })

    expect(csv.filename).toContain('org-1')
    expect(csv.content).toContain('overview,total_users,10')
  })
})
