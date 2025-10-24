import { Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { OrganizationService } from '../services/OrganizationService.js'
import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import {
  Organization,
  OrganizationSettings,
  Subscription
} from '../types/enterprise.js'

export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  /**
   * Create a new organization
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
        return
      }

      const { name, domain, plan, settings } = req.body
      const userId = req.user.id

      const organization = await this.organizationService.create({
        name,
        domain,
        userId,
        plan,
        settings
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId: organization.id,
          action: 'create_organization',
          resource: 'organization',
          resourceId: organization.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
          changes: {
            before: null,
            after: {
              name,
              domain,
              plan,
              settings
            }
          }
        }
      })

      res.status(201).json({
        success: true,
        data: organization
      })
    } catch (error) {
      logger.error('Failed to create organization', error)
      res.status(500).json({
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get organization details
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const organization = await this.organizationService.getById(id)

      if (!organization) {
        res.status(404).json({
          error: 'Organization not found'
        })
        return
      }

      // Check if user has access
      const hasAccess = await this.checkUserAccess(req.user.id, organization.id)
      if (!hasAccess) {
        res.status(403).json({
          error: 'Access denied'
        })
        return
      }

      res.json({
        success: true,
        data: organization
      })
    } catch (error) {
      logger.error('Failed to get organization', error)
      res.status(500).json({
        error: 'Failed to get organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Update organization
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
        return
      }

      const { id } = req.params
      const updates = req.body

      // Check if user has permission to update
      const hasPermission = await this.checkUserPermission(
        req.user.id,
        id,
        'manage_organization'
      )

      if (!hasPermission) {
        res.status(403).json({
          error: 'Permission denied'
        })
        return
      }

      // Get current organization for audit
      const before = await this.organizationService.getById(id)
      if (!before) {
        res.status(404).json({
          error: 'Organization not found'
        })
        return
      }

      const organization = await this.organizationService.update(id, updates)

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          organizationId: id,
          action: 'update_organization',
          resource: 'organization',
          resourceId: id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
          changes: {
            before,
            after: updates
          }
        }
      })

      res.json({
        success: true,
        data: organization
      })
    } catch (error) {
      logger.error('Failed to update organization', error)
      res.status(500).json({
        error: 'Failed to update organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Update organization settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const settings = req.body

      // Check permission
      const hasPermission = await this.checkUserPermission(
        req.user.id,
        id,
        'manage_settings'
      )

      if (!hasPermission) {
        res.status(403).json({
          error: 'Permission denied'
        })
        return
      }

      const organization = await this.organizationService.updateSettings(id, settings)

      res.json({
        success: true,
        data: organization
      })
    } catch (error) {
      logger.error('Failed to update organization settings', error)
      res.status(500).json({
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const subscription = req.body

      // Check permission (only owner or admin can update subscription)
      const hasPermission = await this.checkUserPermission(
        req.user.id,
        id,
        'manage_subscription'
      )

      if (!hasPermission) {
        res.status(403).json({
          error: 'Permission denied'
        })
        return
      }

      const organization = await this.organizationService.updateSubscription(
        id,
        subscription
      )

      res.json({
        success: true,
        data: organization
      })
    } catch (error) {
      logger.error('Failed to update subscription', error)
      res.status(500).json({
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Deactivate organization
   */
  async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      // Only organization owner can deactivate
      const isOwner = await this.isOrganizationOwner(req.user.id, id)
      if (!isOwner) {
        res.status(403).json({
          error: 'Only organization owner can deactivate organization'
        })
        return
      }

      await this.organizationService.deactivate(id)

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          organizationId: id,
          action: 'deactivate_organization',
          resource: 'organization',
          resourceId: id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
          changes: {
            before: { status: 'active' },
            after: { status: 'inactive' }
          }
        }
      })

      res.json({
        success: true,
        message: 'Organization deactivated successfully'
      })
    } catch (error) {
      logger.error('Failed to deactivate organization', error)
      res.status(500).json({
        error: 'Failed to deactivate organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * List organizations for user
   */
  async listUserOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id
      const { page = 1, limit = 20, status } = req.query

      const organizations = await this.organizationService.getByUser(userId)

      // Filter by status if provided
      const filtered = status
        ? organizations.filter((org: any) => org.status === status)
        : organizations

      // Paginate
      const startIndex = (Number(page) - 1) * Number(limit)
      const endIndex = startIndex + Number(limit)
      const paginated = filtered.slice(startIndex, endIndex)

      res.json({
        success: true,
        data: {
          organizations: paginated,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: filtered.length,
            pages: Math.ceil(filtered.length / Number(limit))
          }
        }
      })
    } catch (error) {
      logger.error('Failed to list user organizations', error)
      res.status(500).json({
        error: 'Failed to list organizations',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get organization metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { period = '30d' } = req.query

      // Check permission
      const hasAccess = await this.checkUserAccess(req.user.id, id)
      if (!hasAccess) {
        res.status(403).json({
          error: 'Access denied'
        })
        return
      }

      const metrics = await this.organizationService.getMetrics(
        id,
        period as string
      )

      res.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      logger.error('Failed to get organization metrics', error)
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Invite user to organization
   */
  async inviteUser(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
        return
      }

      const { id } = req.params
      const { email, role, teamIds, message } = req.body

      // Check permission
      const hasPermission = await this.checkUserPermission(
        req.user.id,
        id,
        'invite_users'
      )

      if (!hasPermission) {
        res.status(403).json({
          error: 'Permission denied'
        })
        return
      }

      const invitation = await this.organizationService.inviteUser(id, {
        email,
        role,
        teamIds,
        message
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          organizationId: id,
          action: 'invite_user',
          resource: 'invitation',
          resourceId: invitation.inviteId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
          changes: {
            email,
            role,
            teamIds,
            invitationId: invitation.inviteId
          }
        }
      })

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Invitation sent successfully'
      })
    } catch (error) {
      logger.error('Failed to invite user', error)
      res.status(500).json({
        error: 'Failed to send invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * List pending invitations
   */
  async listInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { status = 'pending' } = req.query

      // Check permission
      const hasPermission = await this.checkUserPermission(
        req.user.id,
        id,
        'view_invitations'
      )

      if (!hasPermission) {
        res.status(403).json({
          error: 'Permission denied'
        })
        return
      }

      const invitations = await prisma.invitation.findMany({
        where: {
          organizationId: id,
          status: status as string
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      res.json({
        success: true,
        data: invitations
      })
    } catch (error) {
      logger.error('Failed to list invitations', error)
      res.status(500).json({
        error: 'Failed to list invitations',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body
      const userId = req.user.id

      await this.organizationService.acceptInvitation(token, userId)

      res.json({
        success: true,
        message: 'Invitation accepted successfully'
      })
    } catch (error) {
      logger.error('Failed to accept invitation', error)
      res.status(400).json({
        error: 'Failed to accept invitation',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Check if user has access to organization
   */
  private async checkUserAccess(userId: string, organizationId: string): Promise<boolean> {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active'
      }
    })

    return !!membership
  }

  /**
   * Check if user has specific permission
   */
  private async checkUserPermission(
    userId: string,
    organizationId: string,
    permission: string
  ): Promise<boolean> {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active'
      }
    })

    if (!membership) return false

    // Owner has all permissions
    if (membership.role === 'owner') return true

    // Admin has most permissions
    if (membership.role === 'admin' && permission !== 'owner_only') return true

    // Check role-based permissions
    const rolePermissions = {
      manager: ['view_projects', 'manage_projects', 'view_analytics', 'manage_team'],
      member: ['view_projects']
    }

    return rolePermissions[membership.role as keyof typeof rolePermissions]?.includes(
      permission
    ) || false
  }

  /**
   * Check if user is organization owner
   */
  private async isOrganizationOwner(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    return org?.ownerId === userId
  }
}