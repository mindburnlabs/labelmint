import { Request, Response, NextFunction } from 'express'
import { TeamService } from '../services/TeamService.js'
import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from '../services/AuditService.js'

export class TeamController {
  /**
   * Create a new team
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id
      const data = req.body

      const team = await TeamService.create(organizationId, data, userId)

      res.status(201).json({
        success: true,
        data: team,
        message: 'Team created successfully'
      })
    } catch (error) {
      logger.error('Create team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get team by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id

      const team = await TeamService.getById(id, organizationId, userId)

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        })
        return
      }

      res.json({
        success: true,
        data: team
      })
    } catch (error) {
      logger.error('Get team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get teams for organization
   */
  static async getByOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id
      const {
        page = 1,
        limit = 20,
        search,
        status = 'active'
      } = req.query

      const result = await TeamService.getByOrganization(organizationId, userId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        status: status as 'active' | 'archived'
      })

      res.json({
        success: true,
        data: result.teams,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: Math.ceil(result.total / parseInt(limit as string))
        }
      })
    } catch (error) {
      logger.error('Get organization teams error', { error: error.message })
      next(error)
    }
  }

  /**
   * Update team
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id
      const data = req.body

      const team = await TeamService.update(id, organizationId, data, userId)

      res.json({
        success: true,
        data: team,
        message: 'Team updated successfully'
      })
    } catch (error) {
      logger.error('Update team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Archive team
   */
  static async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id

      await TeamService.archive(id, organizationId, userId)

      res.json({
        success: true,
        message: 'Team archived successfully'
      })
    } catch (error) {
      logger.error('Archive team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Restore archived team
   */
  static async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id

      await TeamService.restore(id, organizationId, userId)

      res.json({
        success: true,
        message: 'Team restored successfully'
      })
    } catch (error) {
      logger.error('Restore team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Invite member to team
   */
  static async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id
      const data = req.body

      const result = await TeamService.inviteMember(id, organizationId, data, userId)

      if (result.invite) {
        res.status(201).json({
          success: true,
          data: {
            invite: result.invite
          },
          message: 'Invitation sent successfully'
        })
      } else {
        res.status(201).json({
          success: true,
          data: {
            user: result.user,
            member: result.member
          },
          message: 'Member added successfully'
        })
      }
    } catch (error) {
      logger.error('Invite team member error', { error: error.message })
      next(error)
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId, memberId } = req.params
      const userId = req.user!.id
      const { role } = req.body

      const member = await TeamService.updateMemberRole(
        id,
        organizationId,
        memberId,
        role,
        userId
      )

      res.json({
        success: true,
        data: member,
        message: 'Member role updated successfully'
      })
    } catch (error) {
      logger.error('Update member role error', { error: error.message })
      next(error)
    }
  }

  /**
   * Remove member from team
   */
  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId, memberId } = req.params
      const userId = req.user!.id

      await TeamService.removeMember(id, organizationId, memberId, userId)

      res.json({
        success: true,
        message: 'Member removed successfully'
      })
    } catch (error) {
      logger.error('Remove team member error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get team members
   */
  static async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id
      const {
        page = 1,
        limit = 50,
        role
      } = req.query

      const result = await TeamService.getMembers(id, organizationId, userId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        role: role as any
      })

      res.json({
        success: true,
        data: result.members,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: Math.ceil(result.total / parseInt(limit as string))
        }
      })
    } catch (error) {
      logger.error('Get team members error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get team statistics
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id

      const stats = await TeamService.getStats(id, organizationId, userId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get team stats error', { error: error.message })
      next(error)
    }
  }

  /**
   * Leave team
   */
  static async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id

      // Check if user is owner
      const member = await TeamService.getMember(id, userId)
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Not a team member'
        })
        return
      }

      if (member.role === 'owner') {
        res.status(400).json({
          success: false,
          error: 'Team owner cannot leave. Transfer ownership first.'
        })
        return
      }

      await TeamService.removeMember(id, organizationId, userId, userId)

      res.json({
        success: true,
        message: 'Left team successfully'
      })
    } catch (error) {
      logger.error('Leave team error', { error: error.message })
      next(error)
    }
  }

  /**
   * Transfer ownership
   */
  static async transferOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, organizationId } = req.params
      const userId = req.user!.id
      const { newOwnerId } = req.body

      // Verify current user is owner
      const currentOwner = await TeamService.getMember(id, userId)
      if (!currentOwner || currentOwner.role !== 'owner') {
        res.status(403).json({
          success: false,
          error: 'Only team owner can transfer ownership'
        })
        return
      }

      // Verify new owner is member
      const newOwner = await TeamService.getMember(id, newOwnerId)
      if (!newOwner) {
        res.status(404).json({
          success: false,
          error: 'New owner is not a team member'
        })
        return
      }

      // Update roles
      await Promise.all([
        TeamService.updateMemberRole(id, organizationId, userId, 'admin', userId),
        TeamService.updateMemberRole(id, organizationId, newOwnerId, 'owner', userId)
      ])

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'team.ownership_transferred',
        resourceType: 'team',
        resourceId: id,
        details: {
          fromOwnerId: userId,
          toOwnerId: newOwnerId
        }
      })

      res.json({
        success: true,
        message: 'Ownership transferred successfully'
      })
    } catch (error) {
      logger.error('Transfer ownership error', { error: error.message })
      next(error)
    }
  }

  /**
   * Get user's teams
   */
  static async getUserTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const userId = req.user!.id
      const {
        page = 1,
        limit = 20,
        status = 'active'
      } = req.query

      // Get teams where user is a member
      const teams = await prisma.team.findMany({
        where: {
          organizationId,
          members: {
            some: {
              userId,
              status: 'active'
            }
          },
          archivedAt: status === 'archived' ? { not: null } : null
        },
        include: {
          _count: {
            select: {
              members: {
                where: { status: 'active' }
              },
              projects: {
                where: { status: { not: 'archived' } }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string)
      })

      const total = await prisma.team.count({
        where: {
          organizationId,
          members: {
            some: {
              userId,
              status: 'active'
            }
          },
          archivedAt: status === 'archived' ? { not: null } : null
        }
      })

      const teamData = teams.map(team => ({
        ...team,
        memberCount: team._count.members,
        projectCount: team._count.projects,
        role: team.members.find(m => m.userId === userId)?.role
      }))

      res.json({
        success: true,
        data: teamData,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      })
    } catch (error) {
      logger.error('Get user teams error', { error: error.message })
      next(error)
    }
  }
}