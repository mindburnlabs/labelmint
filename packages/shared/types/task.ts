// ============================================================================
// TASK TYPES
// ============================================================================

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum TaskType {
  IMAGE_CLASSIFICATION = 'IMAGE_CLASSIFICATION',
  BOUNDING_BOX = 'BOUNDING_BOX',
  POLYGON_ANNOTATION = 'POLYGON_ANNOTATION',
  SEMANTIC_SEGMENTATION = 'SEMANTIC_SEGMENTATION',
  TEXT_CLASSIFICATION = 'TEXT_CLASSIFICATION',
  NAMED_ENTITY_RECOGNITION = 'NAMED_ENTITY_RECOGNITION',
  TRANSCRIPTION = 'TRANSCRIPTION',
  TRANSLATION = 'TRANSLATION',
  SENTIMENT_ANALYSIS = 'SENTIMENT_ANALYSIS',
  RLHF_COMPARISON = 'RLHF_COMPARISON',
  CUSTOM = 'CUSTOM'
}

export enum ConsensusLevel {
  PENDING = 'PENDING',
  CONFLICTING = 'CONFLICTING',
  AGREED = 'AGREED',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED'
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  type: TaskType
  subType?: string
  data: TaskData
  options?: string[]
  status: TaskStatus
  priority: number
  assignedTo?: string
  assignedAt?: Date
  completedAt?: Date
  dueAt?: Date

  // AI and Quality fields
  aiPrelabel?: string
  aiConfidence?: number
  consensusTarget: number
  consensusLevel: ConsensusLevel
  finalLabel?: string
  qualityScore?: number

  // Pricing
  basePrice: number
  points: number
  multiplier: number

  createdAt: Date
  updatedAt: Date

  // Relations
  project?: Project
  assignee?: User
  responses: Response[]
  consensus?: TaskConsensus
  examples?: TaskExample[]
}

export interface TaskData {
  // Image-based tasks
  imageUrl?: string
  imageMetadata?: {
    width: number
    height: number
    format: string
    size: number
  }

  // Text-based tasks
  text?: string
  textMetadata?: {
    language: string
    length: number
    tokens: number
  }

  // Custom data
  custom?: Record<string, any>

  // Common fields
  context?: string
  instructions?: string
  examples?: TaskExample[]
  metadata?: Record<string, any>
}

export interface Response {
  id: string
  taskId: string
  workerId: string
  label: string
  confidence?: number
  timeSpent?: number // in seconds
  metadata?: Record<string, any>
  createdAt: Date

  // Relations
  task: Task
  worker: User
  boundingBoxes?: BoundingBox[]
  transcriptions?: Transcription[]
  rlhfComparisons?: RLHFComparison[]
  sentimentAnalyses?: SentimentAnalysis[]
}

export interface BoundingBox {
  id: string
  responseId: string
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence?: number
  createdAt: Date
}

export interface Transcription {
  id: string
  responseId: string
  text: string
  confidence?: number
  language?: string
  createdAt: Date
}

export interface RLHFComparison {
  id: string
  responseId: string
  optionA: string
  optionB: string
  preferred: string
  reason?: string
  createdAt: Date
}

export interface SentimentAnalysis {
  id: string
  responseId: string
  sentiment: string
  score: number
  confidence?: number
  createdAt: Date
}

export interface TaskConsensus {
  taskId: string
  finalLabel?: string
  confidence?: number
  disagreement: number
  resolvedAt?: Date
  resolvedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskPricing {
  taskId: string
  basePrice: number
  difficulty?: string
  timeEstimate?: number // in seconds
  multiplier: number
  updatedAt: Date
}

export interface TaskExample {
  id: string
  taskId: string
  title: string
  description?: string
  data: TaskData
  label: string
  isGood: boolean
  createdAt: Date
}

export interface TaskSeen {
  id: string
  taskId: string
  workerId: string
  seenAt: Date
  skipped: boolean
  skipReason?: string
}

// ============================================================================
// AI-ASSISTED TASKS
// ============================================================================

export interface AILabel {
  id: string
  taskId: string
  label: string
  confidence?: number
  model: string
  version?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AIValidationQueue {
  id: string
  taskId: string
  status: ValidationStatus
  assignedTo?: string
  startedAt?: Date
  completedAt?: Date
  result?: Record<string, any>
  error?: string
  createdAt: Date
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// ============================================================================
// TASK MANAGEMENT TYPES
// ============================================================================

export interface TaskAssignment {
  taskId: string
  workerId: string
  assignedAt: Date
  expiresAt: Date
  priority: number
  metadata?: Record<string, any>
}

export interface TaskQueue {
  id: string
  projectId: string
  taskType: TaskType
  status: TaskStatus
  priority: number
  estimatedWaitTime: number
  availableSlots: number
  totalSlots: number
}

export interface BatchTaskOperation {
  id: string
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN'
  taskIds: string[]
  data?: Record<string, any>
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  errors: string[]
  createdAt: Date
  completedAt?: Date
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface Project {
  id: string
  name: string
  description?: string
  client: User
  clientId: string
  status: ProjectStatus
  settings?: ProjectSettings
  createdAt: Date
  updatedAt: Date

  // Relations
  tasks: Task[]
  responses: Response[]
  payments: ClientPayment[]
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED'
}

export interface ProjectSettings {
  // Quality settings
  consensusTarget: number
  qualityThreshold: number
  allowAiAssistance: boolean

  // Worker settings
  minAccuracy: number
  minTrustScore: number
  allowedWorkerTypes: UserRole[]

  // Payment settings
  basePrice: number
  pricePerTask: number
  bonusPerTask: number

  // Privacy settings
  isPublic: boolean
  allowExternalWorkers: boolean
  ndaRequired: boolean

  // Automation settings
  autoApprove: boolean
  autoPayment: boolean
  notifications: boolean
}