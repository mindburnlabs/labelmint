import { EventEmitter } from 'events'
import {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionStatus,
  RuntimeContext,
  WorkflowLogger,
  WorkflowEvent,
  ExecutionContext
} from '../types/workflow.js'
import { prisma, redis } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import { v4 as uuidv4 } from 'uuid'

export class WorkflowEngine extends EventEmitter {
  private static instance: WorkflowEngine
  private executions = new Map<string, RuntimeContext>()
  private nodeExecutors = new Map<string, NodeExecutor>()
  private isShuttingDown = false

  static getInstance(): WorkflowEngine {
    if (!this.instance) {
      this.instance = new WorkflowEngine()
    }
    return this.instance
  }

  constructor() {
    super()
    this.setupGracefulShutdown()
  }

  /**
   * Register a node executor
   */
  registerNodeExecutor(type: string, executor: NodeExecutor): void {
    this.nodeExecutors.set(type, executor)
    logger.debug(`Node executor registered: ${type}`)
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    input: Record<string, any>,
    context: Partial<ExecutionContext>,
    triggeredBy: string,
    triggeredByType: string
  ): Promise<WorkflowExecution> {
    const executionId = uuidv4()

    // Get workflow definition
    const workflow = await this.getWorkflow(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow is not active: ${workflowId}`)
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      status: 'pending',
      input,
      context: {
        variables: { ...input, ...workflow.variables.reduce((acc, v) => {
          acc[v.name] = v.defaultValue
          return acc
        }, {} as Record<string, any>)},
        environment: context.environment || {},
        secrets: context.secrets || {},
        metadata: {
          organizationId: context.metadata?.organizationId || '',
          userId: context.metadata?.userId,
          teamId: context.metadata?.teamId,
          projectId: context.metadata?.projectId
        }
      },
      startedAt: new Date(),
      triggeredBy,
      triggeredByType: triggeredByType as any,
      logs: []
    }

    // Save execution to database
    await this.saveExecution(execution)

    // Create runtime context
    const runtimeContext: RuntimeContext = {
      execution,
      workflow,
      nodeResults: new Map(),
      logger: new WorkflowRuntimeLogger(executionId),
      signal: new AbortController().signal
    }

    // Store context
    this.executions.set(executionId, runtimeContext)

    // Log start
    await runtimeContext.logger.info('Workflow execution started', {
      workflowId,
      triggeredBy,
      triggeredByType
    })

    // Emit event
    this.emit('workflow:started', {
      type: 'workflow.started',
      workflowId,
      executionId,
      data: { input }
    })

    // Start execution asynchronously
    this.runWorkflow(runtimeContext).catch(error => {
      logger.error('Workflow execution error', {
        executionId,
        error: error.message
      })
    })

    return execution
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    // Check cache first
    const context = this.executions.get(executionId)
    if (context) {
      return context.execution
    }

    // Load from database
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        tasks: {
          orderBy: { startTime: 'asc' }
        }
      }
    })

    if (!execution) {
      return null
    }

    // Transform to expected format
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowVersion: 1, // TODO: Store version in DB
      status: execution.status as ExecutionStatus,
      input: execution.input as Record<string, any>,
      output: execution.output as Record<string, any>,
      context: execution.context as ExecutionContext,
      startedAt: execution.startTime,
      completedAt: execution.endTime,
      duration: execution.duration || undefined,
      triggeredBy: execution.triggeredBy || '',
      triggeredByType: execution.triggeredByType as any,
      error: execution.error || undefined,
      nodeId: execution.nodeId || undefined,
      logs: [] // TODO: Load logs separately
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string, userId: string): Promise<void> {
    const context = this.executions.get(executionId)
    if (!context) {
      throw new Error('Execution not found or already completed')
    }

    // Abort the execution
    const controller = context.signal as any
    if (controller.abort) {
      controller.abort()
    }

    // Update status
    context.execution.status = 'cancelled'
    context.execution.completedAt = new Date()
    context.execution.duration = Date.now() - context.execution.startedAt.getTime()

    await this.updateExecution(context.execution)

    await context.logger.info('Workflow execution cancelled', { userId })

    this.emit('workflow:cancelled', {
      type: 'workflow.cancelled',
      workflowId: context.execution.workflowId,
      executionId,
      data: { userId }
    })
  }

  /**
   * Retry execution
   */
  async retryExecution(executionId: string, userId: string): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId)
    if (!execution) {
      throw new Error('Execution not found')
    }

    if (execution.status !== 'failed') {
      throw new Error('Only failed executions can be retried')
    }

    // Create new execution with same input
    return this.execute(
      execution.workflowId,
      execution.input,
      execution.context,
      userId,
      'manual'
    )
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(workflowId: string, days: number = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      avgExecutionTime,
      executionsByDay
    ] = await Promise.all([
      prisma.workflowExecution.count({
        where: {
          workflowId,
          startTime: { gte: startDate }
        }
      }),
      prisma.workflowExecution.count({
        where: {
          workflowId,
          status: 'COMPLETED',
          startTime: { gte: startDate }
        }
      }),
      prisma.workflowExecution.count({
        where: {
          workflowId,
          status: 'FAILED',
          startTime: { gte: startDate }
        }
      }),
      prisma.workflowExecution.aggregate({
        where: {
          workflowId,
          status: 'COMPLETED',
          startTime: { gte: startDate }
        },
        _avg: {
          duration: true
        }
      }),
      prisma.$queryRaw`
        SELECT
          DATE(start_time) as date,
          COUNT(*) as count
        FROM workflow_executions
        WHERE workflow_id = ${workflowId}
          AND start_time >= ${startDate}
        GROUP BY DATE(start_time)
        ORDER BY date
      `
    ])

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      averageExecutionTime: avgExecutionTime._avg.duration || 0,
      executionsByDay: executionsByDay.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    }
  }

  /**
   * Private method to run workflow
   */
  private async runWorkflow(context: RuntimeContext): Promise<void> {
    try {
      context.execution.status = 'running'
      await this.updateExecution(context.execution)

      // Find trigger nodes
      const triggerNodes = context.workflow.nodes.filter(n => n.type === 'trigger')

      if (triggerNodes.length === 0) {
        throw new Error('No trigger nodes found in workflow')
      }

      // Execute trigger node
      const triggerNode = triggerNodes[0]
      await this.executeNode(triggerNode, context)

      // Find next nodes to execute
      await this.executeNextNodes(triggerNode.id, context)

      // Mark as completed
      context.execution.status = 'completed'
      context.execution.completedAt = new Date()
      context.execution.duration = Date.now() - context.execution.startedAt.getTime()

      await this.updateExecution(context.execution)
      await context.logger.info('Workflow execution completed')

      this.emit('workflow:completed', {
        type: 'workflow.completed',
        workflowId: context.execution.workflowId,
        executionId: context.execution.id,
        data: { output: context.execution.output }
      })

    } catch (error) {
      context.execution.status = 'failed'
      context.execution.error = error.message
      context.execution.completedAt = new Date()
      context.execution.duration = Date.now() - context.execution.startedAt.getTime()

      await this.updateExecution(context.execution)
      await context.logger.error('Workflow execution failed', error)

      this.emit('workflow:failed', {
        type: 'workflow.failed',
        workflowId: context.execution.workflowId,
        executionId: context.execution.id,
        data: { error: error.message }
      })

      throw error
    } finally {
      // Flush any remaining logs
      await (context.logger as WorkflowRuntimeLogger).flushBatch(context.execution.id)

      // Clean up
      this.executions.delete(context.execution.id)
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(nodeId: string, context: RuntimeContext): Promise<any> {
    const node = context.workflow.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }

    context.execution.nodeId = nodeId
    await context.logger.info(`Executing node: ${node.type}`, { nodeId })

    const executor = this.nodeExecutors.get(node.type)
    if (!executor) {
      throw new Error(`No executor found for node type: ${node.type}`)
    }

    const startTime = Date.now()

    try {
      // Execute the node
      const result = await executor.execute(node, context)

      // Store result
      context.nodeResults.set(nodeId, result)

      // Update context variables
      if (result.output) {
        Object.assign(context.execution.context.variables, result.output)
      }

      await context.logger.info(`Node executed successfully`, {
        nodeId,
        duration: Date.now() - startTime
      })

      this.emit('node:completed', {
        type: 'node.completed',
        workflowId: context.execution.workflowId,
        executionId: context.execution.id,
        data: { nodeId, result }
      })

      return result

    } catch (error) {
      await context.logger.error(`Node execution failed`, error as Error, { nodeId })

      this.emit('node:failed', {
        type: 'node.failed',
        workflowId: context.execution.workflowId,
        executionId: context.execution.id,
        data: { nodeId, error: error.message }
      })

      // Handle error based on workflow configuration
      const errorHandling = context.workflow.settings.errorHandling
      if (errorHandling.strategy === 'stop') {
        throw error
      } else if (errorHandling.strategy === 'continue') {
        return { output: null }
      } else if (errorHandling.strategy === 'retry') {
        // Implement retry logic
        const maxRetries = errorHandling.maxRetries || 3
        const retryDelay = Math.pow(2, context.retryCount || 0) * 1000 // Exponential backoff

        if ((context.retryCount || 0) < maxRetries) {
          await context.logger.warn(`Node execution failed, retrying... (${(context.retryCount || 0) + 1}/${maxRetries})`, {
            nodeId,
            error: error.message,
            retryCount: (context.retryCount || 0) + 1,
            retryDelay
          })

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay))

          // Update retry count
          context.retryCount = (context.retryCount || 0) + 1

          // Retry execution
          return this.executeNode(nodeId, context)
        } else {
          await context.logger.error(`Node execution failed after ${maxRetries} retries`, error as Error, { nodeId })
          throw error
        }
      }

      throw error
    }
  }

  /**
   * Execute next nodes in the workflow
   */
  private async executeNextNodes(fromNodeId: string, context: RuntimeContext): Promise<void> {
    // Find outgoing edges
    const outgoingEdges = context.workflow.edges.filter(e => e.source === fromNodeId)

    for (const edge of outgoingEdges) {
      // Check edge condition
      if (edge.condition) {
        const shouldExecute = await this.evaluateCondition(edge.condition, context)
        if (!shouldExecute) {
          await context.logger.debug('Edge condition not met', {
            edgeId: edge.id,
            condition: edge.condition.expression
          })
          continue
        }
      }

      // Execute the target node
      const result = await this.executeNode(edge.target, context)

      // Continue to next nodes
      await this.executeNextNodes(edge.target, context)
    }
  }

  /**
   * Evaluate edge condition
   */
  private async evaluateCondition(condition: any, context: RuntimeContext): Promise<boolean> {
    // Simple expression evaluation
    // In production, use a proper expression parser
    try {
      const variables = context.execution.context.variables
      const expression = condition.expression.replace(/\$\{(\w+)\}/g, (_, key) => {
        return JSON.stringify(variables[key] || null)
      })

      // Use Function constructor for evaluation (be careful with this in production)
      const result = new Function(`return ${expression}`)()
      return Boolean(result)
    } catch (error) {
      await context.logger.warn('Failed to evaluate condition', {
        condition: condition.expression,
        error: error.message
      })
      return false
    }
  }

  /**
   * Get workflow definition
   */
  private async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      return null
    }

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || undefined,
      version: workflow.version,
      nodes: (workflow.definition as any).nodes || [],
      edges: (workflow.definition as any).edges || [],
      variables: (workflow.definition as any).variables || [],
      settings: (workflow.definition as any).settings || {},
      triggers: (workflow.definition as any).triggers || [],
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      createdBy: workflow.createdBy,
      isActive: workflow.isActive,
      category: workflow.category || undefined,
      tags: []
    }
  }

  /**
   * Save execution to database
   */
  private async saveExecution(execution: WorkflowExecution): Promise<void> {
    await prisma.workflowExecution.create({
      data: {
        id: execution.id,
        workflowId: execution.workflowId,
        organizationId: execution.context.metadata.organizationId,
        triggeredBy: execution.triggeredBy,
        triggeredByType: execution.triggeredByType,
        status: execution.status,
        input: execution.input,
        output: execution.output || {},
        context: execution.context,
        startTime: execution.startedAt,
        nodeId: execution.nodeId
      }
    })
  }

  /**
   * Update execution in database
   */
  private async updateExecution(execution: WorkflowExecution): Promise<void> {
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: execution.status,
        output: execution.output || {},
        endTime: execution.completedAt,
        duration: execution.duration,
        error: execution.error
      }
    })
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      if (this.isShuttingDown) return
      this.isShuttingDown = true

      logger.info('Workflow engine shutting down...')

      // Cancel all running executions
      for (const [executionId, context] of this.executions) {
        context.execution.status = 'cancelled'
        context.execution.completedAt = new Date()
        await this.updateExecution(context.execution)
      }

      this.executions.clear()
      process.exit(0)
    }

      process.on('SIGTERM', shutdown)
      process.on('SIGINT', shutdown)
    }
}

// Node Executor Interface
export interface NodeExecutor {
  execute(node: any, context: RuntimeContext): Promise<NodeResult>
}

export interface NodeResult {
  output: any
  nextNodes?: string[]
  wait?: boolean // Wait for external event
}

// Runtime Logger Implementation
class WorkflowRuntimeLogger implements WorkflowLogger {
  constructor(private executionId: string) {}

  async debug(message: string, data?: any): Promise<void> {
    await this.log('debug', message, data)
  }

  async info(message: string, data?: any): Promise<void> {
    await this.log('info', message, data)
  }

  async warn(message: string, data?: any): Promise<void> {
    await this.log('warn', message, data)
  }

  async error(message: string, error?: Error | string, data?: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error
    await this.log('error', message, { ...data, error: errorMessage })
  }

  private static logBatch = new Map<string, Array<{
    executionId: string
    level: string
    message: string
    data?: any
    timestamp: Date
  }>>()

  private static batchTimer: NodeJS.Timeout | null = null
  private static readonly BATCH_SIZE = 100
  private static readonly BATCH_TIMEOUT = 5000 // 5 seconds

  private async batchLog(logEntry: {
    executionId: string
    level: string
    message: string
    data?: any
    timestamp: Date
  }): Promise<void> {
    // Get or create batch for this execution
    let batch = WorkflowRuntimeLogger.logBatch.get(this.executionId)
    if (!batch) {
      batch = []
      WorkflowRuntimeLogger.logBatch.set(this.executionId, batch)
    }

    // Add log entry to batch
    batch.push(logEntry)

    // Check if we should flush the batch
    if (batch.length >= WorkflowRuntimeLogger.BATCH_SIZE) {
      await this.flushBatch(this.executionId)
    } else if (!WorkflowRuntimeLogger.batchTimer) {
      // Set timer to flush batch after timeout
      WorkflowRuntimeLogger.batchTimer = setTimeout(() => {
        this.flushAllBatches()
      }, WorkflowRuntimeLogger.BATCH_TIMEOUT)
    }
  }

  private async flushBatch(executionId: string): Promise<void> {
    const batch = WorkflowRuntimeLogger.logBatch.get(executionId)
    if (!batch || batch.length === 0) return

    // Clear batch immediately
    WorkflowRuntimeLogger.logBatch.set(executionId, [])

    try {
      // Insert batch into database
      // Convert logs to database format
      const logsToInsert = batch.map(log => ({
        execution_id: log.executionId,
        node_id: null, // Can be enhanced to track node ID
        level: log.level,
        message: log.message,
        data: log.data || {},
        created_at: log.timestamp
      }))

      // Bulk insert using Prisma
      await prisma.$transaction(async (tx) => {
        for (const log of logsToInsert) {
          await tx.workflowExecutionLog.create({
            data: log
          })
        }
      })

      logger.debug(`Flushed ${logsToInsert.length} workflow logs for execution ${executionId}`)
    } catch (error) {
      logger.error('Failed to flush workflow logs batch', {
        executionId,
        error: error.message,
        batchSize: batch.length
      })

      // Re-add failed logs to batch for retry
      const currentBatch = WorkflowRuntimeLogger.logBatch.get(executionId) || []
      WorkflowRuntimeLogger.logBatch.set(executionId, [...batch, ...currentBatch])
    }
  }

  private async flushAllBatches(): Promise<void> {
    if (WorkflowRuntimeLogger.batchTimer) {
      clearTimeout(WorkflowRuntimeLogger.batchTimer)
      WorkflowRuntimeLogger.batchTimer = null
    }

    const promises = []
    for (const [executionId] of WorkflowRuntimeLogger.logBatch) {
      promises.push(this.flushBatch(executionId))
    }

    await Promise.allSettled(promises)
  }

  private async log(level: string, message: string, data?: any): Promise<void> {
    // Log to Winston
    logger[level]('Workflow log', {
      executionId: this.executionId,
      level,
      message,
      data
    })

    // Store in database (batch for performance)
    await this.batchLog({
      executionId: this.executionId,
      level,
      message,
      data,
      timestamp: new Date()
    })
  }
}

// Singleton instance
export const workflowEngine = WorkflowEngine.getInstance()