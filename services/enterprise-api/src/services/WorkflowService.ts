import { workflowEngine } from './WorkflowEngine.js'
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowTemplate,
  ExecutionStatus,
  WorkflowStats
} from '../types/workflow.js'
import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import type { WorkflowDefinition } from '../types/workflow.js'

export interface WorkflowDetail extends WorkflowDefinition {
  creator?: {
    id: string
    email?: string | null
    firstName?: string | null
    lastName?: string | null
  }
  recentExecutions: Array<{
    id: string
    status: ExecutionStatus
    startedAt: Date
    completedAt?: Date | null
    duration?: number | null
    error?: string | null
  }>
}

export class WorkflowService {
  /**
   * Create a new workflow
   */
  static async create(
    organizationId: string,
    data: Partial<WorkflowDefinition>,
    userId: string
  ): Promise<WorkflowDefinition> {
    const workflowData = {
      name: data.name || 'Untitled Workflow',
      description: data.description,
      organizationId,
      definition: {
        nodes: data.nodes || [],
        edges: data.edges || [],
        variables: data.variables || [],
        settings: data.settings || this.getDefaultSettings(),
        triggers: data.triggers || []
      },
      createdBy: userId,
      category: data.category,
      tags: data.tags || [],
      isActive: data.isActive !== false,
      version: 1
    }

    const workflow = await prisma.workflow.create({
      data: workflowData
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: workflow.id,
      details: { workflowName: workflow.name }
    })

    logger.info('Workflow created', {
      workflowId: workflow.id,
      organizationId,
      userId
    })

    return this.mapToWorkflowDefinition(workflow)
  }

