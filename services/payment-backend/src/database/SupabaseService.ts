import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { Logger } from '../../utils/logger';

const logger = new Logger('SupabaseService');

export class SupabaseService {
  private static instance: SupabaseService;
  private supabase: SupabaseClient<Database>;
  private supabaseAdmin: SupabaseClient<Database>;
  private connected = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private initialize() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
      }

      // Public client for user operations
      this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      });

      // Service role client for admin operations
      if (supabaseServiceKey) {
        this.supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
      }

      this.connected = true;
      logger.info('Supabase initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Supabase', error);
      this.connected = false;
    }
  }

  /**
   * Get public Supabase client
   */
  getClient(): SupabaseClient<Database> {
    if (!this.connected) {
      throw new Error('Supabase not connected');
    }
    return this.supabase;
  }

  /**
   * Get admin Supabase client
   */
  getAdminClient(): SupabaseClient<Database> {
    if (!this.connected || !this.supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return this.supabaseAdmin;
  }

  /**
   * Create user profile
   */
  async createUserProfile(userData: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash?: string;
    authProvider?: 'EMAIL' | 'GOOGLE' | 'GITHUB';
  }) {
    const { data, error } = await this.supabaseAdmin.rpc('create_user_with_profile', {
      p_email: userData.email,
      p_first_name: userData.firstName,
      p_last_name: userData.lastName,
      p_password_hash: userData.passwordHash,
      p_auth_provider: userData.authProvider || 'EMAIL'
    });

    if (error) {
      logger.error('Failed to create user profile', error);
      throw error;
    }

    return data;
  }

  /**
   * Create wallet for user
   */
  async createUserWallet(walletData: {
    userId: string;
    network: 'mainnet' | 'testnet';
    version: 'v3R2' | 'v4R2' | 'telegram';
    address: string;
    publicKey: string;
    mnemonicEncrypted?: string;
  }) {
    const { data, error } = await this.supabaseAdmin.rpc('create_user_wallet', {
      p_user_id: walletData.userId,
      p_network: walletData.network,
      p_version: walletData.version,
      p_address: walletData.address,
      p_public_key: walletData.publicKey,
      p_mnemonic_encrypted: walletData.mnemonicEncrypted
    });

    if (error) {
      logger.error('Failed to create user wallet', error);
      throw error;
    }

    return data;
  }

  /**
   * Record transaction
   */
  async recordTransaction(transactionData: {
    fromWalletId?: string;
    toWalletId?: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    tokenType?: 'TON' | 'USDT';
    transactionType?: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'refund' | 'fee';
    message?: string;
    categoryId?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabaseAdmin.rpc('record_transaction', {
      p_from_wallet_id: transactionData.fromWalletId,
      p_to_wallet_id: transactionData.toWalletId,
      p_from_address: transactionData.fromAddress,
      p_to_address: transactionData.toAddress,
      p_amount: transactionData.amount,
      p_token_type: transactionData.tokenType || 'TON',
      p_transaction_type: transactionData.transactionType || 'transfer',
      p_message: transactionData.message,
      p_category_id: transactionData.categoryId,
      p_metadata: transactionData.metadata || {}
    });

    if (error) {
      logger.error('Failed to record transaction', error);
      throw error;
    }

    return data;
  }

  /**
   * Update wallet balance
   */
  async updateWalletBalance(
    walletId: string,
    newBalance: number,
    usdtBalance?: number
  ) {
    const { error } = await this.supabaseAdmin.rpc('update_wallet_balance', {
      p_wallet_id: walletId,
      p_new_balance: newBalance,
      p_usdt_balance: usdtBalance
    });

    if (error) {
      logger.error('Failed to update wallet balance', error);
      throw error;
    }

    return true;
  }

  /**
   * Get user transaction history
   */
  async getUserTransactions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'refund' | 'fee';
    } = {}
  ) {
    const { data, error } = await this.supabaseAdmin.rpc('get_user_transactions', {
      p_user_id: userId,
      p_limit: options.limit || 50,
      p_offset: options.offset || 0,
      p_status: options.status
    });

    if (error) {
      logger.error('Failed to get user transactions', error);
      throw error;
    }

    return data;
  }

  /**
   * Validate transaction
   */
  async validateTransaction(
    walletId: string,
    amount: number,
    tokenType: 'TON' | 'USDT' = 'TON'
  ) {
    const { data, error } = await this.supabase.rpc('validate_transaction', {
      p_wallet_id: walletId,
      p_amount: amount,
      p_token_type: tokenType
    });

    if (error) {
      logger.error('Failed to validate transaction', error);
      throw error;
    }

    return data;
  }

  /**
   * Get wallet statistics
   */
  async getWalletStatistics(walletId: string) {
    const { data, error } = await this.supabase.rpc('get_wallet_statistics', {
      p_wallet_id: walletId
    });

    if (error) {
      logger.error('Failed to get wallet statistics', error);
      throw error;
    }

    return data;
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowMinutes: number = 15
  ) {
    const { data, error } = await this.supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_limit: limit,
      p_window_minutes: windowMinutes
    });

    if (error) {
      logger.error('Failed to check rate limit', error);
      return true; // Fail open
    }

    return data;
  }

  /**
   * Real-time subscription to wallet changes
   */
  subscribeToWalletUpdates(walletId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`wallet-${walletId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_wallets',
          filter: `id=eq.${walletId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Real-time subscription to transactions
   */
  subscribeToTransactions(
    walletIds: string[],
    callback: (payload: any) => void
  ) {
    const filter = walletIds.map(id => `from_wallet_id=eq.${id},to_wallet_id=eq.${id}`).join(',');

    return this.supabase
      .channel('transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter
        },
        callback
      )
      .subscribe();
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions() {
    const { data, error } = await this.supabaseAdmin.rpc('cleanup_old_sessions');

    if (error) {
      logger.error('Failed to cleanup old sessions', error);
      return 0;
    }

    return data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectionCount: 1
      };
    } catch (error) {
      logger.error('Supabase health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('transaction_categories')
        .select('count', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      logger.info('Supabase connection test successful');
      return true;
    } catch (error) {
      logger.error('Supabase connection test failed', error);
      return false;
    }
  }
}

export default SupabaseService.getInstance();