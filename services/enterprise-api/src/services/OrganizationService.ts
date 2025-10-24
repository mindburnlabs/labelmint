import { PrismaClient, Organization } from '@prisma/client'
import { hash } from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import { redis } from '../app.js'
import { EmailService } from './EmailService.js'
import { AuditService } from './AuditService.js'
import {
  Organization as IOrganization,
  OrganizationSettings,
  Subscription,
  BillingInfo,
  SSOConfig,
  ComplianceConfig
} from '../types/enterprise.js'

export class OrganizationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new organization
   */
  async create(data: {
    name: string
    domain?: string
    userId: string
    plan?: string
    settings?: Partial<OrganizationSettings>
  }): Promise<IOrganization> {
    const slug = this.generateSlug(data.name)

    // Check if slug is available
    const existing = await this.prisma.organization.findFirst({
      where: { slug }
    })

    if (existing) {
      throw new Error('Organization name already exists')
    }

    // Create default settings
    const defaultSettings: OrganizationSettings = {
      timezone: 'UTC',
      locale: 'en-US',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      features: {
        basic_workflows: true,
        team_collaboration: false,
        advanced_analytics: false,
        sso_integration: false,
        api_access: false,
        white_labeling: false,
        custom_integrations: false
      },
      branding: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        companyName: data.name,
        supportEmail: 'support@example.com'
      },
      workflows: {
        requireApproval: false,
        autoAssignTasks: true,
        consensusThreshold: 0.66,
        qualityChecks: ['consensus'],
        customFields: []
      },
      security: {
        mfaRequired: false,
        sessionTimeout: 480,
        ipWhitelist: [],
        apiAccessRestrictions: false,
        auditLogRetention: 90
      },
      ...data.settings
    }

    // Create default subscription
    const subscription: Subscription = {
      plan: (data.plan as any) || 'starter',
      status: 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      cancelAtPeriodEnd: false,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      features: this.getPlanFeatures(data.plan || 'starter'),
      limits: this.getPlanLimits(data.plan || 'starter'),
      addons: []
    }

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        slug,
        domain: data.domain,
        ownerId: data.userId,
        settings: defaultSettings as any,
        subscription: subscription as any,
        billing: {
          customerId: '',
          paymentMethodId: '',
          billingAddress: {
            line1: '',
            city: '',
            state: '',
            country: '',
            postalCode: ''
          },
          taxInfo: {
            taxRate: 0,
            taxExempt: false,
            exemptions: []
          },
          invoices: [],
          usage: [],
          nextBillingDate: subscription.currentPeriodEnd
        } as any,
        ssoConfig: {
          enabled: false,
          provider: 'saml',
          config: {}
        } as any,
        complianceConfig: {
          enabled: false,
          standards: [],
          dataRetention: {
            defaultRetention: 365,
            policies: [],
            autoDelete: false,
            legalHold: false
          },
          auditSettings: {
            logAllActions: true,
            logApiCalls: true,
            logDataAccess: true,
            logUserActions: true,
            retentionPeriod: 2555, // 7 years
            alertOnSuspiciousActivity: true
          },
          encryption: {
            atRest: true,
            inTransit: true,
            fieldLevelEncryption: [],
            keyRotationInterval: 90,
            algorithm: 'AES-256-GCM'
          },
          accessControl: {
            rbacEnabled: true,
            mfaRequired: false,
            sessionTimeout: 480,
            ipRestrictions: [],
            deviceTracking: false,
            emergencyAccess: {
              enabled: false,
              approvers: [],
              auditRequired: true,
              timeout: 60
            }
          }
        } as any,
        status: 'active'
      }
    })

    // Cache organization
    await this.cacheOrganization(organization.id, organization)

    logger.info('Organization created', {
      organizationId: organization.id,
      name: organization.name,
      plan: subscription.plan,
      createdBy: data.userId
    })

    return organization as IOrganization
  }

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<IOrganization | null> {
    // Try cache first
    const cached = await this.getCachedOrganization(id)
    if (cached) {
      return cached
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true
          }
        },
        teams: {
          include: {
            members: {
              select: {
                userId: true,
                role: true,
                status: true
              }
            }
          }
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        }
      }
    })

    if (organization) {
      await this.cacheOrganization(id, organization)
    }

    return organization as IOrganization | null
  }

  /**
   * Get organization by slug
   */
  async getBySlug(slug: string): Promise<IOrganization | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug }
    })

    return organization as IOrganization | null
  }

  /**
   * Update organization
   */
  async update(id: string, data: Partial<IOrganization>): Promise<IOrganization> {
    // Invalidate cache
    await this.invalidateCache(id)

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })

    logger.info('Organization updated', {
      organizationId: id,
      changes: Object.keys(data)
    })

    return organization as IOrganization
  }

  /**
   * Update organization settings
   */
  async updateSettings(id: string, settings: Partial<OrganizationSettings>): Promise<IOrganization> {
    const organization = await this.getById(id)
    if (!organization) {
      throw new Error('Organization not found')
    }

    const updatedSettings = {
      ...organization.settings,
      ...settings
    }

    return await this.update(id, { settings: updatedSettings })
  }

  /**
   * Update subscription
   */
  async updateSubscription(id: string, subscription: Partial<Subscription>): Promise<IOrganization> {
    const organization = await this.getById(id)
    if (!organization) {
      throw new Error('Organization not found')
    }

    const updatedSubscription = {
      ...organization.subscription,
      ...subscription
    }

    // Update features and limits if plan changed
    if (subscription.plan && subscription.plan !== organization.subscription.plan) {
      updatedSubscription.features = this.getPlanFeatures(subscription.plan)
      updatedSubscription.limits = this.getPlanLimits(subscription.plan)
    }

    return await this.update(id, { subscription: updatedSubscription })
  }

  /**
   * Deactivate organization
   */
  async deactivate(id: string): Promise<void> {
    await this.update(id, {
      status: 'inactive',
      subscription: {
        ...((await this.getById(id))?.subscription || {}),
        status: 'cancelled'
      } as Subscription
    })

    // Invalidate cache
    await this.invalidateCache(id)

    logger.info('Organization deactivated', { organizationId: id })
  }

  /**
   * Get organizations by user
   */
  async getByUser(userId: string): Promise<IOrganization[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true
      }
    })

    return memberships.map(m => m.organization as IOrganization)
  }

  /**
   * Invite user to organization
   */
  async inviteUser(organizationId: string, data: {
    email: string
    role: string
    teamIds?: string[]
    message?: string
  }): Promise<{ inviteId: string; token: string }> {
    const organization = await this.getById(organizationId)
    if (!organization) {
      throw new Error('Organization not found')
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email }
    })

    let userId: string
    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create pending user
      const newUser = await this.prisma.user.create({
        data: {
          email: data.email,
          status: 'pending',
          role: data.role
        }
      })
      userId = newUser.id
    }

    // Create invitation
    const inviteToken = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        userId,
        email: data.email,
        role: data.role,
        teamIds: data.teamIds || [],
        token: inviteToken,
        message: data.message,
        status: 'pending',
        expiresAt,
        invitedBy: userId // Will be updated to actual inviter
      }
    })

    // Send invitation email
    const inviteUrl = `${process.env.FRONTEND_URL}/invite?token=${inviteToken}`

    try {
      await EmailService.sendInvitation(
        organizationId,
        data.email,
        inviteToken,
        // Get inviter name
        (await this.prisma.user.findUnique({ where: { id: userId } }))?.firstName || 'Someone',
        (await this.prisma.organization.findUnique({ where: { id: organizationId } }))?.name || 'LabelMint',
        data.role
      )
    } catch (emailError) {
      logger.error('Failed to send invitation email', {
        organizationId,
        email: data.email,
        error: emailError.message
      })
      // Continue without failing the invitation creation
    }

    logger.info('User invited to organization', {
      organizationId,
      invitationId: invitation.id,
      email: data.email,
      role: data.role
    })

    return {
      inviteId: invitation.id,
      token: inviteToken
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { token }
    })

    if (!invitation) {
      throw new Error('Invalid invitation token')
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation expired')
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation already processed')
    }

    // Add user to organization
    await this.prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        status: 'active',
        joinedAt: new Date()
      }
    })

    // Add to teams if specified
    if (invitation.teamIds.length > 0) {
      await this.prisma.teamMember.createMany({
        data: invitation.teamIds.map(teamId => ({
          teamId,
          userId,
          role: 'member',
          status: 'active',
          joinedAt: new Date()
        }))
      })

      // Update team member counts
      await this.prisma.team.updateMany({
        where: { id: { in: invitation.teamIds } },
        data: { memberCount: { increment: 1 } }
      })
    }

    // Update invitation status
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date()
      }
    })

    // Update user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        organizationId: invitation.organizationId
      }
    })

    logger.info('Invitation accepted', {
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      userId
    })
  }

  /**
   * Get organization metrics
   */
  async getMetrics(organizationId: string, period?: string): Promise<any> {
    const org = await this.getById(organizationId)
    if (!org) {
      throw new Error('Organization not found')
    }

    const dateRange = this.getDateRange(period || '30d')

    // Get user metrics
    const totalUsers = await this.prisma.organizationMember.count({
      where: { organizationId, status: 'active' }
    })

    const activeUsers = await this.prisma.user.count({
      where: {
        organizationId,
        lastLoginAt: { gte: dateRange.start }
      }
    })

    const newUsers = await this.prisma.user.count({
      where: {
        organizationId,
        createdAt: { gte: dateRange.start, lte: dateRange.end }
      }
    })

    // Get project metrics
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        createdAt: { gte: dateRange.start }
      }
    })

    const activeProjects = projects.filter(p => p.status === 'active').length
    const completedProjects = projects.filter(p => p.status === 'completed').length

    // Get task metrics
    const tasks = await this.prisma.task.findMany({
      where: {
        project: { organizationId },
        createdAt: { gte: dateRange.start }
      }
    })

    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length

    // Calculate accuracy
    const totalAccuracy = tasks.reduce((sum, task) => sum + (task.accuracy || 0), 0)
    const averageAccuracy = totalAccuracy / tasks.length || 0

    // Get cost metrics
    const totalCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0)
    const avgCostPerTask = totalCost / tasks.length || 0

    return {
      organizationId,
      period,
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers
      },
      projects: {
        total: projects.length,
        active: activeProjects,
        completed: completedProjects
      },
      tasks: {
        created: tasks.length,
        completed: completedTasks,
        pending: pendingTasks,
        averageAccuracy
      },
      costs: {
        total: totalCost,
        perTask: avgCostPerTask,
        breakdown: {
          labeling: totalCost * 0.8,
          review: totalCost * 0.15,
          management: totalCost * 0.05
        }
      },
      performance: {
        averageTimePerTask: this.calculateAverageTimePerTask(tasks),
        throughput: completedTasks / (dateRange.end.getTime() - dateRange.start.getTime()) * 86400000,
        qualityScore: averageAccuracy
      }
    }
  }

  /**
   * Generate unique slug
   */
  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const randomSuffix = Math.random().toString(36).substring(2, 8)
    return `${base}-${randomSuffix}`
  }

  /**
   * Get plan features
   */
  private getPlanFeatures(plan: string): any {
    const features = {
      starter: {
        advanced_workflows: false,
        sso_integration: false,
        api_access: false,
        white_labeling: false,
        priority_support: false,
        custom_integrations: false,
        advanced_analytics: false,
        compliance_tools: false,
        team_collaboration: false,
        multi_tenant: false,
        custom_domains: false
      },
      professional: {
        advanced_workflows: true,
        sso_integration: true,
        api_access: true,
        white_labeling: false,
        priority_support: false,
        custom_integrations: true,
        advanced_analytics: true,
        compliance_tools: false,
        team_collaboration: true,
        multi_tenant: false,
        custom_domains: false
      },
      enterprise: {
        advanced_workflows: true,
        sso_integration: true,
        api_access: true,
        white_labeling: true,
        priority_support: true,
        custom_integrations: true,
        advanced_analytics: true,
        compliance_tools: true,
        team_collaboration: true,
        multi_tenant: true,
        custom_domains: true
      }
    }

    return features[plan as keyof typeof features] || features.starter
  }

  /**
   * Get plan limits
   */
  private getPlanLimits(plan: string): any {
    const limits = {
      starter: {
        users: 10,
        teams: 3,
        projects: 5,
        storage: 10, // GB
        apiCallsPerMonth: 10000,
        workflows: 3,
        customFields: 10,
        integrations: 2,
        supportTickets: 5
      },
      professional: {
        users: 100,
        teams: 20,
        projects: 50,
        storage: 500,
        apiCallsPerMonth: 100000,
        workflows: 20,
        customFields: 50,
        integrations: 10,
        supportTickets: 20
      },
      enterprise: {
        users: -1, // unlimited
        teams: -1,
        projects: -1,
        storage: -1,
        apiCallsPerMonth: -1,
        workflows: -1,
        customFields: -1,
        integrations: -1,
        supportTickets: -1
      }
    }

    return limits[plan as keyof typeof limits] || limits.starter
  }

  /**
   * Cache organization
   */
  private async cacheOrganization(id: string, organization: any): Promise<void> {
    const key = `org:${id}`
    await redis.setex(key, 300, JSON.stringify(organization)) // 5 minutes
  }

  /**
   * Get cached organization
   */
  private async getCachedOrganization(id: string): Promise<IOrganization | null> {
    const key = `org:${id}`
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  /**
   * Invalidate cache
   */
  private async invalidateCache(id: string): Promise<void> {
    const key = `org:${id}`
    await redis.del(key)
  }

  /**
   * Get date range for metrics
   */
  private getDateRange(period: string): { start: Date; end: Date } {
    const end = new Date()
    const start = new Date()

    switch (period) {
      case '7d':
        start.setDate(end.getDate() - 7)
        break
      case '30d':
        start.setDate(end.getDate() - 30)
        break
      case '90d':
        start.setDate(end.getDate() - 90)
        break
      case '1y':
        start.setFullYear(end.getFullYear() - 1)
        break
      default:
        start.setDate(end.getDate() - 30)
    }

    return { start, end }
  }

  /**
   * Calculate average time per task
   */
  private calculateAverageTimePerTask(tasks: any[]): number {
    if (tasks.length === 0) return 0

    const totalTime = tasks.reduce((sum, task) => {
      if (task.completedAt && task.createdAt) {
        return sum + (task.completedAt.getTime() - task.createdAt.getTime())
      }
      return sum
    }, 0)

    const completedTasks = tasks.filter(t => t.completedAt)
    return completedTasks.length > 0 ? totalTime / completedTasks.length : 0
  }

  // ==================== Team Management ====================

  /**
   * Create team within organization
   */
  async createTeam(
    organizationId: string,
    data: {
      name: string
      description?: string
      leadId?: string
      memberIds?: string[]
      permissions?: Record<string, any>
    },
    userId: string
  ): Promise<any> {
    // Verify user has permission to create teams
    await this.verifyPermission(organizationId, userId, 'teams.create')

    const team = await this.prisma.team.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        leadId: data.leadId,
        permissions: data.permissions || {}
      }
    })

    // Add lead as member if specified
    if (data.leadId) {
      await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: data.leadId,
          role: 'LEAD',
          joinedAt: new Date()
        }
      })
    }

    // Add additional members
    if (data.memberIds && data.memberIds.length > 0) {
      await this.prisma.teamMember.createMany({
        data: data.memberIds.map(memberId => ({
          teamId: team.id,
          userId: memberId,
          role: 'MEMBER',
          joinedAt: new Date()
        }))
      })
    }

    await AuditService.log({
      organizationId,
      userId,
      action: 'team.created',
      resourceType: 'team',
      resourceId: team.id,
      details: { name: data.name }
    })

    return team
  }

  /**
   * Update team
   */
  async updateTeam(
    organizationId: string,
    teamId: string,
    data: Partial<{
      name: string
      description: string
      leadId: string
      permissions: Record<string, any>
    }>,
    userId: string
  ): Promise<any> {
    await this.verifyPermission(organizationId, userId, 'teams.update')

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId }
    })

    if (!team) {
      throw new Error('Team not found')
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'team.updated',
      resourceType: 'team',
      resourceId: teamId,
      details: data
    })

    return updated
  }

  /**
   * Add member to team
   */
  async addTeamMember(
    organizationId: string,
    teamId: string,
    memberId: string,
    role: 'LEAD' | 'MEMBER' | 'VIEWER' = 'MEMBER',
    userId: string
  ): Promise<void> {
    await this.verifyPermission(organizationId, userId, 'teams.manage_members')

    // Verify team exists
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId }
    })

    if (!team) {
      throw new Error('Team not found')
    }

    // Check if user is already a member
    const existingMember = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId }
    })

    if (existingMember) {
      throw new Error('User is already a team member')
    }

    await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: memberId,
        role,
        joinedAt: new Date()
      }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'team.member_added',
      resourceType: 'team_member',
      resourceId: memberId,
      details: { teamId, role }
    })
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(
    organizationId: string,
    teamId: string,
    memberId: string,
    userId: string
  ): Promise<void> {
    await this.verifyPermission(organizationId, userId, 'teams.manage_members')

    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId }
    })

    if (!membership) {
      throw new Error('Team member not found')
    }

    await this.prisma.teamMember.delete({
      where: { id: membership.id }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'team.member_removed',
      resourceType: 'team_member',
      resourceId: memberId,
      details: { teamId }
    })
  }

  /**
   * Get organization teams with members
   */
  async getTeams(organizationId: string, userId: string): Promise<any[]> {
    await this.verifyPermission(organizationId, userId, 'teams.read')

    const teams = await this.prisma.team.findMany({
      where: { organizationId },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        },
        _count: {
          select: { members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return teams
  }

  // ==================== Role-Based Permissions ====================

  /**
   * Define custom role
   */
  async createRole(
    organizationId: string,
    data: {
      name: string
      description?: string
      permissions: Record<string, boolean>
      isSystem?: boolean
    },
    userId: string
  ): Promise<any> {
    await this.verifyPermission(organizationId, userId, 'roles.create')

    const role = await this.prisma.role.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isSystem: data.isSystem || false
      }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'role.created',
      resourceType: 'role',
      resourceId: role.id,
      details: { name: data.name }
    })

    return role
  }

  /**
   * Assign role to user
   */
  async assignRole(
    organizationId: string,
    userId: string,
    roleId: string,
    assignedBy: string
  ): Promise<void> {
    await this.verifyPermission(organizationId, assignedBy, 'roles.assign')

    // Verify role exists
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    // Update or create user role assignment
    await this.prisma.organizationUser.updateMany({
      where: { organizationId, userId },
      data: { roleId }
    })

    await AuditService.log({
      organizationId,
      userId: assignedBy,
      action: 'role.assigned',
      resourceType: 'user_role',
      resourceId: userId,
      details: { roleId, roleName: role.name }
    })
  }

  /**
   * Check user permission
   */
  async hasPermission(
    organizationId: string,
    userId: string,
    permission: string
  ): Promise<boolean> {
    // Get user's role in organization
    const membership = await this.prisma.organizationUser.findFirst({
      where: { organizationId, userId },
      include: {
        role: true
      }
    })

    if (!membership) {
      return false
    }

    // Check if role has the permission
    if (membership.role && membership.role.permissions[permission]) {
      return true
    }

    // Check owner permissions
    if (membership.role === 'OWNER') {
      return true
    }

    // Check admin permissions
    if (membership.role === 'ADMIN') {
      const adminPermissions = [
        'users.read', 'users.update', 'users.invite',
        'teams.read', 'teams.create', 'teams.update',
        'billing.read', 'billing.update',
        'settings.read', 'settings.update',
        'analytics.read'
      ]
      return adminPermissions.includes(permission)
    }

    return false
  }

  /**
   * Verify user has permission or throw error
   */
  private async verifyPermission(
    organizationId: string,
    userId: string,
    permission: string
  ): Promise<void> {
    const hasPermission = await this.hasPermission(organizationId, userId, permission)
    if (!hasPermission) {
      throw new Error(`Permission denied: ${permission}`)
    }
  }

  /**
   * Get organization roles
   */
  async getRoles(organizationId: string, userId: string): Promise<any[]> {
    await this.verifyPermission(organizationId, userId, 'roles.read')

    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return roles
  }

  /**
   * Update role permissions
   */
  async updateRole(
    organizationId: string,
    roleId: string,
    data: {
      name?: string
      description?: string
      permissions?: Record<string, boolean>
    },
    userId: string
  ): Promise<any> {
    await this.verifyPermission(organizationId, userId, 'roles.update')

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles')
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'role.updated',
      resourceType: 'role',
      resourceId: roleId,
      details: data
    })

    return updated
  }

  /**
   * Delete role
   */
  async deleteRole(
    organizationId: string,
    roleId: string,
    userId: string
  ): Promise<void> {
    await this.verifyPermission(organizationId, userId, 'roles.delete')

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system roles')
    }

    await this.prisma.role.delete({
      where: { id: roleId }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'role.deleted',
      resourceType: 'role',
      resourceId: roleId,
      details: { roleName: role.name }
    })
  }
}