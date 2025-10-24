import { prisma } from '../app.js'

export interface ITeam {
  id: string
  organizationId: string
  name: string
  description?: string
  avatar?: string
  settings: TeamSettings
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
  status: 'active' | 'archived'
  memberCount?: number
  projectCount?: number
}

export interface ITeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  permissions: TeamPermission[]
  joinedAt: Date
  invitedBy: string
  status: 'active' | 'pending' | 'removed'
  lastActiveAt?: Date
}

export interface TeamSettings {
  isPublic: boolean
  allowJoinRequests: boolean
  requireApproval: boolean
  maxMembers?: number
  defaultRole: TeamRole
  permissions: {
    canCreateProjects: boolean
    canInviteMembers: boolean
    canManageSettings: boolean
    canViewAnalytics: boolean
  }
  notifications: {
    newMember: boolean
    projectUpdates: boolean
    mentions: boolean
  }
}

export type TeamRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'lead'
  | 'member'
  | 'viewer'

export type TeamPermission =
  | 'team:read'
  | 'team:write'
  | 'team:delete'
  | 'team:manage_members'
  | 'team:invite'
  | 'team:remove_members'
  | 'team:manage_settings'
  | 'project:create'
  | 'project:read'
  | 'project:write'
  | 'project:delete'
  | 'project:assign'
  | 'analytics:view'
  | 'analytics:export'
  | 'billing:view'
  | 'billing:manage'

export interface TeamStats {
  totalMembers: number
  activeMembers: number
  totalProjects: number
  activeProjects: number
  completedTasks: number
  averageCompletionTime: number
  memberActivity: Array<{
    userId: string
    tasksCompleted: number
    hoursWorked: number
    lastActive: Date
  }>
}

