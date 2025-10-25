import { Response, NextFunction } from 'express'
import { WorkflowService } from '../services/WorkflowService.js'
import { WorkflowBuilderService } from '../services/WorkflowBuilderService.js'
import { logger } from '../utils/logger.js'
import { AuditService } from '../services/AuditService.js'
import { prisma } from '../app.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { ExecutionStatus } from '../types/workflow.js'

export class WorkflowController {
  /**
   * List workflows for an organization
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const {
        page = 1,
        limit = 20,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query

      const workflows = await WorkflowService.list(organizationId, {
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      })

      res.json({
        success: true,
        data: workflows
      })
    } catch (error) {
      logger.error('Failed to list workflows', {
        organizationId: req.params.organizationId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Create a new workflow
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { name, description, trigger, nodes, settings } = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const workflow = await WorkflowService.create(
        organizationId,
        {
          name,
          description,
          nodes,
          settings,
          triggers: trigger ? [trigger] : undefined
        },
        userId
      )

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.created',
        resourceType: 'workflow',
        resourceId: workflow.id,
        details: { name, triggerType: trigger.type }
      })

      logger.info('Workflow created', {
        organizationId,
        workflowId: workflow.id,
        name,
        createdBy: userId
      })

      res.status(201).json({
        success: true,
        data: (await WorkflowService.getDetailedWorkflow(workflow.id, organizationId)) ?? workflow
      })
    } catch (error) {
      logger.error('Failed to create workflow', {
        organizationId: req.params.organizationId,
        userId: req.user?.id,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Get a specific workflow
   */
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params

