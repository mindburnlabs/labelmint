import { NodeExecutor, WorkflowNode, WorkflowContext, NodeExecutionResult, NodeExecutionStatus } from '../types/workflow';
import { PrismaClient } from '@prisma/client';

export class TaskExecutor implements NodeExecutor {
  constructor(private prisma: PrismaClient) {}

  async execute(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    const config = node.data.config as any;

    switch (config.taskType) {
      case 'labeling':
        return this.executeLabelingTask(node, context, config);

      case 'review':
        return this.executeReviewTask(node, context, config);

      case 'validation':
        return this.executeValidationTask(node, context, config);

      case 'custom':
        return this.executeCustomTask(node, context, config);

      default:
        throw new Error(`Unknown task type: ${config.taskType}`);
    }
  }

  private async executeLabelingTask(
    node: WorkflowNode,
    context: WorkflowContext,
    config: any
  ): Promise<NodeExecutionResult> {
    const projectId = config.projectId;
    const inputData = context.variables.get('input') || {};

    // Create tasks in the database
    const tasks = await this.prisma.task.createMany({
      data: {
        projectId,
        type: inputData.type || 'default',
        data: inputData.data || {},
        priority: inputData.priority || 'normal',
        status: 'pending',
        settings: {
          workflowId: context.metadata?.workflowId,
          nodeId: node.id,
          executionId: context.metadata?.executionId
        }
      }
    });

    // Store task count for monitoring
    context.variables.set('created_tasks', tasks.count);

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        tasksCreated: tasks.count,
        projectId,
        taskIds: [], // Would be populated with actual IDs
        status: 'created'
      }
    };
  }

  private async executeReviewTask(
    node: WorkflowNode,
    context: WorkflowContext,
    config: any
  ): Promise<NodeExecutionResult> {
    const inputData = context.variables.get('input') || {};
    const taskIds = inputData.taskIds || [];

    if (!taskIds.length) {
      throw new Error('No tasks provided for review');
    }

    // Create review assignments
    const reviews = await this.prisma.review.createMany({
      data: taskIds.map((taskId: string) => ({
        taskId,
        assignedTo: this.selectReviewer(taskId, config.assignment),
        status: 'pending',
        settings: {
          workflowId: context.metadata?.workflowId,
          nodeId: node.id
        }
      }))
    });

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        reviewsCreated: reviews.count,
        taskIds,
        status: 'reviews_created'
      }
    };
  }

  private async executeValidationTask(
    node: WorkflowNode,
    context: WorkflowContext,
    config: any
  ): Promise<NodeExecutionResult> {
    const inputData = context.variables.get('input') || {};
    const labels = inputData.labels || [];

    // Perform validation based on rules
    const validationResults = await this.validateLabels(labels, config);

    context.variables.set('validation_results', validationResults);

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        validated: validationResults.valid,
        results: validationResults,
        count: labels.length
      }
    };
  }

  private async executeCustomTask(
    node: WorkflowNode,
    context: WorkflowContext,
    config: any
  ): Promise<NodeExecutionResult> {
    const inputData = context.variables.get('input') || {};
    const customFunction = config.customFunction;

    if (!customFunction) {
      throw new Error('Custom function is required for custom tasks');
    }

    try {
      // Execute custom function (in a real implementation, this would be sandboxed)
      const result = await this.executeCustomFunction(customFunction, inputData);

      return {
        status: NodeExecutionStatus.COMPLETED,
        output: result
      };
    } catch (error) {
      return {
        status: NodeExecutionStatus.FAILED,
        error: error.message
      };
    }
  }

  private selectReviewer(taskId: string, assignment: any): string {
    // Implementation would select appropriate reviewer based on assignment criteria
    // For now, return a placeholder
    return 'reviewer_id';
  }

  private async validateLabels(labels: any[], config: any): Promise<any> {
    // Implementation would validate labels based on configured rules
    // For now, return a placeholder result
    return {
      valid: true,
      errors: [],
      warnings: [],
      score: 1.0
    };
  }

  private async executeCustomFunction(functionCode: string, inputData: any): Promise<any> {
    // In a real implementation, this would execute the custom function in a sandbox
    // For now, return placeholder result
    return {
      success: true,
      data: inputData
    };
  }

  async validate(node: WorkflowNode): Promise<{ valid: boolean; errors?: string[] }> {
    const config = node.data.config as any;
    const errors: string[] = [];

    if (!config.taskType) {
      errors.push('Task type is required');
    }

    if (config.taskType === 'labeling' && !config.projectId) {
      errors.push('Project ID is required for labeling tasks');
    }

    if (config.taskType === 'custom' && !config.customFunction) {
      errors.push('Custom function is required for custom tasks');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}