import { TonClient, Address } from '@ton/ton';
import { fromNano } from '@ton/core';
import { postgresDb } from '../database';
import { smartContractService } from './SmartContractService';
import { notificationService } from '../notifications/NotificationService';
import { Logger } from '../../utils/logger';

const logger = new Logger('TransactionMonitor');

export interface TransactionEvent {
  hash: string;
  contractAddress: string;
  type: 'deposit' | 'withdraw' | 'create_channel' | 'channel_payment' | 'close_channel';
  amount?: string;
  recipient?: string;
  participant?: string;
  channelId?: number;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
}

export interface MonitoringConfig {
  network: 'mainnet' | 'testnet';
  contractAddress: string;
  pollingInterval: number; // in seconds
  enabled: boolean;
}

export class TransactionMonitor {
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: Map<string, boolean> = new Map();
  private lastProcessedBlocks: Map<string, number> = new Map();

  constructor() {
    this.loadMonitoringConfigs();
  }

  /**
   * Load monitoring configurations from database
   */
  private async loadMonitoringConfigs(): Promise<void> {
    try {
      const query = `
        SELECT network, contract_address, polling_interval, enabled
        FROM contract_monitoring
        WHERE enabled = true
      `;

      const result = await postgresDb.query(query);

      for (const config of result.rows) {
        const monitoringConfig: MonitoringConfig = {
          network: config.network,
          contractAddress: config.contract_address,
          pollingInterval: config.polling_interval || 30,
          enabled: config.enabled
        };

        if (monitoringConfig.enabled) {
          this.startMonitoring(monitoringConfig);
        }
      }

      logger.info(`Loaded monitoring for ${result.rows.length} contracts`);
    } catch (error) {
      logger.error('Failed to load monitoring configurations', error);
    }
  }

  /**
   * Start monitoring a contract
   */
  async startMonitoring(config: MonitoringConfig): Promise<void> {
    const jobKey = `${config.network}_${config.contractAddress}`;

    if (this.monitoringJobs.has(jobKey)) {
      logger.warn(`Monitoring already started for ${jobKey}`);
      return;
    }

    this.isRunning.set(jobKey, true);

    const monitoringJob = setInterval(async () => {
      if (this.isRunning.get(jobKey)) {
        await this.checkForNewTransactions(config);
      }
    }, config.pollingInterval * 1000);

    this.monitoringJobs.set(jobKey, monitoringJob);
    logger.info(`Started monitoring ${config.network} contract: ${config.contractAddress}`);
  }

  /**
   * Stop monitoring a contract
   */
  async stopMonitoring(network: string, contractAddress: string): Promise<void> {
    const jobKey = `${network}_${contractAddress}`;
    const job = this.monitoringJobs.get(jobKey);

    if (job) {
      clearInterval(job);
      this.monitoringJobs.delete(jobKey);
      this.isRunning.set(jobKey, false);
      logger.info(`Stopped monitoring ${network} contract: ${contractAddress}`);
    }
  }

  /**
   * Check for new transactions
   */
  private async checkForNewTransactions(config: MonitoringConfig): Promise<void> {
    try {
      const contractAddress = Address.parse(config.contractAddress);
      const lastBlock = this.lastProcessedBlocks.get(`${config.network}_${config.contractAddress}`) || 0;

      // Get recent transactions
      const transactions = await this.getRecentTransactions(config.network, contractAddress, lastBlock);

      for (const tx of transactions) {
        await this.processTransaction(config.network, config.contractAddress, tx);
      }

      // Update last processed block
      if (transactions.length > 0) {
        const latestBlock = Math.max(...transactions.map(tx => tx.blockNumber || 0));
        this.lastProcessedBlocks.set(`${config.network}_${config.contractAddress}`, latestBlock);
      }
    } catch (error) {
      logger.error(`Error checking transactions for ${config.contractAddress}`, error);
    }
  }