  /**
   * Get workflow by ID
   */
  static async getById(
    id: string,
    organizationId: string
  ): Promise<WorkflowDefinition | null> {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId
      }
    })

    if (!workflow) {
      return null
    }

    return this.mapToWorkflowDefinition(workflow)
  }

  static async getDetailedWorkflow(id: string, organizationId: string): Promise<WorkflowDetail | null> {
    const workflow = await prisma.workflow.findFirst({
      where: { id, organizationId },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        executions: {
          orderBy: { startTime: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            startTime: true,
            endTime: true,
            duration: true,
            error: true
          }
        }
      }
    })

    if (!workflow) {
      return null
    }

    const definition = this.mapToWorkflowDefinition(workflow)
    const recentExecutions = (workflow.executions || []).map(exec => ({
      id: exec.id,
      status: exec.status.toLowerCase() as ExecutionStatus,
      startedAt: exec.startTime,
      completedAt: exec.endTime,
      duration: exec.duration ?? null,
      error: exec.error
    }))

    return {
      ...definition,
      creator: workflow.creator
        ? {
            id: workflow.creator.id,
            email: workflow.creator.email,
            firstName: workflow.creator.firstName,
            lastName: workflow.creator.lastName
          }
        : undefined,
      recentExecutions
    }
  }

  /**
   * List workflows for organization
   */
  static async list(
    organizationId: string,
    options: {
      page?: number
      limit?: number
      search?: string
      category?: string
      status?: 'active' | 'inactive'
      tags?: string[]
    } = {}
  ): Promise<{ workflows: WorkflowDefinition[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      tags
    } = options

    const where: any = {
      organizationId
    }

    if (status) {
      where.isActive = status === 'active'
    }

    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      }
    }

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        include: {
          _count: {
            select: {
              executions: {
                where: {
                  startTime: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                  }
                }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.workflow.count({ where })
    ])

    return {
      workflows: workflows.map((w: any) => ({
        ...this.mapToWorkflowDefinition(w),
        executionCount: w._count.executions
      })),
      total
    }
  }

  /**
   * Update workflow
   */
  static async update(
    id: string,
    organizationId: string,
    data: Partial<WorkflowDefinition>,
    userId: string
  ): Promise<WorkflowDefinition> {
    const existing = await this.getById(id, organizationId)
    if (!existing) {
      throw new Error('Workflow not found')
    }

    const updateData: any = {
      name: data.name,
      description: data.description,
      category: data.category,
      tags: data.tags,
      isActive: data.isActive,
      updatedBy: userId,
      updatedAt: new Date()
    }

    if (data.nodes || data.edges || data.variables || data.settings || data.triggers) {
      updateData.definition = {
        nodes: data.nodes || existing.nodes,
        edges: data.edges || existing.edges,
        variables: data.variables || existing.variables,
        settings: data.settings || existing.settings,
        triggers: data.triggers || existing.triggers
      }
      updateData.version = existing.version + 1
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'workflow.updated',
      resourceType: 'workflow',
      resourceId: id,
      details: {
        workflowName: workflow.name,
        version: updateData.version
      }
    })

    return this.mapToWorkflowDefinition(workflow)
  }

  /**
   * Delete workflow
   */
  static async delete(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const workflow = await this.getById(id, organizationId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    // Soft delete by marking as inactive
    await prisma.workflow.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: userId
      }
    })

    // Log audit event
    await AuditService.log({
      organizationId,
      userId,
      action: 'workflow.deleted',
      resourceType: 'workflow',
      resourceId: id,
      details: { workflowName: workflow.name }
    })
  }

  /**
   * Execute workflow
   */
  static async execute(
    id: string,
    organizationId: string,
    input: Record<string, any>,
    userId: string
  ): Promise<WorkflowExecution> {
    const workflow = await this.getById(id, organizationId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    if (!workflow.isActive) {
      throw new Error('Workflow is not active')
    }

    const startTime = new Date()
    const baseContext = {
      variables: {},
      environment: {},
      secrets: {},
      metadata: {
        organizationId,
        userId
      }
    }

    const executionRecord = await prisma.workflowExecution.create({
      data: {
        workflowId: id,
        organizationId,
        triggeredBy: userId,
        triggeredByType: 'MANUAL',
        status: 'RUNNING',
        input,
        startTime,
        context: baseContext
      }
    })

    try {
      const executionResult = await workflowEngine.execute(
        id,
        input,
        baseContext,
        userId,
        'manual'
      )

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      await prisma.workflowExecution.update({
        where: { id: executionRecord.id },
        data: {
          status: 'COMPLETED',
          endTime,
          duration,
          output: executionResult?.output ?? {},
          logs: executionResult?.logs ?? [],
          error: null
        }
      })

      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.executed',
        resourceType: 'workflow',
        resourceId: id,
        details: {
          executionId: executionRecord.id,
          input
        }
      })

      return {
        id: executionRecord.id,
        workflowId: id,
        workflowVersion: workflow.version,
        status: 'completed',
        input,
        output: executionResult?.output ?? {},
        context: baseContext,
        startedAt: startTime,
        completedAt: endTime,
        duration,
        triggeredBy: userId,
        triggeredByType: 'manual',
        error: undefined,
        nodeId: undefined,
        logs: executionResult?.logs ?? []
      }
    } catch (error) {
      const endTime = new Date()
      await prisma.workflowExecution.update({
        where: { id: executionRecord.id },
        data: {
          status: 'FAILED',
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          error: error instanceof Error ? error.message : 'Workflow execution failed'
        }
      })

      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.failed',
        resourceType: 'workflow',
        resourceId: id,
        details: {
          executionId: executionRecord.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      throw error
    }
  }

  /**
   * Get execution status
   */
  static async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return await workflowEngine.getExecution(executionId)
  }

  /**
   * List executions
   */
  static async listExecutions(
    organizationId: string,
    options: {
      workflowId?: string
      status?: ExecutionStatus
      page?: number
      limit?: number
      startDate?: Date
      endDate?: Date
      triggeredBy?: string
    } = {}
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const {
      workflowId,
      status,
      page = 1,
      limit = 20,
      startDate,
      endDate,
      triggeredBy
    } = options

    const where: any = {
      organizationId
    }

    if (workflowId) {
      where.workflowId = workflowId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    if (triggeredBy) {
      where.triggeredBy = triggeredBy
    }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) where.startTime.gte = startDate
      if (endDate) where.startTime.lte = endDate
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          workflow: {
            select: { version: true }
          }
        }
      }),
      prisma.workflowExecution.count({ where })
    ])

    return {
      executions: executions.map((e: any) => ({
        id: e.id,
        workflowId: e.workflowId,
        status: e.status.toLowerCase() as ExecutionStatus,
        input: e.input as Record<string, any>,
        output: e.output as Record<string, any>,
        startedAt: e.startTime,
        completedAt: e.endTime,
        duration: e.duration || undefined,
        triggeredBy: e.triggeredBy || '',
        triggeredByType: e.triggeredByType as any,
        error: e.error || undefined,
        context: (e.context as any) || {
          variables: {},
          environment: {},
          secrets: {},
          metadata: {
            organizationId,
            userId: e.triggeredBy
          }
        },
        workflowVersion: (e.workflow as any)?.version ?? 1,
        logs: (e.logs as any) || []
      })),
      total
    }
  }

  /**
   * Get workflow statistics
   */
  static async getStats(
    id: string,
    _organizationId: string,
    days: number = 30
  ): Promise<WorkflowStats> {
    return await workflowEngine.getWorkflowStats(id, days)
  }

  /**
   * Create workflow template
   */
  static async createTemplate(
    organizationId: string,
    data: Partial<WorkflowTemplate> & { workflowId: string },
    userId: string
  ): Promise<WorkflowTemplate> {
    const template = await prisma.workflowTemplate.create({
      data: {
        workflowId: data.workflowId,
        name: data.name!,
        description: data.description!,
        category: data.category!,
        tags: data.tags || [],
        isPublic: data.isPublic || false,
        createdBy: userId
      }
    })

    logger.info('Workflow template created', {
      templateId: template.id,
      organizationId,
      userId
    })

    return this.mapToWorkflowTemplate(template)
  }

  /**
   * Import workflow from template
   */
  static async importFromTemplate(
    templateId: string,
    organizationId: string,
    name: string,
    userId: string
  ): Promise<WorkflowDefinition> {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        workflow: true
      }
    })

    if (!template) {
      throw new Error('Template not found')
    }

    if (!template.isPublic && template.workflow.organizationId !== organizationId) {
      throw new Error('Access denied')
    }

    // Create new workflow from template
    const workflow = await this.create(
      organizationId,
      {
        name,
        description: `Imported from template: ${template.name}`,
        nodes: (template.workflow.definition as any).nodes,
        edges: (template.workflow.definition as any).edges,
        variables: (template.workflow.definition as any).variables,
        settings: (template.workflow.definition as any).settings,
        triggers: (template.workflow.definition as any).triggers,
        category: template.category,
        tags: template.tags
      },
      userId
    )

    // Increment template usage count
    await prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    })

    return workflow
  }

  /**
   * Duplicate workflow
   */
  static async duplicate(
    id: string,
    organizationId: string,
    name: string,
    userId: string
  ): Promise<WorkflowDefinition> {
    const original = await this.getById(id, organizationId)
    if (!original) {
      throw new Error('Workflow not found')
    }

    const duplicateData: any = {
        name,
        description: `Duplicate of: ${original.description || original.name}`,
        nodes: original.nodes,
        edges: original.edges,
        variables: original.variables,
        settings: original.settings,
        triggers: original.triggers,
        tags: original.tags
      }

      if (original.category) {
        duplicateData.category = original.category
      }

    const duplicated = await this.create(
      organizationId,
      duplicateData,
      userId
    )

    return duplicated
  }

  static async cloneWorkflow(params: {
    sourceWorkflowId: string
    organizationId: string
    name: string
    description?: string
    clonedBy: string
  }): Promise<WorkflowDefinition> {
    const original = await this.getById(params.sourceWorkflowId, params.organizationId)
    if (!original) {
      throw new Error('Workflow not found')
    }

    return this.create(
      params.organizationId,
      {
        name: params.name,
        description: params.description ?? original.description,
        nodes: original.nodes,
        edges: original.edges,
        variables: original.variables,
        settings: original.settings,
        triggers: original.triggers,
        category: original.category,
        tags: original.tags,
        isActive: original.isActive
      },
      params.clonedBy
    )
  }

  static async importWorkflow(params: {
    workflowData: Partial<WorkflowDefinition> & { nodes?: any[]; edges?: any[] }
    organizationId: string
    name?: string
    description?: string
    importedBy: string
  }): Promise<WorkflowDefinition> {
    const { workflowData, organizationId, importedBy } = params
    const name = params.name || workflowData.name || 'Imported Workflow'
    const definition = (workflowData as any).definition || workflowData

    return this.create(
      organizationId,
      {
        name,
        description: params.description ?? workflowData.description,
        nodes: definition.nodes || [],
        edges: definition.edges || [],
        variables: definition.variables || [],
        settings: definition.settings || this.getDefaultSettings(),
        triggers: definition.triggers || [],
        category: workflowData.category,
        tags: workflowData.tags || []
      },
      importedBy
    )
  }

  /**
   * Get default workflow settings
   */
  private static getDefaultSettings() {
    return {
      timeout: 3600, // 1 hour
      retryPolicy: {
        maxAttempts: 3,
        backoffType: 'exponential',
        backoffDelay: 1000,
        maxDelay: 30000
      },
      errorHandling: {
        strategy: 'stop',
        alertOnError: true
      },
      notifications: {
        onSuccess: [],
        onFailure: [],
        onTimeout: []
      },
      concurrency: {
        maxConcurrent: 1,
        queueMode: 'fifo'
      }
    }
  }

  /**
   * Map Prisma workflow to WorkflowDefinition
   */
  private static mapToWorkflowDefinition(workflow: any): WorkflowDefinition {
    const definition = workflow.definition as any || {}

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      nodes: definition.nodes || [],
      edges: definition.edges || [],
      variables: definition.variables || [],
      settings: definition.settings || this.getDefaultSettings(),
      triggers: definition.triggers || [],
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      createdBy: workflow.createdBy,
      isActive: workflow.isActive,
      category: workflow.category,
      tags: workflow.tags || []
    }
  }

  /**
   * Map Prisma template to WorkflowTemplate
   */
  private static mapToWorkflowTemplate(template: any): WorkflowTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      isPublic: template.isPublic,
      usageCount: template.usageCount,
      rating: template.rating.toNumber(),
      reviews: [], // TODO: Load reviews separately
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      definition: template.definition || template.workflow?.definition || {}
    }
  }
}
