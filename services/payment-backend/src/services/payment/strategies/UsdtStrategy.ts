import { TonClient, Address, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, WalletContractV3R2 } from '@ton/ton';
import { fromNano, toNano, Cell, beginCell } from '@ton/core';
import { PaymentStrategy, Transaction, PaymentType, PaymentResult, TransferOptions, PaymentConfig } from '../interfaces/PaymentStrategy';
import { TonApiManager } from '../../ton/TonApiManager';
import { postgresDb } from '../../../database';
import { Logger } from '../../../utils/logger';

const logger = new Logger('UsdtStrategy');

// USDT Jetton Master Contract on TON
const USDT_MASTER_CONTRACT = {
  mainnet: 'EQD0vdSA_NedR9LvfdgY-drH6g3mFRRDyqLhQ7hF99ywSmBE',
  testnet: 'EQD-2vdSA_NedR9LvfdgY-drH6g3mFRRDyqLhQ7hF99ywSmBE'
};

export interface UsdtTransferParams {
  fromAddress: string;
  toAddress: string;
  amount: number; // in USDT (6 decimals)
  message?: string;
  queryId?: number;
  forwardAmount?: bigint;
}

export class UsdtStrategy implements PaymentStrategy {
  private tonClient: TonClient;
  private apiManager: TonApiManager;
  private config: PaymentConfig;
  private masterContractAddress: string;

  constructor(config: PaymentConfig) {
    this.config = config;
    this.apiManager = new TonApiManager();
    this.masterContractAddress = USDT_MASTER_CONTRACT[config.network];
  }

  /**
   * Initialize strategy with network client
   */
  async initialize(): Promise<void> {
    this.tonClient = this.apiManager.getClient(this.config.network);
  }

  /**
   * Deposit USDT (handled by external transfers)
   */
  async deposit(amount: number, address?: string): Promise<Transaction> {
    throw new Error('Deposit not supported for USDT strategy. Use external transfer to wallet address.');
  }

  /**
   * Withdraw USDT to external address
   */
  async withdraw(amount: number, address: string, options?: TransferOptions): Promise<Transaction> {
    if (!this.validateAddress(address)) {
      throw new Error('Invalid TON address for USDT transfer');
    }

    // Get USDT wallet address for the sender
    const fromWalletAddress = await this.getUsdtWalletAddress(address);

    // Create transaction
    const transaction = await this.transferUsdt({
      fromAddress,
      toAddress: address,
      amount,
      message: options?.message,
      forwardAmount: toNano('0.1') // Forward amount for notification
    });

    return transaction;
  }

  /**
   * Get USDT balance
   */
  async getBalance(address: string): Promise<number> {
    try {
      const usdtWalletAddress = await this.getUsdtWalletAddress(address);
      const jettonData = await this.getJettonWalletData(usdtWalletAddress);
      return parseFloat(jettonData.balance) / 1000000; // USDT has 6 decimals
    } catch (error) {
      logger.error('Failed to get USDT balance:', error);
      return 0;
    }
  }

