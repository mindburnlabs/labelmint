import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowNode,
  WorkflowNodeType,
  NodePort,
  TriggerNodeData,
  TaskNodeData,
  ValidationNodeData,
  IntegrationNodeData,
  AIOperationNodeData,
  ConditionNodeData
} from '../types/workflow';

export class NodeBuilder {
  /**
   * Create a trigger node
   */
  static createTriggerNode(config: TriggerNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.TRIGGER,
      position: position || { x: 0, y: 0 },
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
  }

  /**
   * Create a task node
   */
  static createTaskNode(config: TaskNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.TASK,
      position: position || { x: 0, y: 0 },
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
          },
          {
            id: 'metadata',
            name: 'metadata',
            type: 'object',
            description: 'Task execution metadata'
          }
        ],
        validation: {
          rules: [
            {
              field: 'projectId',
              type: 'required'
            }
          ],
          errorMessage: 'Task configuration is invalid'
        }
      }
    };
  }

  /**
   * Create a validation node
   */
  static createValidationNode(config: ValidationNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.VALIDATION,
      position: position || { x: 0, y: 0 },
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
          },
          {
            id: 'errors',
            name: 'errors',
            type: 'array',
            description: 'Validation errors if any'
          }
        ]
      }
    };
  }

  /**
   * Create an AI operation node
   */
  static createAIOperationNode(config: AIOperationNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.AI_OPERATION,
      position: position || { x: 0, y: 0 },
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
          },
          {
            id: 'prompt',
            name: 'prompt',
            type: 'string',
            description: 'Prompt for AI model (optional)'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'AI operation output'
          },
          {
            id: 'confidence',
            name: 'confidence',
            type: 'number',
            description: 'Confidence score of AI prediction'
          },
          {
            id: 'tokens_used',
            name: 'tokens_used',
            type: 'number',
            description: 'Number of tokens used'
          }
        ]
      }
    };
  }

  /**
   * Create an integration node
   */
  static createIntegrationNode(config: IntegrationNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.INTEGRATION,
      position: position || { x: 0, y: 0 },
      data: {
        label: `${config.provider}.${config.service}`,
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
          },
          {
            id: 'status',
            name: 'status',
            type: 'string',
            description: 'Integration operation status'
          }
        ],
        validation: {
          rules: [
            {
              field: 'authentication',
              type: 'required'
            }
          ],
          errorMessage: 'Integration authentication is required'
        }
      }
    };
  }

  /**
   * Create a condition node
   */
  static createConditionNode(config: ConditionNodeData['config'], position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.CONDITION,
      position: position || { x: 0, y: 0 },
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
  }

  /**
   * Create a webhook node
   */
  static createWebhookNode(config: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    authentication?: {
      type: 'bearer' | 'basic' | 'api_key';
      token?: string;
      username?: string;
      password?: string;
      apiKey?: string;
    };
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.WEBHOOK,
      position: position || { x: 0, y: 0 },
      data: {
        label: `Webhook: ${config.method} ${config.url}`,
        config,
        inputs: [
          {
            id: 'data',
            name: 'data',
            type: 'object',
            description: 'Data to send in webhook'
          }
        ],
        outputs: [
          {
            id: 'response',
            name: 'response',
            type: 'object',
            description: 'Webhook response'
          },
          {
            id: 'status_code',
            name: 'status_code',
            type: 'number',
            description: 'HTTP status code'
          }
        ]
      }
    };
  }

  /**
   * Create an HTTP request node
   */
  static createHttpRequestNode(config: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    params?: Record<string, any>;
    body?: any;
    timeout?: number;
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.HTTP_REQUEST,
      position: position || { x: 0, y: 0 },
      data: {
        label: `HTTP: ${config.method} ${config.url}`,
        config,
        inputs: [
          {
            id: 'query_params',
            name: 'query_params',
            type: 'object',
            description: 'Query parameters'
          },
          {
            id: 'body',
            name: 'body',
            type: 'object',
            description: 'Request body'
          }
        ],
        outputs: [
          {
            id: 'data',
            name: 'data',
            type: 'object',
            description: 'Response data'
          },
          {
            id: 'status',
            name: 'status',
            type: 'number',
            description: 'HTTP status code'
          },
          {
            id: 'headers',
            name: 'headers',
            type: 'object',
            description: 'Response headers'
          }
        ]
      }
    };
  }

  /**
   * Create a delay node
   */
  static createDelayNode(config: {
    delay: number;
    unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours';
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.DELAY,
      position: position || { x: 0, y: 0 },
      data: {
        label: `Delay: ${config.delay} ${config.unit}`,
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'any',
            description: 'Input to pass through after delay'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'any',
            description: 'Delayed output'
          }
        ]
      }
    };
  }

  /**
   * Create an email node
   */
  static createEmailNode(config: {
    to: string | string[];
    subject: string;
    body?: string;
    template?: string;
    variables?: Record<string, any>;
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.EMAIL,
      position: position || { x: 0, y: 0 },
      data: {
        label: `Email: ${config.subject}`,
        config,
        inputs: [
          {
            id: 'data',
            name: 'data',
            type: 'object',
            description: 'Email template data'
          }
        ],
        outputs: [
          {
            id: 'message_id',
            name: 'message_id',
            type: 'string',
            description: 'Email message ID'
          },
          {
            id: 'status',
            name: 'status',
            type: 'string',
            description: 'Email status'
          }
        ]
      }
    };
  }

  /**
   * Create a database node
   */
  static createDatabaseNode(config: {
    connection: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      ssl?: boolean;
    };
    query: string;
    parameters?: any[];
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.DATABASE,
      position: position || { x: 0, y: 0 },
      data: {
        label: `Database Query`,
        config,
        inputs: [
          {
            id: 'parameters',
            name: 'parameters',
            type: 'array',
            description: 'Query parameters'
          }
        ],
        outputs: [
          {
            id: 'rows',
            name: 'rows',
            type: 'array',
            description: 'Query result rows'
          },
          {
            id: 'affected_rows',
            name: 'affected_rows',
            type: 'number',
            description: 'Number of affected rows'
          }
        ],
        validation: {
          rules: [
            {
              field: 'query',
              type: 'required'
            }
          ],
          errorMessage: 'Database query is required'
        }
      }
    };
  }

  /**
   * Create a loop node
   */
  static createLoopNode(config: {
    iterable: string;
    variable: string;
    maxIterations?: number;
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.LOOP,
      position: position || { x: 0, y: 0 },
      data: {
        label: `Loop: ${config.variable}`,
        config,
        inputs: [
          {
            id: 'items',
            name: 'items',
            type: 'array',
            required: true,
            description: 'Items to iterate over'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'array',
            description: 'Loop results'
          },
          {
            id: 'iteration',
            name: 'iteration',
            type: 'number',
            description: 'Current iteration number'
          }
        ]
      }
    };
  }

  /**
   * Create a data transform node
   */
  static createDataTransformNode(config: {
    transformation: string;
    mapping?: Record<string, string>;
    function?: string;
  }, position?: { x: number; y: number }): WorkflowNode {
    return {
      id: uuidv4(),
      type: WorkflowNodeType.DATA_TRANSFORM,
      position: position || { x: 0, y: 0 },
      data: {
        label: 'Transform Data',
        config,
        inputs: [
          {
            id: 'input',
            name: 'input',
            type: 'object',
            required: true,
            description: 'Data to transform'
          }
        ],
        outputs: [
          {
            id: 'output',
            name: 'output',
            type: 'object',
            description: 'Transformed data'
          }
        ],
        validation: {
          rules: [
            {
              field: 'transformation',
              type: 'required'
            }
          ],
          errorMessage: 'Transformation script is required'
        }
      }
    };
  }
}