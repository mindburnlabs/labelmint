/**
 * Payment Service
 * Handles payment and transaction related API operations
 */

import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { ApiClient } from '../client';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  metadata: {
    taskId?: string;
    projectId?: string;
    paymentMethod?: string;
    externalId?: string;
  };
  createdAt: string;
  processedAt?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  method: WithdrawalMethod;
  destination: string;
  fee: number;
  netAmount: number;
  createdAt: string;
  processedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface PaymentStats {
  totalEarned: number;
  totalWithdrawn: number;
  availableBalance: number;
  pendingWithdrawals: number;
  thisMonth: {
    earned: number;
    withdrawn: number;
  };
  thisWeek: {
    earned: number;
    withdrawn: number;
  };
}

export enum TransactionType {
  EARNING = 'earning',
  WITHDRAWAL = 'withdrawal',
  REFUND = 'refund',
  BONUS = 'bonus',
  PENALTY = 'penalty'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum WithdrawalMethod {
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  CRYPTO = 'crypto',
  STRIPE = 'stripe'
}

export class PaymentService extends BaseService {
  constructor(client: ApiClient) {
    super(client, '/payments');
  }

  /**
   * Get user's payment statistics
   */
  async getStats(): Promise<ApiResponse<PaymentStats>> {
    return this.client.get<PaymentStats>('/payments/stats');
  }

  /**
   * Get user's transactions
   */
  async getTransactions(type?: TransactionType, status?: TransactionStatus, page = 1, limit = 20): Promise<ApiResponse<Transaction[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (type) params.append('type', type);
    if (status) params.append('status', status);

    return this.client.get<Transaction[]>(`/payments/transactions?${params}`);
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<ApiResponse<Transaction>> {
    return this.client.get<Transaction>(`/payments/transactions/${transactionId}`);
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(amount: number, method: WithdrawalMethod, destination: string): Promise<ApiResponse<Withdrawal>> {
    return this.client.post<Withdrawal>('/payments/withdrawals', {
      amount,
      method,
      destination
    });
  }

  /**
   * Get user's withdrawals
   */
  async getWithdrawals(status?: WithdrawalStatus, page = 1, limit = 20): Promise<ApiResponse<Withdrawal[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (status) params.append('status', status);

    return this.client.get<Withdrawal[]>(`/payments/withdrawals?${params}`);
  }

  /**
   * Get withdrawal by ID
   */
  async getWithdrawal(withdrawalId: string): Promise<ApiResponse<Withdrawal>> {
    return this.client.get<Withdrawal>(`/payments/withdrawals/${withdrawalId}`);
  }

  /**
   * Cancel withdrawal request
   */
  async cancelWithdrawal(withdrawalId: string): Promise<ApiResponse<Withdrawal>> {
    return this.client.post<Withdrawal>(`/payments/withdrawals/${withdrawalId}/cancel`);
  }

  /**
   * Get available withdrawal methods
   */
  async getWithdrawalMethods(): Promise<ApiResponse<WithdrawalMethod[]>> {
    return this.client.get<WithdrawalMethod[]>('/payments/withdrawal-methods');
  }

  /**
   * Calculate withdrawal fees
   */
  async calculateFees(amount: number, method: WithdrawalMethod): Promise<ApiResponse<{ fee: number; netAmount: number }>> {
    return this.client.post<{ fee: number; netAmount: number }>('/payments/calculate-fees', {
      amount,
      method
    });
  }

  /**
   * Get payment methods for adding funds (if applicable)
   */
  async getPaymentMethods(): Promise<ApiResponse<any[]>> {
    return this.client.get<any[]>('/payments/methods');
  }

  /**
   * Create payment intent for adding funds
   */
  async createPaymentIntent(amount: number, currency: string = 'USD'): Promise<ApiResponse<{ clientSecret: string }>> {
    return this.client.post<{ clientSecret: string }>('/payments/create-intent', {
      amount,
      currency
    });
  }

  /**
   * Process payment (webhook handler)
   */
  async processPayment(paymentIntentId: string): Promise<ApiResponse<Transaction>> {
    return this.client.post<Transaction>('/payments/process', {
      paymentIntentId
    });
  }

  /**
   * Get earning breakdown by period
   */
  async getEarningsBreakdown(period: 'week' | 'month' | 'year'): Promise<ApiResponse<any>> {
    return this.client.get<any>(`/payments/earnings?period=${period}`);
  }

  /**
   * Download transaction history as CSV
   */
  async downloadTransactionHistory(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${this.client['config'].baseURL}/payments/transactions/export?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to download transaction history');
    }

    return response.blob();
  }
}