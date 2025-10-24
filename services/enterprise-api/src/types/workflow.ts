export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  version: number
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: WorkflowVariable[]
  settings: WorkflowSettings
  triggers: WorkflowTrigger[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  isActive: boolean
  category?: string
  tags: string[]
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  position: { x: number; y: number }
  data: Record<string, any>
  config: NodeConfig
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: EdgeCondition
}

export interface WorkflowVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  defaultValue?: any
  description?: string
  required?: boolean
}

export interface WorkflowSettings {
  timeout?: number // in seconds
  retryPolicy: RetryPolicy
  errorHandling: ErrorHandling
  notifications: NotificationSettings
  concurrency: ConcurrencySettings
}

export interface WorkflowTrigger {
  id: string
  type: TriggerType
  config: Record<string, any>
  enabled: boolean
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowVersion: number
  status: ExecutionStatus
  input: Record<string, any>
  output?: Record<string, any>
  context: ExecutionContext
  startedAt: Date
  completedAt?: Date
  duration?: number
  triggeredBy: string
  triggeredByType: TriggerType
  error?: string
  nodeId?: string // Current node being executed
  logs: ExecutionLog[]
}

export interface ExecutionContext {
  variables: Record<string, any>
  environment: Record<string, string>
  secrets: Record<string, string>
  metadata: {
    organizationId: string
    userId?: string
    teamId?: string
    projectId?: string
  }
}

export interface ExecutionLog {
  id: string
  nodeId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: Date
  data?: any
}

export interface NodeConfig {
  label: string
  description?: string
  inputs: NodePort[]
  outputs: NodePort[]
  settings: Record<string, any>
  validation?: NodeValidation
}

export interface NodePort {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'image'
  required?: boolean
  description?: string
}

export interface EdgeCondition {
  type: 'expression' | 'script'
  expression: string
  description?: string
}

export interface RetryPolicy {
  maxAttempts: number
  backoffType: 'fixed' | 'linear' | 'exponential'
  backoffDelay: number // in milliseconds
  maxDelay?: number // in milliseconds
}

export interface ErrorHandling {
  strategy: 'stop' | 'continue' | 'retry' | 'ignore'
  onError?: string // Node ID to execute on error
  alertOnError?: boolean
}

export interface NotificationSettings {
  onSuccess?: NotificationConfig[]
  onFailure?: NotificationConfig[]
  onTimeout?: NotificationConfig[]
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook' | 'in_app'
  recipients: string[]
  template?: string
  message?: string
}

export interface ConcurrencySettings {
  maxConcurrent: number
  queueMode: 'fifo' | 'lifo' | 'priority'
}

export type WorkflowNodeType =
  | 'trigger'
  | 'task'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'delay'
  | 'webhook'
  | 'api_call'
  | 'data_transform'
  | 'validation'
  | 'notification'
  | 'approval'
  | 'sub_workflow'

export type TriggerType =
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'event'
  | 'api'
  | 'email'

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'

export interface NodeValidation {
  required: string[]
  schema?: any // JSON Schema
  custom?: string // Custom validation function
}

// Workflow Template Types
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  isPublic: boolean
  usageCount: number
  rating: number
  reviews: TemplateReview[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface TemplateReview {
  id: string
  userId: string
  rating: number // 1-5
  comment?: string
  createdAt: Date
}

// Workflow Schedule Types
export interface WorkflowSchedule {
  id: string
  workflowId: string
  name: string
  scheduleType: ScheduleType
  cronExpression?: string
  interval?: number // in seconds
  timezone: string
  isActive: boolean
  lastRunAt?: Date
  nextRunAt: Date
  runCount: number
  settings: ScheduleSettings
  createdAt: Date
  updatedAt: Date
}

export interface ScheduleSettings {
  retryOnFailure: boolean
  maxRetries: number
  timeout?: number
  input?: Record<string, any>
}

export type ScheduleType = 'cron' | 'interval' | 'once'

// Pre-built Node Types with their configurations
export interface NodeTypeDefinition {
  type: WorkflowNodeType
  category: 'core' | 'integration' | 'data' | 'control' | 'utility'
  name: string
  description: string
  icon: string
  config: NodeConfig
  implementation: string // Path to implementation file
  dependencies?: string[]
}

// Workflow Statistics
export interface WorkflowStats {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  executionsToday: number
  executionsThisWeek: number
  executionsThisMonth: number
  topExecutedWorkflows: Array<{
    workflowId: string
    workflowName: string
    count: number
  }>
  errorRates: Array<{
    nodeId: string
    nodeType: string
    errorCount: number
    lastError: string
  }>
}

// Workflow Export/Import Types
export interface WorkflowExport {
  version: string
  workflows: WorkflowDefinition[]
  templates?: WorkflowTemplate[]
  dependencies?: Record<string, any>
  exportedAt: Date
  exportedBy: string
}

export interface WorkflowImport {
  workflows: WorkflowDefinition[]
  conflicts: ImportConflict[]
  warnings: string[]
}

export interface ImportConflict {
  type: 'name' | 'id' | 'dependency'
  workflowId?: string
  workflowName?: string
  description: string
  resolution: 'skip' | 'rename' | 'replace'
}

// Workflow Runtime Context
export interface RuntimeContext {
  execution: WorkflowExecution
  workflow: WorkflowDefinition
  nodeResults: Map<string, any>
  currentNode?: string
  logger: WorkflowLogger
  signal: AbortSignal
  retryCount?: number
}

export interface WorkflowLogger {
  debug(message: string, data?: any): void
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, error?: Error | string, data?: any): void
}

// Workflow Event Types
export interface WorkflowEvent {
  type: string
  workflowId: string
  executionId: string
  data: any
  timestamp: Date
  userId?: string
}

// API Response Types
export interface WorkflowListResponse {
  workflows: WorkflowDefinition[]
  total: number
  page: number
  limit: number
}

export interface ExecutionListResponse {
  executions: WorkflowExecution[]
  total: number
  page: number
  limit: number
}