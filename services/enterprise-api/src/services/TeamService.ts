import { prisma, redis } from '../app.js'
import { TeamModel, ITeam, ITeamMember, TeamRole } from '../models/Team.js'
import { OrganizationService } from './OrganizationService.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'

export interface CreateTeamData {
  name: string
  description?: string
  avatar?: string
  settings?: any
}

export interface UpdateTeamData {
  name?: string
  description?: string
  avatar?: string
  settings?: any
}

export interface InviteMemberData {
  userId?: string
  email?: string
  role: TeamRole
  message?: string
}

export class TeamService {
  private static readonly CACHE_TTL = 3600 // 1 hour

  /**
   * Create a new team
   */
  static async create(
    organizationId: string,
    data: CreateTeamData,
    userId: string
  ): Promise<ITeam> {
    // Verify user is member of organization
    const isMember = await OrganizationService.isMember(organizationId, userId)
    if (!isMember) {
      throw new Error('User is not a member of this organization')
    }

    // Check user permissions
    const canCreate = await OrganizationService.hasPermission(
      organizationId,
      userId,
      'team:create'
    )
    if (!canCreate) {
      throw new Error('Insufficient permissions to create team')
    }

    // Check organization team limits
    const org = await OrganizationService.findById(organizationId)
    if (!org) throw new Error('Organization not found')

    const currentTeams = await this.getTeamCount(organizationId)
    const maxTeams = org.subscription.limits.teams
    if (currentTeams >= maxTeams) {
      throw new Error(`Team limit reached (${maxTeams})`)
    }

    // Create team
    const team = await TeamModel.create({
      organizationId,
      name: data.name,
      description: data.description,
      userId,
      settings: data.settings
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.created',
      resourceType: 'team',
      resourceId: team.id,
      details: { teamName: team.name }
    })

    // Clear cache
    await this.clearTeamCache(organizationId)

    logger.info('Team created', {
      teamId: team.id,
      organizationId,
      userId,
      name: team.name
    })

    return team
  }

  /**
   * Get team by ID
   */
  static async getById(
    id: string,
    organizationId: string,
    userId?: string
  ): Promise<ITeam | null> {
    const cacheKey = `team:${id}:${organizationId}`

    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const team = await TeamModel.findById(id, organizationId)
    if (!team) return null

    // Check permissions if userId provided
    if (userId) {
      const isMember = await this.isMember(id, userId)
      if (!isMember) {
        throw new Error('Access denied')
      }
    }

    // Cache result
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(team))

