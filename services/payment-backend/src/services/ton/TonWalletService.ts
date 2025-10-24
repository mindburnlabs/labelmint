import { TonClient, Address } from '@ton/ton';
import { mnemonicToPrivateKey, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4, WalletContractV3R2 } from '@ton/ton';
import { fromNano, toNano, Cell, beginCell } from '@ton/core';
import { postgresDb } from '../database';
import { encrypt, decrypt } from '../encryption';
import { TonApiManager } from './TonApiManager';
import { UsdtContract } from './UsdtContract';

export interface WalletInfo {
  address: string;
  version: string;
  publicKey: string;
  mnemonic?: string[];
}

export interface CreateWalletOptions {
  userId: number;
  network: 'mainnet' | 'testnet';
  version?: 'v4R2' | 'v3R2';
  saveMnemonic?: boolean;
}

export interface TransactionParams {
  toAddress: string;
  amount: string; // in TON or USDT
  tokenType: 'TON' | 'USDT';
  message?: string;
}

export class TonWalletService {
  private tonClient: TonClient;
  private apiManager: TonApiManager;
  private usdtContract: UsdtContract;

  constructor() {
    this.apiManager = new TonApiManager();
    this.usdtContract = new UsdtContract();
  }

  /**
   * Create a new TON wallet for a user
   */
  async createWallet(options: CreateWalletOptions): Promise<WalletInfo> {
    const { userId, network, version = 'v4R2', saveMnemonic = true } = options;

    // Generate new mnemonic
    const mnemonic = await this.generateMnemonic();
    const keyPair = await mnemonicToPrivateKey(mnemonic);

    // Get workchain and create wallet
    const workchain = 0;
    let walletContract;
    let walletVersion: string;

    if (version === 'v4R2') {
      walletContract = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });
      walletVersion = 'v4R2';
    } else {
      walletContract = WalletContractV3R2.create({ workchain, publicKey: keyPair.publicKey });
      walletVersion = 'v3R2';
    }

    const address = walletContract.address.toString();

    // Save to database
    const query = `
      INSERT INTO user_ton_wallets
      (user_id, network_name, wallet_address, wallet_version, public_key, mnemonic_encrypted)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const encryptedMnemonic = saveMnemonic ? encrypt(JSON.stringify(mnemonic)) : null;

    await connectionPool.query(query, [
      userId,
      network,
      address,
      walletVersion,
      keyPair.publicKey.toString('hex'),
      encryptedMnemonic
    ]);

    return {
      address,
      version: walletVersion,
      publicKey: keyPair.publicKey.toString('hex'),
      mnemonic: saveMnemonic ? mnemonic : undefined
    };
  }

  /**
   * Get user's wallet information
   */
  async getUserWallet(userId: number, network: 'mainnet' | 'testnet' = 'testnet'): Promise<any> {
    const query = `
      SELECT * FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await connectionPool.query(query, [userId, network]);

    if (!result.rows.length) {
      throw new Error('Wallet not found');
    }

    const wallet = result.rows[0];

    // Decrypt mnemonic if needed
    if (wallet.mnemonic_encrypted) {
      wallet.mnemonic = JSON.parse(decrypt(wallet.mnemonic_encrypted));
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletAddress: string, network: 'mainnet' | 'testnet' = 'testnet') {
    const client = await this.apiManager.getClient(network);
    const address = Address.parse(walletAddress);

    // Get TON balance
    const tonBalance = await client.getBalance(address);

    // Get USDT balance
    const usdtBalance = await this.usdtContract.getBalance(client, address, network);

    return {
      ton: fromNano(tonBalance),
      usdt: usdtBalance.toString()
    };
  }

  /**
   * Update wallet balance in database
   */
  async updateWalletBalance(userId: number, network: 'mainnet' | 'testnet') {
    const wallet = await this.getUserWallet(userId, network);
    const balances = await this.getWalletBalance(wallet.wallet_address, network);

    const query = `
      UPDATE user_ton_wallets
      SET balance_ton = $1, balance_usdt = $2, last_sync_at = NOW()
      WHERE id = $3
    `;

    await postgresDb.query(query, [
      parseFloat(balances.ton),
      parseFloat(balances.usdt),
      wallet.id
    ]);

    // Create balance snapshot
    await this.createBalanceSnapshot(userId, balances);

    return balances;
  }

  /**
   * Send transaction
   */
  async sendTransaction(
    userId: number,
    params: TransactionParams,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<string> {
    const wallet = await this.getUserWallet(userId, network);
    const client = await this.apiManager.getClient(network);

    if (!wallet.mnemonic_encrypted) {
      throw new Error('Wallet mnemonic not available');
    }

    const mnemonic = JSON.parse(decrypt(wallet.mnemonic_encrypted));
    const keyPair = await mnemonicToPrivateKey(mnemonic);

    // Validate recipient address
    if (!this.isValidAddress(params.toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // Check balance before transaction
    const balances = await this.getWalletBalance(wallet.wallet_address, network);
    if (params.tokenType === 'TON' && parseFloat(balances.ton) < parseFloat(params.amount)) {
      throw new Error('Insufficient TON balance');
    }
    if (params.tokenType === 'USDT' && parseFloat(balances.usdt) < parseFloat(params.amount)) {
      throw new Error('Insufficient USDT balance');
    }

    // Create wallet contract
    let walletContract;
    if (wallet.wallet_version === 'v4R2') {
      walletContract = client.open(
        WalletContractV4.create({
          publicKey: keyPair.publicKey,
          address: Address.parse(wallet.wallet_address)
        })
      );
    } else {
      walletContract = client.open(
        WalletContractV3R2.create({
          publicKey: keyPair.publicKey,
          address: Address.parse(wallet.wallet_address)
        })
      );
    }

    const seqno = await walletContract.getSeqno();
    let txHash: string;

    if (params.tokenType === 'TON') {
      // Calculate gas fees and check again
      const estimatedGas = await this.estimateGasFee(params.toAddress, params.amount, network);
      const totalNeeded = parseFloat(params.amount) + estimatedGas;

      if (parseFloat(balances.ton) < totalNeeded) {
        throw new Error(`Insufficient balance. Need ${totalNeeded} TON (including ${estimatedGas} TON for gas)`);
      }

      // Send TON
      const payload = params.message
        ? beginCell().storeUint(0, 32).storeStringTail(params.message).endCell()
        : undefined;

      const transfer = walletContract.createTransfer({
        secretKey: keyPair.secretKey,
        seqno,
        messages: [{
          address: Address.parse(params.toAddress),
          amount: toNano(params.amount),
          payload
        }]
      });

      txHash = await walletContract.send(transfer);

    } else {
      // Send USDT with proper gas fee estimation
      const estimatedGas = await this.usdtContract.estimateTransferFee(
        client,
        Address.parse(wallet.wallet_address),
        Address.parse(params.toAddress),
        params.amount
      );

      if (parseFloat(balances.ton) < parseFloat(estimatedGas.total)) {
        throw new Error(`Insufficient TON for gas. Need ${estimatedGas.total} TON for USDT transfer`);
      }

      txHash = await this.usdtContract.transfer(
        client,
        walletContract,
        keyPair,
        Address.parse(params.toAddress),
        params.amount,
        params.message,
        network
      );
    }

    // Record transaction with proper status tracking
    await this.recordTransaction({
      txHash,
      userId,
      fromAddress: wallet.wallet_address,
      toAddress: params.toAddress,
      amount: params.tokenType === 'TON' ? parseFloat(params.amount) : 0,
      amountUsdt: params.tokenType === 'USDT' ? parseFloat(params.amount) : 0,
      tokenType: params.tokenType,
      network,
      status: 'pending'
    });

    // Start monitoring this transaction
    const { TransactionMonitor } = await import('./TransactionMonitor');
    const monitor = new TransactionMonitor({
      network,
      pollingInterval: 10000,
      maxRetries: 30,
      batchSize: 20
    });
    await monitor.addTransaction(txHash, userId, network);

    return txHash;
  }

  /**
   * Connect Telegram Wallet
   */
  async connectTelegramWallet(userId: number, walletAddress: string, signature: string) {
    // Verify signature from Telegram Wallet
    const isValid = await this.verifyTelegramWalletSignature(walletAddress, signature);

    if (!isValid) {
      throw new Error('Invalid wallet signature');
    }

    // Save the connected wallet
    const query = `
      INSERT INTO user_ton_wallets (user_id, network_name, wallet_address, wallet_version, public_key)
      VALUES ($1, 'mainnet', $2, 'telegram', $3)
      ON CONFLICT (wallet_address) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      is_active = true
      RETURNING *
    `;

    const result = await postgresDb.query(query, [userId, walletAddress, 'telegram']);

    return result.rows[0];
  }

  /**
   * Internal transfer between users (zero fee)
   */
  async internalTransfer(
    fromUserId: number,
    toUserId: number,
    amount: number,
    description?: string
  ) {
    await postgresDb.query('BEGIN');

    try {
      // Check sender balance
      const fromWallet = await this.getUserWallet(fromUserId, 'mainnet');

      if (fromWallet.balance_usdt < amount) {
        throw new Error('Insufficient balance');
      }

      // Create internal transfer record
      const transferQuery = `
        INSERT INTO internal_transfers (from_user_id, to_user_id, amount, description, status)
        VALUES ($1, $2, $3, $4, 'completed')
        RETURNING *
      `;

      const transferResult = await postgresDb.query(transferQuery, [
        fromUserId,
        toUserId,
        amount,
        description
      ]);

      // Update balances
      await postgresDb.query(`
        UPDATE user_ton_wallets
        SET balance_usdt = balance_usdt - $1,
            updated_at = NOW()
        WHERE user_id = $2 AND network_name = 'mainnet'
      `, [amount, fromUserId]);

      await postgresDb.query(`
        UPDATE user_ton_wallets
        SET balance_usdt = balance_usdt + $1,
            updated_at = NOW()
        WHERE user_id = $2 AND network_name = 'mainnet'
      `, [amount, toUserId]);

      // Create snapshots from database values (not re-syncing)
      await postgresDb.query(`
        INSERT INTO balance_snapshots (user_id, balance_usdt, balance_ton)
        SELECT
          $1::integer as user_id,
          w.balance_usdt,
          w.balance_ton
        FROM user_ton_wallets w
        WHERE w.user_id = $1 AND w.network_name = 'mainnet'
      `, [fromUserId]);

      await postgresDb.query(`
        INSERT INTO balance_snapshots (user_id, balance_usdt, balance_ton)
        SELECT
          $1::integer as user_id,
          w.balance_usdt,
          w.balance_ton
        FROM user_ton_wallets w
        WHERE w.user_id = $1 AND w.network_name = 'mainnet'
      `, [toUserId]);

      await postgresDb.query('COMMIT');

      return transferResult.rows[0];

    } catch (error) {
      await postgresDb.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Process worker payout
   */
  async processWorkerPayout(payoutId: number) {
    const payoutQuery = `
      SELECT wp.*, u.email, w.wallet_address
      FROM worker_payouts wp
      JOIN users u ON wp.worker_id = u.id
      LEFT JOIN user_ton_wallets w ON w.user_id = u.id AND w.network_name = 'mainnet'
      WHERE wp.id = $1
    `;

    const payoutResult = await postgresDb.query(payoutQuery, [payoutId]);

    if (!payoutResult.rows.length) {
      throw new Error('Payout not found');
    }

    const payout = payoutResult.rows[0];

    if (!payout.wallet_address) {
      throw new Error('Worker wallet not found');
    }

    try {
      // Send USDT to worker
      const txHash = await this.sendTransaction(
        1, // System user ID
        {
          toAddress: payout.wallet_address,
          amount: payout.amount.toString(),
          tokenType: 'USDT',
          message: `Payout for task batch ${payout.task_batch_id}`
        },
        'mainnet'
      );

      // Update payout status
      await postgresDb.query(`
        UPDATE worker_payouts
        SET status = 'sent', tx_hash = $1, sent_at = NOW()
        WHERE id = $2
      `, [txHash, payoutId]);

      return { success: true, txHash };

    } catch (error) {
      await postgresDb.query(`
        UPDATE worker_payouts
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [error.message, payoutId]);

      throw error;
    }
  }

  /**
   * Helper methods
   */
  private async generateMnemonic(): Promise<string[]> {
    return (await import('@ton/crypto')).mnemonicNew(24);
  }

  private async verifyTelegramWalletSignature(address: string, signature: string): Promise<boolean> {
    // Implementation for verifying Telegram wallet signature
    // This would depend on the specific signature format used by Telegram Wallet
    return true; // Simplified for now
  }

  private async recordTransaction(tx: any) {
    const query = `
      INSERT INTO ton_transactions
      (tx_hash, user_id, from_address, to_address, amount, amount_usdt, token_type, network_name, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await postgresDb.query(query, [
      tx.txHash,
      tx.userId,
      tx.fromAddress,
      tx.toAddress,
      tx.amount,
      tx.amountUsdt,
      tx.tokenType,
      tx.network,
      tx.status
    ]);
  }

  private async createBalanceSnapshot(userId: number, balances: any) {
    const query = `
      INSERT INTO balance_snapshots (user_id, balance_usdt, balance_ton)
      VALUES ($1, $2, $3)
    `;

    await postgresDb.query(query, [
      userId,
      parseFloat(balances.usdt),
      parseFloat(balances.ton)
    ]);
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: number,
    network: 'mainnet' | 'testnet' = 'testnet',
    limit: number = 50,
    offset: number = 0
  ) {
    const query = `
      SELECT * FROM ton_transactions
      WHERE user_id = $1 AND network_name = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await postgresDb.query(query, [userId, network, limit, offset]);
    return result.rows;
  }

  /**
   * Monitor transaction status
   */
  async monitorTransaction(txHash: string, network: 'mainnet' | 'testnet' = 'testnet') {
    const client = await this.apiManager.getClient(network);
    const address = Address.parse(txHash.split(':')[0]);

    try {
      // Get account transactions
      const transactions = await client.getTransactions(address, {
        limit: 10
      });

      const blockchainTx = transactions.find(
        t => t.hash.toString('hex') === txHash.replace('0x', '')
      );

      if (!blockchainTx) {
        return { status: 'pending', message: 'Transaction not yet found' };
      }

      if (blockchainTx.status === 'applied') {
        // Update transaction status
        await postgresDb.query(`
          UPDATE ton_transactions
          SET status = 'confirmed', confirmed_at = NOW()
          WHERE tx_hash = $1
        `, [txHash]);

        return { status: 'confirmed', transaction: blockchainTx };
      } else if (blockchainTx.status === 'failed') {
        await postgresDb.query(`
          UPDATE ton_transactions
          SET status = 'failed', error_message = 'Transaction failed on blockchain'
          WHERE tx_hash = $1
        `, [txHash]);

        return { status: 'failed', transaction: blockchainTx };
      }

      return { status: 'pending', transaction: blockchainTx };

    } catch (error) {
      console.error('Error monitoring transaction:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Estimate gas fee for TON transfer
   */
  private async estimateGasFee(
    toAddress: string,
    amount: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<number> {
    // Base gas fee for regular transfers
    let baseFee = 0.005; // 0.005 TON base fee

    // Adjust based on amount (larger transfers may need more gas)
    const amountFloat = parseFloat(amount);
    if (amountFloat > 1000) {
      baseFee = 0.01;
    } else if (amountFloat > 10000) {
      baseFee = 0.02;
    }

    // Network-specific adjustments
    if (network === 'mainnet') {
      baseFee *= 1.5; // Mainnet has higher gas fees
    }

    // Add small buffer for price fluctuations
    baseFee *= 1.1;

    return Math.ceil(baseFee * 1000) / 1000; // Round up to 3 decimal places
  }

  /**
   * Batch sync wallet balances
   */
  async batchSyncWalletBalances(walletAddresses: string[], network: 'mainnet' | 'testnet' = 'testnet') {
    const client = await this.apiManager.getClient(network);
    const results = [];

    for (const address of walletAddresses) {
      try {
        const balances = await this.getWalletBalance(address, network);

        // Update in database
        await postgresDb.query(`
          UPDATE user_ton_wallets
          SET balance_ton = $1, balance_usdt = $2, last_sync_at = NOW()
          WHERE wallet_address = $3 AND network_name = $4
        `, [
          parseFloat(balances.ton),
          parseFloat(balances.usdt),
          address,
          network
        ]);

        results.push({
          address,
          success: true,
          balances
        });
      } catch (error) {
        results.push({
          address,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get real-time wallet status
   */
  async getWalletStatus(walletAddress: string, network: 'mainnet' | 'testnet' = 'testnet') {
    const client = await this.apiManager.getClient(network);
    const address = Address.parse(walletAddress);

    try {
      const account = await client.getAccount(address);
      const balance = await client.getBalance(address);

      return {
        isActive: account.state === 'active',
        balance: fromNano(balance),
        lastTransactionLt: account.lastLt,
        codeHash: account.code?.toString('hex'),
        dataHash: account.data?.toString('hex')
      };
    } catch (error) {
      throw new Error(`Failed to get wallet status: ${error.message}`);
    }
  }

  /**
   * Validate TON address format
   */
  isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch (error) {
      return false;
    }
  }
}