import { TonClient, Address } from '@ton/ton';
import { postgresDb } from '../database';
import { TonApiManager } from './TonApiManager';

export interface TransactionMonitorConfig {
  network: 'mainnet' | 'testnet';
  pollingInterval: number; // in milliseconds
  maxRetries: number;
  batchSize: number;
}

export class TransactionMonitor {
  private apiManager: TonApiManager;
  private monitoring: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private config: TransactionMonitorConfig;

  constructor(config: TransactionMonitorConfig) {
    this.apiManager = new TonApiManager();
    this.config = config;
  }

  /**
   * Start monitoring transactions
   */
  async start() {
    if (this.monitoring) {
      console.log('Transaction monitor already running');
      return;
    }

    this.monitoring = true;
    console.log(`Starting transaction monitor for ${this.config.network}`);

    // Process existing pending transactions
    await this.processPendingTransactions();

    // Start polling for updates
    this.pollInterval = setInterval(
      async () => {
        try {
          await this.processPendingTransactions();
        } catch (error) {
          console.error('Error in transaction monitor:', error);
        }
      },
      this.config.pollingInterval
    );
  }

  /**
   * Stop monitoring transactions
   */
  stop() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('Transaction monitor stopped');
  }

  /**
   * Process all pending transactions
   */
  private async processPendingTransactions() {
    const query = `
      SELECT * FROM ton_transactions
      WHERE status = 'pending'
      AND network_name = $1
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at ASC
      LIMIT $2
    `;

    const result = await postgresDb.query(query, [this.config.network, this.config.batchSize]);
    const transactions = result.rows;

    if (transactions.length === 0) {
      return;
    }

    console.log(`Processing ${transactions.length} pending transactions`);

    for (const tx of transactions) {
      try {
        await this.checkTransactionStatus(tx);
      } catch (error) {
        console.error(`Error checking transaction ${tx.tx_hash}:`, error);
        await this.markTransactionFailed(tx.tx_hash, error.message);
      }
    }
  }

  /**
   * Check status of a specific transaction
   */
  private async checkTransactionStatus(tx: any) {
    const client = await this.apiManager.getClient(this.config.network);

    try {
      // Get transaction from blockchain
      const address = Address.parse(tx.from_address);
      const account = await client.getAccount(address);

      if (!account.lastLt) {
        // Transaction not yet found
        return;
      }

      // Get transaction details
      const transactions = await client.getTransactions(address, {
        limit: 10
      });

      const blockchainTx = transactions.find(
        t => t.hash.toString('hex') === tx.tx_hash.replace('0x', '')
      );

      if (!blockchainTx) {
        // Transaction not found, might still be processing
        return;
      }

      if (blockchainTx.status === 'applied') {
        await this.markTransactionConfirmed(tx.tx_hash);
        await this.processConfirmedTransaction(tx);
      } else if (blockchainTx.status === 'failed') {
        await this.markTransactionFailed(tx.tx_hash, 'Transaction failed on blockchain');
      }

    } catch (error) {
      // Transaction might be too old or not found
      if (error.message.includes('transaction not found')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Mark transaction as confirmed
   */
  private async markTransactionConfirmed(txHash: string) {
    await postgresDb.query(`
      UPDATE ton_transactions
      SET status = 'confirmed', confirmed_at = NOW()
      WHERE tx_hash = $1
    `, [txHash]);

    console.log(`Transaction ${txHash} confirmed`);
  }

  /**
   * Mark transaction as failed
   */
  private async markTransactionFailed(txHash: string, errorMessage: string) {
    await postgresDb.query(`
      UPDATE ton_transactions
      SET status = 'failed', error_message = $1
      WHERE tx_hash = $1
    `, [txHash]);

    console.log(`Transaction ${txHash} failed: ${errorMessage}`);
  }

  /**
   * Process confirmed transaction (update balances, trigger events)
   */
  private async processConfirmedTransaction(tx: any) {
    await postgresDb.query('BEGIN');

    try {
      // Update wallet balances
      if (tx.token_type === 'TON') {
        await this.updateTonBalance(tx.user_id, tx.from_address);
        if (tx.to_address) {
          await this.updateTonBalanceByAddress(tx.to_address);
        }
      } else if (tx.token_type === 'USDT') {
        await this.updateUsdtBalance(tx.user_id, tx.from_address);
        if (tx.to_address) {
          await this.updateUsdtBalanceByAddress(tx.to_address);
        }
      }

      // Trigger webhook if configured
      await this.triggerWebhook(tx);

      // Update internal transfer status if applicable
      await this.updateInternalTransferStatus(tx);

      await postgresDb.query('COMMIT');

    } catch (error) {
      await postgresDb.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Update TON balance for user
   */
  private async updateTonBalance(userId: number, address: string) {
    const client = await this.apiManager.getClient(this.config.network);
    const balance = await client.getBalance(Address.parse(address));

    await postgresDb.query(`
      UPDATE user_ton_wallets
      SET balance_ton = $1, last_sync_at = NOW()
      WHERE user_id = $2 AND wallet_address = $3
    `, [parseFloat(balance.toString()), userId, address]);
  }

  /**
   * Update USDT balance for user
   */
  private async updateUsdtBalance(userId: number, address: string) {
    const { UsdtContract } = await import('./UsdtContract');
    const usdtContract = new UsdtContract();
    const client = await this.apiManager.getClient(this.config.network);
    const balance = await usdtContract.getBalance(
      client,
      Address.parse(address),
      this.config.network
    );

    await postgresDb.query(`
      UPDATE user_ton_wallets
      SET balance_usdt = $1, last_sync_at = NOW()
      WHERE user_id = $2 AND wallet_address = $3
    `, [parseFloat(balance.toString()), userId, address]);
  }

  /**
   * Update TON balance by address (for recipient)
   */
  private async updateTonBalanceByAddress(address: string) {
    const client = await this.apiManager.getClient(this.config.network);
    const balance = await client.getBalance(Address.parse(address));

    await postgresDb.query(`
      UPDATE user_ton_wallets
      SET balance_ton = balance_ton + $1, last_sync_at = NOW()
      WHERE wallet_address = $2
    `, [parseFloat(balance.toString()), address]);
  }

  /**
   * Update USDT balance by address (for recipient)
   */
  private async updateUsdtBalanceByAddress(address: string) {
    const { UsdtContract } = await import('./UsdtContract');
    const usdtContract = new UsdtContract();
    const client = await this.apiManager.getClient(this.config.network);
    const balance = await usdtContract.getBalance(
      client,
      Address.parse(address),
      this.config.network
    );

    await postgresDb.query(`
      UPDATE user_ton_wallets
      SET balance_usdt = balance_usdt + $1, last_sync_at = NOW()
      WHERE wallet_address = $2
    `, [parseFloat(balance.toString()), address]);
  }

  /**
   * Trigger webhook for confirmed transaction
   */
  private async triggerWebhook(tx: any) {
    // Get webhook URLs for the user
    const webhookQuery = `
      SELECT webhook_url FROM user_webhooks
      WHERE user_id = $1 AND active = true
      AND event_types @> ARRAY['transaction.confirmed']
    `;

    const webhookResult = await postgresDb.query(webhookQuery, [tx.user_id]);

    for (const webhook of webhookResult.rows) {
      try {
        await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': await this.generateSignature(tx)
          },
          body: JSON.stringify({
            event: 'transaction.confirmed',
            data: tx
          })
        });
      } catch (error) {
        console.error(`Webhook delivery failed to ${webhook.webhook_url}:`, error);
      }
    }
  }

  /**
   * Generate signature for webhook
   */
  private async generateSignature(data: any): Promise<string> {
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Update internal transfer status
   */
  private async updateInternalTransferStatus(tx: any) {
    // Check if this transaction corresponds to an internal transfer
    const transferQuery = `
      SELECT id FROM internal_transfers
      WHERE (from_user_id = $1 OR to_user_id = $1)
      AND created_at > NOW() - INTERVAL '1 hour'
      AND status = 'pending'
    `;

    const transferResult = await postgresDb.query(transferQuery, [tx.user_id]);

    if (transferResult.rows.length > 0) {
      await postgresDb.query(`
        UPDATE internal_transfers
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [transferResult.rows[0].id]);
    }
  }

  /**
   * Add transaction to monitor
   */
  async addTransaction(txHash: string, userId: number, network: 'mainnet' | 'testnet') {
    await postgresDb.query(`
      INSERT INTO ton_transactions (tx_hash, user_id, network_name, status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (tx_hash) DO NOTHING
    `, [txHash, userId, network]);
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<any> {
    const query = `
      SELECT * FROM ton_transactions
      WHERE tx_hash = $1
    `;

    const result = await postgresDb.query(query, [txHash]);

    if (!result.rows.length) {
      return null;
    }

    return result.rows[0];
  }
}