// ============================================================================
// PAYMENT TYPES
// ============================================================================

import { BaseEntity } from './common';

export enum PaymentCurrency {
  TON = 'TON',
  USDT = 'USDT',
  USD = 'USD'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentType {
  TASK_REWARD = 'task_reward',
  BONUS = 'bonus',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
  REFUND = 'refund',
  PENALTY = 'penalty'
}

export interface Wallet extends BaseEntity {
  user_id: string;
  address: string;
  currency: PaymentCurrency;
  balance: number;
  is_primary: boolean;
  is_active: boolean;
  last_used_at?: Date;
  metadata?: Record<string, any>;
}

export interface Payment extends BaseEntity {
  user_id: string;
  wallet_id: string;
  type: PaymentType;
  amount: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  transaction_hash?: string;
  from_address?: string;
  to_address?: string;
  gas_used?: number;
  gas_price?: number;
  block_number?: number;
  block_hash?: string;
  description?: string;
  metadata?: Record<string, any>;
  task_id?: string;
  project_id?: string;
  batch_id?: string;
  processed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
}

export interface WithdrawalRequest extends BaseEntity {
  user_id: string;
  wallet_id: string;
  amount: number;
  currency: PaymentCurrency;
  to_address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  transaction_hash?: string;
  gas_estimate?: number;
  fee_amount?: number;
  processing_fee?: number;
  net_amount?: number;
  notes?: string;
  processed_at?: Date;
  processed_by?: string;
  failed_at?: Date;
  failure_reason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentMethod extends BaseEntity {
  user_id: string;
  type: 'ton_wallet' | 'bank_account' | 'crypto_wallet';
  identifier: string;
  currency: PaymentCurrency;
  is_verified: boolean;
  is_default: boolean;
  verification_data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Invoice extends BaseEntity {
  user_id: string;
  project_id?: string;
  type: PaymentType;
  amount: number;
  currency: PaymentCurrency;
  description: string;
  due_date?: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  line_items: InvoiceLineItem[];
  tax_amount?: number;
  total_amount: number;
  paid_amount?: number;
  paid_at?: Date;
  metadata?: Record<string, any>;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  task_id?: string;
  metadata?: Record<string, any>;
}

export interface PaymentStats {
  total_payments: number;
  total_volume: number;
  volume_by_currency: Record<PaymentCurrency, number>;
  payments_by_type: Record<PaymentType, number>;
  payments_by_status: Record<PaymentStatus, number>;
  average_payment_amount: number;
  successful_payments: number;
  failed_payments: number;
  success_rate: number;
  total_withdrawals: number;
  pending_withdrawals: number;
  total_fees_collected: number;
}

export interface UserPaymentStats {
  user_id: string;
  total_earned: number;
  total_withdrawn: number;
  current_balance: number;
  pending_payments: number;
  completed_tasks: number;
  average_earning_per_task: number;
  last_payment_date?: Date;
  payment_method: PaymentCurrency;
  earnings_by_period: Array<{
    period: string;
    amount: number;
    tasks: number;
  }>;
}

export interface PaymentConfig {
  ton: {
    network: 'mainnet' | 'testnet';
    rpc_url: string;
    gas_limit: number;
    gas_price?: number;
    fee_address?: string;
    minimum_withdrawal: number;
    withdrawal_fee: number;
  };
  usdt: {
    network: 'mainnet' | 'testnet';
    contract_address: string;
    rpc_url: string;
    gas_limit: number;
    gas_price?: number;
    fee_address?: string;
    minimum_withdrawal: number;
    withdrawal_fee: number;
  };
  processing: {
    auto_process_threshold: number;
    batch_processing_interval: number;
    max_retry_attempts: number;
    failure_cooldown: number;
  };
  security: {
    require_2fa_for_withdrawals: boolean;
    max_withdrawal_per_day: number;
    max_withdrawal_per_transaction: number;
    require_verification_for_amount: number;
  };
}

export interface PaymentWebhook {
  id: string;
  type: 'payment.completed' | 'payment.failed' | 'withdrawal.requested' | 'withdrawal.completed';
  data: any;
  timestamp: Date;
  processed: boolean;
  attempts: number;
  last_attempt?: Date;
}

export interface PaymentAudit extends BaseEntity {
  payment_id: string;
  action: 'created' | 'processed' | 'failed' | 'refunded' | 'cancelled';
  old_status?: PaymentStatus;
  new_status?: PaymentStatus;
  actor_id: string;
  actor_role: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface PaymentFindOptions {
  user_id?: string;
  wallet_id?: string;
  type?: PaymentType | PaymentType[];
  status?: PaymentStatus | PaymentStatus[];
  currency?: PaymentCurrency;
  amount_min?: number;
  amount_max?: number;
  created_after?: Date;
  created_before?: Date;
  task_id?: string;
  project_id?: string;
  transaction_hash?: string;
}

export interface WithdrawalFindOptions {
  user_id?: string;
  status?: string[];
  currency?: PaymentCurrency;
  amount_min?: number;
  amount_max?: number;
  created_after?: Date;
  created_before?: Date;
}