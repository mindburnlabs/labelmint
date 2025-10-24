// ============================================================================
// TASK TYPES
// ============================================================================

import { BaseEntity, PaginationResult } from './common';
import { User } from './user';

export enum TaskType {
  IMAGE_CLASSIFICATION = 'image_classification',
  BOUNDING_BOX = 'bounding_box',
  POLYGON_ANNOTATION = 'polygon_annotation',
  TEXT_CLASSIFICATION = 'text_classification',
  NAMED_ENTITY_RECOGNITION = 'named_entity_recognition',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  TRANSLATION = 'translation',
  TRANSCRIPTION = 'transcription',
  DATA_VALIDATION = 'data_validation',
  CONTENT_MODERATION = 'content_moderation'
}

export enum TaskStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  REVIEW_PENDING = 'review_pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

export interface Task extends BaseEntity {
  project_id: string;
  batch_id?: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string;
  completed_by?: string;
  reviewed_by?: string;
  data: TaskData;
  instructions?: string;
  requirements?: TaskRequirements;
  time_limit?: number; // in minutes
  due_at?: Date;
  started_at?: Date;
  submitted_at?: Date;
  reviewed_at?: Date;
  completed_at?: Date;
  metadata?: Record<string, any>;
  consensus_data?: ConsensusData;
  quality_metrics?: QualityMetrics;
}

export interface TaskData {
  // Common fields
  id: string;
  type: TaskType;
  content: any;
  media_url?: string;
  media_type?: string;

  // Type-specific data structures
  text_data?: {
    text: string;
    language?: string;
    tokens?: number;
  };

  image_data?: {
    url: string;
    width: number;
    height: number;
    format: string;
    size: number;
  };

  audio_data?: {
    url: string;
    duration: number;
    format: string;
    size: number;
    sample_rate?: number;
  };

  video_data?: {
    url: string;
    duration: number;
    format: string;
    size: number;
    width?: number;
    height?: number;
    fps?: number;
  };

  structured_data?: {
    schema: Record<string, any>;
    data: Record<string, any>;
  };
}

export interface TaskRequirements {
  min_accuracy?: number;
  time_limit?: number;
  required_skills?: string[];
  min_rating?: number;
  verification_tasks?: number;
  instructions?: string[];
  examples?: Array<{
    input: any;
    output: any;
    explanation?: string;
  }>;
}

export interface ConsensusData {
  required_submissions: number;
  current_submissions: number;
  consensus_threshold: number;
  current_consensus: number;
  is_honeypot: boolean;
  expected_answer?: any;
  submissions?: ConsensusSubmission[];
}

export interface ConsensusSubmission {
  user_id: string;
  answer: any;
  confidence?: number;
  time_spent: number;
  submitted_at: Date;
  is_correct?: boolean;
}

export interface QualityMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  time_efficiency?: number;
  consistency_score?: number;
  consensus_score?: number;
  honeypot_performance?: number;
  overall_score?: number;
}

export interface TaskCreateData {
  project_id: string;
  batch_id?: string;
  title: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  data: TaskData;
  instructions?: string;
  requirements?: TaskRequirements;
  time_limit?: number;
  due_at?: Date;
  metadata?: Record<string, any>;
  consensus_config?: {
    required_submissions: number;
    consensus_threshold: number;
    honeypot_percentage?: number;
  };
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string;
  instructions?: string;
  requirements?: TaskRequirements;
  time_limit?: number;
  due_at?: Date;
  metadata?: Record<string, any>;
}

export interface TaskFindOptions {
  project_id?: string;
  batch_id?: string;
  type?: TaskType | TaskType[];
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigned_to?: string;
  completed_by?: string;
  reviewed_by?: string;
  due_before?: Date;
  due_after?: Date;
  created_after?: Date;
  created_before?: Date;
  is_honeypot?: boolean;
  consensus_pending?: boolean;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: Date;
  assigned_by: string;
  expires_at?: Date;
  accepted_at?: Date;
  rejected_at?: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  user_id: string;
  answer: any;
  confidence?: number;
  time_spent: number;
  notes?: string;
  metadata?: Record<string, any>;
  submitted_at: Date;
  reviewed_at?: Date;
  reviewed_by?: string;
  review_status?: 'pending' | 'approved' | 'rejected';
  review_notes?: string;
  quality_score?: number;
  is_correct?: boolean;
}

export interface TaskReview {
  id: string;
  task_id: string;
  submission_id: string;
  reviewer_id: string;
  status: 'approved' | 'rejected' | 'needs_revision';
  score: number;
  notes?: string;
  feedback?: {
    accuracy_issues?: string[];
    completeness_issues?: string[];
    quality_issues?: string[];
    suggestions?: string[];
  };
  reviewed_at: Date;
}

export interface TaskBatch extends BaseEntity {
  project_id: string;
  name: string;
  description?: string;
  task_count: number;
  task_type: TaskType;
  status: 'draft' | 'ready' | 'in_progress' | 'completed';
  requirements?: TaskRequirements;
  metadata?: Record<string, any>;
  created_by: string;
}

export interface TaskStats {
  total_tasks: number;
  tasks_by_status: Record<TaskStatus, number>;
  tasks_by_type: Record<TaskType, number>;
  tasks_by_priority: Record<TaskPriority, number>;
  completed_today: number;
  completed_this_week: number;
  completed_this_month: number;
  average_completion_time: number;
  approval_rate: number;
  average_quality_score: number;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  activity_type: 'assigned' | 'started' | 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'cancelled';
  description: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface TaskFindResult extends PaginationResult<Task> {}
export interface TaskStatsResult extends TaskStats {}

// Template types
export interface TaskTemplate extends BaseEntity {
  name: string;
  description?: string;
  type: TaskType;
  instructions: string;
  requirements: TaskRequirements;
  data_schema: Record<string, any>;
  answer_schema: Record<string, any>;
  is_public: boolean;
  usage_count: number;
  created_by: string;
  metadata?: Record<string, any>;
}