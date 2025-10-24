// ============================================================================
// LABEL TYPES
// ============================================================================

import { BaseEntity } from './common';
import { TaskType } from './task';

export interface Label extends BaseEntity {
  id: string;
  task_id: string;
  user_id: string;
  type: TaskType;
  data: LabelData;
  confidence?: number;
  time_spent: number;
  notes?: string;
  metadata?: Record<string, any>;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_status?: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  review_notes?: string;
  quality_score?: number;
  is_consensus_match?: boolean;
  consensus_score?: number;
}

export interface LabelData {
  // Common fields
  type: TaskType;
  labels: any[];
  confidence?: number;
  annotations?: Annotation[];
  metadata?: Record<string, any>;

  // Type-specific label data
  classification?: {
    class: string;
    confidence: number;
    alternatives?: Array<{
      class: string;
      confidence: number;
    }>;
  };

  bounding_boxes?: BoundingBox[];
  polygons?: Polygon[];
  keypoints?: Keypoint[];

  text_labels?: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
    confidence?: number;
  }>;

  entities?: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
    confidence?: number;
  }>;

  sentiment?: {
    polarity: 'positive' | 'negative' | 'neutral';
    confidence: number;
    intensity?: number;
  };

  translation?: {
    source_text: string;
    target_text: string;
    source_language: string;
    target_language: string;
    confidence?: number;
  };

  transcription?: {
    text: string;
    confidence?: number;
    timestamps?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };

  validation?: {
    is_valid: boolean;
    issues: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };

  moderation?: {
    is_approved: boolean;
    categories: Array<{
      type: string;
      confidence: number;
    }>;
    reasoning?: string;
  };
}

export interface Annotation {
  id: string;
  type: 'bounding_box' | 'polygon' | 'point' | 'line' | 'text';
  coordinates: number[] | number[][];
  label: string;
  confidence?: number;
  attributes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence?: number;
  attributes?: Record<string, any>;
}

export interface Polygon {
  points: Array<{ x: number; y: number }>;
  label: string;
  confidence?: number;
  attributes?: Record<string, any>;
}

export interface Keypoint {
  x: number;
  y: number;
  label: string;
  confidence?: number;
  attributes?: Record<string, any>;
}

export interface LabelTemplate {
  id: string;
  name: string;
  task_type: TaskType;
  description?: string;
  schema: LabelSchema;
  guidelines?: string;
  examples?: Array<{
    input: any;
    output: LabelData;
    explanation?: string;
  }>;
  is_public: boolean;
  usage_count: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface LabelSchema {
  type: TaskType;
  fields: SchemaField[];
  validation?: ValidationRule[];
  output_format: 'json' | 'xml' | 'custom';
}

export interface SchemaField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'bounding_box' | 'polygon' | 'point' | 'line';
  required: boolean;
  label: string;
  description?: string;
  default_value?: any;
  options?: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  validation?: ValidationRule[];
  attributes?: Record<string, any>;
}

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'min_value' | 'max_value' | 'pattern' | 'custom';
  parameters: Record<string, any>;
  message: string;
}

export interface LabelQuality {
  id: string;
  label_id: string;
  reviewer_id: string;
  accuracy_score: number;
  completeness_score: number;
  consistency_score: number;
  overall_score: number;
  feedback?: {
    accuracy_issues?: string[];
    completeness_issues?: string[];
    consistency_issues?: string[];
    suggestions?: string[];
  };
  reviewed_at: Date;
}

export interface LabelConsensus {
  task_id: string;
  total_submissions: number;
  consensus_score: number;
  consensus_labels: LabelData[];
 分歧_labels: LabelData[];
  final_label?: LabelData;
  consensus_algorithm: 'majority_vote' | 'weighted_average' | 'custom';
  metadata?: Record<string, any>;
}

export interface LabelReview {
  id: string;
  label_id: string;
  reviewer_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  decision: 'approve' | 'reject' | 'request_changes';
  confidence: number;
  notes?: string;
  suggested_changes?: Array<{
    field: string;
    current_value: any;
    suggested_value: any;
    reason: string;
  }>;
  reviewed_at: Date;
}

export interface LabelStats {
  total_labels: number;
  labels_by_type: Record<TaskType, number>;
  labels_by_quality: Array<{
    quality_range: string;
    count: number;
    percentage: number;
  }>;
  average_confidence: number;
  average_time_spent: number;
  consensus_rate: number;
  revision_rate: number;
  rejection_rate: number;
  top_labelers: Array<{
    user_id: string;
    label_count: number;
    average_quality: number;
    average_time: number;
  }>;
}

export interface LabelFindOptions {
  task_id?: string;
  user_id?: string;
  type?: TaskType;
  confidence_min?: number;
  confidence_max?: number;
  time_spent_min?: number;
  time_spent_max?: number;
  reviewed_by?: string;
  review_status?: string;
  quality_score_min?: number;
  quality_score_max?: number;
  created_after?: Date;
  created_before?: Date;
  is_consensus_match?: boolean;
  search?: string;
}

export interface LabelCreateData {
  task_id: string;
  user_id: string;
  type: TaskType;
  data: LabelData;
  confidence?: number;
  time_spent: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface LabelUpdateData {
  data?: LabelData;
  confidence?: number;
  notes?: string;
  metadata?: Record<string, any>;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_status?: string;
  review_notes?: string;
  quality_score?: number;
}

export interface LabelFindResult {
  data: Label[];
  total: number;
  page: number;
  limit: number;
}

export interface LabelBatch {
  id: string;
  name: string;
  description?: string;
  task_ids: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  metadata?: Record<string, any>;
}