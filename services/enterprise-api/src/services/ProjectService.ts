import { Prisma } from '@prisma/client'
import { prisma, redis } from '../app.js'
import { AuditService } from './AuditService.js'
import { logger } from '../utils/logger.js'

export interface CreateProjectPayload {
  teamId: string
  name: string
  description?: string
  type?: string
  status?: string
  workflowId?: string
  settings?: Record<string, any>
  metadata?: Record<string, any>
  budget?: {
    total?: number
    currency?: string
    spent?: number
  }
  timeline?: {
    startDate?: string
    endDate?: string
    milestoneIds?: string[]
  }
  tags?: string[]
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  teamId?: string
  isPrivate?: boolean
}

export interface ListProjectOptions {
  page?: number
  limit?: number
  status?: string
  teamId?: string
  search?: string
  includeArchived?: boolean
}

export interface MemberPayload {
  userId: string
  role: string
  permissions?: string[]
}

export class ProjectService {
  private static readonly DEFAULT_PAGE = 1
  private static readonly DEFAULT_LIMIT = 25
  private static readonly ANALYTICS_CACHE_TTL = 300

  /**
   * Create a project inside an organization
   */
  static async create(
    organizationId: string,
    userId: string,
    payload: CreateProjectPayload
  ) {
    await this.ensureCanCreateProjects(organizationId, userId)

    const team = await prisma.team.findUnique({
      where: { id: payload.teamId },
      select: {
        id: true,
        organizationId: true
      }
    })

    if (!team || team.organizationId !== organizationId) {
      throw new Error('Team not found in organization')
    }

    const project = await prisma.project.create({
      data: {
        organizationId,
        teamId: payload.teamId,
        name: payload.name,
        description: payload.description,
        type: payload.type || 'custom',
        status: payload.status || 'active',
        workflowId: payload.workflowId || null,
        settings: payload.settings || {},
        metadata: payload.metadata || {},
        budget: payload.budget || {},
        timeline: payload.timeline || {},
        tags: payload.tags || [],
        createdBy: userId
      } as any,
      include: {
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
      details: {
        name: project.name,
        teamId: project.teamId,
        type: project.type
      }
    })

    return this.toProjectResponse(project)
  }

  /**
   * List projects for organization
   */
  static async list(
    organizationId: string,
    userId: string,
    options: ListProjectOptions = {}
  ) {
    await this.ensureCanViewProjects(organizationId, userId)

    const {
      page = this.DEFAULT_PAGE,
      limit = this.DEFAULT_LIMIT,
      status,
      teamId,
      search,
      includeArchived = false
    } = options

    const where: Prisma.ProjectWhereInput = {
      organizationId
    }

    if (status) {
      where.status = status
    }

    if (teamId) {
      where.teamId = teamId
    }

    if (!includeArchived) {
      where.archivedAt = null
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          tags: {
            has: search
          }
        }
      ]
    }

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              members: true,
              tasks: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.project.count({ where })
    ])

    return {
      projects: projects.map(project => this.toProjectResponse(project)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get single project
   */
  static async getById(
    organizationId: string,
    projectId: string,
    userId: string
  ) {
    await this.ensureCanViewProjects(organizationId, userId)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          select: { id: true, name: true }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            tasks: true
          }
        }
      }
    })

    if (!project || project.organizationId !== organizationId) {
      return null
    }

    return this.toProjectResponse(project)
  }

  /**
   * Update project
   */
  static async update(
    organizationId: string,
    projectId: string,
    userId: string,
    payload: UpdateProjectPayload
  ) {
    await this.ensureCanManageProject(organizationId, projectId, userId)

    if (payload.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: payload.teamId },
        select: {
          id: true,
          organizationId: true
        }
      })

      if (!team || team.organizationId !== organizationId) {
        throw new Error('Team not found in organization')
      }
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        teamId: payload.teamId,
        name: payload.name,
        description: payload.description,
        type: payload.type,
        status: payload.status,
        workflowId: payload.workflowId,
        settings: payload.settings,
        metadata: payload.metadata,
        budget: payload.budget,
        timeline: payload.timeline,
        tags: payload.tags,
        isPrivate: payload.isPrivate
      } as any,
      include: {
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: projectId,
      details: payload
    })

    return this.toProjectResponse(project)
  }

  /**
   * Archive project (soft-delete)
   */
  static async archive(
    organizationId: string,
    projectId: string,
    userId: string
  ) {
    await this.ensureCanManageProject(organizationId, projectId, userId)

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: new Date(),
        status: 'archived'
      } as any
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'project.archived',
      resourceType: 'project',
      resourceId: projectId
    })

    return project
  }

  /**
   * Restore archived project
   */
  static async restore(
    organizationId: string,
    projectId: string,
    userId: string
  ) {
    await this.ensureCanManageProject(organizationId, projectId, userId)

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: null,
        status: 'active'
      } as any
    })

    await AuditService.log({
      organizationId,
      userId,
      action: 'project.restored',
      resourceType: 'project',
      resourceId: projectId
    })

    return project
  }

  /**
   * Manage project members
   */
  static async addMember(
    organizationId: string,
    projectId: string,
    userId: string,
    payload: MemberPayload,
    actorId: string
  ) {
    await this.ensureCanManageProject(organizationId, projectId, actorId)

    const targetMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: payload.userId
        }
      }
    })

    if (!targetMembership || targetMembership.status !== 'active') {
      throw new Error('User must be an active member of the organization')
    }

    const projectMember = await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: payload.userId
        }
      },
      update: {
        role: payload.role,
        permissions: payload.permissions || []
      } as any,
      create: {
        projectId,
        userId: payload.userId,
        role: payload.role,
        permissions: payload.permissions || [],
        joinedAt: new Date()
      } as any,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatar: true
          }
        }
      }
    })

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: 'project.member_added',
      resourceType: 'project',
      resourceId: projectId,
      details: {
        userId: payload.userId,
        role: payload.role
      }
    })

    return projectMember
  }

  static async removeMember(
    organizationId: string,
    projectId: string,
    memberId: string,
    actorId: string
  ) {
    await this.ensureCanManageProject(organizationId, projectId, actorId)

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId
        }
      }
    }).catch(() => {
      throw new Error('Project member not found')
    })

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: 'project.member_removed',
      resourceType: 'project',
      resourceId: projectId,
      details: {
        userId: memberId
      }
    })
  }

  static async listMembers(
    organizationId: string,
    projectId: string,
    userId: string
  ) {
    await this.ensureCanViewProjects(organizationId, userId)

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatar: true
          }
        }
      },
      orderBy: {
        joinedAt: 'asc'
      }
    })

    return members
  }

  /**
   * Project analytics summary
   */
  static async getAnalytics(
    organizationId: string,
    projectId: string,
    userId: string,
    rangeDays: number = 30
  ) {
    await this.ensureCanViewProjects(organizationId, userId)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true }
    })

    if (!project || project.organizationId !== organizationId) {
      throw new Error('Project not found in organization')
    }

    const cacheKey = `project:${projectId}:analytics:${rangeDays}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - rangeDays)

    const [tasks, activity, members] = await Promise.all([
      prisma.task.findMany({
        where: {
          projectId,
          createdAt: {
            gte: startDate
          }
        },
        select: {
          id: true,
          status: true,
          completedAt: true,
          accuracy: true,
          cost: true,
          createdAt: true
        }
      }),
      prisma.auditLog.count({
        where: {
          organizationId,
          resourceType: 'project',
          resourceId: projectId,
          timestamp: {
            gte: startDate
          }
        }
      }),
      prisma.projectMember.count({
        where: { projectId }
      })
    ])

    const completedTasks = tasks.filter(t => t.status === 'completed')
    const pendingTasks = tasks.filter(t => t.status !== 'completed')

    const analytics = {
      projectId,
      rangeDays,
      totals: {
        tasksCreated: tasks.length,
        tasksCompleted: completedTasks.length,
        tasksPending: pendingTasks.length,
        projectMembers: members,
        auditEvents: activity
      },
      quality: {
        averageAccuracy: completedTasks.length
          ? completedTasks.reduce((acc, task) => acc + (task.accuracy || 0), 0) /
            completedTasks.length
          : 0
      },
      cost: {
        totalCost: tasks.reduce((acc, task) => acc + (task.cost || 0), 0)
      },
      timeline: {
        averageCompletionTime: completedTasks.length
          ? completedTasks.reduce((acc, task) => {
              if (task.completedAt) {
                return acc + (task.completedAt.getTime() - task.createdAt.getTime())
              }
              return acc
            }, 0) / completedTasks.length
          : 0
      },
      generatedAt: new Date().toISOString()
    }

    await redis.setex(cacheKey, this.ANALYTICS_CACHE_TTL, JSON.stringify(analytics))

    return analytics
  }

  private static async ensureCanViewProjects(
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

  private static async ensureCanCreateProjects(
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
        (membership.permissions.includes('project:create') ||
          membership.permissions.includes('project:manage')))

    if (!hasPermission) {
      throw new Error('Insufficient permissions to create projects')
    }
  }

  private static async ensureCanManageProject(
    organizationId: string,
    projectId: string,
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

    if (membership.role === 'owner' || membership.role === 'admin') {
      return
    }

    const hasOrgPermission =
      Array.isArray(membership.permissions) &&
      membership.permissions.includes('project:manage')

    if (hasOrgPermission) {
      return
    }

    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    }).catch(() => null)

    if (!projectMember) {
      throw new Error('Insufficient permissions to manage this project')
    }

    if (
      projectMember.role !== 'lead' &&
      !(
        Array.isArray(projectMember.permissions) &&
        projectMember.permissions.includes('project:manage')
      )
    ) {
      throw new Error('Insufficient permissions to manage this project')
    }
  }

  private static toProjectResponse(project: any) {
    return {
      id: project.id,
      organizationId: project.organizationId,
      teamId: project.teamId,
      team: project.team,
      name: project.name,
      description: project.description,
      type: project.type,
      status: project.status,
      workflowId: project.workflowId,
      settings: project.settings || {},
      metadata: project.metadata || {},
      budget: project.budget || {},
      timeline: project.timeline || {},
      tags: project.tags || [],
      isPrivate: project.isPrivate || false,
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      memberCount: project._count?.members,
      taskCount: project._count?.tasks
    }
  }
}
