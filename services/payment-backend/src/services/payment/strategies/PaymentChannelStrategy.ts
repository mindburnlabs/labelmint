import { PaymentStrategy, Transaction, PaymentType, PaymentResult, TransferOptions, PaymentConfig } from '../interfaces/PaymentStrategy';
import { postgresDb } from '../../../../database';
import { Logger } from '../../../../utils/logger';

const logger = new Logger('PaymentChannelStrategy');

export interface PaymentChannel {
  id: string;
  participant1: string;
  participant2: string;
  capacity: number;
  balance1: number;
  balance2: number;
  status: 'opening' | 'open' | 'closing' | 'closed';
  created_at: Date;
  last_update: Date;
}

export interface ChannelState {
  channel: PaymentChannel;
  sequence: number;
  signatures: {
    participant1?: string;
    participant2?: string;
  };
}

export class PaymentChannelStrategy implements PaymentStrategy {
  private config: PaymentConfig;
  private activeChannels: Map<string, PaymentChannel> = new Map();

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  /**
   * Initialize strategy
   */
  async initialize(): Promise<void> {
    // Load active channels from database
    await this.loadActiveChannels();
    logger.info(`PaymentChannelStrategy initialized with ${this.activeChannels.size} active channels`);
  }

  /**
   * Open a new payment channel
   */
  async openChannel(
    participant1: string,
    participant2: string,
    capacity: number
  ): Promise<PaymentChannel> {
    const channelId = this.generateChannelId();

    const channel: PaymentChannel = {
      id: channelId,
      participant1,
      participant2,
      capacity,
      balance1: capacity / 2,
      balance2: capacity / 2,
      status: 'opening',
      created_at: new Date(),
      last_update: new Date()
    };

    // Save to database
    await this.saveChannel(channel);
    this.activeChannels.set(channelId, channel);

    logger.info(`Opened payment channel: ${channelId} between ${participant1} and ${participant2}`);

    return channel;
  }

  /**
   * Deposit to payment channel
   */
  async deposit(amount: number, channelId?: string): Promise<Transaction> {
    if (!channelId) {
      throw new Error('Channel ID required for payment channel deposit');
    }

    const channel = this.activeChannels.get(channelId);
    if (!channel) {
      throw new Error('Payment channel not found');
    }

    const transaction: Transaction = {
      hash: this.generateTxHash(),
      fromAddress: 'SYSTEM',
      toAddress: channelId,
      amount: amount.toString(),
      tokenType: 'PAYMENT_CHANNEL',
      fee: '0', // Channel deposits are off-chain
      timestamp: new Date(),
      status: 'confirmed',
      message: `Channel deposit of ${amount}`
    };

    // Update channel balance
    channel.balance1 += amount;
    channel.last_update = new Date();
    await this.saveChannel(channel);

    await this.recordChannelTransaction(transaction);

    return transaction;
  }

  /**
   * Withdraw from payment channel
   */
  async withdraw(amount: number, address: string): Promise<Transaction> {
    // Find channel where address is participant
    const channel = Array.from(this.activeChannels.values()).find(
      c => c.participant1 === address || c.participant2 === address
    );

    if (!channel) {
      throw new Error('No active payment channel found for address');
    }

    const isParticipant1 = channel.participant1 === address;
    const currentBalance = isParticipant1 ? channel.balance1 : channel.balance2;

    if (currentBalance < amount) {
      throw new Error('Insufficient channel balance');
    }

    const transaction: Transaction = {
      hash: this.generateTxHash(),
      fromAddress: channel.id,
      toAddress: address,
      amount: amount.toString(),
      tokenType: 'PAYMENT_CHANNEL',
      fee: '0', // Channel withdrawals are off-chain
      timestamp: new Date(),
      status: 'confirmed',
      message: `Channel withdrawal of ${amount}`
    };

    // Update channel balance
    if (isParticipant1) {
      channel.balance1 -= amount;
    } else {
      channel.balance2 -= amount;
    }
    channel.last_update = new Date();
    await this.saveChannel(channel);

    await this.recordChannelTransaction(transaction);

    return transaction;
  }

  /**
   * Transfer through payment channel
   */
  async transferThroughChannel(
    fromAddress: string,
    toAddress: string,
    amount: number,
    channelId?: string
  ): Promise<Transaction> {
    let channel: PaymentChannel;

    if (channelId) {
      channel = this.activeChannels.get(channelId)!;
    } else {
      // Find channel connecting the two addresses
      channel = Array.from(this.activeChannels.values()).find(
        c => (c.participant1 === fromAddress && c.participant2 === toAddress) ||
             (c.participant1 === toAddress && c.participant2 === fromAddress)
      )!;
    }

    if (!channel) {
      throw new Error('No payment channel found between participants');
    }

    const isFromParticipant1 = channel.participant1 === fromAddress;

    if (isFromParticipant1 && channel.balance1 < amount) {
      throw new Error('Insufficient balance in channel');
    } else if (!isFromParticipant1 && channel.balance2 < amount) {
      throw new Error('Insufficient balance in channel');
    }

    // Update balances
    if (isFromParticipant1) {
      channel.balance1 -= amount;
      channel.balance2 += amount;
    } else {
      channel.balance2 -= amount;
      channel.balance1 += amount;
    }

    channel.last_update = new Date();
    await this.saveChannel(channel);

    const transaction: Transaction = {
      hash: this.generateTxHash(),
      fromAddress,
      toAddress,
      amount: amount.toString(),
      tokenType: 'PAYMENT_CHANNEL',
      fee: '0', // Off-chain transfer
      timestamp: new Date(),
      status: 'confirmed',
      message: `Channel transfer through ${channel.id}`
    };

    await this.recordChannelTransaction(transaction);

    return transaction;
  }

