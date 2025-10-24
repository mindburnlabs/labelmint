// ============================================================================
// SUPABASE DATABASE TYPES
// ============================================================================

// This file would normally be generated using Supabase CLI:
// supabase gen types typescript --local > src/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
          user_agent?: string | null
        }
      }
      labels: {
        Row: {
          consensus_score: number | null
          confidence: number | null
          created_at: string
          data: Json
          id: string
          is_consensus_match: boolean | null
          metadata: Json
          notes: string | null
          quality_score: number | null
          review_notes: string | null
          review_status: "needs_revision" | "pending" | "approved" | "rejected" | null
          reviewed_at: string | null
          reviewed_by: string | null
          task_id: string
          time_spent: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consensus_score?: number | null
          confidence?: number | null
          created_at?: string
          data: Json
          id?: string
          is_consensus_match?: boolean | null
          metadata?: Json
          notes?: string | null
          quality_score?: number | null
          review_notes?: string | null
          review_status?: "needs_revision" | "pending" | "approved" | "rejected" | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          task_id: string
          time_spent: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consensus_score?: number | null
          confidence?: number | null
          created_at?: string
          data?: Json
          id?: string
          is_consensus_match?: boolean | null
          metadata?: Json
          notes?: string | null
          quality_score?: number | null
          review_notes?: string | null
          review_status?: "needs_revision" | "pending" | "approved" | "rejected" | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          task_id?: string
          time_spent?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
      }
      project_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          notes: string | null
          permissions: string[]
          project_id: string
          removed_at: string | null
          removed_by: string | null
          role: "owner" | "manager" | "reviewer" | "labeler"
          status: "active" | "inactive" | "removed"
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          notes?: string | null
          permissions?: string[]
          project_id: string
          removed_at?: string | null
          removed_by?: string | null
          role: "owner" | "manager" | "reviewer" | "labeler"
          status?: "active" | "inactive" | "removed"
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          notes?: string | null
          permissions?: string[]
          project_id?: string
          removed_at?: string | null
          removed_by?: string | null
          role?: "owner" | "manager" | "reviewer" | "labeler"
          status?: "active" | "inactive" | "removed"
          user_id?: string
        }
      }
      projects: {
        Row: {
          budget: Json
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string
          requirements: Json
          settings: Json
          status: "draft" | "active" | "paused" | "completed" | "cancelled" | "archived"
          task_types: string[]
          timeline: Json
          updated_at: string
          visibility: "public" | "private" | "invite_only"
        }
        Insert: {
          budget: Json
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id: string
          requirements?: Json
          settings?: Json
          status?: "draft" | "active" | "paused" | "completed" | "cancelled" | "archived"
          task_types: string[]
          timeline: Json
          updated_at?: string
          visibility?: "public" | "private" | "invite_only"
        }
        Update: {
          budget?: Json
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string
          requirements?: Json
          settings?: Json
          status?: "draft" | "active" | "paused" | "completed" | "cancelled" | "archived"
          task_types?: string[]
          timeline?: Json
          updated_at?: string
          visibility?: "public" | "private" | "invite_only"
        }
      }
      task_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by: string
          expires_at: string | null
          id: string
          rejected_at: string | null
          status: "pending" | "accepted" | "rejected" | "expired"
          task_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by: string
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          status?: "pending" | "accepted" | "rejected" | "expired"
          task_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          status?: "pending" | "accepted" | "rejected" | "expired"
          task_id?: string
          user_id?: string
        }
      }
      task_batches: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json
          name: string
          project_id: string
          requirements: Json
          status: "draft" | "ready" | "in_progress" | "completed"
          task_count: number
          task_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          project_id: string
          requirements?: Json
          status?: "draft" | "ready" | "in_progress" | "completed"
          task_count?: number
          task_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          project_id?: string
          requirements?: Json
          status?: "draft" | "ready" | "in_progress" | "completed"
          task_count?: number
          task_type?: string
          updated_at?: string
        }
      }
      task_reviews: {
        Row: {
          feedback: Json
          id: string
          notes: string | null
          reviewed_at: string
          reviewer_id: string
          score: number
          status: "approved" | "rejected" | "needs_revision"
          submission_id: string
          task_id: string
        }
        Insert: {
          feedback?: Json
          id?: string
          notes?: string | null
          reviewed_at?: string
          reviewer_id: string
          score: number
          status: "approved" | "rejected" | "needs_revision"
          submission_id: string
          task_id: string
        }
        Update: {
          feedback?: Json
          id?: string
          notes?: string | null
          reviewed_at?: string
          reviewer_id?: string
          score?: number
          status?: "approved" | "rejected" | "needs_revision"
          submission_id?: string
          task_id?: string
        }
      }
      tasks: {
        Row: {
          assigned_to: string | null
          batch_id: string | null
          completed_at: string | null
          completed_by: string | null
          consensus_data: Json
          created_at: string
          data: Json
          description: string | null
          due_at: string | null
          id: string
          instructions: string | null
          metadata: Json
          priority: number
          project_id: string
          quality_metrics: Json
          requirements: Json
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: "draft" | "pending" | "assigned" | "in_progress" | "submitted" | "review_pending" | "approved" | "rejected" | "completed" | "cancelled" | "expired"
          submitted_at: string | null
          time_limit: number | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          batch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          consensus_data?: Json
          created_at?: string
          data: Json
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          metadata?: Json
          priority?: number
          project_id: string
          quality_metrics?: Json
          requirements?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: "draft" | "pending" | "assigned" | "in_progress" | "submitted" | "review_pending" | "approved" | "rejected" | "completed" | "cancelled" | "expired"
          submitted_at?: string | null
          time_limit?: number | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          batch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          consensus_data?: Json
          created_at?: string
          data?: Json
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          metadata?: Json
          priority?: number
          project_id?: string
          quality_metrics?: Json
          requirements?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: "draft" | "pending" | "assigned" | "in_progress" | "submitted" | "review_pending" | "approved" | "rejected" | "completed" | "cancelled" | "expired"
          submitted_at?: string | null
          time_limit?: number | null
          title?: string
          type?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          amount: number
          block_hash: string | null
          block_number: number | null
          blockchain_hash: string | null
          created_at: string
          currency: "TON" | "USDT" | "USD"
          description: string | null
          failed_at: string | null
          failure_reason: string | null
          fee_amount: number
          from_wallet_id: string | null
          gas_price: number | null
          gas_used: number | null
          id: string
          metadata: Json
          processed_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          retry_count: number
          status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded"
          to_wallet_id: string | null
          type: "task_reward" | "bonus_payment" | "withdrawal" | "deposit" | "refund" | "penalty" | "adjustment" | "fee" | "transfer"
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          block_hash?: string | null
          block_number?: number | null
          blockchain_hash?: string | null
          created_at?: string
          currency: "TON" | "USDT" | "USD"
          description?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          fee_amount?: number
          from_wallet_id?: string | null
          gas_price?: number | null
          gas_used?: number | null
          id?: string
          metadata?: Json
          processed_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded"
          to_wallet_id?: string | null
          type: "task_reward" | "bonus_payment" | "withdrawal" | "deposit" | "refund" | "penalty" | "adjustment" | "fee" | "transfer"
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          block_hash?: string | null
          block_number?: number | null
          blockchain_hash?: string | null
          created_at?: string
          currency?: "TON" | "USDT" | "USD"
          description?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          fee_amount?: number
          from_wallet_id?: string | null
          gas_price?: number | null
          gas_used?: number | null
          id?: string
          metadata?: Json
          processed_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded"
          to_wallet_id?: string | null
          type?: "task_reward" | "bonus_payment" | "withdrawal" | "deposit" | "refund" | "penalty" | "adjustment" | "fee" | "transfer"
          updated_at?: string
          user_id?: string
        }
      }
      user_sessions: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity: string
          metadata: Json
          refresh_token: string
          telegram_id: number
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          metadata?: Json
          refresh_token: string
          telegram_id: number
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          metadata?: Json
          refresh_token?: string
          telegram_id?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
      }
      user_wallets: {
        Row: {
          address: string
          balance: number
          created_at: string
          currency: "TON" | "USDT" | "USD"
          id: string
          is_active: boolean
          is_primary: boolean
          last_used_at: string | null
          metadata: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          balance?: number
          created_at?: string
          currency: "TON" | "USDT" | "USD"
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          metadata?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          balance?: number
          created_at?: string
          currency?: "TON" | "USDT" | "USD"
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          metadata?: Json
          updated_at?: string
          user_id?: string
        }
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          completed_tasks: number
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_verified: boolean
          language_code: string | null
          last_login_at: string | null
          last_name: string | null
          metadata: Json
          phone: string | null
          preferences: Json
          rating: number | null
          role: "admin" | "project_manager" | "labeler" | "quality_controller" | "client"
          status: "active" | "inactive" | "suspended" | "pending_verification"
          telegram_id: number
          total_earnings: number
          ton_wallet: string | null
          updated_at: string
          username: string | null
          verification_level: number
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          completed_tasks?: number
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_verified?: boolean
          language_code?: string | null
          last_login_at?: string | null
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          preferences?: Json
          rating?: number | null
          role?: "admin" | "project_manager" | "labeler" | "quality_controller" | "client"
          status?: "active" | "inactive" | "suspended" | "pending_verification"
          telegram_id: number
          total_earnings?: number
          ton_wallet?: string | null
          updated_at?: string
          username?: string | null
          verification_level?: number
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          completed_tasks?: number
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_verified?: boolean
          language_code?: string | null
          last_login_at?: string | null
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          preferences?: Json
          rating?: number | null
          role?: "admin" | "project_manager" | "labeler" | "quality_controller" | "client"
          status?: "active" | "inactive" | "suspended" | "pending_verification"
          telegram_id?: number
          total_earnings?: number
          ton_wallet?: string | null
          updated_at?: string
          username?: string | null
          verification_level?: number
          wallet_address?: string | null
        }
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          currency: "TON" | "USDT" | "USD"
          failed_at: string | null
          failure_reason: string | null
          fee_amount: number
          id: string
          metadata: Json
          net_amount: number | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          processing_fee: number
          status: "pending" | "processing" | "completed" | "failed" | "cancelled"
          task_count: number
          task_type: string
          to_address: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: "TON" | "USDT" | "USD"
          failed_at?: string | null
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_fee?: number
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled"
          task_count?: number
          task_type?: string
          to_address: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: "TON" | "USDT" | "USD"
          failed_at?: string | null
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_fee?: number
          status?: "pending" | "processing" | "completed" | "failed" | "cancelled"
          task_count?: number
          task_type?: string
          to_address?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
      }
    }
    Views: {
      user_profiles: {
        Row: {
          assigned_task_count: number | null
          avatar_url: string | null
          bio: string | null
          completed_tasks: number
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_verified: boolean
          last_name: string | null
          member_count: number | null
          project_count: number | null
          rating: number | null
          role: "admin" | "project_manager" | "labeler" | "quality_controller" | "client"
          status: "active" | "inactive" | "suspended" | "pending_verification"
          telegram_id: number
          total_earnings: number
          updated_at: string
          username: string | null
          verification_level: number
          wallet_count: number | null
        }
      }
      project_summaries: {
        Row: {
          completed_tasks: number | null
          created_at: string
          description: string | null
          id: string
          member_count: number | null
          name: string
          owner_id: string
          owner_name: string
          pending_tasks: number | null
          status: "draft" | "active" | "paused" | "completed" | "cancelled" | "archived"
          total_tasks: number | null
          updated_at: string
          visibility: "public" | "private" | "invite_only"
        }
      }
    }
    Functions: {
      can_access_task: {
        Args: {
          task_uuid: string
        }
        Returns: boolean
      }
      current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_project_member: {
        Args: {
          project_uuid: string
          required_roles?: string[]
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}