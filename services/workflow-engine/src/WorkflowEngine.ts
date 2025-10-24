import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowNode,
  WorkflowContext,
  NodeExecutionStatus,
  WorkflowNodeType
} from '../types/workflow';

export class WorkflowEngine extends EventEmitter {
  private redis: Redis;
  private prisma: PrismaClient;
  private executingWorkflows: Map<string, WorkflowExecution> = new Map();
  private nodeExecutors: Map<WorkflowNodeType, NodeExecutor>;

  constructor(redis: Redis, prisma: PrismaClient) {
    super();
    this.redis = redis;
    this.prisma = prisma;
    this.initializeNodeExecutors();
  }

  /**
   * Execute a workflow from a definition
   */
  async executeWorkflow(
    workflowId: string,
    input: any = {},
    options: {
      triggeredBy?: string;
      context?: any;
    } = {}
  ): Promise<WorkflowExecution> {
    const executionId = uuidv4();

    // Create workflow execution record
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'PENDING',
      input,
      output: null,
      error: null,
      startTime: new Date(),
      endTime: null,
      duration: null,
      nodeId: null,
      context: {
        ...options.context,
        triggeredBy: options.triggeredBy,
        variables: new Map(),
        secrets: new Map()
      }
    };

    // Store in database
    await this.prisma.workflowExecution.create({
      data: {
        id: executionId,
        workflowId,
        organizationId: await this.getOrganizationId(workflowId),
        status: 'PENDING',
        input,
        context: execution.context
      }
    });

    // Store in memory
    this.executingWorkflows.set(executionId, execution);

    // Cache execution state
    await this.redis.setex(
      `workflow:execution:${executionId}`,
      3600, // 1 hour
      JSON.stringify(execution)
    );

    // Emit event
    this.emit('workflow:started', execution);

    // Start execution
    this.processExecution(executionId);

