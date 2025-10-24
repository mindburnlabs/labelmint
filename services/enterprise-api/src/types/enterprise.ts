export interface Organization {
  id: string
  name: string
  domain?: string
  slug: string
  logo?: string
  settings: OrganizationSettings
  subscription: Subscription
  billing: BillingInfo
  ssoConfig?: SSOConfig
  complianceConfig: ComplianceConfig
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'inactive' | 'suspended'
}

export interface OrganizationSettings {
  timezone: string
  locale: string
  currency: string
  dateFormat: string
  features: Record<string, boolean>
  branding: BrandingSettings
  workflows: WorkflowSettings
  security: SecuritySettings
}

export interface BrandingSettings {
  primaryColor: string
  secondaryColor: string
  logo?: string
  favicon?: string
  customCSS?: string
  domain?: string
  companyName: string
  supportEmail: string
}

export interface WorkflowSettings {
  requireApproval: boolean
  autoAssignTasks: boolean
  consensusThreshold: number
  qualityChecks: string[]
  customFields: CustomField[]
}

export interface SecuritySettings {
  mfaRequired: boolean
  sessionTimeout: number
  ipWhitelist: string[]
  apiAccessRestrictions: boolean
  auditLogRetention: number
}

export interface CustomField {
  id: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect'
  required: boolean
  options?: string[]
  validation?: ValidationRule
}

export interface ValidationRule {
  pattern?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
}

export interface Team {
  id: string
  organizationId: string
  name: string
  description?: string
  leadId: string
  memberIds: string[]
  settings: TeamSettings
  permissions: TeamPermissions
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'archived'
}

export interface TeamSettings {
  autoJoin: boolean
  requireApproval: boolean
  maxMembers: number
  defaultRole: string
  permissions: Record<string, string[]>
}

export interface TeamPermissions {
  canCreateProjects: boolean
  canManageMembers: boolean
  canViewAnalytics: boolean
  canManageBilling: boolean
  canManageWorkflows: boolean
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  permissions: string[]
  joinedAt: Date
  invitedBy: string
  status: 'active' | 'pending' | 'invited' | 'removed'
}

export interface EnterpriseProject {
  id: string
  organizationId: string
  teamIds: string[]
  name: string
  description: string
  type: ProjectType
  settings: ProjectSettings
  workflowId?: string
  budget: ProjectBudget
  timeline: ProjectTimeline
  collaborators: ProjectCollaborator[]
  metrics: ProjectMetrics
  auditLog: AuditEntry[]
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
}

export type ProjectType =
  | 'image_classification'
  | 'text_labeling'
  | 'audio_transcription'
  | 'video_annotation'
  | '3d_annotation'
  | 'custom'

export interface ProjectSettings {
  qualityThreshold: number
  consensusRequired: boolean
  consensusSize: number
  goldStandardPercent: number
  retryFailedTasks: boolean
  workerRequirements: WorkerRequirements
  customInstructions: string
  metadataSchema: Record<string, any>
}

export interface WorkerRequirements {
  minTrustScore: number
  minCompletedTasks: number
  requiredSkills: string[]
  locationRestrictions: string[]
  languageRequirements: string[]
}

export interface ProjectBudget {
  total: number
  currency: string
  spent: number
  allocated: number
  perTaskReward: number
  maxTasksPerWorker: number
  bonusStructure: BonusStructure[]
}

export interface BonusStructure {
  type: 'accuracy' | 'speed' | 'volume' | 'quality'
  threshold: number
  reward: number
  description: string
}

export interface ProjectTimeline {
  startDate: Date
  endDate: Date
  milestones: Milestone[]
  estimatedHours: number
  actualHours: number
}

export interface Milestone {
  id: string
  name: string
  description: string
  dueDate: Date
  completedAt?: Date
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  deliverables: string[]
}

export interface ProjectCollaborator {
  userId: string
  teamId?: string
  role: 'viewer' | 'annotator' | 'reviewer' | 'manager' | 'admin'
  permissions: string[]
  invitedAt: Date
  acceptedAt?: Date
}

export interface ProjectMetrics {
  tasksCreated: number
  tasksCompleted: number
  tasksInProgress: number
  averageAccuracy: number
  averageTimePerTask: number
  workerCount: number
  totalSpent: number
  estimatedCost: number
  actualCost: number
}

