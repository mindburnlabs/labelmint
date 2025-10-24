import { prisma, redis } from '../app.js'
import { calculateStorageUsage } from '../middleware/multiTenant.js'

interface DateRange {
  start: Date
  end: Date
}

type MetricName =
  | 'users_active'
  | 'users_new'
  | 'projects_active'
  | 'projects_total'
  | 'workflows_total'
  | 'workflows_executed'
  | 'storage_used'

export interface AnalyticsExportOptions {
  startDate: string
  endDate: string
  metrics: Array<'overview' | 'users' | 'projects' | 'workflows'>
}

export class AnalyticsService {
  static async getOverview(organizationId: string, range: DateRange) {
    const cacheKey = this.cacheKey(organizationId, 'overview', range)
    const cached = await redis.get(cacheKey)
    if (cached) {
      return { data: JSON.parse(cached), cached: true }
    }

    const [totalUsers, activeUsers, newUsers, totalProjects, activeProjects, totalWorkflows, executedWorkflows] =
      await Promise.all([
        prisma.organizationUser.count({ where: { organizationId } }),
        prisma.organizationUser.count({
          where: {
            organizationId,
            lastLoginAt: { gte: range.start, lte: range.end },
            isActive: true
          }
        }),
        prisma.organizationUser.count({
          where: {
            organizationId,
            createdAt: { gte: range.start, lte: range.end }
          }
        }),
        prisma.project.count({ where: { organizationId } }),
        prisma.project.count({
          where: {
            organizationId,
            archivedAt: null
          }
        }),
        prisma.workflow.count({
          where: { organizationId, createdAt: { lte: range.end } }
        }),
        prisma.workflowExecution.count({
          where: {
            organizationId,
            startTime: { gte: range.start, lte: range.end },
            status: 'COMPLETED'
          }
        })
      ])

    const storageGb = await calculateStorageUsage(organizationId)

    const overview = {
      period: {
        start: range.start.toISOString(),
        end: range.end.toISOString()
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        activeRate: totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(2)) : 0
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
        activeRate: totalProjects > 0 ? Number(((activeProjects / totalProjects) * 100).toFixed(2)) : 0
      },
      workflows: {
        total: totalWorkflows,
        executed: executedWorkflows
      },
      storage: {
        gigabytes: Number(storageGb.toFixed(3))
      }
    }

    await redis.setex(cacheKey, 900, JSON.stringify(overview))