    return execution;
  }

  /**
   * Process a workflow execution
   */
  private async processExecution(executionId: string): Promise<void> {
    try {
      const execution = this.executingWorkflows.get(executionId);
      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      // Get workflow definition
      const workflow = await this.getWorkflow(execution.workflowId);

      // Update status to running
      execution.status = 'RUNNING';
      await this.updateExecutionStatus(executionId, 'RUNNING');

      // Find and execute trigger nodes
      const triggerNodes = workflow.definition.nodes.filter(
        node => node.type === WorkflowNodeType.TRIGGER
      );

      if (triggerNodes.length === 0) {
        throw new Error('No trigger node found in workflow');
      }

      // Execute triggers (usually just one)
      for (const triggerNode of triggerNodes) {
        await this.executeNode(executionId, triggerNode, execution.input);
      }

    } catch (error) {
      await this.failExecution(executionId, error);
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(
    executionId: string,
    node: WorkflowNode,
    input: any
  ): Promise<NodeExecutionStatus> {
    const execution = this.executingWorkflows.get(executionId);
    const taskId = uuidv4();

    try {
      // Update current node
      if (execution) {
        execution.nodeId = node.id;
        await this.redis.set(
          `workflow:execution:${executionId}`,
          JSON.stringify(execution)
        );
      }

      // Create task record
      await this.prisma.workflowTask.create({
        data: {
          id: taskId,
          executionId,
          nodeId: node.id,
          nodeType: node.type,
          status: 'RUNNING',
          input,
          startTime: new Date(),
          dependencies: node.dependencies || []
        }
      });

      // Get node executor
      const executor = this.nodeExecutors.get(node.type);
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      // Check dependencies
      if (node.dependencies && node.dependencies.length > 0) {
        await this.checkDependencies(executionId, node.dependencies);
      }

      // Execute node
      this.emit('node:started', { executionId, nodeId: node.id });

      const result = await executor.execute(node, input, {
        executionId,
        context: execution?.context
      });

      // Update task with result
      const duration = Date.now() - new Date().getTime();

      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          output: result.output,
          error: result.error,
          endTime: new Date(),
          duration
        }
      });

      // Handle node outputs
      if (result.success) {
        this.emit('node:completed', {
          executionId,
          nodeId: node.id,
          output: result.output
        });

        // Store output in context for next nodes
        if (execution && result.output) {
          execution.context.variables.set(`node_${node.id}_output`, result.output);
          await this.redis.set(
            `workflow:execution:${executionId}`,
            JSON.stringify(execution)
          );
        }

        // Execute next nodes
        await this.executeNextNodes(executionId, node.id, result.output);
      } else {
        this.emit('node:failed', {
          executionId,
          nodeId: node.id,
          error: result.error
        });

        // Fail workflow for critical errors
        if (node.critical || result.fatal) {
          await this.failExecution(executionId, new Error(result.error));
        }
      }

      return {
        taskId,
        nodeId: node.id,
        status: result.success ? 'COMPLETED' : 'FAILED',
        output: result.output,
        error: result.error
      };

    } catch (error) {
      console.error(`Failed to execute node ${node.id}:`, error);

      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error: error.message,
          endTime: new Date()
        }
      });

      return {
        taskId,
        nodeId: node.id,
        status: 'FAILED',
        error: error.message
      };
    }
  }

  /**
   * Execute next nodes in the workflow
   */
  private async executeNextNodes(
    executionId: string,
    completedNodeId: string,
    output: any
  ): Promise<void> {
    const execution = this.executingWorkflows.get(executionId);
    if (!execution) return;

    const workflow = await this.getWorkflow(execution.workflowId);

    // Find connected nodes
    const connections = workflow.definition.connections.filter(
      conn => conn.sourceNodeId === completedNodeId
    );

    // Execute each connected node
    for (const connection of connections) {
      const nextNode = workflow.definition.nodes.find(
        node => node.id === connection.targetNodeId
      );

      if (nextNode) {
        // Prepare input based on connection mapping
        const nodeInput = this.prepareNodeInput(output, connection.mapping);

        // Execute asynchronously if parallel
        if (nextNode.parallel) {
          this.executeNode(executionId, nextNode, nodeInput);
        } else {
          await this.executeNode(executionId, nextNode, nodeInput);
        }
      }
    }
  }

  /**
   * Complete a workflow execution
   */
  async completeExecution(
    executionId: string,
    output: any
  ): Promise<void> {
    const execution = this.executingWorkflows.get(executionId);
    if (!execution) return;

    execution.status = 'COMPLETED';
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.output = output;

    // Update database
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'COMPLETED',
        output,
        endTime: new Date(),
        duration: execution.duration
      }
    });

    // Send notifications
    await this.sendNotifications(executionId, 'WORKFLOW_COMPLETED');

    // Clean up
    this.executingWorkflows.delete(executionId);
    await this.redis.del(`workflow:execution:${executionId}`);

    // Emit event
    this.emit('workflow:completed', execution);
  }

  /**
   * Fail a workflow execution
   */
  private async failExecution(
    executionId: string,
    error: Error
  ): Promise<void> {
    const execution = this.executingWorkflows.get(executionId);
    if (!execution) return;

    execution.status = 'FAILED';
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.error = error.message;

    // Update database
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        error: error.message,
        endTime: new Date(),
        duration: execution.duration
      }
    });

    // Send notifications
    await this.sendNotifications(executionId, 'WORKFLOW_FAILED');

    // Clean up
    this.executingWorkflows.delete(executionId);
    await this.redis.del(`workflow:execution:${executionId}`);

    // Emit event
    this.emit('workflow:failed', { execution, error });
  }

  /**
   * Get workflow definition from database
   */
  private async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        organization: {
          select: {
            id: true,
            settings: true
          }
        }
      }
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    return {
      id: workflow.id,
      name: workflow.name,
      definition: workflow.definition as any,
      organization: workflow.organization
    };
  }

  /**
   * Get organization ID from workflow
   */
  private async getOrganizationId(workflowId: string): Promise<string> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { organizationId: true }
    });

    return workflow.organizationId;
  }

  /**
   * Initialize node executors
   */
  private initializeNodeExecutors(): void {
    this.nodeExecutors.set(WorkflowNodeType.TRIGGER, new TriggerExecutor());
    this.nodeExecutors.set(WorkflowNodeType.TASK, new TaskExecutor(this.prisma));
    this.nodeExecutors.set(WorkflowNodeType.VALIDATION, new ValidationExecutor());
    this.nodeExecutors.set(WorkflowNodeType.NOTIFICATION, new NotificationExecutor(this.redis));
    this.nodeExecutors.set(WorkflowNodeType.INTEGRATION, new IntegrationExecutor());
    this.nodeExecutors.set(WorkflowNodeType.CONDITION, new ConditionExecutor());
    this.nodeExecutors.set(WorkflowNodeType.ACTION, new ActionExecutor());
  }

  /**
   * Update execution status in database
   */
  private async updateExecutionStatus(
    executionId: string,
    status: string
  ): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status }
    });
  }

  /**
   * Check node dependencies
   */
  private async checkDependencies(
    executionId: string,
    dependencies: string[]
  ): Promise<void> {
    for (const depId of dependencies) {
      const completed = await this.prisma.workflowTask.findFirst({
        where: {
          executionId,
          nodeId: depId,
          status: 'COMPLETED'
        }
      });

      if (!completed) {
        throw new Error(`Dependency ${depId} not completed`);
      }
    }
  }

  /**
   * Prepare node input based on connection mapping
   */
  private prepareNodeInput(
    sourceOutput: any,
    mapping?: Record<string, string>
  ): any {
    if (!mapping) return sourceOutput;

    const result: any = {};
    for (const [targetKey, sourceKey] of Object.entries(mapping)) {
      const value = sourceKey.split('.').reduce(
        (obj, key) => obj && obj[key],
        sourceOutput
      );
      result[targetKey] = value;
    }

    return result;
  }

  /**
   * Send notifications for workflow events
   */
  private async sendNotifications(
    executionId: string,
    eventType: string
  ): Promise<void> {
    // Create notification records
    await this.prisma.notification.create({
      data: {
        executionId,
        type: eventType,
        title: this.getNotificationTitle(eventType),
        message: this.getNotificationMessage(eventType),
        priority: this.getNotificationPriority(eventType),
        channels: ['in_app', 'email']
      }
    });
  }

  private getNotificationTitle(type: string): string {
    const titles = {
      'WORKFLOW_STARTED': 'Workflow Started',
      'WORKFLOW_COMPLETED': 'Workflow Completed',
      'WORKFLOW_FAILED': 'Workflow Failed'
    };
    return titles[type] || 'Workflow Event';
  }

  private getNotificationMessage(type: string): string {
    const messages = {
      'WORKFLOW_STARTED': 'Your workflow has started execution',
      'WORKFLOW_COMPLETED': 'Your workflow has completed successfully',
      'WORKFLOW_FAILED': 'Your workflow has failed during execution'
    };
    return messages[type] || 'Workflow event occurred';
  }

  private getNotificationPriority(type: string): string {
    const priorities = {
      'WORKFLOW_STARTED': 'NORMAL',
      'WORKFLOW_COMPLETED': 'NORMAL',
      'WORKFLOW_FAILED': 'HIGH'
    };
    return priorities[type] || 'NORMAL';
  }
}

