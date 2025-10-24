import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowVariable,
  WorkflowSettings,
  WorkflowNodeType,
  NodePort,
  TriggerNodeData,
  TaskNodeData,
  ValidationNodeData,
  IntegrationNodeData,
  AIOperationNodeData,
  ConditionNodeData
} from '../types/workflow';

export class WorkflowBuilder {
  private workflow: Partial<WorkflowDefinition>;

  constructor(name: string, description?: string) {
    this.workflow = {
      name,
      description,
      version: 1,
      nodes: [],
      edges: [],
      variables: [],
      settings: {
        timeout: 3600000, // 1 hour default
        retryPolicy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          initialDelay: 1000
        },
        errorHandling: {
          strategy: 'stop',
          alertOnError: true
        }
      }
    };
  }

  /**
   * Add a trigger node to the workflow
   */
  addTrigger(config: TriggerNodeData['config']): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.TRIGGER,
      position: { x: 100, y: 100 },
      data: {
        label: `Trigger: ${config.triggerType}`,
        config,
        inputs: [],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'Trigger output data'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add a task node for labeling operations
   */
  addTask(config: TaskNodeData['config'], sourceNodeId?: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.TASK,
      position: { x: 300, y: 100 },
      data: {
        label: `Task: ${config.taskType}`,
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Task input data'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'Task output data'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);

    if (sourceNodeId) {
      this.addEdge(sourceNodeId, node.id);
    }

    return this;
  }

  /**
   * Add a validation node
   */
  addValidation(config: ValidationNodeData['config'], sourceNodeId?: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.VALIDATION,
      position: { x: 500, y: 100 },
      data: {
        label: `Validation: ${config.validationType}`,
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Data to validate'
          }
        ],
        outputs: [
          {
            id: 'valid',
            name: 'valid',
            type: 'boolean',
            description: 'Validation result'
          },
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'Validated data'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);

    if (sourceNodeId) {
      this.addEdge(sourceNodeId, node.id);
    }

    return this;
  }

  /**
   * Add an AI operation node
   */
  addAIOperation(config: AIOperationNodeData['config'], sourceNodeId?: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.AI_OPERATION,
      position: { x: 700, y: 100 },
      data: {
        label: `AI: ${config.operation}`,
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Input data for AI operation'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'AI operation output'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);

    if (sourceNodeId) {
      this.addEdge(sourceNodeId, node.id);
    }

    return this;
  }

  /**
   * Add an integration node
   */
  addIntegration(config: IntegrationNodeData['config'], sourceNodeId?: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.INTEGRATION,
      position: { x: 900, y: 100 },
      data: {
        label: `Integration: ${config.provider}.${config.service}`,
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Integration input data'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'Integration output data'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);

    if (sourceNodeId) {
      this.addEdge(sourceNodeId, node.id);
    }

    return this;
  }

  /**
   * Add a condition node for branching logic
   */
  addCondition(config: ConditionNodeData['config'], sourceNodeId?: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.CONDITION,
      position: { x: 400, y: 300 },
      data: {
        label: 'Condition',
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Data to evaluate'
          }
        ],
        outputs: [
          {
            id: 'true',
            name: 'true',
            type: 'object',
            description: 'Output if condition is true'
          },
          {
            id: 'false',
            name: 'false',
            type: 'object',
            description: 'Output if condition is false'
          }
        ]
      }
    };

    this.workflow.nodes!.push(node);

    if (sourceNodeId) {
      this.addEdge(sourceNodeId, node.id);
    }

    return this;
  }

  /**
   * Add a custom node
   */
  addNode(node: Omit<WorkflowNode, 'id'>): WorkflowBuilder {
    const workflowNode: WorkflowNode = {
      ...node,
      id: uuidv4()
    };

    this.workflow.nodes!.push(workflowNode);
    return this;
  }

  /**
   * Add an edge between two nodes
   */
  addEdge(sourceId: string, targetId: string, condition?: string): WorkflowBuilder {
    const edge: WorkflowEdge = {
      id: uuidv4(),
      source: sourceId,
      target: targetId,
      condition
    };

    this.workflow.edges!.push(edge);
    return this;
  }

  /**
   * Add a variable to the workflow
   */
  addVariable(variable: Omit<WorkflowVariable, 'id'>): WorkflowBuilder {
    const workflowVariable: WorkflowVariable = {
      ...variable,
      id: uuidv4()
    };

    this.workflow.variables!.push(workflowVariable);
    return this;
  }

  /**
   * Configure workflow settings
   */
  setSettings(settings: Partial<WorkflowSettings>): WorkflowBuilder {
    this.workflow.settings = {
      ...this.workflow.settings,
      ...settings
    };
    return this;
  }

  /**
   * Build the workflow definition
   */
  build(): WorkflowDefinition {
    if (!this.workflow.nodes || this.workflow.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    // Validate that all trigger nodes are properly connected
    const triggerNodes = this.workflow.nodes.filter(n => n.type === WorkflowNodeType.TRIGGER);
    if (triggerNodes.length === 0) {
      throw new Error('Workflow must have at least one trigger node');
    }

    // Validate that all edges reference valid nodes
    const nodeIds = new Set(this.workflow.nodes.map(n => n.id));
    for (const edge of this.workflow.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new Error(`Edge references non-existent node: ${edge.source} -> ${edge.target}`);
      }
    }

    return {
      ...this.workflow,
      id: uuidv4()
    } as WorkflowDefinition;
  }

  /**
   * Create a pre-built template for common workflows
   */
  static createDataLabelingWorkflow(projectId: string): WorkflowBuilder {
    return new WorkflowBuilder('Data Labeling Workflow')
      .addTrigger({
        triggerType: 'manual'
      })
      .addTask({
        taskType: 'labeling',
        projectId,
        assignment: {
          type: 'auto'
        },
        quality: {
          consensusLevel: 2,
          goldStandardPercentage: 5
        }
      })
      .addValidation({
        validationType: 'consensus',
        rules: [
          {
            field: 'consensus',
            type: 'min',
            value: 2
          }
        ]
      });
  }

  static createAIAssistedWorkflow(projectId: string, aiModel: string): WorkflowBuilder {
    return new WorkflowBuilder('AI-Assisted Labeling Workflow')
      .addTrigger({
        triggerType: 'manual'
      })
      .addAIOperation({
        operation: 'classify',
        model: aiModel,
        prompt: 'Please analyze and pre-label this data'
      })
      .addTask({
        taskType: 'review',
        projectId,
        assignment: {
          type: 'skill_based',
          criteria: {
            minAccuracy: 0.9
          }
        }
      })
      .addValidation({
        validationType: 'quality',
        rules: [
          {
            field: 'accuracy',
            type: 'min',
            value: 0.95
          }
        ]
      });
  }

  static createBatchProcessingWorkflow(): WorkflowBuilder {
    return new WorkflowBuilder('Batch Processing Workflow')
      .addTrigger({
        triggerType: 'webhook',
        webhook: {
          path: '/batch/start',
          method: 'POST'
        }
      })
      .addTask({
        taskType: 'labeling'
      })
      .addCondition({
        condition: 'batchComplete',
        rules: [
          {
            field: 'remainingItems',
            operator: 'eq',
            value: 0
          }
        ]
      })
      .addIntegration({
        provider: 'labelmint',
        service: 'export',
        action: 'exportResults',
        parameters: {
          format: 'json'
        }
      });
  }

  static createQualityAssuranceWorkflow(): WorkflowBuilder {
    return new WorkflowBuilder('Quality Assurance Workflow')
      .addTrigger({
        triggerType: 'event',
        event: {
          eventType: 'task_completed',
          source: 'labeling_backend'
        }
      })
      .addValidation({
        validationType: 'ai',
        rules: [
          {
            field: 'label',
            type: 'custom',
            validator: 'validateLabelAccuracy'
          }
        ],
        aiModel: 'quality-checker-v2'
      })
      .addCondition({
        condition: 'qualityPass',
        expression: '{{validation.confidence}} > 0.9'
      })
      .addTask({
        taskType: 'review'
      })
      .addNotification({
        type: 'email',
        recipients: ['{{task.assignee.email}}'],
        message: 'Your task has been reviewed and requires attention'
      });
  }
}