  /**
   * Get balance in payment channels
   */
  async getBalance(address: string): Promise<number> {
    let totalBalance = 0;

    for (const channel of this.activeChannels.values()) {
      if (channel.participant1 === address) {
        totalBalance += channel.balance1;
      } else if (channel.participant2 === address) {
        totalBalance += channel.balance2;
      }
    }

    return totalBalance;
  }

  /**
   * Get transaction history for payment channels
   */
  async getTransactionHistory(address: string, limit: number = 50): Promise<Transaction[]> {
    const query = `
      SELECT * FROM channel_transactions
      WHERE from_address = $1 OR to_address = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    try {
      const result = await postgresDb.query(query, [address, limit]);

      return result.rows.map(row => ({
        hash: row.hash,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: row.amount,
        tokenType: 'PAYMENT_CHANNEL',
        fee: row.fee || 0,
        timestamp: row.timestamp,
        status: row.status,
        message: row.message
      }));
    } catch (error) {
      logger.error('Failed to get channel transaction history:', error);
      return [];
    }
  }

  /**
   * Validate address for payment channel
   */
  validateAddress(address: string): boolean {
    // Payment channels use TON addresses
    try {
      return address.startsWith('EQ') || address.startsWith('0Q');
    } catch {
      return false;
    }
  }

  /**
   * Estimate fee (zero for off-chain transfers)
   */
  async estimateFee(fromAddress: string, toAddress: string, amount: number): Promise<number> {
    // Payment channel transfers are off-chain and have zero fee
    // However, opening/closing channels has fees
    return 0;
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(txHash: string): Promise<Transaction> {
    const query = `
      SELECT * FROM channel_transactions
      WHERE hash = $1
    `;

    try {
      const result = await postgresDb.query(query, [txHash]);

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const row = result.rows[0];
      return {
        hash: row.hash,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: row.amount,
        tokenType: 'PAYMENT_CHANNEL',
        fee: row.fee || 0,
        timestamp: row.timestamp,
        status: row.status,
        message: row.message
      };
    } catch (error) {
      logger.error('Failed to check channel transaction status:', error);
      throw error;
    }
  }

  /**
   * Get payment type
   */
  getPaymentType(): PaymentType {
    return 'PAYMENT_CHANNEL';
  }

  /**
   * Close payment channel
   */
  async closeChannel(channelId: string): Promise<void> {
    const channel = this.activeChannels.get(channelId);
    if (!channel) {
      throw new Error('Payment channel not found');
    }

    channel.status = 'closing';
    channel.last_update = new Date();
    await this.saveChannel(channel);

    // In a real implementation, this would involve on-chain settlement
    // For now, just mark as closed
    channel.status = 'closed';
    await this.saveChannel(channel);

    this.activeChannels.delete(channelId);
    logger.info(`Closed payment channel: ${channelId}`);
  }

  /**
   * Get channel information
   */
  async getChannel(channelId: string): Promise<PaymentChannel | null> {
    return this.activeChannels.get(channelId) || null;
  }

  /**
   * Get channels for participant
   */
  async getChannelsForParticipant(address: string): Promise<PaymentChannel[]> {
    return Array.from(this.activeChannels.values()).filter(
      channel => channel.participant1 === address || channel.participant2 === address
    );
  }

  /**
   * Load active channels from database
   */
  private async loadActiveChannels(): Promise<void> {
    const query = `
      SELECT * FROM payment_channels
      WHERE status IN ('opening', 'open')
    `;

    try {
      const result = await postgresDb.query(query);
      result.rows.forEach(row => {
        const channel: PaymentChannel = {
          id: row.id,
          participant1: row.participant1,
          participant2: row.participant2,
          capacity: row.capacity,
          balance1: row.balance1,
          balance2: row.balance2,
          status: row.status,
          created_at: row.created_at,
          last_update: row.last_update
        };
        this.activeChannels.set(channel.id, channel);
      });
    } catch (error) {
      logger.error('Failed to load active channels:', error);
    }
  }

  /**
   * Save channel to database
   */
  private async saveChannel(channel: PaymentChannel): Promise<void> {
    const query = `
      INSERT INTO payment_channels
      (id, participant1, participant2, capacity, balance1, balance2, status, created_at, last_update)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        balance1 = EXCLUDED.balance1,
        balance2 = EXCLUDED.balance2,
        status = EXCLUDED.status,
        last_update = EXCLUDED.last_update
    `;

    try {
      await postgresDb.query(query, [
        channel.id,
        channel.participant1,
        channel.participant2,
        channel.capacity,
        channel.balance1,
        channel.balance2,
        channel.status,
        channel.created_at,
        channel.last_update
      ]);
    } catch (error) {
      logger.error('Failed to save channel:', error);
    }
  }

  /**
   * Record channel transaction
   */
  private async recordChannelTransaction(transaction: Transaction): Promise<void> {
    const query = `
      INSERT INTO channel_transactions
      (hash, from_address, to_address, amount, token_type, fee, status, message, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    try {
      await postgresDb.query(query, [
        transaction.hash,
        transaction.fromAddress,
        transaction.toAddress,
        transaction.amount,
        transaction.tokenType,
        transaction.fee,
        transaction.status,
        transaction.message,
        transaction.timestamp
      ]);
    } catch (error) {
      logger.error('Failed to record channel transaction:', error);
    }
  }

  /**
   * Generate channel ID
   */
  private generateChannelId(): string {
    return 'CH_' + Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Generate transaction hash
   */
  private generateTxHash(): string {
    return '0x' + Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}