    return { data: overview, cached: false }
  }

  static async getUserAnalytics(organizationId: string, range: DateRange) {
    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        OR: [
          { createdAt: { gte: range.start, lte: range.end } },
          { lastLoginAt: { gte: range.start, lte: range.end } }
        ]
      },
      select: {
        createdAt: true,
        lastLoginAt: true,
        role: true,
        isActive: true
      }
    })

    const days = this.enumerateDays(range)
    const newMembers: Record<string, number> = Object.fromEntries(days.map(date => [date, 0]))
    const activeMembers: Record<string, number> = Object.fromEntries(days.map(date => [date, 0]))
    const roleCounts: Record<string, number> = {}

    members.forEach(member => {
      const createdKey = this.dayKey(member.createdAt)
      if (newMembers[createdKey] !== undefined) {
        newMembers[createdKey] += 1
      }

      if (member.lastLoginAt) {
        const activeKey = this.dayKey(member.lastLoginAt)
        if (activeMembers[activeKey] !== undefined) {
          activeMembers[activeKey] += 1
        }
      }

      roleCounts[member.role] = (roleCounts[member.role] ?? 0) + 1
    })

    return {
      period: {
        start: range.start.toISOString(),
        end: range.end.toISOString()
      },
      newMembers: this.seriesFromMap(newMembers),
      activeMembers: this.seriesFromMap(activeMembers),
      roles: Object.entries(roleCounts).map(([role, count]) => ({ role, count }))
    }
  }

  static async getProjectAnalytics(organizationId: string, range: DateRange) {
    const projects = await prisma.project.findMany({
      where: {
        organizationId,
        createdAt: { lte: range.end }
      },
      select: {
        id: true,
        teamId: true,
        createdAt: true,
        archivedAt: true,
        updatedAt: true
      }
    })

    const teams = await prisma.team.findMany({
      where: { organizationId },
      select: { id: true, name: true, isActive: true }
    })

    const activeProjects = projects.filter(p => !p.archivedAt)
    const archivedProjects = projects.filter(p => p.archivedAt)

    const creationTimeline: Record<string, number> = Object.fromEntries(this.enumerateDays(range).map(d => [d, 0]))
    projects.forEach(project => {
      const key = this.dayKey(project.createdAt)
      if (creationTimeline[key] !== undefined) {
        creationTimeline[key] += 1
      }
    })

    const teamMap: Record<string, { id: string; name: string | null; total: number }> = {}
    projects.forEach(project => {
      const key = project.teamId || 'unassigned'
      if (!teamMap[key]) {
        const teamInfo = teams.find(t => t.id === project.teamId)
        teamMap[key] = {
          id: key,
          name: teamInfo?.name ?? null,
          total: 0
        }
      }
      teamMap[key].total += 1
    })

    return {
      summary: {
        total: projects.length,
        active: activeProjects.length,
        archived: archivedProjects.length
      },
      byTeam: Object.values(teamMap),
      createdTimeline: this.seriesFromMap(creationTimeline)
    }
  }

  static async getWorkflowAnalytics(organizationId: string, range: DateRange) {
    const workflows = await prisma.workflow.findMany({
      where: {
        organizationId,
        createdAt: { lte: range.end }
      },
      select: { id: true, createdAt: true, isActive: true }
    })

    const executions = await prisma.workflowExecution.findMany({
      where: {
        organizationId,
        startTime: { gte: range.start, lte: range.end }
      },
      select: {
        status: true,
        duration: true,
        workflowId: true,
        startTime: true
      }
    })

    const statusCounts: Record<string, number> = {}
    let totalDuration = 0
    let durationCount = 0

    executions.forEach(exec => {
      statusCounts[exec.status] = (statusCounts[exec.status] ?? 0) + 1
      if (typeof exec.duration === 'number') {
        totalDuration += exec.duration
        durationCount += 1
      }
    })

    const executionTimeline: Record<string, number> = Object.fromEntries(this.enumerateDays(range).map(d => [d, 0]))
    executions.forEach(exec => {
      const key = this.dayKey(exec.startTime)
      if (executionTimeline[key] !== undefined) {
        executionTimeline[key] += 1
      }
    })

    return {
      totals: {
        workflows: workflows.length,
        active: workflows.filter(w => w.isActive).length,
        executions: executions.length
      },
      executionsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      averageDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      executionTimeline: this.seriesFromMap(executionTimeline)
    }
  }

  static async getMetric(organizationId: string, metric: MetricName, range: DateRange) {
    switch (metric) {
      case 'users_active': {
        const active = await prisma.organizationUser.count({
          where: {
            organizationId,
            lastLoginAt: { gte: range.start, lte: range.end },
            isActive: true
          }
        })
        return { metric, value: active, calculatedAt: new Date().toISOString() }
      }
      case 'users_new': {
        const created = await prisma.organizationUser.count({
          where: {
            organizationId,
            createdAt: { gte: range.start, lte: range.end }
          }
        })
        return { metric, value: created, calculatedAt: new Date().toISOString() }
      }
      case 'projects_active': {
        const activeProjects = await prisma.project.count({
          where: { organizationId, archivedAt: null }
        })
        return { metric, value: activeProjects, calculatedAt: new Date().toISOString() }
      }
      case 'projects_total': {
        const totalProjects = await prisma.project.count({ where: { organizationId } })
        return { metric, value: totalProjects, calculatedAt: new Date().toISOString() }
      }
      case 'workflows_total': {
        const total = await prisma.workflow.count({ where: { organizationId } })
        return { metric, value: total, calculatedAt: new Date().toISOString() }
      }
      case 'workflows_executed': {
        const executed = await prisma.workflowExecution.count({
          where: { organizationId, startTime: { gte: range.start, lte: range.end } }
        })
        return { metric, value: executed, calculatedAt: new Date().toISOString() }
      }
      case 'storage_used': {
        const storage = await calculateStorageUsage(organizationId)
        return { metric, value: Number(storage.toFixed(3)), unit: 'GB', calculatedAt: new Date().toISOString() }
      }
      default:
        throw new Error(`Unsupported metric: ${metric}`)
    }
  }

  static async exportToCsv(
    organizationId: string,
    options: AnalyticsExportOptions
  ): Promise<{ filename: string; content: string }> {
    const range = this.parseRange(options.startDate, options.endDate)
    const rows: string[] = []
    rows.push('metric,label,value')

    if (options.metrics.includes('overview')) {
      const { data } = await this.getOverview(organizationId, range)
      rows.push(`overview,total_users,${data.users.total}`)
      rows.push(`overview,active_users,${data.users.active}`)
      rows.push(`overview,active_projects,${data.projects.active}`)
      rows.push(`overview,executed_workflows,${data.workflows.executed}`)
      rows.push(`overview,storage_gb,${data.storage.gigabytes}`)
    }

    if (options.metrics.includes('users')) {
      const users = await this.getUserAnalytics(organizationId, range)
      users.newMembers.forEach(entry => {
        rows.push(`users,new_members_${entry.date},${entry.value}`)
      })
      users.activeMembers.forEach(entry => {
        rows.push(`users,active_members_${entry.date},${entry.value}`)
      })
    }

    if (options.metrics.includes('projects')) {
      const projects = await this.getProjectAnalytics(organizationId, range)
      rows.push(`projects,total,${projects.summary.total}`)
      rows.push(`projects,active,${projects.summary.active}`)
      rows.push(`projects,archived,${projects.summary.archived}`)
    }

    if (options.metrics.includes('workflows')) {
      const workflows = await this.getWorkflowAnalytics(organizationId, range)
      rows.push(`workflows,total,${workflows.totals.workflows}`)
      rows.push(`workflows,executions,${workflows.totals.executions}`)
      rows.push(`workflows,average_duration_ms,${workflows.averageDurationMs}`)
    }

    const filename = `analytics-${organizationId}-${range.start.toISOString().slice(0, 10)}-${range.end
      .toISOString()
      .slice(0, 10)}.csv`

    return { filename, content: rows.join('\n') }
  }

  static parseRange(start?: string | Date, end?: string | Date): DateRange {
    const endDate = end ? new Date(end) : new Date()
    const startDate = start ? new Date(start) : this.addDays(endDate, -30)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('Invalid date range')
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before end date')
    }

    return { start: startDate, end: endDate }
  }

  private static cacheKey(organizationId: string, key: string, range: DateRange) {
    return `analytics:${organizationId}:${key}:${range.start.toISOString()}:${range.end.toISOString()}`
  }

  private static enumerateDays(range: DateRange): string[] {
    const days = this.differenceInCalendarDays(range.end, range.start)
    const result: string[] = []
    for (let i = 0; i <= days; i += 1) {
      result.push(this.dayKey(this.addDays(range.start, i)))
    }
    return result
  }

  private static dayKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().slice(0, 10)
  }

  private static seriesFromMap(map: Record<string, number>) {
    return Object.entries(map).map(([date, value]) => ({ date, value }))
  }

  private static differenceInCalendarDays(a: Date, b: Date): number {
    const start = new Date(b.getFullYear(), b.getMonth(), b.getDate())
    const end = new Date(a.getFullYear(), a.getMonth(), a.getDate())
    const diff = end.getTime() - start.getTime()
    return Math.max(Math.round(diff / (24 * 60 * 60 * 1000)), 0)
  }

  private static addDays(date: Date, amount: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + amount)
    return result
  }
}
