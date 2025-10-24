import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { prisma, redis } from '../app.js'
import { logger } from '../utils/logger.js'

const STORAGE_USAGE_CACHE_TTL_SECONDS = 300
export const BYTES_IN_GIGABYTE = 1024 * 1024 * 1024

type StorageSource = {
  table: string
  sizeColumn: string
  organizationColumn: string
  filters?: string
}

const STORAGE_SOURCES: StorageSource[] = [
  {
    table: 'dataset_files',
    sizeColumn: 'file_size_bytes',
    organizationColumn: 'organization_id'
  },
  {
    table: 'project_files',
    sizeColumn: 'size_bytes',
    organizationColumn: 'organization_id'
  },
  {
    table: 'project_exports',
    sizeColumn: 'size_bytes',
    organizationColumn: 'organization_id'
  },
  {
    table: 'workflow_exports',
    sizeColumn: 'file_size_bytes',
    organizationColumn: 'organization_id'
  },
  {
    table: 'attachments',
    sizeColumn: 'file_size',
    organizationColumn: 'organization_id'
  },
  {
    table: 'organization_storage_usage',
    sizeColumn: 'bytes_used',
    organizationColumn: 'organization_id'
  }
]

let prismaClient = prisma
let redisClient = redis

export function __setTenantTestClients(options: {
  prisma?: typeof prisma
  redis?: typeof redis
}) {
  if (options.prisma) {
    prismaClient = options.prisma as any
  }
  if (options.redis) {
    redisClient = options.redis as any
  }
}

export function __resetTenantTestClients() {
  prismaClient = prisma
  redisClient = redis
}

export const __debugTenantClients = {
  getPrisma: () => prismaClient,
  getRedis: () => redisClient
}

/**
 * Middleware to ensure proper tenant isolation
 * This middleware runs after tenantMiddleware but adds additional checks
 */
export async function multiTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizationId = req.headers['x-organization-id'] as string
    const userId = req.user?.id

    if (!organizationId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID and user ID are required'
      })
      return
    }

    // Verify organization exists and is active
    const organization = await prismaClient.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        settings: true,
        subscription: true
      }
    })

    if (!organization) {
      res.status(404).json({
        success: false,
        error: 'Organization not found'
      })
      return
    }

    if (organization.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Organization is not active'
      })
      return
    }

    // Check if user is member of the organization
    const membership = await prismaClient.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      select: {
        id: true,
        role: true,
        status: true,
        permissions: true
      }
    })

    if (!membership || membership.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Access denied: Not a member of this organization'
      })
      return
    }

    // Add organization and membership info to request
    req.organization = organization
    req.membership = membership

    // Log access for security monitoring
    logger.debug('Multi-tenant access', {
      organizationId,
      userId,
      role: membership.role,
      path: req.path,
      method: req.method
    })

    next()
  } catch (error) {
    logger.error('Multi-tenant middleware error', {
      error: error.message,
      organizationId: req.headers['x-organization-id'],
      userId: req.user?.id
    })

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

/**
 * Middleware to check tenant-specific subscription limits
 */
export function checkSubscriptionLimit(limitType: string, limitName?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organization = req.organization

      if (!organization?.subscription) {
        res.status(403).json({
          success: false,
          error: 'No subscription found'
        })
        return
      }

      const subscription = organization.subscription as any
      const limits = subscription.limits || {}

      // Get current usage
      let currentUsage = 0

      switch (limitType) {
        case 'teams':
          currentUsage = await prismaClient.team.count({
            where: {
              organizationId: organization.id,
              archivedAt: null
            }
          })
          break

        case 'users':
          currentUsage = await prismaClient.organizationMember.count({
            where: {
              organizationId: organization.id,
              status: 'active'
            }
          })
          break

        case 'projects':
          currentUsage = await prismaClient.project.count({
            where: {
              team: {
                organizationId: organization.id
              },
              status: { not: 'archived' }
            }
          })
          break

        case 'storage': {
          const usageGb = await calculateStorageUsage(organization.id)
          currentUsage = usageGb
          break
        }

        default:
          logger.warn('Unknown limit type', { limitType })
          next()
          return
      }

      const limit = limits[limitName || limitType] || 0

      if (currentUsage >= limit) {
        res.status(429).json({
          success: false,
          error: `Subscription limit reached`,
          details: {
            type: limitType,
            current: currentUsage,
            limit,
            plan: subscription.plan
          }
        })
        return
      }

      // Add usage info to request for potential use in controllers
      req.usage = {
        type: limitType,
        current: currentUsage,
        limit,
        unit: limitType === 'storage' ? 'GB' : 'count',
        metadata: limitType === 'storage'
          ? {
              bytes: Math.round(currentUsage * BYTES_IN_GIGABYTE),
              calculatedAt: new Date().toISOString()
            }
          : undefined
      }

      next()
    } catch (error) {
      logger.error('Subscription limit check error', {
        error: error.message,
        limitType,
        organizationId: req.organization?.id
      })

      next(error)
    }
  }
}