      const workflow = await WorkflowService.getDetailedWorkflow(workflowId, organizationId)
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        })
        return
      }

      res.json({
        success: true,
        data: workflow
      })
    } catch (error) {
      logger.error('Failed to get workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Update a workflow
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const updates = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const workflow = await WorkflowService.update(workflowId, organizationId, updates, userId)
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        })
        return
      }

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.updated',
        resourceType: 'workflow',
        resourceId: workflowId,
        details: { updates: Object.keys(updates) }
      })

      logger.info('Workflow updated', {
        organizationId,
        workflowId,
        updatedBy: userId
      })

      res.json({
        success: true,
        data: (await WorkflowService.getDetailedWorkflow(workflowId, organizationId)) ?? workflow
      })
    } catch (error) {
      logger.error('Failed to update workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Delete a workflow
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      await WorkflowService.delete(workflowId, organizationId, userId)

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.deleted',
        resourceType: 'workflow',
        resourceId: workflowId,
        details: {}
      })

      logger.info('Workflow deleted', {
        organizationId,
        workflowId,
        deletedBy: userId
      })

      res.status(204).send()
    } catch (error) {
      if (error instanceof Error && error.message === 'Workflow not found') {
        res.status(404).json({ success: false, error: error.message })
        return
      }

      logger.error('Failed to delete workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Execute a workflow
   */
  static async execute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const { input = {} } = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const execution = await WorkflowService.execute(workflowId, organizationId, input, userId)

      logger.info('Workflow executed', {
        organizationId,
        workflowId,
        executionId: execution.id,
        triggeredBy: userId
      })

      res.status(202).json({
        success: true,
        data: execution
      })
    } catch (error) {
      logger.error('Failed to execute workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Get workflow execution history
   */
  static async getExecutions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const { page = 1, limit = 20, status, startDate, endDate } = req.query

      const executions = await WorkflowService.listExecutions(organizationId, {
        workflowId,
        page: Number(page),
        limit: Number(limit),
        status: status as ExecutionStatus | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      })

      res.json({
        success: true,
        data: executions
      })
    } catch (error) {
      logger.error('Failed to get workflow executions', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Get workflow templates
   */
  static async getTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search } = req.query

      const templates = await WorkflowBuilderService.getTemplates(
        category as string,
        search as string
      )

      res.json({
        success: true,
        data: templates
      })
    } catch (error) {
      logger.error('Failed to get workflow templates', {
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Create workflow from template
   */
  static async createFromTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, templateId } = req.params
      const { name, description, config = {} } = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const workflow = await WorkflowBuilderService.createFromTemplate({
        templateId,
        name,
        description,
        config,
        organizationId,
        createdBy: userId
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.created_from_template',
        resourceType: 'workflow',
        resourceId: workflow.id,
        details: { templateId, name }
      })

      logger.info('Workflow created from template', {
        organizationId,
        workflowId: workflow.id,
        templateId,
        createdBy: userId
      })

      const detailed = await WorkflowService.getDetailedWorkflow(workflow.id, organizationId)

      res.status(201).json({
        success: true,
        data: detailed ?? workflow
      })
    } catch (error) {
      logger.error('Failed to create workflow from template', {
        organizationId: req.params.organizationId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Clone a workflow
   */
  static async clone(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const { name, description } = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const clonedWorkflow = await WorkflowService.cloneWorkflow({
        sourceWorkflowId: workflowId,
        organizationId,
        name,
        description,
        clonedBy: userId
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.cloned',
        resourceType: 'workflow',
        resourceId: clonedWorkflow.id,
        details: { sourceWorkflowId, name }
      })

      logger.info('Workflow cloned', {
        organizationId,
        sourceWorkflowId: workflowId,
        newWorkflowId: clonedWorkflow.id,
        clonedBy: userId
      })

      const detailed = await WorkflowService.getDetailedWorkflow(clonedWorkflow.id, organizationId)

      res.status(201).json({
        success: true,
        data: detailed ?? clonedWorkflow
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'Workflow not found') {
        res.status(404).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to clone workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Export workflow
   */
  static async export(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, workflowId } = req.params
      const { format = 'json' } = req.query

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const workflow = await WorkflowService.getDetailedWorkflow(workflowId, organizationId)

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        })
        return
      }

      if (format === 'yaml') {
        res.status(400).json({
          success: false,
          error: 'YAML export not supported'
        })
        return
      }

      const filename = `workflow-${workflowId}.${format}`

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Type', 'application/json')

      res.send(JSON.stringify(workflow, null, 2))
    } catch (error) {
      if (error instanceof Error && error.message === 'Workflow not found') {
        res.status(404).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to export workflow', {
        organizationId: req.params.organizationId,
        workflowId: req.params.workflowId,
        error: error.message
      })
      next(error)
    }
  }

  /**
   * Import workflow
   */
  static async import(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { workflow, name, description } = req.body
      const userId = WorkflowController.getUserId(req)

      if (!(await WorkflowController.ensureWorkflowManager(req, res, organizationId))) {
        return
      }

      const importedWorkflow = await WorkflowService.importWorkflow({
        workflowData: workflow,
        organizationId,
        name,
        description,
        importedBy: userId
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId,
        action: 'workflow.imported',
        resourceType: 'workflow',
        resourceId: importedWorkflow.id,
        details: { name: name || workflow.name }
      })

      logger.info('Workflow imported', {
        organizationId,
        workflowId: importedWorkflow.id,
        importedBy: userId
      })

      res.status(201).json({
        success: true,
        data: importedWorkflow
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'Workflow not found') {
        res.status(404).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to import workflow', {
        organizationId: req.params.organizationId,
        error: error.message
      })
      next(error)
    }
  }

  private static getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id
    if (!userId) {
      throw new Error('User authentication required')
    }
    return userId
  }

  private static async ensureWorkflowManager(
    req: AuthenticatedRequest,
    res: Response,
    organizationId: string
  ): Promise<boolean> {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return false
    }

    const membership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      select: {
        role: true,
        permissions: true,
        isActive: true
      }
    })

    if (!membership || !membership.isActive) {
      res.status(403).json({ success: false, error: 'Access denied: not a member of this organization' })
      return false
    }

    const role = typeof membership.role === 'string' ? membership.role.toLowerCase() : ''
    if (role === 'owner' || role === 'admin') {
      return true
    }

    const permissionSet = new Set<string>()
    const collect = (value: any) => {
      if (!value) return
      if (Array.isArray(value)) {
        value.forEach(collect)
      } else if (typeof value === 'string') {
        permissionSet.add(value)
      } else if (typeof value === 'object') {
        Object.values(value).forEach(collect)
      }
    }
    collect(membership.permissions)

    if (permissionSet.has('workflow:manage') || permissionSet.has('workflow:write')) {
      return true
    }

    res.status(403).json({ success: false, error: 'Insufficient permissions to manage workflows' })
    return false
  }
}