export interface Workflow {
  id: string
  organizationId: string
  name: string
  description: string
  category: 'data_ingestion' | 'quality_control' | 'distribution' | 'integration' | 'automation'
  definition: WorkflowDefinition
  version: number
  isActive: boolean
  executionHistory: WorkflowExecution[]
  settings: WorkflowConfig
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  variables: Record<string, any>
  triggers: WorkflowTrigger[]
}

export interface WorkflowNode {
  id: string
  type: NodeType
  name: string
  config: Record<string, any>
  position: { x: number; y: number }
  inputs: string[]
  outputs: string[]
}

export type NodeType =
  | 'trigger'
  | 'task'
  | 'validation'
  | 'notification'
  | 'integration'
  | 'condition'
  | 'action'
  | 'transform'
  | 'approval'
  | 'escalation'

export interface WorkflowConnection {
  id: string
  fromNode: string
  toNode: string
  fromOutput: string
  toInput: string
  condition?: string
}

export interface WorkflowTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual'
  config: Record<string, any>
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
  context: Record<string, any>
  nodeExecutions: NodeExecution[]
  error?: string
}

export interface NodeExecution {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: Date
  completedAt?: Date
  input: Record<string, any>
  output?: Record<string, any>
  error?: string
}

export interface WorkflowConfig {
  timeout: number
  retryPolicy: RetryPolicy
  notifications: NotificationConfig
  logging: LoggingConfig
}

export interface RetryPolicy {
  maxAttempts: number
  backoffType: 'fixed' | 'linear' | 'exponential'
  backoffDelay: number
  maxDelay: number
}

export interface NotificationConfig {
  onSuccess: Notification[]
  onFailure: Notification[]
  onTimeout: Notification[]
}

export interface Notification {
  type: 'email' | 'webhook' | 'slack' | 'teams' | 'in_app'
  recipients: string[]
  template: string
  data: Record<string, any>
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  includeContext: boolean
  retentionDays: number
}

export interface SSOConfig {
  enabled: boolean
  provider: 'saml' | 'oauth2' | 'oidc' | 'ldap'
  config: SAMLConfig | OAuth2Config | OIDCConfig | LDAPConfig
}

export interface SAMLConfig {
  entryPoint: string
  issuer: string
  cert: string
  privateKey: string
  attributeMapping: Record<string, string>
  groupsAttribute?: string
  roleMapping: Record<string, string>
}

export interface OAuth2Config {
  clientId: string
  clientSecret: string
  authorizationURL: string
  tokenURL: string
  userInfoURL: string
  scope: string[]
  mapping: Record<string, string>
}

export interface OIDCConfig extends OAuth2Config {
  jwksURL: string
  issuer: string
  audience: string
}

export interface LDAPConfig {
  url: string
  bindDN: string
  bindCredentials: string
  searchBase: string
  searchFilter: string
  attributes: Record<string, string>
  groupsAttribute: string
  groupsSearchBase?: string
}

export interface ComplianceConfig {
  enabled: boolean
  standards: ComplianceStandard[]
  dataRetention: DataRetentionPolicy
  auditSettings: AuditSettings
  encryption: EncryptionSettings
  accessControl: AccessControlSettings
}

export interface ComplianceStandard {
  name: 'SOC2' | 'ISO27001' | 'GDPR' | 'HIPAA' | 'PCI_DSS'
  version: string
  status: 'compliant' | 'in_progress' | 'non_compliant'
  lastAuditDate?: Date
  nextAuditDate?: Date
  requirements: ComplianceRequirement[]
}

export interface ComplianceRequirement {
  id: string
  name: string
  description: string
  status: 'compliant' | 'partial' | 'non_compliant'
  evidence: string[]
  controls: string[]
}

export interface DataRetentionPolicy {
  defaultRetention: number // days
  policies: RetentionPolicy[]
  autoDelete: boolean
  legalHold: boolean
}

export interface RetentionPolicy {
  dataType: string
  retentionPeriod: number // days
  conditions: string[]
  exceptions: string[]
}

export interface AuditSettings {
  logAllActions: boolean
  logApiCalls: boolean
  logDataAccess: boolean
  logUserActions: boolean
  retentionPeriod: number // days
  alertOnSuspiciousActivity: boolean
}

export interface EncryptionSettings {
  atRest: boolean
  inTransit: boolean
  fieldLevelEncryption: string[]
  keyRotationInterval: number // days
  algorithm: string
}

export interface AccessControlSettings {
  rbacEnabled: boolean
  mfaRequired: boolean
  sessionTimeout: number // minutes
  ipRestrictions: string[]
  deviceTracking: boolean
  emergencyAccess: EmergencyAccess
}

