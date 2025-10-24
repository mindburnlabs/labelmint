import { Address, beginCell, toNano } from '@ton/core';
import { SendTransactionRequest } from '@tonconnect/ui-react';

export interface WalletBalance {
  ton: string;
  usdt: string;
  jettons?: Record<string, string>;
}

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  tokenType: 'TON' | 'USDT' | 'JETTON';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  description?: string;
}

export interface TonWalletConfig {
  network: 'testnet' | 'mainnet';
  apiKey?: string;
  rpcEndpoint?: string;
}

export class TonWalletService {
  private config: TonWalletConfig;
  private balance: WalletBalance = { ton: '0', usdt: '0' };
  private transactions: Transaction[] = [];
  private listeners: Map<string, Function[]> = new Map();

  constructor(config: TonWalletConfig) {
    this.config = config;
  }

  /**
   * Initialize the TON wallet service
   */
  async initialize(): Promise<void> {
    try {
      await this.fetchBalance();
      await this.fetchTransactions();
      this.startBalancePolling();
    } catch (error) {
      console.error('Failed to initialize TON wallet service:', error);
      throw error;
    }
  }

  /**
   * Get current wallet balance
   */
  getBalance(): WalletBalance {
    return this.balance;
  }

  /**
   * Get transaction history
   */
  getTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Fetch balance from API
   */
  async fetchBalance(): Promise<WalletBalance> {
    try {
      const response = await fetch(`/api/payments/wallet?network=${this.config.network}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }

      const data = await response.json();
      const wallet = data.wallet ?? data.data?.wallet ?? {};
      const balances = wallet.balances ?? {
        ton: data.balance?.ton,
        usdt: data.balance?.usdt,
        jettons: data.balance?.jettons
      };

      const jettons =
        balances?.jettons && typeof balances.jettons === 'object'
          ? Object.fromEntries(
              Object.entries(balances.jettons).map(([key, value]) => [key, this.formatBalanceValue(value)])
            )
          : undefined;

      this.balance = {
        ton: this.formatBalanceValue(balances.ton),
        usdt: this.formatBalanceValue(balances.usdt),
        jettons
      };
      this.emit('balanceUpdated', this.balance);
      return this.balance;
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      throw error;
    }
  }

  /**
   * Fetch transaction history
   */
  async fetchTransactions(): Promise<Transaction[]> {
    try {
      const response = await fetch(`/api/payments/transactions?network=${this.config.network}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const onChain = Array.isArray(data.data?.onChain) ? data.data.onChain : [];
      const internal = Array.isArray(data.data?.internal) ? data.data.internal : [];

      const normalizedOnChain = onChain.map((tx: any) => this.normalizeTransaction(tx));
      const normalizedInternal = internal.map((tx: any) => this.normalizeInternalTransaction(tx));

      this.transactions = [...normalizedOnChain, ...normalizedInternal];
      this.emit('transactionsUpdated', this.transactions);
      return this.transactions;
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      throw error;
    }
  }

  /**
   * Send TON transaction
   */
  async sendTonTransaction(
    toAddress: string,
    amount: string,
    message?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const response = await fetch('/api/payments/transaction/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          toAddress,
          amount,
          tokenType: 'TON',
          message: message || '',
          network: this.config.network
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh balance and transactions
        await Promise.all([
          this.fetchBalance(),
          this.fetchTransactions()
        ]);
      }

      return data;
    } catch (error) {
      console.error('Failed to send TON transaction:', error);
      return { success: false, error: 'Transaction failed' };
    }
  }

