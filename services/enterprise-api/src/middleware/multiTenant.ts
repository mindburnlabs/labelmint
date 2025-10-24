import { Request, Response, NextFunction } from 'express'
import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'

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
    const organization = await prisma.organization.findUnique({
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
    const membership = await prisma.organizationMember.findUnique({
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
          currentUsage = await prisma.team.count({
            where: {
              organizationId: organization.id,
              archivedAt: null
            }
          })
          break

        case 'users':
          currentUsage = await prisma.organizationMember.count({
            where: {
              organizationId: organization.id,
              status: 'active'
            }
          })
          break

        case 'projects':
          currentUsage = await prisma.project.count({
            where: {
              team: {
                organizationId: organization.id
              },
              status: { not: 'archived' }
            }
          })
          break

        case 'storage':
          // TODO: Implement storage usage calculation
          currentUsage = 0
          break

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
        limit
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
      instance.originalFindMany = prisma['team']?.findMany
      instance.originalFindFirst = prisma['team']?.findFirst
      instance.originalFindUnique = prisma['team']?.findUnique
      instance.originalCreate = prisma['team']?.create
      instance.originalUpdate = prisma['team']?.update
      instance.originalDelete = prisma['team']?.delete
      instance.originalCount = prisma['team']?.count
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
    if (instance.originalFindMany && prisma['team']) {
      prisma['team'].findMany = instance.originalFindMany
      prisma['team'].findFirst = instance.originalFindFirst
      prisma['team'].findUnique = instance.originalFindUnique
      prisma['team'].create = instance.originalCreate
      prisma['team'].update = instance.originalUpdate
      prisma['team'].delete = instance.originalDelete
      prisma['team'].count = instance.originalCount
    }
  }

  private static addTenantFilters(organizationId: string): void {
    // Add tenant filters to team model queries
    const teamModel = prisma['team']
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
      }
    }
  }
}