import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'

export interface AuditLogData {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
}

export class AuditService {
  /**
   * Log an audit event
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: data.organizationId,
          userId: data.userId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: data.details ? JSON.stringify(data.details) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date()
        }
      })

      logger.debug('Audit log created', {
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId
      })
    } catch (error) {
      logger.error('Failed to create audit log', {
        error: error.message,
        data
      })
      // Don't throw error - audit logging failure shouldn't break the main flow
    }
  }

  /**
   * Query audit logs
   */
  static async query(organizationId: string, options: {
    userId?: string
    action?: string
    resourceType?: string
    resourceId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  } = {}): Promise<{ logs: any[]; total: number }> {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = options

    const where: any = {
      organizationId
    }

    if (userId) where.userId = userId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (resourceType) where.resourceType = resourceType
    if (resourceId) where.resourceId = resourceId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = startDate
      if (endDate) where.timestamp.lte = endDate
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ])

    // Parse details JSON
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }))

    return { logs: parsedLogs, total }
  }

  /**
   * Get audit statistics
   */
  static async getStats(organizationId: string, days: number = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [
      totalLogs,
      topActions,
      topUsers,
      topResources
    ] = await Promise.all([
      prisma.auditLog.count({
        where: {
          organizationId,
          timestamp: { gte: startDate }
        }
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          organizationId,
          timestamp: { gte: startDate }
        },
        _count: {
          action: true
        },
        orderBy: {
          _count: {
            action: 'desc'
          }
        },
        take: 10
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          organizationId,
          timestamp: { gte: startDate }
        },
        _count: {
          userId: true
        },
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: 10
      }),
      prisma.auditLog.groupBy({
        by: ['resourceType'],
        where: {
          organizationId,
          timestamp: { gte: startDate }
        },
        _count: {
          resourceType: true
        },
        orderBy: {
          _count: {
            resourceType: 'desc'
          }
        },
        take: 10
      })
    ])

    // Get user details for top users
    const userIds = topUsers.map(u => u.userId)
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true
      }
    }) : []

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user
      return acc
    }, {})

    return {
      totalLogs,
      periodDays: days,
      topActions: topActions.map(action => ({
        action: action.action,
        count: action._count.action
      })),
      topUsers: topUsers.map(user => ({
        user: userMap[user.userId],
        count: user._count.userId
      })),
      topResources: topResources.map(resource => ({
        resourceType: resource.resourceType,
        count: resource._count.resourceType
      }))
    }
  }
}