export interface EmergencyAccess {
  enabled: boolean
  approvers: string[]
  breakGlassPassword?: string
  auditRequired: boolean
  timeout: number // minutes
}

export interface Subscription {
  plan: 'starter' | 'professional' | 'enterprise' | 'custom'
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEndsAt?: Date
  features: SubscriptionFeatures
  limits: SubscriptionLimits
  addons: SubscriptionAddon[]
}

export interface SubscriptionFeatures {
  advancedWorkflows: boolean
  ssoIntegration: boolean
  apiAccess: boolean
  whiteLabeling: boolean
  prioritySupport: boolean
  customIntegrations: boolean
  advancedAnalytics: boolean
  complianceTools: boolean
  teamCollaboration: boolean
  multiTenant: boolean
  customDomains: boolean
}

export interface SubscriptionLimits {
  users: number
  teams: number
  projects: number
  storage: number // GB
  apiCallsPerMonth: number
  workflows: number
  customFields: number
  integrations: number
  supportTickets: number
}

export interface SubscriptionAddon {
  id: string
  name: string
  price: number
  currency: string
  billingInterval: 'monthly' | 'yearly'
  quantity: number
  features: string[]
}

export interface BillingInfo {
  customerId: string
  paymentMethodId: string
  billingAddress: Address
  taxInfo: TaxInfo
  invoices: Invoice[]
  usage: UsageRecord[]
  nextBillingDate: Date
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  country: string
  postalCode: string
}

export interface TaxInfo {
  taxId?: string
  taxRate: number
  taxExempt: boolean
  exemptions: string[]
}

export interface Invoice {
  id: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount: number
  currency: string
  date: Date
  dueDate: Date
  paidAt?: Date
  items: InvoiceItem[]
  tax: number
  total: number
  pdfUrl?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  period?: string
}

export interface UsageRecord {
  id: string
  metric: string
  quantity: number
  unit: string
  period: string
  timestamp: Date
  cost: number
}

export interface AuditEntry {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  organizationId: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  changes: Record<string, { from: any; to: any }>
  metadata: Record<string, any>
}

export interface APIClient {
  id: string
  organizationId: string
  name: string
  description?: string
  keyId: string
  keyHash: string
  permissions: APIPermission[]
  rateLimit: RateLimit
  isActive: boolean
  lastUsedAt?: Date
  createdBy: string
  createdAt: Date
  expiresAt?: Date
}

export interface APIPermission {
  resource: string
  actions: ('create' | 'read' | 'update' | 'delete' | 'list')[]
  conditions?: Record<string, any>
}

export interface RateLimit {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstLimit: number
}

export interface WebhookSubscription {
  id: string
  organizationId: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  version: number
  retryPolicy: RetryPolicy
  lastTriggered?: Date
  createdAt: Date
}

export interface EnterpriseUser {
  id: string
  organizationId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  teams: string[]
  permissions: string[]
  preferences: UserPreferences
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'inactive' | 'suspended' | 'pending'
}

export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'team_admin'
  | 'project_manager'
  | 'annotator'
  | 'reviewer'
  | 'viewer'

export interface UserPreferences {
  language: string
  timezone: string
  notifications: NotificationPreferences
  ui: UIPreferences
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  inApp: boolean
  types: Record<string, boolean>
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto'
  density: 'compact' | 'normal' | 'comfortable'
  language: string
  dashboard: string[]
}

export interface EnterpriseMetrics {
  organizationId: string
  period: string
  users: {
    total: number
    active: number
    new: number
  }
  projects: {
    total: number
    active: number
    completed: number
  }
  tasks: {
    created: number
    completed: number
    pending: number
    averageAccuracy: number
  }
  costs: {
    total: number
    perTask: number
    breakdown: Record<string, number>
  }
  performance: {
    averageTimePerTask: number
    throughput: number
    qualityScore: number
  }
}

export interface CollaborationEvent {
  id: string
  type: 'cursor_move' | 'edit' | 'comment' | 'mention' | 'share'
  userId: string
  resource: string
  resourceId: string
  data: any
  timestamp: Date
}

export interface Comment {
  id: string
  userId: string
  content: string
  mentions: string[]
  attachments: Attachment[]
  parentId?: string
  replies: Comment[]
  createdAt: Date
  updatedAt: Date
  edited: boolean
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  uploadedBy: string
  uploadedAt: Date
}