async function calculateStorageUsage(organizationId: string): Promise<number> {
  const cacheKey = `org:${organizationId}:storage-usage`
  const cached = await redisClient.get(cacheKey)
  if (cached) {
    const cachedValue = parseFloat(cached)
    if (!Number.isNaN(cachedValue)) {
      return cachedValue
    }
  }

  let totalBytes = 0

  for (const source of STORAGE_SOURCES) {
    totalBytes += await sumStorageFromSource(source, organizationId)
  }

  // Ensure non-negative
  totalBytes = Math.max(0, totalBytes)

  const usageGb = totalBytes / BYTES_IN_GIGABYTE

  await redisClient.setex(
    cacheKey,
    STORAGE_USAGE_CACHE_TTL_SECONDS,
    usageGb.toString()
  ).catch(error => {
    logger.warn('Failed to cache storage usage', {
      organizationId,
      error: error.message
    })
  })

  return usageGb
}

async function sumStorageFromSource(
  source: StorageSource,
  organizationId: string,
  client: typeof prismaClient = prismaClient
): Promise<number> {
  try {
    const exists = await tableExists(source.table, client)
    if (!exists) {
      return 0
    }

    let whereClause = Prisma.sql`${Prisma.raw(source.organizationColumn)} = ${organizationId}`
    if (source.filters) {
      whereClause = Prisma.sql`${whereClause} AND ${Prisma.raw(source.filters)}`
    }

    const query = Prisma.sql`
      SELECT COALESCE(SUM(${Prisma.raw(source.sizeColumn)}), 0) AS total
      FROM ${Prisma.raw(source.table)}
      WHERE ${whereClause}
    `

    const rows = await client.$queryRaw<{ total: bigint | number | null }[]>(query)

    const value = rows?.[0]?.total ?? 0
    if (typeof value === 'bigint') {
      return Number(value)
    }
    return Number(value) || 0
  } catch (error) {
    logger.warn('Failed to fetch storage usage from source', {
      table: source.table,
      error: error.message
    })
    return 0
  }
}

