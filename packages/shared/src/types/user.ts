// ============================================================================
// USER TYPES
// ============================================================================

import { BaseEntity, PaginationResult } from './common';

export enum UserRole {
  ADMIN = 'admin',
  PROJECT_MANAGER = 'project_manager',
  LABELER = 'labeler',
  QUALITY_CONTROLLER = 'quality_controller',
  CLIENT = 'client'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface User extends BaseEntity {
  telegram_id: bigint;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  bio?: string;
  skills?: string[];
  rating?: number;
  total_earnings?: number;
  completed_tasks?: number;
  wallet_address?: string;
  ton_wallet?: string;
  is_verified?: boolean;
  verification_level?: number;
  last_login_at?: Date;
  preferences?: UserPreferences;
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    telegram: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  auto_assign_tasks: boolean;
  task_categories: string[];
  working_hours?: {
    start: string;
    end: string;
  };
}

export interface UserCreateData {
  telegram_id: bigint;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  avatar_url?: string;
  bio?: string;
  skills?: string[];
  wallet_address?: string;
  ton_wallet?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
  avatar_url?: string;
  bio?: string;
  skills?: string[];
  rating?: number;
  total_earnings?: number;
  completed_tasks?: number;
  wallet_address?: string;
  ton_wallet?: string;
  is_verified?: boolean;
  verification_level?: number;
  last_login_at?: Date;
  preferences?: Partial<UserPreferences>;
  metadata?: Record<string, any>;
}

export interface UserFindOptions {
  role?: UserRole | UserRole[];
  status?: UserStatus | UserStatus[];
  skills?: string[];
  rating_min?: number;
  rating_max?: number;
  telegram_id?: bigint;
  username?: string;
  email?: string;
  wallet_address?: string;
  is_verified?: boolean;
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
}

export interface UserProfile {
  id: string;
  telegram_id: bigint;
  first_name: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  role: UserRole;
  status: UserStatus;
  rating?: number;
  total_earnings?: number;
  completed_tasks?: number;
  skills?: string[];
  verification_level?: number;
  is_verified?: boolean;
  created_at: Date;
  last_login_at?: Date;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  new_users_today: number;
  new_users_this_week: number;
  new_users_this_month: number;
  users_by_role: Record<UserRole, number>;
  users_by_status: Record<UserStatus, number>;
  average_rating: number;
  total_earnings: number;
}

export interface WorkerProfile extends UserProfile {
  success_rate: number;
  average_time_per_task: number;
  specialization_areas: string[];
  quality_score: number;
  reliability_score: number;
  recent_projects: Array<{
    project_id: string;
    project_name: string;
    tasks_completed: number;
    rating: number;
    completed_at: Date;
  }>;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: 'task_completed' | 'task_started' | 'login' | 'profile_updated' | 'wallet_connected';
  description: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  telegram_web_app_data?: string;
  ip_address?: string;
  user_agent?: string;
  started_at: Date;
  last_activity: Date;
  expires_at: Date;
  is_active: boolean;
}

export interface UserFindResult extends PaginationResult<User> {}
export interface UserStatsResult extends UserStats {}