export class TeamModel {
  static async create(data: {
    organizationId: string
    name: string
    description?: string
    userId: string
    settings?: Partial<TeamSettings>
  }): Promise<ITeam> {
    const defaultSettings: TeamSettings = {
      isPublic: false,
      allowJoinRequests: false,
      requireApproval: true,
      defaultRole: 'member',
      permissions: {
        canCreateProjects: true,
        canInviteMembers: false,
        canManageSettings: false,
        canViewAnalytics: false
      },
      notifications: {
        newMember: true,
        projectUpdates: true,
        mentions: true
      }
    }

    const team = await prisma.team.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        settings: { ...defaultSettings, ...data.settings },
        members: {
          create: {
            userId: data.userId,
            role: 'owner',
            permissions: this.getPermissionsForRole('owner'),
            invitedBy: data.userId,
            status: 'active'
          }
        }
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true
          }
        }
      }
    })

    return {
      ...team,
      memberCount: team._count.members,
      projectCount: team._count.projects
    }
  }

  static async findById(id: string, organizationId: string): Promise<ITeam | null> {
    const team = await prisma.team.findFirst({
      where: {
        id,
        organizationId,
        archivedAt: null
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
      }
    })

    if (!team) return null

    return {
      ...team,
      memberCount: team._count.members,
      projectCount: team._count.projects,
      status: team.archivedAt ? 'archived' : 'active'
    }
  }

  static async findByOrganization(
    organizationId: string,
    options: {
      page?: number
      limit?: number
      search?: string
      status?: 'active' | 'archived'
      includeCounts?: boolean
    } = {}
  ): Promise<{ teams: ITeam[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'active',
      includeCounts = true
    } = options

    const where = {
      organizationId,
      archivedAt: status === 'archived' ? { not: null } : null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        include: includeCounts ? {
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
        } : undefined,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.team.count({ where })
    ])

    return {
      teams: teams.map(team => ({
        ...team,
        memberCount: includeCounts ? team._count?.members || 0 : undefined,
        projectCount: includeCounts ? team._count?.projects || 0 : undefined,
        status: team.archivedAt ? 'archived' : 'active'
      })),
      total
    }
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<{
      name: string
      description: string
      avatar: string
      settings: Partial<TeamSettings>
    }>
  ): Promise<ITeam> {
    const team = await prisma.team.update({
      where: {
        id,
        organizationId
      },
      data,
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
      }
    })

    return {
      ...team,
      memberCount: team._count.members,
      projectCount: team._count.projects,
      status: team.archivedAt ? 'archived' : 'active'
    }
  }

  static async archive(
    id: string,
    organizationId: string
  ): Promise<void> {
    await prisma.team.update({
      where: {
        id,
        organizationId
      },
      data: {
        archivedAt: new Date()
      }
    })
  }

  static async restore(
    id: string,
    organizationId: string
  ): Promise<void> {
    await prisma.team.update({
      where: {
        id,
        organizationId
      },
      data: {
        archivedAt: null
      }
    })
  }

  static async delete(
    id: string,
    organizationId: string
  ): Promise<void> {
    // Soft delete by archiving
    await this.archive(id, organizationId)
  }

  static async addMember(data: {
    teamId: string
    userId: string
    role: TeamRole
    invitedBy: string
  }): Promise<ITeamMember> {
    return await prisma.teamMember.create({
      data: {
        teamId: data.teamId,
        userId: data.userId,
        role: data.role,
        permissions: this.getPermissionsForRole(data.role),
        invitedBy: data.invitedBy,
        status: 'active',
        joinedAt: new Date()
      }
    })
  }

  static async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamRole
  ): Promise<ITeamMember> {
    return await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      },
      data: {
        role,
        permissions: this.getPermissionsForRole(role)
      }
    })
  }

  static async removeMember(
    teamId: string,
    userId: string
  ): Promise<void> {
    await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      },
      data: {
        status: 'removed'
      }
    })
  }

  static async getMembers(
    teamId: string,
    options: {
      page?: number
      limit?: number
      role?: TeamRole
      status?: 'active' | 'pending' | 'removed'
    } = {}
  ): Promise<{ members: ITeamMember[]; total: number }> {
    const { page = 1, limit = 50, role, status = 'active' } = options

    const where = {
      teamId,
      status,
      ...(role && { role })
    }

    const [members, total] = await Promise.all([
      prisma.teamMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              avatar: true
            }
          }
        },
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.teamMember.count({ where })
    ])

    return { members, total }
  }

  static async getStats(teamId: string): Promise<TeamStats> {
    const [
      totalMembers,
      activeMembers,
      totalProjects,
      activeProjects,
      completedTasks,
      memberActivity
    ] = await Promise.all([
      prisma.teamMember.count({
        where: { teamId, status: 'active' }
      }),
      prisma.teamMember.count({
        where: {
          teamId,
          status: 'active',
          lastActiveAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
          }
        }
      }),
      prisma.project.count({
        where: { teamId }
      }),
      prisma.project.count({
        where: {
          teamId,
          status: { not: 'archived' }
        }
      }),
      prisma.task.count({
        where: {
          project: { teamId },
          status: 'completed'
        }
      }),
      prisma.$queryRaw`
        SELECT
          tm.user_id,
          COUNT(t.id) as tasks_completed,
          EXTRACT(EPOCH FROM AVG(t.completed_at - t.assigned_at)) as avg_completion_time,
          MAX(t.completed_at) as last_active
        FROM team_members tm
        LEFT JOIN project_members pm ON tm.user_id = pm.user_id
        LEFT JOIN tasks t ON pm.project_id = t.project_id
          AND t.status = 'completed'
          AND t.completed_at >= NOW() - INTERVAL '30 days'
        WHERE tm.team_id = ${teamId}
          AND tm.status = 'active'
        GROUP BY tm.user_id
      `
    ])

    return {
      totalMembers,
      activeMembers,
      totalProjects,
      activeProjects,
      completedTasks,
      averageCompletionTime: 0, // Calculate from raw query
      memberActivity: memberActivity.map((ma: any) => ({
        userId: ma.user_id,
        tasksCompleted: parseInt(ma.tasks_completed) || 0,
        hoursWorked: parseFloat(ma.avg_completion_time) / 3600 || 0,
        lastActive: ma.last_active || new Date()
      }))
    }
  }

  static getPermissionsForRole(role: TeamRole): TeamPermission[] {
    const rolePermissions = {
      owner: [
        'team:read', 'team:write', 'team:delete',
        'team:manage_members', 'team:invite', 'team:remove_members',
        'team:manage_settings',
        'project:create', 'project:read', 'project:write', 'project:delete',
        'project:assign',
        'analytics:view', 'analytics:export',
        'billing:view', 'billing:manage'
      ],
      admin: [
        'team:read', 'team:write',
        'team:manage_members', 'team:invite', 'team:remove_members',
        'team:manage_settings',
        'project:create', 'project:read', 'project:write', 'project:delete',
        'project:assign',
        'analytics:view', 'analytics:export',
        'billing:view'
      ],
      manager: [
        'team:read', 'team:write',
        'team:invite',
        'project:create', 'project:read', 'project:write', 'project:delete',
        'project:assign',
        'analytics:view'
      ],
      lead: [
        'team:read',
        'project:create', 'project:read', 'project:write',
        'project:assign',
        'analytics:view'
      ],
      member: [
        'team:read',
        'project:read', 'project:write'
      ],
      viewer: [
        'team:read',
        'project:read'
      ]
    }

    return rolePermissions[role] || []
  }
}