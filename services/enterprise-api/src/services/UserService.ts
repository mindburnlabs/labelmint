import { Prisma } from '@prisma/client'
import { prisma } from '../app.js'
import { AuditService } from './AuditService.js'
import { EmailService } from './EmailService.js'
import { logger } from '../utils/logger.js'

export interface ListUsersOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  role?: string
}

export interface InviteUserPayload {
  email: string
  firstName?: string
  lastName?: string
  role: string
  permissions?: string[]
  teamIds?: string[]
  message?: string
}

export interface UpdateUserPayload {
  role?: string
  permissions?: string[]
  title?: string
  department?: string
  metadata?: Record<string, any>
}

export class UserService {
  private static readonly DEFAULT_PAGE = 1
  private static readonly DEFAULT_LIMIT = 25
  private static readonly CACHE_TTL_SECONDS = 300

  /**
   * List organization users with pagination and filters
   */
  static async list(
    organizationId: string,
    requesterId: string,
    options: ListUsersOptions = {}
  ) {
    await this.ensureCanViewUsers(organizationId, requesterId)

    const {
      page = this.DEFAULT_PAGE,
      limit = this.DEFAULT_LIMIT,
      search,
      status,
      role
    } = options

    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId
    }

    if (status) {
      where.status = status
    }

    if (role) {
      where.role = role
    }

