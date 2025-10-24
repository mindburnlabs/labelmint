export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: WorkflowVariable[];
  settings?: WorkflowSettings;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    config: Record<string, any>;
    inputs?: NodePort[];
    outputs?: NodePort[];
    validation?: NodeValidation;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

export interface NodePort {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  required?: boolean;
  description?: string;
}

export interface NodeValidation {
  rules: ValidationRule[];
  errorMessage?: string;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  validator?: string;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: any;
  description?: string;
  isSecret?: boolean;
}

export interface WorkflowSettings {
  timeout?: number;
  retryPolicy?: RetryPolicy;
  notifications?: NotificationSettings;
  errorHandling?: ErrorHandlingSettings;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay?: number;
}

export interface NotificationSettings {
  onSuccess?: Notification[];
  onFailure?: Notification[];
  onTimeout?: Notification[];
}

export interface Notification {
  type: 'email' | 'webhook' | 'slack' | 'teams';
  recipients: string[];
  template?: string;
  message?: string;
}

export interface ErrorHandlingSettings {
  strategy: 'stop' | 'continue' | 'retry' | 'skip';
  fallbackNode?: string;
  alertOnError?: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: NodeExecutionStatus;
  input: any;
  output: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  nodeId?: string;
  context: WorkflowContext;
}

export interface WorkflowContext {
  triggeredBy?: string;
  variables: Map<string, any>;
  secrets: Map<string, any>;
  environment?: Record<string, string>;
  metadata?: Record<string, any>;
}

export enum WorkflowNodeType {
  TRIGGER = 'trigger',
  TASK = 'task',
  VALIDATION = 'validation',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  CONDITION = 'condition',
  ACTION = 'action',
  AI_OPERATION = 'ai_operation',
  DATA_TRANSFORM = 'data_transform',
  LOOP = 'loop',
  DELAY = 'delay',
  WEBHOOK = 'webhook',
  HTTP_REQUEST = 'http_request',
  DATABASE = 'database',
  FILE_OPERATION = 'file_operation',
  EMAIL = 'email',
  SLACK = 'slack',
  API_CALL = 'api_call'
}

export enum NodeExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED',
  TIMEOUT = 'TIMEOUT'
}

export interface NodeExecutor {
  execute(node: WorkflowNode, context: WorkflowContext): Promise<NodeExecutionResult>;
  validate?(node: WorkflowNode): Promise<ValidationResult>;
}

export interface NodeExecutionResult {
  status: NodeExecutionStatus;
  output?: any;
  error?: string;
  nextNodes?: string[];
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface TriggerNodeData extends WorkflowNode['data'] {
  config: {
    triggerType: 'manual' | 'schedule' | 'webhook' | 'event';
    schedule?: {
      cron: string;
      timezone?: string;
    };
    webhook?: {
      path: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      authentication?: {
        type: 'bearer' | 'basic';
        token?: string;
        username?: string;
        password?: string;
      };
    };
    event?: {
      eventType: string;
      source: string;
      filters?: Record<string, any>;
    };
  };
}

export interface TaskNodeData extends WorkflowNode['data'] {
  config: {
    taskType: 'labeling' | 'review' | 'validation' | 'custom';
    projectId?: string;
    taskDefinition?: Record<string, any>;
    assignment?: {
      type: 'auto' | 'manual' | 'skill_based';
      criteria?: Record<string, any>;
    };
    quality?: {
      consensusLevel: number;
      goldStandardPercentage?: number;
    };
  };
}

export interface ValidationNodeData extends WorkflowNode['data'] {
  config: {
    validationType: 'quality' | 'consensus' | 'ai' | 'custom';
    rules: ValidationRule[];
    thresholds?: Record<string, number>;
    aiModel?: string;
    customScript?: string;
  };
}

export interface IntegrationNodeData extends WorkflowNode['data'] {
  config: {
    provider: 'aws' | 'gcp' | 'azure' | 'custom' | 'labelmint';
    service: string;
    action: string;
    parameters: Record<string, any>;
    authentication: {
      type: 'api_key' | 'oauth' | 'service_account';
      credentials: Record<string, any>;
    };
  };
}

export interface AIOperationNodeData extends WorkflowNode['data'] {
  config: {
    operation: 'classify' | 'extract' | 'analyze' | 'predict' | 'generate';
    model?: string;
    prompt?: string;
    parameters?: Record<string, any>;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
  };
}

export interface ConditionNodeData extends WorkflowNode['data'] {
  config: {
    condition: string;
    expression?: string;
    rules?: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
      value: any;
    }>;
    logic?: 'and' | 'or';
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  definition: WorkflowDefinition;
  isPublic: boolean;
  usageCount: number;
  rating: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  name: string;
  scheduleType: 'recurring' | 'once' | 'conditional';
  cronExpression?: string;
  timezone?: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
  runCount: number;
  settings: Record<string, any>;
}