// Base class for node executors
abstract class NodeExecutor {
  abstract async execute(
    node: WorkflowNode,
    input: any,
    context: any
  ): Promise<NodeExecutionResult>;
}

interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  fatal?: boolean;
}

// Example executor implementations
class TriggerExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    // Triggers just pass through the input
    return {
      success: true,
      output: input
    };
  }
}

class TaskExecutor extends NodeExecutor {
  constructor(private prisma: PrismaClient) {
    super();
  }

  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    switch (node.config.taskType) {
      case 'create_project':
        return this.createProject(node.config, input);
      case 'assign_task':
        return this.assignTask(node.config, input);
      case 'send_notification':
        return this.sendNotification(node.config, input);
      default:
        throw new Error(`Unknown task type: ${node.config.taskType}`);
    }
  }

  private async createProject(config: any, input: any): Promise<NodeExecutionResult> {
    const project = await this.prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: input.organizationId
      }
    });

    return {
      success: true,
      output: { projectId: project.id, project }
    };
  }

  private async assignTask(config: any, input: any): Promise<NodeExecutionResult> {
    // Implementation for task assignment
    return {
      success: true,
      output: { assigned: true }
    };
  }

  private async sendNotification(config: any, input: any): Promise<NodeExecutionResult> {
    // Implementation for sending notifications
    return {
      success: true,
      output: { sent: true }
    };
  }
}

class ValidationExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    const rules = node.config.validationRules || [];

    for (const rule of rules) {
      const result = this.validateRule(rule, input);
      if (!result.valid) {
        return {
          success: false,
          error: result.error
        };
      }
    }

    return {
      success: true,
      output: { validated: true, originalInput: input }
    };
  }

  private validateRule(rule: any, input: any): { valid: boolean; error?: string } {
    switch (rule.type) {
      case 'required':
        if (!input[rule.field]) {
          return {
            valid: false,
            error: `Field ${rule.field} is required`
          };
        }
        break;
      case 'regex':
        if (!new RegExp(rule.pattern).test(input[rule.field])) {
          return {
            valid: false,
            error: `Field ${rule.field} doesn't match required pattern`
          };
        }
        break;
    }
    return { valid: true };
  }
}

// Additional executor classes...
class NotificationExecutor extends NodeExecutor {
  constructor(private redis: Redis) {
    super();
  }

  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    // Send notification through various channels
    await this.redis.publish(
      'notifications',
      JSON.stringify({
        type: node.config.notificationType,
        message: node.config.message || input.message,
        channels: node.config.channels || ['in_app']
      })
    );

    return {
      success: true,
      output: { notified: true }
    };
  }
}

class IntegrationExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    // Execute third-party integrations
    const integration = node.config.integration;

    switch (integration.type) {
      case 'webhook':
        return this.executeWebhook(integration, input);
      case 'api_call':
        return this.executeAPICall(integration, input);
      case 'database_query':
        return this.executeDatabaseQuery(integration, input);
      default:
        throw new Error(`Unknown integration type: ${integration.type}`);
    }
  }

  private async executeWebhook(config: any, input: any): Promise<NodeExecutionResult> {
    // Implementation for webhook calls
    return {
      success: true,
      output: { webhookCalled: true }
    };
  }

  private async executeAPICall(config: any, input: any): Promise<NodeExecutionResult> {
    // Implementation for API calls
    return {
      success: true,
      output: { apiResponse: {} }
    };
  }

  private async executeDatabaseQuery(config: any, input: any): Promise<NodeExecutionResult> {
    // Implementation for database queries
    return {
      success: true,
      output: { queryResult: [] }
    };
  }
}

class ConditionExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    const condition = node.config.condition;
    const result = this.evaluateCondition(condition, input);

    return {
      success: true,
      output: { conditionMet: result }
    };
  }

  private evaluateCondition(condition: any, input: any): boolean {
    // Implementation for condition evaluation
    switch (condition.operator) {
      case 'equals':
        return input[condition.field] === condition.value;
      case 'greater_than':
        return input[condition.field] > condition.value;
      case 'contains':
        return input[condition.field].includes(condition.value);
      // Add more operators as needed
    }
    return false;
  }
}

class ActionExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, input: any): Promise<NodeExecutionResult> {
    const action = node.config.action;

    switch (action.type) {
      case 'set_variable':
        return this.setVariable(action, input);
      case 'delay':
        return this.delay(action, input);
      case 'branch':
        return this.branch(action, input);
      case 'loop':
        return this.loop(action, input);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private setVariable(config: any, input: any): NodeExecutionResult {
    // Set variable in workflow context
    return {
      success: true,
      output: { variableSet: true }
    };
  }

  private delay(config: any, input: any): NodeExecutionResult {
    // Implementation for delay
    return {
      success: true,
      output: { delayed: true }
    };
  }

  private branch(config: any, input: any): NodeExecutionResult {
    // Implementation for conditional branching
    return {
      success: true,
      output: { branch: config.condition }
    };
  }

  private loop(config: any, input: any): NodeExecutionResult {
    // Implementation for loops
    return {
      success: true,
      output: { loopComplete: true }
    };
  }
}