import { TonClient, Address, beginCell, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { query, getClient } from '../database/connection.js';

interface ChannelConfig {
  channelId: string;
  platformAddress: Address;
  workerAddress: Address;
  balance: {
    platform: number;
    worker: number;
  };
  status: 'initiating' | 'active' | 'closing' | 'closed' | 'challenged';
  sequence: number;
  lastUpdate: Date;
  settleThreshold: number;
  autoSettle: boolean;
  settleInterval: 'hourly' | 'daily' | 'weekly';
}

interface OffchainTransaction {
  id: string;
  channelId: string;
  from: Address;
  to: Address;
  amount: number;
  sequence: number;
  timestamp: Date;
  type: 'payment' | 'deposit' | 'withdrawal';
  taskId?: string;
  metadata?: any;
  signature?: string;
}

export class PaymentChannelManager {
  private tonClient: TonClient;
  private platformKeyPair: any;
  private channels: Map<string, ChannelConfig> = new Map();
  private pendingTransactions: Map<string, OffchainTransaction[]> = new Map();
  private channelContracts: Map<string, Address> = new Map();

  constructor() {
    this.tonClient = new TonClient({
      endpoint: process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });

    // Initialize platform key pair from environment
    this.initializePlatformKeys();
  }

  private async initializePlatformKeys() {
    const mnemonic = process.env.PLATFORM_MNEMONIC;
    if (!mnemonic) {
      throw new Error('PLATFORM_MNEMONIC not configured');
    }

    this.platformKeyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
  }

  /**
   * Create a new payment channel with a worker
   */
  async createChannel(workerAddress: string | Address, initialDeposit: number = 10): Promise<{
    channelId: string;
    contractAddress: Address;
    success: boolean;
  }> {
    try {
      const workerAddr = typeof workerAddress === 'string'
        ? Address.parse(workerAddress)
        : workerAddress;

      const channelId = `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create channel configuration
      const config: ChannelConfig = {
        channelId,
        platformAddress: Address.parse(process.env.PLATFORM_ADDRESS!),
        workerAddress: workerAddr,
        balance: {
          platform: initialDeposit,
          worker: 0
        },
        status: 'initiating',
        sequence: 0,
        lastUpdate: new Date(),
        settleThreshold: 100, // Auto-settle after 100 transactions
        autoSettle: true,
        settleInterval: 'daily'
      };

      // Deploy channel contract
      const contractAddress = await this.deployChannelContract(config);

      // Save channel to database
      await this.saveChannelToDB(config, contractAddress);

      // Initialize channel on-chain
      await this.initializeChannelOnChain(contractAddress, initialDeposit);

      config.status = 'active';
      this.channels.set(channelId, config);
      this.channelContracts.set(channelId, contractAddress);
      this.pendingTransactions.set(channelId, []);

      return {
        channelId,
        contractAddress,
        success: true
      };
    } catch (error) {
      console.error('Failed to create channel:', error);
      return {
        channelId: '',
        contractAddress: new Address(),
        success: false
      };
    }
  }

  /**
   * Process off-chain payment (zero fee)
   */
  async processOffchainPayment(
    channelId: string,
    fromAddress: Address,
    toAddress: Address,
    amount: number,
    taskId?: string,
    metadata?: any
  ): Promise<{
    success: boolean;
    transactionId: string;
    error?: string;
  }> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (channel.status !== 'active') {
        throw new Error('Channel is not active');
      }

      const transaction: OffchainTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        channelId,
        from: fromAddress,
        to: toAddress,
        amount,
        sequence: channel.sequence + 1,
        timestamp: new Date(),
        type: 'payment',
        taskId,
        metadata
      };

      // Sign transaction with platform key
      const signature = await this.signTransaction(transaction);
      transaction.signature = signature;

      // Update balances off-chain
      const isPlatformToWorker = fromAddress.equals(channel.platformAddress);

      if (isPlatformToWorker) {
        if (channel.balance.platform < amount) {
          throw new Error('Insufficient platform balance');
        }
        channel.balance.platform -= amount;
        channel.balance.worker += amount;
      } else {
        if (channel.balance.worker < amount) {
          throw new Error('Insufficient worker balance');
        }
        channel.balance.worker -= amount;
        channel.balance.platform += amount;
      }

      channel.sequence++;
      channel.lastUpdate = new Date();

      // Store transaction
      const pending = this.pendingTransactions.get(channelId) || [];
      pending.push(transaction);
      this.pendingTransactions.set(channelId, pending);

      // Save to database
      await this.saveTransactionToDB(transaction);
      await this.updateChannelInDB(channel);

      // Check if settlement is needed
      if (this.shouldSettle(channel)) {
        await this.settleChannel(channelId);
      }

      return {
        success: true,
        transactionId: transaction.id
      };
    } catch (error: any) {
      console.error('Off-chain payment failed:', error);
      return {
        success: false,
        transactionId: '',
        error: error.message
      };
    }
  }

  /**
   * Worker instant withdrawal using channel balance
   */
  async workerInstantWithdrawal(
    channelId: string,
    workerId: number,
    amount: number,
    destinationAddress?: string
  ): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        // Check if worker has an active channel
        const workerChannel = await this.getWorkerChannel(workerId);
        if (!workerChannel) {
          return {
            success: false,
            error: 'No active payment channel found'
          };
        }
        channel = workerChannel;
      }

      const withdrawAddress = destinationAddress
        ? Address.parse(destinationAddress)
        : channel.workerAddress;

      if (channel.balance.worker < amount) {
        return {
          success: false,
          error: 'Insufficient balance'
        };
      }

      // Process off-chain withdrawal
      const result = await this.processOffchainPayment(
        channel.channelId,
        channel.workerAddress,
        withdrawAddress,
        amount,
        undefined,
        { type: 'withdrawal', workerId }
      );

      if (result.success) {
        // Trigger immediate settlement for withdrawals
        await this.settleChannel(channel.channelId);
      }

      return result;
    } catch (error: any) {
      console.error('Instant withdrawal failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch settle pending transactions
   */
  async settleChannel(channelId: string): Promise<{
    success: boolean;
    txHash?: string;
    settledCount?: number;
    totalAmount?: number;
    error?: string;
  }> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      const pending = this.pendingTransactions.get(channelId) || [];
      if (pending.length === 0) {
        return { success: true, settledCount: 0, totalAmount: 0 };
      }

      const contractAddress = this.channelContracts.get(channelId);
      if (!contractAddress) {
        throw new Error('Contract address not found');
      }

      // Calculate total amounts
      let platformTotal = 0;
      let workerTotal = 0;

      pending.forEach(tx => {
        if (tx.from.equals(channel.platformAddress)) {
          platformTotal += tx.amount;
        } else {
          workerTotal += tx.amount;
        }
      });

      // Create settlement transaction
      const settlementBody = beginCell()
        .storeUint(2, 32) // Settlement operation
        .storeUint(channel.balance.platform, 256)
        .storeUint(channel.balance.worker, 256)
        .endCell();

      // Execute on-chain settlement
      const result = await this.tonClient.provider.internal(contractAddress, {
        body: settlementBody,
        value: toNano('0.05') // Small fee for settlement
      });

      // Update channel status
      channel.status = 'active';
      channel.lastUpdate = new Date();

      // Clear pending transactions
      this.pendingTransactions.set(channelId, []);

      // Update database
      await this.updateChannelInDB(channel);
      await this.markTransactionsAsSettled(channelId, pending);

      return {
        success: true,
        txHash: result.toString(),
        settledCount: pending.length,
        totalAmount: platformTotal + workerTotal
      };
    } catch (error: any) {
      console.error('Channel settlement failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Auto-settle all channels based on their configuration
   */
  async autoSettleAll(): Promise<{
    totalSettled: number;
    totalAmount: number;
    errors: string[];
  }> {
    let totalSettled = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    for (const [channelId, channel] of this.channels) {
      if (this.shouldAutoSettle(channel)) {
        try {
          const result = await this.settleChannel(channelId);
          if (result.success) {
            totalSettled++;
            totalAmount += result.totalAmount || 0;
          } else {
            errors.push(`Channel ${channelId}: ${result.error}`);
          }
        } catch (error: any) {
          errors.push(`Channel ${channelId}: ${error.message}`);
        }
      }
    }

    return { totalSettled, totalAmount, errors };
  }

  /**
   * Check if channel should be settled
   */
  private shouldSettle(channel: ChannelConfig): boolean {
    if (!channel.autoSettle || channel.status !== 'active') {
      return false;
    }

    // Check transaction count threshold
    const pending = this.pendingTransactions.get(channel.channelId) || [];
    if (pending.length >= channel.settleThreshold) {
      return true;
    }

    // Check time-based settlement
    const now = new Date();
    const lastUpdate = channel.lastUpdate;

    let timeThreshold: Date;
    switch (channel.settleInterval) {
      case 'hourly':
        timeThreshold = new Date(lastUpdate.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        timeThreshold = new Date(lastUpdate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        timeThreshold = new Date(lastUpdate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return false;
    }

    return now >= timeThreshold;
  }

  /**
   * Check if channel should be auto-settled
   */
  private shouldAutoSettle(channel: ChannelConfig): boolean {
    if (!channel.autoSettle || channel.status !== 'active') {
      return false;
    }

    const pending = this.pendingTransactions.get(channel.channelId) || [];

    // Settle if threshold reached
    if (pending.length >= channel.settleThreshold) {
      return true;
    }

    // Settle based on time interval
    const now = new Date();
    const lastUpdate = channel.lastUpdate;

    switch (channel.settleInterval) {
      case 'hourly':
        return now.getTime() - lastUpdate.getTime() >= 60 * 60 * 1000;
      case 'daily':
        return now.getTime() - lastUpdate.getTime() >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return now.getTime() - lastUpdate.getTime() >= 7 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  /**
   * Get worker's active channel
   */
  async getWorkerChannel(workerId: number): Promise<ChannelConfig | null> {
    try {
      const result = await query(
        `SELECT * FROM payment_channels
         WHERE worker_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [workerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        channelId: row.channel_id,
        platformAddress: Address.parse(row.platform_address),
        workerAddress: Address.parse(row.worker_address),
        balance: {
          platform: parseFloat(row.platform_balance),
          worker: parseFloat(row.worker_balance)
        },
        status: row.status,
        sequence: row.sequence,
        lastUpdate: row.last_update,
        settleThreshold: row.settle_threshold,
        autoSettle: row.auto_settle,
        settleInterval: row.settle_interval
      };
    } catch (error) {
      console.error('Failed to get worker channel:', error);
      return null;
    }
  }

  /**
   * Deploy channel contract
   */
  private async deployChannelContract(config: ChannelConfig): Promise<Address> {
    // In production, this would deploy the actual smart contract
    // For now, return a mock address
    return Address.parse(`EQD${Math.random().toString(36).substr(2, 64)}`);
  }

  /**
   * Initialize channel on-chain
   */
  private async initializeChannelOnChain(
    contractAddress: Address,
    initialDeposit: number
  ): Promise<void> {
    // Send initial deposit to channel contract
    // This would be implemented with actual TON transactions
    console.log(`Initializing channel ${contractAddress} with ${initialDeposit} USDT`);
  }

  /**
   * Sign transaction with platform key
   */
  private async signTransaction(transaction: OffchainTransaction): Promise<string> {
    // Create message to sign
    const message = beginCell()
      .storeUint(3, 32) // Off-chain transfer op
      .storeUint(transaction.amount, 256)
      .storeAddress(transaction.from)
      .storeAddress(transaction.to)
      .storeUint(transaction.sequence, 64)
      .endCell();

    // Sign with platform key
    // This would use actual cryptographic signing
    return `signature_${message.hash().toString()}`;
  }

  /**
   * Save channel to database
   */
  private async saveChannelToDB(config: ChannelConfig, contractAddress: Address): Promise<void> {
    await query(
      `INSERT INTO payment_channels
       (channel_id, platform_address, worker_address, platform_balance,
        worker_balance, status, sequence, last_update, settle_threshold,
        auto_settle, settle_interval, contract_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (channel_id) DO UPDATE SET
       platform_balance = EXCLUDED.platform_balance,
       worker_balance = EXCLUDED.worker_balance,
       status = EXCLUDED.status,
       sequence = EXCLUDED.sequence,
       last_update = EXCLUDED.last_update`,
      [
        config.channelId,
        config.platformAddress.toString(),
        config.workerAddress.toString(),
        config.balance.platform,
        config.balance.worker,
        config.status,
        config.sequence,
        config.lastUpdate,
        config.settleThreshold,
        config.autoSettle,
        config.settleInterval,
        contractAddress.toString()
      ]
    );
  }

  /**
   * Update channel in database
   */
  private async updateChannelInDB(config: ChannelConfig): Promise<void> {
    await query(
      `UPDATE payment_channels
       SET platform_balance = $1, worker_balance = $2, status = $3,
           sequence = $4, last_update = $5
       WHERE channel_id = $6`,
      [
        config.balance.platform,
        config.balance.worker,
        config.status,
        config.sequence,
        config.lastUpdate,
        config.channelId
      ]
    );
  }

  /**
   * Save transaction to database
   */
  private async saveTransactionToDB(transaction: OffchainTransaction): Promise<void> {
    await query(
      `INSERT INTO offchain_transactions
       (transaction_id, channel_id, from_address, to_address, amount,
        sequence, timestamp, type, task_id, metadata, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        transaction.id,
        transaction.channelId,
        transaction.from.toString(),
        transaction.to.toString(),
        transaction.amount,
        transaction.sequence,
        transaction.timestamp,
        transaction.type,
        transaction.taskId,
        JSON.stringify(transaction.metadata),
        transaction.signature
      ]
    );
  }

  /**
   * Mark transactions as settled
   */
  private async markTransactionsAsSettled(
    channelId: string,
    transactions: OffchainTransaction[]
  ): Promise<void> {
    const ids = transactions.map(t => t.id);
    await query(
      `UPDATE offchain_transactions
       SET status = 'settled', settled_at = NOW()
       WHERE transaction_id = ANY($1)`,
      [ids]
    );
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId: string): Promise<{
    totalTransactions: number;
    totalVolume: number;
    pendingCount: number;
    efficiency: number;
  }> {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COALESCE(SUM(amount), 0) as volume,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
       FROM offchain_transactions
       WHERE channel_id = $1`,
      [channelId]
    );

    const row = result.rows[0];
    const totalTransactions = parseInt(row.total);
    const totalVolume = parseFloat(row.volume);
    const pendingCount = parseInt(row.pending);

    // Calculate efficiency (saved fees)
    const estimatedOnChainFees = totalTransactions * 0.001; // 0.001 USDT per tx
    const actualFees = totalVolume * 0.05; // 5% platform fee
    const savedFees = estimatedOnChainFees;
    const efficiency = savedFees / (savedFees + actualFees) * 100;

    return {
      totalTransactions,
      totalVolume,
      pendingCount,
      efficiency
    };
  }
}

// Export singleton instance
export const paymentChannelManager = new PaymentChannelManager();