    if (search) {
      where.OR = [
        {
          user: {
            email: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          user: {
            username: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          user: {
            fullName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    const [members, total] = await prisma.$transaction([
      prisma.organizationMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              fullName: true,
              avatar: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              title: true,
              department: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { role: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.organizationMember.count({ where })
    ])

    return {
      users: members.map(member => this.toUserResponse(member)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get single organization user
   */
  static async get(
    organizationId: string,
    userId: string,
    requesterId: string
  ) {
    await this.ensureCanViewUsers(organizationId, requesterId)

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      include: {
        user: true
      }
    })

    if (!membership || membership.organizationId !== organizationId) {
      return null
    }

    return this.toUserResponse(membership)
  }

  /**
   * Invite or add a new user to the organization
   */
  static async invite(
    organizationId: string,
    requesterId: string,
    payload: InviteUserPayload
  ) {
    await this.ensureCanManageUsers(organizationId, requesterId)

    const email = payload.email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    // Prevent duplicate active memberships
    if (existingUser) {
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id
          }
        }
      })

      if (existingMembership && existingMembership.status === 'active') {
        throw new Error('User is already a member of this organization')
      }
    }

    const inviteToken = uuidv4()

    const result = await prisma.$transaction(async tx => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: existingUser.fullName || this.combineName(payload),
              firstName: (payload.firstName || existingUser.firstName) as any,
              lastName: (payload.lastName || existingUser.lastName) as any
            }
          })
        : await tx.user.create({
            data: {
              email,
              username: email.split('@')[0],
              fullName: this.combineName(payload),
              firstName: payload.firstName,
              lastName: payload.lastName,
              avatar: null,
              status: 'pending',
              isActive: false
            } as any
          })

      const membership = await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id
          }
        },
        update: {
          role: payload.role,
          permissions: payload.permissions || [],
          status: 'pending',
          invitedBy: requesterId,
          invitationToken: inviteToken,
          invitationSentAt: new Date()
        } as any,
        create: {
          organizationId,
          userId: user.id,
          role: payload.role,
          permissions: payload.permissions || [],
          status: 'pending',
          invitedBy: requesterId,
          invitationToken: inviteToken,
          joinedAt: null
        } as any,
        include: {
          user: true
        }
      })

      // Create explicit invitation record if the table exists
      try {
        await (tx as any).invitation.create({
          data: {
            organizationId,
            userId: user.id,
            email,
            role: payload.role,
            teamIds: payload.teamIds || [],
            message: payload.message,
            token: inviteToken,
            status: 'pending',
            invitedBy: requesterId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        })
      } catch (error) {
        logger.warn('Invitation table unavailable, skipping explicit record', {
          error: (error as Error).message
        })
      }

      return membership
    })

    // Send invitation email (best effort)
    try {
      await EmailService.sendInvitation(
        organizationId,
        email,
        inviteToken,
        await this.getInviterName(requesterId),
        await this.getOrganizationName(organizationId),
        payload.role
      )
    } catch (error) {
      logger.error('Failed to send invitation email', {
        organizationId,
        email,
        error: (error as Error).message
      })
    }

    await AuditService.log({
      organizationId,
      userId: requesterId,
      action: 'user.invited',
      resourceType: 'user',
      resourceId: result.userId,
      details: {
        email,
        role: payload.role,
        permissions: payload.permissions || []
      }
    })

    return this.toUserResponse(result)
  }

  /**
   * Update membership details
   */
  static async update(
    organizationId: string,
    userId: string,
    requesterId: string,
    payload: UpdateUserPayload
  ) {
    await this.ensureCanManageUsers(organizationId, requesterId)

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      include: {
        user: true
      }
    })

    if (!membership) {
      throw new Error('User not found in organization')
    }

    if (membership.role === 'owner' && payload.role && payload.role !== 'owner') {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'owner',
          status: 'active'
        }
      })

      if (ownerCount <= 1) {
        throw new Error('Organization must have at least one active owner')
      }
    }

    const updated = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      data: {
        role: payload.role ?? membership.role,
        permissions: payload.permissions ?? membership.permissions,
        metadata: payload.metadata ?? membership.metadata
      } as any,
      include: {
        user: true
      }
    })

    await AuditService.log({
      organizationId,
      userId: requesterId,
      action: 'user.updated',
      resourceType: 'user',
      resourceId: userId,
      details: payload
    })

    return this.toUserResponse(updated)
  }

  /**
   * Activate membership
   */
  static async activate(
    organizationId: string,
    userId: string,
    requesterId: string
  ) {
    await this.ensureCanManageUsers(organizationId, requesterId)

    const membership = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      data: {
        status: 'active',
        joinedAt: new Date(),
        invitationAcceptedAt: new Date()
      } as any,
      include: {
        user: true
      }
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        status: 'active'
      } as any
    }).catch(() => null)

    await AuditService.log({
      organizationId,
      userId: requesterId,
      action: 'user.activated',
      resourceType: 'user',
      resourceId: userId
    })

    return this.toUserResponse(membership)
  }

  /**
   * Deactivate membership (soft delete)
   */
  static async deactivate(
    organizationId: string,
    userId: string,
    requesterId: string,
    reason?: string
  ) {
    await this.ensureCanManageUsers(organizationId, requesterId)

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      }
    })

    if (!membership) {
      throw new Error('User not found in organization')
    }

    if (membership.role === 'owner') {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'owner',
          status: 'active'
        }
      })

      if (ownerCount <= 1) {
        throw new Error('Organization must have at least one active owner')
      }
    }

    const updated = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      data: {
        status: 'inactive',
        deactivatedAt: new Date(),
        deactivatedBy: requesterId,
        deactivationReason: reason
      } as any,
      include: {
        user: true
      }
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        status: 'inactive'
      } as any
    }).catch(() => null)

    await AuditService.log({
      organizationId,
      userId: requesterId,
      action: 'user.deactivated',
      resourceType: 'user',
      resourceId: userId,
      details: { reason }
    })

    // Revoke active sessions if session table exists
    try {
      await (prisma as any).session.deleteMany({
        where: {
          userId,
          organizationId
        }
      })
    } catch {
      // ignore missing table
    }

    return this.toUserResponse(updated)
  }

  /**
   * Get organization-level analytics for users
   */
  static async getAnalytics(
    organizationId: string,
    requesterId: string,
    rangeDays: number = 30
  ) {
    await this.ensureCanViewUsers(organizationId, requesterId)

    const cacheKey = `org:${organizationId}:user_analytics:${rangeDays}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const rangeStart = new Date()
    rangeStart.setDate(rangeStart.getDate() - rangeDays)

    const [
      totalMembers,
      activeMembers,
      inactiveMembers,
      pendingInvites,
      roleBreakdown,
      loginActivity,
      topContributors
    ] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId } }),
      prisma.organizationMember.count({
        where: { organizationId, status: 'active' }
      }),
      prisma.organizationMember.count({
        where: { organizationId, status: 'inactive' }
      }),
      prisma.organizationMember.count({
        where: { organizationId, status: 'pending' }
      }),
      prisma.organizationMember.groupBy({
        by: ['role'],
        where: { organizationId },
        _count: { _all: true }
      }),
      prisma.user.count({
        where: {
          organizations: {
            some: {
              organizationId,
              status: 'active'
            }
          },
          lastLoginAt: {
            gte: rangeStart
          }
        }
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          organizationId,
          timestamp: {
            gte: rangeStart
          }
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
      })
    ])

    let contributors: Array<{ userId: string; count: number; user?: any }> = []
    if (topContributors.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: topContributors.map(c => c.userId)
          }
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatar: true
        }
      })

      const userMap = new Map(users.map(u => [u.id, u]))
      contributors = topContributors.map(item => ({
        userId: item.userId,
        count: item._count.userId,
        user: userMap.get(item.userId)
      }))
    }

    const analytics = {
      totals: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        pendingInvites
      },
      roleBreakdown: roleBreakdown.map(item => ({
        role: item.role,
        count: item._count._all
      })),
      loginActivity: {
        activeUsers: loginActivity,
        rangeDays
      },
      topContributors: contributors,
      generatedAt: new Date().toISOString()
    }

    await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(analytics))

    return analytics
  }

  /**
   * Return chronological activity for a specific user filtered by requester permissions
   */
  static async getActivity(
    organizationId: string,
    targetUserId: string,
    requesterId: string,
    options: { limit?: number; cursor?: string } = {}
  ) {
    await this.ensureCanViewUsers(organizationId, requesterId)

    const { limit = 50, cursor } = options

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        userId: targetUserId
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined
    })

    const accessibleLogs: any[] = []

    for (const log of logs) {
      const canView = await this.canViewResource(
        organizationId,
        requesterId,
        log.resourceType,
        log.resourceId
      )

      if (canView) {
        accessibleLogs.push({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details ? JSON.parse(log.details) : null,
          timestamp: log.timestamp,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent
        })
      }

      if (accessibleLogs.length === limit) {
        break
      }
    }

    const hasMore = logs.length > accessibleLogs.length
    const nextCursor = hasMore ? logs[Math.min(logs.length - 1, limit - 1)]?.id : null

    return {
      items: accessibleLogs,
      nextCursor,
      hasMore
    }
  }

  private static async ensureCanViewUsers(
    organizationId: string,
    userId: string
  ) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      }
    })

    if (!membership || membership.status !== 'active') {
      throw new Error('Access denied: not a member of this organization')
    }
  }

  private static async ensureCanManageUsers(
    organizationId: string,
    userId: string
  ) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      }
    })

    if (!membership || membership.status !== 'active') {
      throw new Error('Access denied: not a member of this organization')
    }

    const hasPermission =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      (Array.isArray(membership.permissions) &&
        membership.permissions.includes('organization:manage_members'))

    if (!hasPermission) {
      throw new Error('Insufficient permissions to manage organization users')
    }
  }

  private static async canViewResource(
    organizationId: string,
    userId: string,
    resourceType: string | null,
    resourceId: string | null
  ): Promise<boolean> {
    if (!resourceType || !resourceId) {
      return true
    }

    if (resourceType === 'project') {
      const project = await prisma.project.findUnique({
        where: { id: resourceId }
      })

      if (!project || project.organizationId !== organizationId) {
        return false
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId
          }
        }
      })

      if (!membership) {
        return false
      }

      if (membership.role === 'owner' || membership.role === 'admin') {
        return true
      }

      const projectMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: resourceId,
            userId
          }
        }
      }).catch(() => null)

      return !!projectMember
    }

    // Default allow for non-project resources within organization
    return true
  }

  private static toUserResponse(member: any) {
    const user = member.user || {}
    return {
      id: user.id,
      organizationId: member.organizationId,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      role: member.role,
      status: member.status,
      permissions: member.permissions || [],
      lastLoginAt: user.lastLoginAt,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      title: user.title,
      department: user.department,
      metadata: member.metadata || {}
    }
  }

  private static async getInviterName(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true }
    })

    return user?.fullName || user?.email || 'Member'
  }

  private static async getOrganizationName(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true }
    })

    return org?.name || 'LabelMint'
  }

  private static combineName(payload: { firstName?: string; lastName?: string }) {
    const firstName = payload.firstName?.trim() || ''
    const lastName = payload.lastName?.trim() || ''
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || undefined
  }
}
