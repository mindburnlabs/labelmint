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
  type: string;
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

export enum NodeExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED',
  TIMEOUT = 'TIMEOUT'
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