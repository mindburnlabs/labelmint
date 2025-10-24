// ============================================================================
// PROJECT TYPES
// ============================================================================

import { BaseEntity, PaginationResult } from './common';
import { User, UserRole } from './user';
import { TaskType, TaskStatus } from './task';

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived'
}

export enum ProjectVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  INVITE_ONLY = 'invite_only'
}

export interface Project extends BaseEntity {
  name: string;
  description?: string;
  owner_id: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  task_types: TaskType[];
  budget: ProjectBudget;
  timeline: ProjectTimeline;
  requirements: ProjectRequirements;
  settings: ProjectSettings;
  metadata?: Record<string, any>;
  stats?: ProjectStats;
}

export interface ProjectBudget {
  total_budget: number;
  currency: 'TON' | 'USDT' | 'USD';
  allocated_budget: number;
  spent_budget: number;
  per_task_reward: number;
  bonus_thresholds?: Array<{
    tasks_completed: number;
    bonus_amount: number;
  }>;
  quality_bonus?: {
    threshold: number;
    bonus_percentage: number;
  };
}

export interface ProjectTimeline {
  start_date: Date;
  end_date?: Date;
  milestones?: Array<{
    id: string;
    name: string;
    description?: string;
    due_date: Date;
    completed_at?: Date;
    status: 'pending' | 'completed' | 'overdue';
  }>;
}

export interface ProjectRequirements {
  min_labelers?: number;
  max_labelers?: number;
  required_skills?: string[];
  min_rating?: number;
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  languages?: string[];
  time_zone?: string[];
  working_hours?: {
    start: string;
    end: string;
  };
  verification_required: boolean;
  consensus_threshold?: number;
  quality_threshold?: number;
}

export interface ProjectSettings {
  auto_assignment: boolean;
  allow_self_assignment: boolean;
  require_verification: boolean;
  consensus_enabled: boolean;
  honeypot_percentage: number;
  review_required: boolean;
  review_percentage: number;
  public_results: boolean;
  allow_revisions: boolean;
  revision_limit?: number;
  time_per_task?: number;
  grace_period?: number;
}

export interface ProjectCreateData {
  name: string;
  description?: string;
  owner_id: string;
  task_types: TaskType[];
  budget: Omit<ProjectBudget, 'allocated_budget' | 'spent_budget'>;
  timeline: ProjectTimeline;
  requirements?: ProjectRequirements;
  settings?: Partial<ProjectSettings>;
  visibility?: ProjectVisibility;
  metadata?: Record<string, any>;
}

export interface ProjectUpdateData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  task_types?: TaskType[];
  budget?: Partial<ProjectBudget>;
  timeline?: Partial<ProjectTimeline>;
  requirements?: Partial<ProjectRequirements>;
  settings?: Partial<ProjectSettings>;
  metadata?: Record<string, any>;
}

export interface ProjectFindOptions {
  owner_id?: string;
  status?: ProjectStatus | ProjectStatus[];
  visibility?: ProjectVisibility;
  task_types?: TaskType[];
  budget_min?: number;
  budget_max?: number;
  start_date_after?: Date;
  start_date_before?: Date;
  end_date_after?: Date;
  end_date_before?: Date;
  required_skills?: string[];
  min_rating?: number;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'budget' | 'start_date';
  sort_direction?: 'asc' | 'desc';
}

export interface ProjectMember extends BaseEntity {
  project_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'reviewer' | 'labeler';
  permissions: string[];
  joined_at: Date;
  invited_by?: string;
  status: 'active' | 'inactive' | 'removed';
  removed_at?: Date;
  removed_by?: string;
  notes?: string;
}

export interface ProjectInvitation extends BaseEntity {
  project_id: string;
  invited_user_id?: string;
  invited_email?: string;
  invited_by: string;
  role: 'manager' | 'reviewer' | 'labeler';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  token?: string;
  expires_at: Date;
  accepted_at?: Date;
  message?: string;
}

export interface ProjectStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  approved_tasks: number;
  rejected_tasks: number;
  total_labelers: number;
  active_labelers: number;
  average_completion_time: number;
  average_quality_score: number;
  consensus_rate: number;
  total_spent: number;
  remaining_budget: number;
  tasks_by_type: Record<TaskType, number>;
  tasks_by_status: Record<TaskStatus, number>;
  top_performers: Array<{
    user_id: string;
    tasks_completed: number;
    average_quality: number;
    total_earned: number;
  }>;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id: string;
  activity_type: 'created' | 'updated' | 'paused' | 'resumed' | 'completed' | 'cancelled' | 'member_added' | 'member_removed' | 'budget_updated';
  description: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface ProjectTemplate extends BaseEntity {
  name: string;
  description?: string;
  category: string;
  task_types: TaskType[];
  default_requirements: ProjectRequirements;
  default_settings: ProjectSettings;
  suggested_budget: {
    min_per_task: number;
    max_per_task: number;
    currency: string;
  };
  example_data?: any;
  usage_count: number;
  is_public: boolean;
  created_by: string;
  tags?: string[];
}

export interface ProjectFindResult extends PaginationResult<Project> {}
export interface ProjectStatsResult extends ProjectStats {}

// Analytics types
export interface ProjectAnalytics {
  project_id: string;
  date_range: {
    start: Date;
    end: Date;
  };
  daily_stats: Array<{
    date: Date;
    tasks_completed: number;
    labelers_active: number;
    average_quality: number;
    cost_incurred: number;
  }>;
  performance_metrics: {
    completion_rate: number;
    quality_score: number;
    cost_efficiency: number;
    labeler_retention: number;
  };
  labeler_analytics: Array<{
    user_id: string;
    tasks_completed: number;
    average_quality: number;
    total_earned: number;
    efficiency_score: number;
  }>;
  task_analytics: Array<{
    task_type: TaskType;
    total_count: number;
    completed_count: number;
    average_time: number;
    average_quality: number;
  }>;
}