  /**
   * Get recent transactions for contract
   */
  private async getRecentTransactions(
    network: string,
    contractAddress: Address,
    fromBlock: number
  ): Promise<any[]> {
    try {
      const client = this.getClient(network);
      if (!client) {
        return [];
      }

      const transactions = await client.getTransactions(contractAddress, {
        limit: 100
      });

      return transactions
        .filter(tx => (tx.blockNumber || 0) > fromBlock)
        .map(tx => ({
          hash: tx.hash,
          blockNumber: tx.blockNumber,
          timestamp: tx.now,
          inMessage: tx.inMessage,
          outMessages: tx.outMessages,
          status: tx.status
        }));
    } catch (error) {
      logger.error('Failed to get recent transactions', error);
      return [];
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(
    network: string,
    contractAddress: string,
    transaction: any
  ): Promise<void> {
    try {
      const event = this.parseTransactionEvent(network, contractAddress, transaction);
      if (!event) {
        return;
      }

      // Store event in database
      await this.storeTransactionEvent(event);

      // Send real-time notifications for important events
      if (this.shouldNotify(event)) {
        await this.sendNotification(event);
      }

      // Update contract state in database
      await this.updateContractState(network, contractAddress, event);

      logger.info(`Processed transaction: ${event.type} - ${event.hash}`);
    } catch (error) {
      logger.error(`Failed to process transaction ${transaction.hash}`, error);
    }
  }

  /**
   * Parse transaction event
   */
  private parseTransactionEvent(
    network: string,
    contractAddress: string,
    transaction: any
  ): TransactionEvent | null {
    try {
      if (!transaction.inMessage?.body) {
        return null;
      }

      const body = transaction.inMessage.body;
      const op = body.bits.readUint(32);

      const baseEvent: TransactionEvent = {
        hash: transaction.hash,
        contractAddress,
        timestamp: new Date(transaction.now * 1000),
        status: transaction.status === 1 ? 'confirmed' : 'failed',
        blockNumber: transaction.blockNumber,
        type: 'deposit' // default
      };

      switch (op) {
        case 0x4A4F4B48: // Deposit
          return {
            ...baseEvent,
            type: 'deposit',
            amount: fromNano(body.bits.readCoins()),
            recipient: '0x' + body.bits.readUint(256).toString(16)
          };

        case 0x57495448: // Withdraw
          return {
            ...baseEvent,
            type: 'withdraw',
            amount: fromNano(body.bits.readCoins()),
            recipient: '0x' + body.bits.readUint(256).toString(16)
          };

        case 0x4348414E: // CreateChannel
          return {
            ...baseEvent,
            type: 'create_channel',
            participant: '0x' + body.bits.readUint(256).toString(16),
            amount: fromNano(body.bits.readCoins())
          };

        case 0x43484150: // ChannelPayment
          return {
            ...baseEvent,
            type: 'channel_payment',
            channelId: parseInt(body.bits.readUint(32).toString()),
            amount: fromNano(body.bits.readCoins()),
            recipient: '0x' + body.bits.readUint(256).toString(16)
          };

        default:
          return null;
      }
    } catch (error) {
      logger.error('Failed to parse transaction event', error);
      return null;
    }
  }

  /**
   * Store transaction event in database
   */
  private async storeTransactionEvent(event: TransactionEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO contract_transactions (
          hash, contract_address, type, amount, recipient, participant,
          channel_id, timestamp, status, block_number, network
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (hash) DO NOTHING
      `;

      await postgresDb.query(query, [
        event.hash,
        event.contractAddress,
        event.type,
        event.amount,
        event.recipient,
        event.participant,
        event.channelId,
        event.timestamp,
        event.status,
        event.blockNumber,
        'mainnet' // Extract from config or add to event
      ]);
    } catch (error) {
      logger.error('Failed to store transaction event', error);
    }
  }

  /**
   * Check if event should trigger notification
   */
  private shouldNotify(event: TransactionEvent): boolean {
    // Notify for high-value withdrawals and failed transactions
    if (event.status === 'failed') {
      return true;
    }

    if (event.type === 'withdraw' && event.amount && parseFloat(event.amount) > 100) {
      return true;
    }

    return false;
  }

  /**
   * Send notification for event
   */
  private async sendNotification(event: TransactionEvent): Promise<void> {
    try {
      let message: string;
      let severity: 'info' | 'warning' | 'error' | 'critical';

      if (event.status === 'failed') {
        message = `Transaction failed: ${event.type} - ${event.hash}`;
        severity = 'error';
      } else if (event.type === 'withdraw' && event.amount && parseFloat(event.amount) > 100) {
        message = `Large withdrawal: ${event.amount} TON - ${event.hash}`;
        severity = 'warning';
      } else {
        return; // No notification needed
      }

      await notificationService.sendSystemAlert({
        type: 'payment_alert',
        severity,
        message,
        data: event,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to send notification', error);
    }
  }

  /**
   * Update contract state in database
   */
  private async updateContractState(
    network: string,
    contractAddress: string,
    event: TransactionEvent
  ): Promise<void> {
    try {
      // Update contract statistics
      const query = `
        INSERT INTO contract_stats (
          contract_address, network, last_transaction_at,
          total_transactions, total_volume
        ) VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (contract_address, network) DO UPDATE SET
          last_transaction_at = EXCLUDED.last_transaction_at,
          total_transactions = contract_stats.total_transactions + 1,
          total_volume = contract_stats.total_volume + EXCLUDED.total_volume
      `;

      await postgresDb.query(query, [
        contractAddress,
        network,
        event.timestamp,
        event.amount || '0'
      ]);
    } catch (error) {
      logger.error('Failed to update contract state', error);
    }
  }

  /**
   * Get TON client
   */
  private getClient(network: string): TonClient | null {
    // This should use the same client as SmartContractService
    return null; // Implementation depends on your client management
  }

  /**
   * Get monitoring status
   */
  async getStatus(): Promise<any> {
    const activeJobs = Array.from(this.monitoringJobs.entries()).map(([key, _]) => ({
      key,
      isRunning: this.isRunning.get(key) || false,
      lastProcessedBlock: this.lastProcessedBlocks.get(key) || 0
    }));

    return {
      activeMonitors: activeJobs.length,
      monitors: activeJobs,
      uptime: process.uptime()
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    network?: string,
    contractAddress?: string,
    type?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionEvent[]> {
    try {
      let query = `
        SELECT hash, contract_address, type, amount, recipient, participant,
               channel_id, timestamp, status, block_number, network
        FROM contract_transactions
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (network) {
        query += ` AND network = $${paramIndex++}`;
        params.push(network);
      }

      if (contractAddress) {
        query += ` AND contract_address = $${paramIndex++}`;
        params.push(contractAddress);
      }

      if (type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(type);
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await postgresDb.query(query, params);

      return result.rows.map(row => ({
        hash: row.hash,
        contractAddress: row.contract_address,
        type: row.type,
        amount: row.amount,
        recipient: row.recipient,
        participant: row.participant,
        channelId: row.channel_id,
        timestamp: row.timestamp,
        status: row.status,
        blockNumber: row.block_number
      }));
    } catch (error) {
      logger.error('Failed to get transaction history', error);
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    for (const [key, job] of this.monitoringJobs.entries()) {
      clearInterval(job);
      this.isRunning.set(key, false);
    }

    this.monitoringJobs.clear();
    this.isRunning.clear();
    this.lastProcessedBlocks.clear();

    logger.info('Transaction monitor cleaned up');
  }
}

// Create singleton instance
export const transactionMonitor = new TransactionMonitor();