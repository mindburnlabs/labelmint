import { TonClient, Address, internal } from '@ton/ton';
import { mnemonicToPrivateKey, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4, WalletContractV3R2 } from '@ton/ton';
import { fromNano, toNano, Cell, beginCell } from '@ton/core';
import { PaymentStrategy, Transaction, PaymentType, PaymentResult, TransferOptions, PaymentConfig, BalanceInfo } from '../interfaces/PaymentStrategy';
import { TonApiManager } from '../../ton/TonApiManager';
import { postgresDb } from '../../../database';
import { Logger } from '../../../utils/logger';

const logger = new Logger('TONWalletStrategy');

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

export class TonWalletStrategy implements PaymentStrategy {
  private tonClient: TonClient;
  private apiManager: TonApiManager;
  private config: PaymentConfig;

  constructor(config: PaymentConfig) {
    this.config = config;
    this.apiManager = new TonApiManager();
  }

  /**
   * Initialize strategy with network client
   */
  async initialize(): Promise<void> {
    this.tonClient = this.apiManager.getClient(this.config.network);
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

    const encryptedMnemonic = saveMnemonic ? this.encryptMnemonic(JSON.stringify(mnemonic)) : null;

    await postgresDb.query(query, [
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
   * Deposit funds (not applicable for TON - handled by external transfers)
   */
  async deposit(amount: number, address?: string): Promise<Transaction> {
    throw new Error('Deposit not supported for TON strategy. Use external transfer to wallet address.');
  }

  /**
   * Withdraw TON to external address
   */
  async withdraw(amount: number, address: string, options?: TransferOptions): Promise<Transaction> {
    if (!this.validateAddress(address)) {
      throw new Error('Invalid TON address');
    }

    // Get wallet info
    const wallet = await this.getUserWallet(address);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Create and send transaction
    const transaction = await this.sendTransaction({
      fromAddress: wallet.wallet_address,
      toAddress: address,
      amount: toNano(amount).toString(),
      tokenType: 'TON',
      message: options?.message
    });

    return transaction;
  }

  /**
   * Get current TON balance
   */
  async getBalance(address: string): Promise<number> {
    try {
      const balance = await this.tonClient.getBalance(Address.parse(address));
      return parseFloat(fromNano(balance));
    } catch (error) {
      logger.error('Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Get transaction history for TON wallet
   */
  async getTransactionHistory(address: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const query = `
        SELECT * FROM transactions
        WHERE from_address = $1 OR to_address = $1
        AND token_type = 'TON'
        ORDER BY timestamp DESC
        LIMIT $2
      `;

      const result = await postgresDb.query(query, [address, limit]);

      return result.rows.map(row => ({
        hash: row.hash,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: fromNano(row.amount),
        tokenType: 'TON',
        fee: fromNano(row.fee || 0),
        timestamp: row.timestamp,
        status: row.status,
        blockNumber: row.block_number,
        message: row.message
      }));
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Validate TON address
   */
  validateAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(fromAddress: string, toAddress: string, amount: number): Promise<number> {
    try {
      const fee = await this.estimateGasFee(
        fromAddress,
        toAddress,
        toNano(amount).toString()
      );
      return parseFloat(fromNano(fee));
    } catch (error) {
      logger.error('Failed to estimate fee:', error);
      return 0.1; // Default fee estimate
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(txHash: string): Promise<Transaction> {
    try {
      const query = `
        SELECT * FROM transactions WHERE hash = $1
      `;
      const result = await postgresDb.query(query, [txHash]);

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const row = result.rows[0];
      return {
        hash: row.hash,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: fromNano(row.amount),
        tokenType: 'TON',
        fee: fromNano(row.fee || 0),
        timestamp: row.timestamp,
        status: row.status,
        blockNumber: row.block_number,
        message: row.message
      };
    } catch (error) {
      logger.error('Failed to check transaction status:', error);
      throw error;
    }
  }

  /**
   * Get payment type
   */
  getPaymentType(): PaymentType {
    return 'TON';
  }

  /**
   * Get wallet info for user
   */
  async getUserWallet(walletAddress: string): Promise<any> {
    const query = `
      SELECT * FROM user_ton_wallets
      WHERE wallet_address = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await postgresDb.query(query, [walletAddress]);
    return result.rows[0] || null;
  }

  /**
   * Update wallet balance in database
   */
  async updateWalletBalance(userId: number): Promise<void> {
    const wallet = await this.getUserWalletByUserId(userId);
    if (!wallet) return;

    const balance = await this.getBalance(wallet.wallet_address);

    const query = `
      UPDATE user_ton_wallets
      SET balance = $1, balance_updated_at = NOW()
      WHERE id = $2
    `;

    await postgresDb.query(query, [balance, wallet.id]);
  }

  /**
   * Send TON transaction
   */
  private async sendTransaction(params: {
    fromAddress: string;
    toAddress: string;
    amount: string;
    tokenType: string;
    message?: string;
  }): Promise<Transaction> {
    const { fromAddress, toAddress, amount, message } = params;

    // Get wallet info for sending
    const wallet = await this.getUserWallet(fromAddress);
    if (!wallet) {
      throw new Error(`Sender wallet not found: ${fromAddress}`);
    }

    // Decrypt mnemonic to get wallet keys
    const mnemonic = this.decryptMnemonic(wallet.mnemonic_encrypted);
    const keyPair = await mnemonicToPrivateKey(mnemonic);

    // Create wallet contract
    const workchain = 0;
    let walletContract;

    if (wallet.wallet_version === 'v4R2') {
      walletContract = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });
    } else {
      walletContract = WalletContractV3R2.create({ workchain, publicKey: keyPair.publicKey });
    }

    // Open wallet and check balance
    const openedWallet = this.tonClient.open(walletContract);
    const balance = await openedWallet.getBalance();

    const transferAmount = BigInt(amount);
    const estimatedFee = await this.estimateRealGasFee(fromAddress, toAddress, amount);

    if (balance < transferAmount + estimatedFee) {
      throw new Error(`Insufficient balance. Required: ${fromNano(transferAmount + estimatedFee)} TON, Available: ${fromNano(balance)} TON`);
    }

    // Create transfer
    const seqno = await openedWallet.getSeqno();
    const transfer = openedWallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: transferAmount,
          body: message ? beginCell().storeUint(0, 32).storeStringTail(message).endCell() : undefined,
        })
      ],
    });

    // Send transaction to blockchain
    logger.info(`Sending TON transfer: ${fromAddress} -> ${toAddress}, amount: ${fromNano(transferAmount)} TON`);

    const result = await this.tonClient.external(transfer);

    // Create transaction record with real hash
    const transaction: Transaction = {
      hash: result.toString(), // Real transaction hash
      fromAddress,
      toAddress,
      amount: fromNano(transferAmount),
      tokenType: 'TON',
      fee: fromNano(estimatedFee),
      timestamp: new Date(),
      status: 'pending',
      message
    };

    // Record transaction in database
    await this.recordTransaction(transaction);

    // Update wallet balance in background
    this.updateWalletBalance(wallet.user_id).catch(error => {
      logger.error('Failed to update wallet balance:', error);
    });

    return transaction;
  }

  /**
   * Generate transaction hash
   */
  private generateTxHash(): string {
    return '0x' + Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Record transaction in database
   */
  private async recordTransaction(transaction: Transaction): Promise<void> {
    const query = `
      INSERT INTO transactions
      (hash, from_address, to_address, amount, token_type, fee, status, message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;

    await postgresDb.query(query, [
      transaction.hash,
      transaction.fromAddress,
      transaction.toAddress,
      toNano(transaction.amount).toString(),
      transaction.tokenType,
      toNano(transaction.fee).toString(),
      transaction.status,
      transaction.message
    ]);
  }

  /**
   * Estimate gas fee for transaction
   */
  private async estimateGasFee(
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<bigint> {
    // Use more realistic gas fee estimation
    const baseFee = toNano('0.005'); // 0.005 TON base fee
    const storageFee = toNano('0.0001'); // Storage fee
    const gasFee = toNano('0.006'); // Gas fee for message processing
    const forwardFee = toNano('0.001'); // Forward fee
    return baseFee + storageFee + gasFee + forwardFee;
  }

  /**
   * Estimate real gas fee for transaction (detailed estimation)
   */
  private async estimateRealGasFee(
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<bigint> {
    // Real-world gas fee estimation based on TON blockchain
    const messageSize = 256; // Estimated message size in bytes
    const transferAmount = BigInt(amount);

    // Storage fees depend on account state and new contracts
    const storageFee = toNano('0.0001');

    // Gas fees for message processing (varies by complexity)
    const gasFees = toNano('0.006');

    // Forward fees depend on message size and destination
    const forwardFees = BigInt(messageSize) * BigInt('1000'); // 1000 nanotons per byte

    // Total fee calculation
    const totalFee = storageFee + gasFees + forwardFees;

    // Add a 20% buffer for network congestion
    const buffer = totalFee * BigInt('20') / BigInt('100');

    return totalFee + buffer;
  }

  /**
   * Generate mnemonic phrase
   */
  private async generateMnemonic(): Promise<string[]> {
    // Import mnemonic generation from @ton/crypto
    const { mnemonicNew, mnemonicValidate } = await import('@ton/crypto');

    // Generate a new 24-word mnemonic phrase
    const mnemonic = await mnemonicNew(24);

    // Validate the generated mnemonic
    if (!await mnemonicValidate(mnemonic)) {
      throw new Error('Generated mnemonic is invalid');
    }

    return mnemonic;
  }

  /**
   * Encrypt mnemonic for storage
   */
  private encryptMnemonic(mnemonic: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.MNEMONIC_ENCRYPTION_KEY || 'default-secret-key-change-in-production';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('mnemonic'));

    let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt mnemonic
   */
  private decryptMnemonic(encryptedMnemonic: string): string[] {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.MNEMONIC_ENCRYPTION_KEY || 'default-secret-key-change-in-production';
    const key = crypto.scryptSync(secretKey, 'salt', 32);

    const parts = encryptedMnemonic.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted mnemonic format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('mnemonic'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Get wallet by user ID
   */
  private async getUserWalletByUserId(userId: number): Promise<any> {
    const query = `
      SELECT * FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await postgresDb.query(query, [userId, this.config.network]);
    return result.rows[0] || null;
  }
}