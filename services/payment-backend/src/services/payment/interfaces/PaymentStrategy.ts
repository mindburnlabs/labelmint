import { Address } from '@ton/core';

export interface Transaction {
  hash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenType: 'TON' | 'USDT';
  fee: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  message?: string;
}

export interface PaymentStrategy {
  /**
   * Deposit funds to a wallet
   */
  deposit(amount: number, address?: string): Promise<Transaction>;

  /**
   * Withdraw funds from a wallet
   */
  withdraw(amount: number, address: string): Promise<Transaction>;

  /**
   * Get current balance
   */
  getBalance(address: string): Promise<number>;

  /**
   * Get transaction history
   */
  getTransactionHistory(address: string, limit?: number): Promise<Transaction[]>;

  /**
   * Validate if address is correct for this payment type
   */
  validateAddress(address: string): boolean;

  /**
   * Estimate transaction fee
   */
  estimateFee(fromAddress: string, toAddress: string, amount: number): Promise<number>;

  /**
   * Check transaction status
   */
  checkTransactionStatus(txHash: string): Promise<Transaction>;

  /**
   * Get payment type identifier
   */
  getPaymentType(): PaymentType;
}

export type PaymentType = 'TON' | 'USDT' | 'PAYMENT_CHANNEL';

export interface PaymentResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  errorCode?: string;
}

export interface TransferOptions {
  message?: string;
  fee?: number;
  timeout?: number;
  skipValidation?: boolean;
}

export interface BalanceInfo {
  address: string;
  tokenType: 'TON' | 'USDT';
  balance: number;
  lastUpdated: Date;
  pendingTransactions: number;
}

export interface PaymentConfig {
  network: 'mainnet' | 'testnet';
  timeoutMs: number;
  maxRetries: number;
  feeMultiplier: number;
}