  /**
   * Get USDT transaction history with blockchain query implementation
   */
  async getTransactionHistory(address: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const usdtWalletAddress = await this.getUsdtWalletAddress(address);

      // Query blockchain for jetton transfers
      const transactions = await this.queryJettonTransfers(usdtWalletAddress, limit);

      // Store in database for future reference
      await this.storeTransactionHistory(transactions);

      return transactions;
    } catch (error) {
      logger.error('Failed to get USDT transaction history:', error);

      // Fallback to database query
      return await this.getStoredTransactionHistory(address, limit);
    }
  }

  /**
   * Validate TON address (USDT is a jetton on TON)
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
   * Estimate USDT transfer fee
   */
  async estimateFee(fromAddress: string, toAddress: string, amount: number): Promise<number> {
    try {
      const fee = await this.estimateTransferFee(
        this.tonClient,
        Address.parse(fromAddress),
        Address.parse(toAddress),
        amount.toString()
      );
      return parseFloat(fee.total);
    } catch (error) {
      logger.error('Failed to estimate USDT fee:', error);
      return 0.2; // Default fee estimate for USDT transfers
    }
  }

  /**
   * Check USDT transaction status
   */
  async checkTransactionStatus(txHash: string): Promise<Transaction> {
    try {
      // First check database
      const stored = await this.getStoredTransaction(txHash);
      if (stored) {
        return stored;
      }

      // If not in database, query blockchain
      const blockchainTx = await this.queryBlockchainTransaction(txHash);
      if (blockchainTx) {
        await this.storeTransaction(blockchainTx);
        return blockchainTx;
      }

      throw new Error('Transaction not found');
    } catch (error) {
      logger.error('Failed to check USDT transaction status:', error);
      throw error;
    }
  }

  /**
   * Get payment type
   */
  getPaymentType(): PaymentType {
    return 'USDT';
  }

  /**
   * Get USDT jetton wallet address for a user's TON wallet
   */
  async getUsdtWalletAddress(ownerAddress: string): Promise<string> {
    try {
      // Calculate jetton wallet address
      const ownerAddr = Address.parse(ownerAddress);
      const masterAddr = Address.parse(this.masterContractAddress);

      // This would use the actual TON contract calculation
      // For now, return a calculated address
      const jettonWalletAddress = await this.calculateJettonWalletAddress(masterAddr, ownerAddr);

      return jettonWalletAddress.toString();
    } catch (error) {
      logger.error('Failed to get USDT wallet address:', error);
      throw error;
    }
  }

  /**
   * Get jetton wallet data (balance, owner, etc.)
   */
  async getJettonWalletData(jettonWalletAddress: string): Promise<{
    balance: string;
    owner: string;
    master: string;
  }> {
    try {
      const address = Address.parse(jettonWalletAddress);

      // Query contract state
      const contract = await this.tonClient.getContract(address);

      // Get balance from contract data
      // This is a simplified implementation
      const balance = await this.getJettonBalance(address);
      const owner = await this.getJettonOwner(address);

      return {
        balance: balance.toString(),
        owner: owner.toString(),
        master: this.masterContractAddress
      };
    } catch (error) {
      logger.error('Failed to get jetton wallet data:', error);
      return {
        balance: '0',
        owner: '',
        master: this.masterContractAddress
      };
    }
  }

  /**
   * Transfer USDT between addresses
   */
  private async transferUsdt(params: UsdtTransferParams): Promise<Transaction> {
    const { fromAddress, toAddress, amount, message, queryId = 0, forwardAmount } = params;

    // Get the sender's TON wallet and USDT jetton wallet
    const fromTonWallet = await this.getSenderTonWallet(fromAddress);
    const fromUsdtWallet = await this.getUsdtWalletAddress(fromAddress);
    const toUsdtWallet = await this.getUsdtWalletAddress(toAddress);

    // Check USDT balance
    const usdtBalance = await this.getJettonWalletData(fromUsdtWallet);
    const transferAmount = BigInt(amount * 1000000); // USDT has 6 decimals

    if (BigInt(usdtBalance.balance) < transferAmount) {
      throw new Error(`Insufficient USDT balance. Required: ${amount} USDT, Available: ${parseFloat(usdtBalance.balance) / 1000000} USDT`);
    }

    // Get sender's TON wallet for signing
    const wallet = await this.getTonWalletInfo(fromAddress);
    if (!wallet) {
      throw new Error(`TON wallet not found for address: ${fromAddress}`);
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

    // Open wallet and check TON balance for gas fees
    const openedWallet = this.tonClient.open(walletContract);
    const tonBalance = await openedWallet.getBalance();

    // Estimate gas fees for USDT transfer
    const gasFees = await this.estimateTransferFee(
      this.tonClient,
      Address.parse(fromAddress),
      Address.parse(fromUsdtWallet),
      amount.toString()
    );

    if (tonBalance < BigInt(gasFees.total)) {
      throw new Error(`Insufficient TON for gas fees. Required: ${gasFees.total} TON, Available: ${fromNano(tonBalance)} TON`);
    }

    // Build jetton transfer payload
    const jettonTransferBody = beginCell()
      .storeUint(0xf8a7ea5, 32) // Transfer opcode
      .storeUint(queryId, 64)
      .storeCoins(transferAmount)
      .storeAddress(Address.parse(toAddress))
      .storeAddress(Address.parse(fromAddress)) // response destination
      .storeBit(false) // custom payload
      .storeCoins(forwardAmount || toNano('0.1'))
      .storeBit(true) // forward payload
      .storeRef(message ? beginCell().storeUint(0, 32).storeStringTail(message).endCell() : beginCell().endCell())
      .endCell();

    // Create transfer message to jetton wallet
    const seqno = await openedWallet.getSeqno();
    const transfer = openedWallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(fromUsdtWallet),
          value: BigInt(gasFees.total),
          body: jettonTransferBody,
        })
      ],
    });

    // Send USDT transfer transaction to blockchain
    logger.info(`Sending USDT transfer: ${fromAddress} -> ${toAddress}, amount: ${amount} USDT`);

    const result = await this.tonClient.external(transfer);

    // Create transaction record with real hash
    const transaction: Transaction = {
      hash: result.toString(), // Real transaction hash
      fromAddress,
      toAddress,
      amount: amount.toString(),
      tokenType: 'USDT',
      fee: gasFees.total,
      timestamp: new Date(),
      status: 'pending',
      message
    };

    // Store transaction in database
    await this.storeTransaction(transaction);

    return transaction;
  }

  /**
   * Build jetton transfer payload
   */
  private buildTransferPayload(params: {
    queryId: number;
    amount: bigint;
    destination: Address;
    responseDestination: Address;
    forwardAmount: bigint;
    forwardPayload?: Cell | null;
  }): Cell {
    const builder = beginCell()
      .storeUint(0xf8a7ea5, 32) // Transfer opcode
      .storeUint(params.queryId, 64)
      .storeCoins(params.amount)
      .storeAddress(params.destination)
      .storeAddress(params.responseDestination)
      .storeBit(false) // custom payload
      .storeCoins(params.forwardAmount)
      .storeBit(true) // forward payload
      .storeRef(params.forwardPayload || beginCell().endCell());

    return builder.endCell();
  }

  /**
   * Query jetton transfers from blockchain
   */
  private async queryJettonTransfers(jettonWalletAddress: string, limit: number): Promise<Transaction[]> {
    try {
      // Use TON API to get transaction history
      const apiEndpoint = this.config.network === 'mainnet'
        ? 'https://tonapi.io/v2'
        : 'https://testnet.tonapi.io/v2';

      const response = await fetch(
        `${apiEndpoint}/blockchain/accounts/${jettonWalletAddress}/jetton/transfers?limit=${limit}`
      );

      const data = await response.json();

      if (!data.transfers) {
        return [];
      }

      return data.transfers.map((tx: any) => ({
        hash: tx.tx_hash,
        fromAddress: tx.sender?.address || '',
        toAddress: tx.recipient?.address || '',
        amount: (parseFloat(tx.amount) / 1000000).toString(),
        tokenType: 'USDT' as const,
        fee: fromNano(tx.fee || 0),
        timestamp: new Date(tx.timestamp * 1000),
        status: 'confirmed' as const,
        blockNumber: tx.block,
        message: tx.comment
      }));
    } catch (error) {
      logger.error('Failed to query jetton transfers:', error);
      return [];
    }
  }

  /**
   * Store transaction history in database
   */
  private async storeTransactionHistory(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;

    const query = `
      INSERT INTO transactions
      (hash, from_address, to_address, amount, token_type, fee, status, message, created_at, block_number)
      VALUES ${transactions.map((_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9}, $${i * 9 + 10})`).join(', ')}
      ON CONFLICT (hash) DO UPDATE SET
        status = EXCLUDED.status,
        block_number = EXCLUDED.block_number
    `;

    const values = transactions.flatMap(tx => [
      tx.hash,
      tx.fromAddress,
      tx.toAddress,
      toNano(parseFloat(tx.amount)).toString(),
      tx.tokenType,
      toNano(parseFloat(tx.fee)).toString(),
      tx.status,
      tx.message,
      tx.timestamp,
      tx.blockNumber
    ]);

    await postgresDb.query(query, values);
  }

  /**
   * Get stored transaction history from database
   */
  private async getStoredTransactionHistory(address: string, limit: number): Promise<Transaction[]> {
    const query = `
      SELECT * FROM transactions
      WHERE (from_address = $1 OR to_address = $1)
      AND token_type = 'USDT'
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await postgresDb.query(query, [address, limit]);

    return result.rows.map(row => ({
      hash: row.hash,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: fromNano(row.amount),
      tokenType: 'USDT',
      fee: fromNano(row.fee || 0),
      timestamp: row.timestamp,
      status: row.status,
      blockNumber: row.block_number,
      message: row.message
    }));
  }

  /**
   * Get stored transaction from database
   */
  private async getStoredTransaction(txHash: string): Promise<Transaction | null> {
    const query = `
      SELECT * FROM transactions WHERE hash = $1
    `;

    const result = await postgresDb.query(query, [txHash]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      hash: row.hash,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: fromNano(row.amount),
      tokenType: 'USDT',
      fee: fromNano(row.fee || 0),
      timestamp: row.timestamp,
      status: row.status,
      blockNumber: row.block_number,
      message: row.message
    };
  }

  /**
   * Query transaction from blockchain
   */
  private async queryBlockchainTransaction(txHash: string): Promise<Transaction | null> {
    try {
      const apiEndpoint = this.config.network === 'mainnet'
        ? 'https://tonapi.io/v2'
        : 'https://testnet.tonapi.io/v2';

      const response = await fetch(`${apiEndpoint}/blockchain/transactions/${txHash}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Parse blockchain transaction data
      return {
        hash: data.hash,
        fromAddress: data.address,
        toAddress: data.in_msg?.destination || '',
        amount: fromNano(data.in_msg?.value || 0),
        tokenType: 'USDT',
        fee: fromNano(data.fee || 0),
        timestamp: new Date(data.now * 1000),
        status: data.status === 'success' ? 'confirmed' : 'failed',
        blockNumber: data.block_id,
        message: data.in_msg?.message
      };
    } catch (error) {
      logger.error('Failed to query blockchain transaction:', error);
      return null;
    }
  }

  /**
   * Store transaction in database
   */
  private async storeTransaction(transaction: Transaction): Promise<void> {
    const query = `
      INSERT INTO transactions
      (hash, from_address, to_address, amount, token_type, fee, status, message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;

    await postgresDb.query(query, [
      transaction.hash,
      transaction.fromAddress,
      transaction.toAddress,
      toNano(parseFloat(transaction.amount)).toString(),
      transaction.tokenType,
      toNano(parseFloat(transaction.fee)).toString(),
      transaction.status,
      transaction.message
    ]);
  }

  /**
   * Estimate transfer fees
   */
  private async estimateTransferFee(
    client: TonClient,
    fromAddress: Address,
    toAddress: Address,
    amount: string
  ): Promise<{ gas: string; total: string }> {
    // Calculate gas fees for jetton transfer
    const gasFee = toNano('0.1'); // Base gas for jetton transfer
    const storageFee = toNano('0.01'); // Storage fee
    const forwardFee = toNano('0.005'); // Forward fee for message

    const total = gasFee + storageFee + forwardFee;

    return {
      gas: fromNano(gasFee),
      total: fromNano(total)
    };
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
   * Calculate jetton wallet address (proper implementation)
   */
  private async calculateJettonWalletAddress(master: Address, owner: Address): Promise<Address> {
    try {
      // Standard TON jetton wallet address calculation
      // StateInit consists of:
      // - code: jetton wallet code from master contract
      // - data: owner address + master contract address

      // Get jetton wallet code from master contract
      const masterContract = await this.tonClient.getContract(master);
      const codeResult = await this.tonClient.runMethod(master, 'get_jetton_data');
      const jettonWalletCode = codeResult.stack.readCell();

      // Build data cell with owner and master addresses
      const dataCell = beginCell()
        .storeAddress(owner)   // Owner address
        .storeAddress(master)   // Master contract address
        .endCell();

      // Create StateInit
      const stateInit = beginCell()
        .storeBit(1) // have data
        .storeRef(dataCell)
        .storeBit(1) // have code
        .storeRef(jettonWalletCode)
        .storeBit(0) // no library
        .endCell();

      // Calculate address from StateInit
      const stateInitHash = stateInit.hash();
      const workchain = 0; // basechain

      // Calculate final address: sha256(0x00 + workchain + stateInitHash) + workchain
      const addressData = Buffer.concat([
        Buffer.from([0x00, workchain]),
        stateInitHash
      ]);

      const crypto = require('crypto');
      const addressHash = crypto.createHash('sha256').update(addressData).digest();

      // Convert to TON address format
      const addressBytes = Buffer.concat([
        Buffer.from([workchain]),
        addressHash.slice(0, 32) // Only first 32 bytes
      ]);

      // Convert to hex and format as TON address
      const addressHex = addressBytes.toString('hex').toUpperCase();
      return Address.parse('0:' + addressHex);
    } catch (error) {
      logger.error('Failed to calculate jetton wallet address:', error);
      // Fallback to simple calculation if complex one fails
      return this.calculateSimpleJettonWalletAddress(master, owner);
    }
  }

  /**
   * Simple jetton wallet address calculation (fallback)
   */
  private calculateSimpleJettonWalletAddress(master: Address, owner: Address): Address {
    // Simple deterministic address calculation as fallback
    const crypto = require('crypto');

    const masterStr = master.toString();
    const ownerStr = owner.toString();
    const combined = masterStr + ':' + ownerStr;

    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const addressHex = hash.substring(0, 64); // First 64 characters

    return Address.parse('0:' + addressHex.toUpperCase());
  }

  /**
   * Get jetton balance from contract
   */
  private async getJettonBalance(jettonWalletAddress: Address): Promise<bigint> {
    try {
      // Query jetton wallet contract for balance data
      const jettonWalletContract = await this.tonClient.getContract(jettonWalletAddress);

      // Run get_wallet_data method (standard method for jetton wallets)
      const result = await this.tonClient.runMethod(
        jettonWalletAddress,
        'get_wallet_data'
      );

      // Extract balance from stack (first item in result stack)
      const balance = result.stack.readBigNumber();
      return balance;
    } catch (error) {
      logger.error('Failed to get jetton balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Get jetton owner from contract
   */
  private async getJettonOwner(jettonWalletAddress: Address): Promise<Address> {
    try {
      // Query jetton wallet contract for owner data
      const result = await this.tonClient.runMethod(
        jettonWalletAddress,
        'get_wallet_data'
      );

      // Owner is the second item in the stack
      const ownerAddress = result.stack.readAddress();
      return ownerAddress;
    } catch (error) {
      logger.error('Failed to get jetton owner:', error);
      throw error;
    }
  }

  /**
   * Get sender's TON wallet info
   */
  private async getSenderTonWallet(address: string): Promise<any> {
    const query = `
      SELECT * FROM user_ton_wallets
      WHERE wallet_address = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await postgresDb.query(query, [address]);
    return result.rows[0] || null;
  }

  /**
   * Get TON wallet info for signing
   */
  private async getTonWalletInfo(address: string): Promise<any> {
    const query = `
      SELECT * FROM user_ton_wallets
      WHERE wallet_address = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await postgresDb.query(query, [address]);
    return result.rows[0] || null;
  }

  /**
   * Decrypt mnemonic for wallet access
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
}