  /**
   * Send USDT transaction
   */
  async sendUSDTTransaction(
    toAddress: string,
    amount: string,
    message?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const response = await fetch('/api/payments/transaction/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          toAddress,
          amount: amount,
          tokenType: 'USDT',
          message: message || '',
          network: this.config.network
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh balance and transactions
        await Promise.all([
          this.fetchBalance(),
          this.fetchTransactions()
        ]);
      }

      return data;
    } catch (error) {
      console.error('Failed to send USDT transaction:', error);
      return { success: false, error: 'Transaction failed' };
    }
  }

  /**
   * Create TON Connect transaction request
   */
  createTonConnectTransaction(
    toAddress: string,
    amount: string,
    message?: string
  ): SendTransactionRequest {
    const address = Address.parse(toAddress);
    
    return {
      messages: [
        {
          address: address.toString(),
          amount: toNano(amount),
          payload: message ? beginCell().storeUint(0, 32).storeStringTail(message).endCell() : undefined
        }
      ],
      validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Connect Telegram wallet
   */
  async connectTelegramWallet(): Promise<{ success: boolean; error?: string }> {
    try {
      const webApp = (window as any).Telegram?.WebApp;
      
      if (!webApp) {
        return { success: false, error: 'Telegram WebApp not available' };
      }

      const response = await fetch('/api/payments/wallet/telegram/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          initData: webApp.initData,
          user: webApp.initDataUnsafe?.user
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorPayload.error || 'Failed to connect Telegram wallet'
        };
      }

      const data = await response.json();
      
      if (data.success) {
        await this.fetchBalance();
      }

      return data;
    } catch (error) {
      console.error('Failed to connect Telegram wallet:', error);
      return { success: false, error: 'Connection failed' };
    }
  }

  /**
   * Get wallet address from connected wallet
   */
  getWalletAddress(): string | null {
    // This would be implemented based on the specific wallet connection
    // For now, return null as it depends on the wallet provider
    return null;
  }

  /**
   * Format address for display
   */
  formatAddress(address: string, length: number = 6): string {
    if (address.length <= length * 2) return address;
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: string, decimals: number = 2): string {
    const num = parseFloat(amount);
    return num.toFixed(decimals);
  }

  /**
   * Start polling for balance updates
   */
  private startBalancePolling(): void {
    setInterval(async () => {
      try {
        await this.fetchBalance();
      } catch (error) {
        console.error('Failed to poll balance:', error);
      }
    }, 30000); // Poll every 30 seconds
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const token =
      window.localStorage?.getItem('authToken') ??
      window.localStorage?.getItem('auth_token') ??
      window.localStorage?.getItem('token') ??
      window.sessionStorage?.getItem('authToken') ??
      window.sessionStorage?.getItem('auth_token') ??
      null;

    return token || '';
  }

  private formatBalanceValue(value: unknown): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      return (value as { toString(): string }).toString();
    }
    return '0';
  }

  private normalizeTransaction(tx: any): Transaction {
    return {
      id: (tx.id ?? tx.transactionId ?? tx.txHash ?? this.generateId('tx')).toString(),
      hash: (tx.txHash ?? tx.hash ?? tx.id ?? '').toString(),
      from: tx.from ?? tx.fromAddress ?? tx.sender ?? '',
      to: tx.to ?? tx.toAddress ?? tx.recipient ?? '',
      amount: this.formatBalanceValue(tx.amount),
      tokenType: (tx.tokenType ?? tx.currency ?? 'TON').toUpperCase() as 'TON' | 'USDT' | 'JETTON',
      status: (tx.status ?? tx.state ?? 'confirmed') as 'pending' | 'confirmed' | 'failed',
      timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date(),
      description: tx.description ?? tx.memo
    };
  }

  private normalizeInternalTransaction(tx: any): Transaction {
    return {
      id: `internal_${tx.id ?? tx.transfer_id ?? this.generateId('internal')}`,
      hash: tx.tx_hash?.toString() ?? '',
      from: tx.from_user_id?.toString() ?? '',
      to: tx.to_user_id?.toString() ?? '',
      amount: this.formatBalanceValue(tx.amount),
      tokenType: 'TON',
      status: 'confirmed',
      timestamp: tx.created_at ? new Date(tx.created_at) : new Date(),
      description: tx.description ?? 'Internal transfer'
    };
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}_${(crypto as Crypto).randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Event emitter methods
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.clear();
  }
}

// Default export for convenience
let defaultTonWalletService: TonWalletService | null = null;

export function initializeTonWalletService(config: TonWalletConfig): TonWalletService {
  defaultTonWalletService = new TonWalletService(config);
  return defaultTonWalletService;
}

export function getTonWalletService(): TonWalletService {
  if (!defaultTonWalletService) {
    throw new Error('TonWalletService not initialized. Call initializeTonWalletService first.');
  }
  return defaultTonWalletService;
}

export default TonWalletService;
