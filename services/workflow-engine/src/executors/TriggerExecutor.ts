import { NodeExecutor, WorkflowNode, WorkflowContext, NodeExecutionResult, NodeExecutionStatus } from '../types/workflow';

export class TriggerExecutor implements NodeExecutor {
  async execute(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    const config = node.data.config as any;

    switch (config.triggerType) {
      case 'manual':
        return this.executeManualTrigger(node, context);

      case 'schedule':
        return this.executeScheduleTrigger(node, context);

      case 'webhook':
        return this.executeWebhookTrigger(node, context);

      case 'event':
        return this.executeEventTrigger(node, context);

      default:
        throw new Error(`Unknown trigger type: ${config.triggerType}`);
    }
  }

  private async executeManualTrigger(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    // Manual triggers are executed by user action
    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        triggeredBy: context.triggeredBy || 'user',
        timestamp: new Date().toISOString(),
        nodeType: 'manual'
      }
    };
  }

  private async executeScheduleTrigger(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    const config = node.data.config;

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        triggeredBy: 'schedule',
        timestamp: new Date().toISOString(),
        schedule: config.schedule,
        nodeType: 'schedule'
      }
    };
  }

  private async executeWebhookTrigger(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    const config = node.data.config;
    const webhookData = context.variables.get('webhook_data');

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        triggeredBy: 'webhook',
        timestamp: new Date().toISOString(),
        webhook: {
          path: config.webhook?.path,
          method: config.webhook?.method,
          data: webhookData
        }
      }
    };
  }

  private async executeEventTrigger(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult> {
    const config = node.data.config;
    const eventData = context.variables.get('event_data');

    return {
      status: NodeExecutionStatus.COMPLETED,
      output: {
        triggeredBy: 'event',
        timestamp: new Date().toISOString(),
        event: {
          type: config.event?.eventType,
          source: config.event?.source,
          data: eventData
        }
      }
    };
  }

  async validate(node: WorkflowNode): Promise<{ valid: boolean; errors?: string[] }> {
    const config = node.data.config as any;
    const errors: string[] = [];

    if (!config.triggerType) {
      errors.push('Trigger type is required');
    }

    switch (config.triggerType) {
      case 'schedule':
        if (!config.schedule?.cron) {
          errors.push('Schedule cron expression is required');
        }
        break;

      case 'webhook':
        if (!config.webhook?.path) {
          errors.push('Webhook path is required');
        }
        if (!config.webhook?.method) {
          errors.push('Webhook method is required');
        }
        break;

      case 'event':
        if (!config.event?.eventType) {
          errors.push('Event type is required');
        }
        if (!config.event?.source) {
          errors.push('Event source is required');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}