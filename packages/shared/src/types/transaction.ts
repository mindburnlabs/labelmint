// ============================================================================
// TRANSACTION TYPES
// ============================================================================

import { BaseEntity, PaginationResult } from './common';
import { PaymentCurrency, PaymentStatus, PaymentType } from './payment';

export interface Transaction extends BaseEntity {
  id: string;
  user_id: string;
  from_wallet_id?: string;
  to_wallet_id?: string;
  type: TransactionType;
  amount: number;
  currency: PaymentCurrency;
  status: TransactionStatus;
  blockchain_hash?: string;
  block_number?: number;
  block_hash?: string;
  gas_used?: number;
  gas_price?: number;
  fee_amount?: number;
  description?: string;
  metadata?: Record<string, any>;
  related_entity_type?: 'task' | 'project' | 'user' | 'withdrawal';
  related_entity_id?: string;
  processed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  retry_count?: number;
}

export enum TransactionType {
  TASK_REWARD = 'task_reward',
  BONUS_PAYMENT = 'bonus_payment',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
  REFUND = 'refund',
  PENALTY = 'penalty',
  ADJUSTMENT = 'adjustment',
  FEE = 'fee',
  TRANSFER = 'transfer'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface TransactionCreateData {
  user_id: string;
  from_wallet_id?: string;
  to_wallet_id?: string;
  type: TransactionType;
  amount: number;
  currency: PaymentCurrency;
  description?: string;
  metadata?: Record<string, any>;
  related_entity_type?: 'task' | 'project' | 'user' | 'withdrawal';
  related_entity_id?: string;
}

export interface TransactionUpdateData {
  status?: TransactionStatus;
  blockchain_hash?: string;
  block_number?: number;
  block_hash?: string;
  gas_used?: number;
  gas_price?: number;
  fee_amount?: number;
  processed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  retry_count?: number;
  metadata?: Record<string, any>;
}

export interface TransactionFindOptions {
  user_id?: string;
  from_wallet_id?: string;
  to_wallet_id?: string;
  type?: TransactionType | TransactionType[];
  status?: TransactionStatus | TransactionStatus[];
  currency?: PaymentCurrency;
  amount_min?: number;
  amount_max?: number;
  created_after?: Date;
  created_before?: Date;
  processed_after?: Date;
  processed_before?: Date;
  related_entity_type?: string;
  related_entity_id?: string;
  blockchain_hash?: string;
  block_number?: number;
  search?: string;
}

export interface TransactionBatch extends BaseEntity {
  batch_id: string;
  name: string;
  description?: string;
  transaction_count: number;
  total_amount: number;
  currency: PaymentCurrency;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by: string;
  processed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  metadata?: Record<string, any>;
}

export interface TransactionSummary {
  total_transactions: number;
  total_amount: number;
  amount_by_type: Record<TransactionType, number>;
  amount_by_status: Record<TransactionStatus, number>;
  amount_by_currency: Record<PaymentCurrency, number>;
  successful_transactions: number;
  failed_transactions: number;
  success_rate: number;
  average_transaction_amount: number;
  total_fees_collected: number;
}

export interface UserTransactionSummary {
  user_id: string;
  total_received: number;
  total_sent: number;
  net_balance: number;
  transaction_count: number;
  successful_transactions: number;
  failed_transactions: number;
  last_transaction_date?: Date;
  transactions_by_type: Record<TransactionType, number>;
  transactions_by_currency: Record<PaymentCurrency, number>;
}

export interface TransactionStats {
  period_start: Date;
  period_end: Date;
  total_transactions: number;
  total_volume: number;
  unique_users: number;
  average_transaction_value: number;
  transactions_by_type: Record<TransactionType, number>;
  transactions_by_status: Record<TransactionStatus, number>;
  volume_by_currency: Record<PaymentCurrency, number>;
  daily_breakdown: Array<{
    date: Date;
    transaction_count: number;
    total_volume: number;
    unique_users: number;
  }>;
  processing_metrics: {
    average_processing_time: number;
    success_rate: number;
    failure_reasons: Record<string, number>;
  };
}

export interface TransactionEvent {
  id: string;
  transaction_id: string;
  event_type: 'created' | 'processing_started' | 'completed' | 'failed' | 'cancelled' | 'retry_attempted';
  data: Record<string, any>;
  timestamp: Date;
  actor_id?: string;
  actor_type?: 'system' | 'user' | 'admin';
}

export interface TransactionRetry {
  id: string;
  transaction_id: string;
  attempt_number: number;
  reason: string;
  scheduled_at: Date;
  executed_at?: Date;
  success?: boolean;
  error_message?: string;
  next_retry_at?: Date;
  max_retries: number;
}

export interface TransactionAudit extends BaseEntity {
  transaction_id: string;
  action: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  actor_id: string;
  actor_role: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface TransactionExport {
  format: 'csv' | 'json' | 'xlsx';
  filters: TransactionFindOptions;
  columns: string[];
  date_range?: {
    start: Date;
    end: Date;
  };
  include_metadata?: boolean;
  max_rows?: number;
}

export interface TransactionWebhook {
  id: string;
  url: string;
  events: Array<'created' | 'completed' | 'failed' | 'cancelled'>;
  secret?: string;
  is_active: boolean;
  retry_count: number;
  last_success?: Date;
  last_failure?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionFindResult extends PaginationResult<Transaction> {}
export interface TransactionStatsResult extends TransactionStats {}
export interface TransactionSummaryResult extends TransactionSummary {}

export interface PaymentSystemConfig {
  ton: {
    network: 'mainnet' | 'testnet';
    rpc_url: string;
    contract_address?: string;
    gas_limit: number;
    gas_price?: number;
    confirmation_blocks: number;
    timeout_seconds: number;
  };
  processing: {
    batch_size: number;
    processing_interval: number;
    max_retry_attempts: number;
    retry_backoff_multiplier: number;
    dead_letter_queue_enabled: boolean;
  };
  monitoring: {
    success_rate_threshold: number;
    failure_rate_threshold: number;
  };
  security: {
    max_transaction_amount: number;
    require_verification_for_amount: number;
    rate_limit_per_user: number;
    rate_limit_window: number;
  };
}