    return team
  }

  /**
   * Get teams for organization
   */
  static async getByOrganization(
    organizationId: string,
    userId: string,
    options: {
      page?: number
      limit?: number
      search?: string
      status?: 'active' | 'archived'
    } = {}
  ): Promise<{ teams: ITeam[]; total: number }> {
    // Verify user is member of organization
    const isMember = await OrganizationService.isMember(organizationId, userId)
    if (!isMember) {
      throw new Error('Access denied')
    }

    const cacheKey = `teams:${organizationId}:${JSON.stringify(options)}`

    // Try cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const result = await TeamModel.findByOrganization(organizationId, options)

    // Cache for shorter time due to pagination
    await redis.setex(cacheKey, 300, JSON.stringify(result))

    return result
  }

  /**
   * Update team
   */
  static async update(
    id: string,
    organizationId: string,
    data: UpdateTeamData,
    userId: string
  ): Promise<ITeam> {
    // Check permissions
    const canManage = await this.hasPermission(id, userId, 'team:manage_settings')
    if (!canManage) {
      throw new Error('Insufficient permissions to manage team settings')
    }

    const team = await TeamModel.update(id, organizationId, data)

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.updated',
      resourceType: 'team',
      resourceId: id,
      details: { changes: data }
    })

    // Clear cache
    await this.clearTeamCache(organizationId, id)

    logger.info('Team updated', {
      teamId: id,
      organizationId,
      userId,
      changes: Object.keys(data)
    })

    return team
  }

  /**
   * Archive team
   */
  static async archive(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Check permissions
    const canDelete = await this.hasPermission(id, userId, 'team:delete')
    if (!canDelete) {
      throw new Error('Insufficient permissions to archive team')
    }

    await TeamModel.archive(id, organizationId)

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.archived',
      resourceType: 'team',
      resourceId: id
    })

    // Clear cache
    await this.clearTeamCache(organizationId, id)

    logger.info('Team archived', {
      teamId: id,
      organizationId,
      userId
    })
  }

  /**
   * Restore archived team
   */
  static async restore(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Check permissions
    const canManage = await OrganizationService.hasPermission(
      organizationId,
      userId,
      'team:manage'
    )
    if (!canManage) {
      throw new Error('Insufficient permissions to restore team')
    }

    await TeamModel.restore(id, organizationId)

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.restored',
      resourceType: 'team',
      resourceId: id
    })

    // Clear cache
    await this.clearTeamCache(organizationId, id)

    logger.info('Team restored', {
      teamId: id,
      organizationId,
      userId
    })
  }

  /**
   * Invite member to team
   */
  static async inviteMember(
    id: string,
    organizationId: string,
    data: InviteMemberData,
    userId: string
  ): Promise<{ invite: any; user?: any }> {
    // Check permissions
    const canInvite = await this.hasPermission(id, userId, 'team:invite')
    if (!canInvite) {
      throw new Error('Insufficient permissions to invite members')
    }

    // Check team member limits
    const team = await TeamModel.findById(id, organizationId)
    if (!team) throw new Error('Team not found')

    const currentMembers = team.memberCount || 0
    const maxMembers = 50 // Get from organization settings
    if (currentMembers >= maxMembers) {
      throw new Error(`Team member limit reached (${maxMembers})`)
    }

    let targetUserId = data.userId

    // If email provided, find or create user
    if (data.email && !targetUserId) {
      // In a real implementation, this would send an email invitation
      // For now, we'll create a pending invitation
      const invite = {
        id: `invite_${Date.now()}`,
        teamId: id,
        email: data.email,
        role: data.role,
        message: data.message,
        invitedBy: userId,
        token: this.generateInviteToken(),
        status: 'pending',
        createdAt: new Date()
      }

      // Store invitation in database or Redis
      await redis.setex(
        `team_invite:${invite.token}`,
        7 * 24 * 3600, // 7 days
        JSON.stringify(invite)
      )

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'team.invitation_sent',
        resourceType: 'team',
        resourceId: id,
        details: {
          email: data.email,
          role: data.role
        }
      })

      logger.info('Team invitation sent', {
        teamId: id,
        email: data.email,
        invitedBy: userId
      })

      return { invite }
    }

    // Add existing user to team
    if (targetUserId) {
      // Check if user is already member
      const existingMember = await this.getMember(id, targetUserId)
      if (existingMember) {
        throw new Error('User is already a team member')
      }

      const member = await TeamModel.addMember({
        teamId: id,
        userId: targetUserId,
        role: data.role,
        invitedBy: userId
      })

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          avatar: true
        }
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'team.member_added',
        resourceType: 'team',
        resourceId: id,
        details: {
          memberId: targetUserId,
          role: data.role
        }
      })

      // Clear cache
      await this.clearTeamCache(organizationId, id)

      logger.info('Team member added', {
        teamId: id,
        memberId: targetUserId,
        role: data.role,
        addedBy: userId
      })

      return { invite: null, user, member }
    }

    throw new Error('Invalid invitation data')
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    id: string,
    organizationId: string,
    memberId: string,
    role: TeamRole,
    userId: string
  ): Promise<ITeamMember> {
    // Check permissions
    const canManage = await this.hasPermission(id, userId, 'team:manage_members')
    if (!canManage) {
      throw new Error('Insufficient permissions to manage members')
    }

    // Prevent owner role change
    const member = await this.getMember(id, memberId)
    if (!member) throw new Error('Member not found')
    if (member.role === 'owner') {
      throw new Error('Cannot change owner role')
    }

    const updatedMember = await TeamModel.updateMemberRole(id, memberId, role)

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.member_role_updated',
      resourceType: 'team',
      resourceId: id,
      details: {
        memberId,
        oldRole: member.role,
        newRole: role
      }
    })

    // Clear cache
    await this.clearTeamCache(organizationId, id)

    logger.info('Team member role updated', {
      teamId: id,
      memberId,
      oldRole: member.role,
      newRole: role,
      updatedBy: userId
    })

    return updatedMember
  }

  /**
   * Remove member from team
   */
  static async removeMember(
    id: string,
    organizationId: string,
    memberId: string,
    userId: string
  ): Promise<void> {
    // Check permissions
    const canRemove = await this.hasPermission(id, userId, 'team:remove_members')
    if (!canRemove) {
      throw new Error('Insufficient permissions to remove members')
    }

    // Prevent removing owner
    const member = await this.getMember(id, memberId)
    if (!member) throw new Error('Member not found')
    if (member.role === 'owner') {
      throw new Error('Cannot remove team owner')
    }

    await TeamModel.removeMember(id, memberId)

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'team.member_removed',
      resourceType: 'team',
      resourceId: id,
      details: {
        memberId,
        role: member.role
      }
    })

    // Clear cache
    await this.clearTeamCache(organizationId, id)

    logger.info('Team member removed', {
      teamId: id,
      memberId,
      role: member.role,
      removedBy: userId
    })
  }

  /**
   * Get team members
   */
  static async getMembers(
    id: string,
    organizationId: string,
    userId: string,
    options: {
      page?: number
      limit?: number
      role?: TeamRole
    } = {}
  ): Promise<{ members: ITeamMember[]; total: number }> {
    // Check permissions
    const canView = await this.isMember(id, userId)
    if (!canView) {
      throw new Error('Access denied')
    }

    return await TeamModel.getMembers(id, options)
  }

  /**
   * Get team statistics
   */
  static async getStats(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<any> {
    // Check permissions
    const canView = await this.hasPermission(id, userId, 'analytics:view')
    if (!canView) {
      throw new Error('Insufficient permissions to view analytics')
    }

    const stats = await TeamModel.getStats(id)

    // Add additional metrics
    const [recentActivity, topPerformers] = await Promise.all([
      this.getRecentActivity(id),
      this.getTopPerformers(id)
    ])

    return {
      ...stats,
      recentActivity,
      topPerformers
    }
  }

  /**
   * Check if user is team member
   */
  static async isMember(teamId: string, userId: string): Promise<boolean> {
    const cacheKey = `team_member:${teamId}:${userId}`
    const cached = await redis.get(cacheKey)
    if (cached !== null) {
      return cached === 'true'
    }

    const member = await this.getMember(teamId, userId)
    const isMember = !!member && member.status === 'active'

    await redis.setex(cacheKey, 300, isMember.toString())

    return isMember
  }

  /**
   * Check if user has specific permission in team
   */
  static async hasPermission(
    teamId: string,
    userId: string,
    permission: string
  ): Promise<boolean> {
    const member = await this.getMember(teamId, userId)
    if (!member || member.status !== 'active') {
      return false
    }

    return member.permissions.includes(permission as any)
  }

  /**
   * Get team member
   */
  static async getMember(teamId: string, userId: string): Promise<ITeamMember | null> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      }
    })

    return member as ITeamMember | null
  }

  /**
   * Get team count for organization
   */
  static async getTeamCount(organizationId: string): Promise<number> {
    const cacheKey = `team_count:${organizationId}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return parseInt(cached)
    }

    const count = await prisma.team.count({
      where: {
        organizationId,
        archivedAt: null
      }
    })

    await redis.setex(cacheKey, 300, count.toString())

    return count
  }

  /**
   * Get recent activity for team
   */
  private static async getRecentActivity(teamId: string): Promise<any[]> {
    // Get recent tasks, projects, and member activity
    const activities = await prisma.auditLog.findMany({
      where: {
        resourceId: teamId,
        resourceType: 'team'
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        userId: true,
        details: true,
        createdAt: true
      }
    })

    return activities
  }

  /**
   * Get top performers in team
   */
  private static async getTopPerformers(teamId: string): Promise<any[]> {
    const performers = await prisma.$queryRaw`
      SELECT
        u.id,
        u.username,
        u.full_name,
        COUNT(t.id) as tasks_completed,
        AVG(t.completed_at - t.assigned_at) as avg_completion_time
      FROM users u
      JOIN team_members tm ON u.id = tm.user_id
      JOIN project_members pm ON u.id = pm.user_id
      JOIN tasks t ON pm.project_id = t.project_id
      WHERE tm.team_id = ${teamId}
        AND tm.status = 'active'
        AND t.status = 'completed'
        AND t.completed_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id
      ORDER BY tasks_completed DESC
      LIMIT 5
    `

    return performers
  }

  /**
   * Generate invitation token
   */
  private static generateInviteToken(): string {
    return Buffer.from(`${Date.now()}:${Math.random()}`).toString('base64')
  }

  /**
   * Clear team-related cache
   */
  private static async clearTeamCache(
    organizationId: string,
    teamId?: string
  ): Promise<void> {
    const keys = [
      `team_count:${organizationId}`,
      `teams:${organizationId}:*`
    ]

    if (teamId) {
      keys.push(`team:${teamId}:*`)
    }

    // Delete matching keys
    for (const pattern of keys) {
      const matchingKeys = await redis.keys(pattern)
      if (matchingKeys.length > 0) {
        await redis.del(...matchingKeys)
      }
    }
  }
}