async function tableExists(
  tableName: string,
  client: typeof prismaClient = prismaClient
): Promise<boolean> {
  try {
    const result = await client.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
      ) AS exists
    `)

    return Boolean(result?.[0]?.exists)
  } catch (error) {
    logger.warn('Failed to determine table existence', {
      tableName,
      error: error.message
    })
    return false
  }
}

export const __storageUtils = {
  calculateStorageUsage,
  sumStorageFromSource,
  tableExists
}

export { calculateStorageUsage }

/**
 * Middleware to enforce tenant data isolation at query level
 * This intercepts Prisma queries and adds tenant filters
 */
export class TenantQueryInterceptor {
  private static instance: TenantQueryInterceptor
  private originalFindMany: any
  private originalFindFirst: any
  private originalFindUnique: any
  private originalCreate: any
  private originalUpdate: any
  private originalDelete: any
  private originalCount: any

  static getInstance(): TenantQueryInterceptor {
    if (!this.instance) {
      this.instance = new TenantQueryInterceptor()
    }
    return this.instance
  }

  /**
   * Initialize tenant isolation for the current request context
   */
  static initialize(req: Request): void {
    const instance = this.getInstance()
    const organizationId = req.headers['x-organization-id'] as string

    if (!organizationId) return

    // Store original methods if not already stored
    if (!instance.originalFindMany) {
      instance.originalFindMany = prismaClient['team']?.findMany
      instance.originalFindFirst = prismaClient['team']?.findFirst
      instance.originalFindUnique = prismaClient['team']?.findUnique
      instance.originalCreate = prismaClient['team']?.create
      instance.originalUpdate = prismaClient['team']?.update
      instance.originalDelete = prismaClient['team']?.delete
      instance.originalCount = prismaClient['team']?.count
    }

    // Override methods to add tenant filters
    this.addTenantFilters(organizationId)
  }

  /**
   * Clean up tenant filters after request
   */
  static cleanup(): void {
    const instance = this.getInstance()

    // Restore original methods
    if (instance.originalFindMany && prismaClient['team']) {
      prismaClient['team'].findMany = instance.originalFindMany
      prismaClient['team'].findFirst = instance.originalFindFirst
      prismaClient['team'].findUnique = instance.originalFindUnique
      prismaClient['team'].create = instance.originalCreate
      prismaClient['team'].update = instance.originalUpdate
      prismaClient['team'].delete = instance.originalDelete
      prismaClient['team'].count = instance.originalCount
    }
  }

  private static addTenantFilters(organizationId: string): void {
    // Add tenant filters to team model queries
    const teamModel = prismaClient['team']
    if (!teamModel) return

    // Override findMany
    teamModel.findMany = (args?: any) => {
      const filteredArgs = this.addOrganizationFilter(args, organizationId)
      return this.getInstance().originalFindMany.call(teamModel, filteredArgs)
    }

    // Override findFirst
    teamModel.findFirst = (args?: any) => {
      const filteredArgs = this.addOrganizationFilter(args, organizationId)
      return this.getInstance().originalFindFirst.call(teamModel, filteredArgs)
    }

    // Override findUnique
    teamModel.findUnique = (args?: any) => {
      // For findUnique, we need to be more careful
      // Only add filter if it's not already filtered by ID
      if (!args?.where?.id) {
        const filteredArgs = this.addOrganizationFilter(args, organizationId)
        return this.getInstance().originalFindUnique.call(teamModel, filteredArgs)
      }
      return this.getInstance().originalFindUnique.call(teamModel, args)
    }

    // Override count
    teamModel.count = (args?: any) => {
      const filteredArgs = this.addOrganizationFilter(args, organizationId)
      return this.getInstance().originalCount.call(teamModel, filteredArgs)
    }
  }

  private static addOrganizationFilter(args: any, organizationId: string): any {
    if (!args) {
      return { where: { organizationId } }
    }

    if (!args.where) {
      return { ...args, where: { organizationId } }
    }

    // Merge organization filter with existing where clause
    return {
      ...args,
      where: {
        ...args.where,
        organizationId
      }
    }
  }
}

/**
 * Middleware to set up and clean up tenant query interception
 */
export function tenantQueryInterceptor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Initialize tenant isolation
  TenantQueryInterceptor.initialize(req)

  // Clean up after response
  res.on('finish', () => {
    TenantQueryInterceptor.cleanup()
  })

  next()
}

/**
 * Middleware to check if feature is enabled for tenant's subscription plan
 */
export function checkFeature(featureName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const organization = req.organization

    if (!organization) {
      res.status(400).json({
        success: false,
        error: 'Organization not found'
      })
      return
    }

    const subscription = organization.subscription as any
    const features = subscription.features || {}

    if (!features[featureName]) {
      res.status(403).json({
        success: false,
        error: `Feature '${featureName}' is not available in your current plan`,
        details: {
          feature: featureName,
          plan: subscription.plan
        }
      })
      return
    }

    next()
  }
}

// Extend Request interface to include organization and membership
declare global {
  namespace Express {
    interface Request {
      organization?: any
      membership?: any
      usage?: {
        type: string
        current: number
        limit: number
        unit?: string
        metadata?: Record<string, any>
      }
    }
  }
}
