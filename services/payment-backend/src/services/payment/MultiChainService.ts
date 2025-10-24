import { postgresDb } from '../database';
import { PAYMENT_CHAINS, EXCHANGE_PROVIDERS } from '../../config/payment-chains';
import { TonWalletService } from '../ton/TonWalletService';
import Web3 from 'web3';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

export interface ChainConfig {
  name: string;
  chainId: number;
  nativeCurrency: string;
  decimals: number;
  fee: number;
  speed: number;
  explorerUrl: string;
  rpcEndpoints: string[];
  contracts: Record<string, string>;
  gasLimits: Record<string, number>;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  timestamp: Date;
}

export interface ConversionRequest {
  userId: number;
  fromChain: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAddress: string;
}

export class MultiChainService {
  private tonService: TonWalletService;
  private connections: Map<string, any> = new Map();

  constructor() {
    this.tonService = new TonWalletService();
    this.initializeConnections();
  }

  /**
   * Initialize blockchain connections
   */
  private async initializeConnections() {
    // Initialize TON connection
    await this.tonService;

    // Initialize Solana connection
    this.connections.set('solana', new Connection(PAYMENT_CHAINS.SOLANA.rpcEndpoints[0]));

    // Initialize Polygon connection
    this.connections.set('polygon', new Web3(PAYMENT_CHAINS.POLYGON.rpcEndpoints[0]));

    // Initialize Arbitrum connection
    this.connections.set('arbitrum', new Web3(PAYMENT_CHAINS.ARBITRUM.rpcEndpoints[0]));
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(): Promise<ChainConfig[]> {
    const query = `
      SELECT * FROM payment_chains WHERE is_active = true ORDER BY chain_name
    `;
    const result = await postgresDb.query(query);
    return result.rows;
  }

  /**
   * Get user wallet addresses for all chains
   */
  async getUserWallets(userId: number): Promise<any[]> {
    const query = `
      SELECT * FROM user_crypto_wallets WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC
    `;
    const result = await postgresDb.query(query, [userId]);
    return result.rows;
  }

  /**
   * Add or update user wallet address
   */
  async addOrUpdateWallet(
    userId: number,
    chain: string,
    address: string,
    label?: string,
    isDefault: boolean = false
  ): Promise<any> {
    // If setting as default, unset other defaults
    if (isDefault) {
      await postgresDb.query(
        'UPDATE user_crypto_wallets SET is_default = false WHERE user_id = $1 AND chain = $2',
        [userId, chain]
      );
    }

    const query = `
      INSERT INTO user_crypto_wallets (user_id, chain, address, label, is_default)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, chain, address)
      DO UPDATE SET
        label = EXCLUDED.label,
        is_default = EXCLUDED.is_default,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await postgresDb.query(query, [userId, chain, address, label, isDefault]);
    return result.rows[0];
  }

  /**
   * Get exchange rate from external API
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string = 'USD'): Promise<ExchangeRate> {
    // Check cache first (last 5 minutes)
    const cacheQuery = `
      SELECT * FROM exchange_rates
      WHERE from_currency = $1 AND to_currency = $2
      AND timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const cached = await postgresDb.query(cacheQuery, [fromCurrency, toCurrency]);

    if (cached.rows.length > 0) {
      return cached.rows[0];
    }

    // Fetch from CoinGecko
    try {
      const response = await axios.get(
        `${EXCHANGE_PROVIDERS.COINGECKO.baseUrl}/simple/price`,
        {
          params: {
            ids: fromCurrency.toLowerCase(),
            vs_currencies: toCurrency.toLowerCase(),
            include_24hr_change: true
          }
        }
      );

      const rate = response.data[fromCurrency.toLowerCase()][toCurrency.toLowerCase()];

      // Save to database
      const insertQuery = `
        INSERT INTO exchange_rates (from_currency, to_currency, rate, source)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await postgresDb.query(insertQuery, [fromCurrency, toCurrency, rate, 'coingecko']);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      throw new Error('Unable to fetch exchange rate');
    }
  }

  /**
   * Convert crypto to USDT
   */
  async convertToUSDT(request: ConversionRequest): Promise<string> {
    const { userId, fromChain, fromCurrency, fromAmount, toCurrency, toAddress } = request;

    // Create conversion record
    const insertQuery = `
      INSERT INTO crypto_conversions (
        user_id, from_chain, from_currency, from_amount,
        to_currency, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    const conversion = await postgresDb.query(insertQuery, [
      userId, fromChain, fromCurrency, fromAmount, toCurrency
    ]);

    // Get exchange rate
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const usdtAmount = fromAmount * exchangeRate.rate;
    const fee = usdtAmount * 0.005; // 0.5% conversion fee
    const netAmount = usdtAmount - fee;

    // Update conversion with calculated amounts
    await postgresDb.query(`
      UPDATE crypto_conversions
      SET to_amount = $1, exchange_rate = $2, fee = $3, status = 'processing'
      WHERE id = $4
    `, [netAmount, exchangeRate.rate, fee, conversion.rows[0].id]);

    // Execute the conversion based on chain
    let txHash: string;

    switch (fromChain) {
      case 'ton':
        txHash = await this.convertTONToUSDT(userId, fromAmount, toAddress);
        break;
      case 'solana':
        txHash = await this.convertSolanaToUSDT(userId, fromAmount, toAddress);
        break;
      case 'polygon':
        txHash = await this.convertPolygonToUSDT(userId, fromAmount, toAddress);
        break;
      case 'arbitrum':
        txHash = await this.convertArbitrumToUSDT(userId, fromAmount, toAddress);
        break;
      default:
        throw new Error(`Unsupported chain: ${fromChain}`);
    }

    // Update conversion record
    await postgresDb.query(`
      UPDATE crypto_conversions
      SET status = 'completed', from_tx_hash = $1, completed_at = NOW()
      WHERE id = $2
    `, [txHash, conversion.rows[0].id]);

    return txHash;
  }

  /**
   * Convert TON to USDT
   */
  private async convertTONToUSDT(userId: number, amount: number, toAddress: string): Promise<string> {
    // Use TON service to send USDT
    const txHash = await this.tonService.sendTransaction(userId, {
      toAddress,
      amount: amount.toString(),
      tokenType: 'USDT',
      message: 'Auto-conversion from TON'
    }, 'mainnet');

    return txHash;
  }

  /**
   * Convert Solana to USDT
   */
  private async convertSolanaToUSDT(userId: number, amount: number, toAddress: string): Promise<string> {
    const connection = this.connections.get('solana');
    const userWallets = await this.getUserWallets(userId);
    const solanaWallet = userWallets.find(w => w.chain === 'solana');

    if (!solanaWallet) {
      throw new Error('No Solana wallet found for user');
    }

    // Create transaction to swap SOL for USDT
    // This would typically use a DEX like Jupiter or Raydium
    // Simplified for demonstration
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(solanaWallet.address),
        toPubkey: new PublicKey(toAddress),
        lamports: amount * LAMPORTS_PER_SOL
      })
    );

    // Sign and send transaction (would need user's private key in real implementation)
    const signature = await connection.sendRawTransaction(transaction.serialize());

    return signature;
  }

  /**
   * Convert Polygon MATIC to USDT
   */
  private async convertPolygonToUSDT(userId: number, amount: number, toAddress: string): Promise<string> {
    const web3 = this.connections.get('polygon') as Web3;
    const userWallets = await this.getUserWallets(userId);
    const polygonWallet = userWallets.find(w => w.chain === 'polygon');

    if (!polygonWallet) {
      throw new Error('No Polygon wallet found for user');
    }

    // Create transaction to swap MATIC for USDT
    // This would typically use a DEX like Uniswap or QuickSwap
    const txHash = await web3.eth.sendTransaction({
      from: polygonWallet.address,
      to: toAddress,
      value: web3.utils.toWei(amount.toString(), 'ether'),
      gas: PAYMENT_CHAINS.POLYGON.gasLimits.tokenTransfer
    });

    return txHash.transactionHash || txHash;
  }

  /**
   * Convert Arbitrum ETH to USDT
   */
  private async convertArbitrumToUSDT(userId: number, amount: number, toAddress: string): Promise<string> {
    const web3 = this.connections.get('arbitrum') as Web3;
    const userWallets = await this.getUserWallets(userId);
    const arbitrumWallet = userWallets.find(w => w.chain === 'arbitrum');

    if (!arbitrumWallet) {
      throw new Error('No Arbitrum wallet found for user');
    }

    // Create transaction to swap ETH for USDT
    const txHash = await web3.eth.sendTransaction({
      from: arbitrumWallet.address,
      to: toAddress,
      value: web3.utils.toWei(amount.toString(), 'ether'),
      gas: PAYMENT_CHAINS.ARBITRUM.gasLimits.tokenTransfer
    });

    return txHash.transactionHash || txHash;
  }

  /**
   * Get transaction status across chains
   */
  async getTransactionStatus(txHash: string, chain: string): Promise<any> {
    switch (chain) {
      case 'ton':
        return await this.tonService.monitorTransaction(txHash, 'mainnet');

      case 'solana':
        const solConnection = this.connections.get('solana');
        return await solConnection.getSignatureStatus(txHash);

      case 'polygon':
        const polyWeb3 = this.connections.get('polygon') as Web3;
        return await polyWeb3.eth.getTransactionReceipt(txHash);

      case 'arbitrum':
        const arbWeb3 = this.connections.get('arbitrum') as Web3;
        return await arbWeb3.eth.getTransactionReceipt(txHash);

      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Get chain balance for user
   */
  async getChainBalance(userId: number, chain: string): Promise<{ balance: number; usdValue: number }> {
    const userWallets = await this.getUserWallets(userId);
    const wallet = userWallets.find(w => w.chain === chain);

    if (!wallet) {
      return { balance: 0, usdValue: 0 };
    }

    const chainConfig = PAYMENT_CHAINS[chain.toUpperCase() as keyof typeof PAYMENT_CHAINS];
    let balance = 0;

    switch (chain) {
      case 'ton':
        const tonBalance = await this.tonService.getWalletBalance(wallet.address, 'mainnet');
        balance = parseFloat(tonBalance.ton);
        break;

      case 'solana':
        const solConnection = this.connections.get('solana');
        const solBalance = await solConnection.getBalance(new PublicKey(wallet.address));
        balance = solBalance / LAMPORTS_PER_SOL;
        break;

      case 'polygon':
        const polyWeb3 = this.connections.get('polygon') as Web3;
        const polyBalance = await polyWeb3.eth.getBalance(wallet.address);
        balance = parseFloat(polyWeb3.utils.fromWei(polyBalance, 'ether'));
        break;

      case 'arbitrum':
        const arbWeb3 = this.connections.get('arbitrum') as Web3;
        const arbBalance = await arbWeb3.eth.getBalance(wallet.address);
        balance = parseFloat(arbWeb3.utils.fromWei(arbBalance, 'ether'));
        break;
    }

    // Convert to USD
    const exchangeRate = await this.getExchangeRate(chainConfig.nativeCurrency);
    const usdValue = balance * exchangeRate.rate;

    return { balance, usdValue };
  }

  /**
   * Batch auto-conversion for large balances
   */
  async processAutoConversions(): Promise<void> {
    const usersQuery = `
      SELECT DISTINCT user_id FROM user_crypto_wallets
      WHERE chain IN ('ton', 'solana', 'polygon', 'arbitrum')
    `;
    const users = await postgresDb.query(usersQuery);

    for (const user of users.rows) {
      const balances = [];

      // Check each chain balance
      for (const chain of ['ton', 'solana', 'polygon', 'arbitrum']) {
        const { balance, usdValue } = await this.getChainBalance(user.user_id, chain);

        if (usdValue > 1000) { // Auto-convert threshold
          balances.push({ chain, balance, usdValue });
        }
      }

      // Convert balances to USDT
      for (const balanceInfo of balances) {
        try {
          const userWallets = await this.getUserWallets(user.user_id);
          const wallet = userWallets.find(w => w.chain === balanceInfo.chain);

          if (wallet) {
            await this.convertToUSDT({
              userId: user.user_id,
              fromChain: balanceInfo.chain,
              fromCurrency: PAYMENT_CHAINS[balanceInfo.chain.toUpperCase() as keyof typeof PAYMENT_CHAINS].nativeCurrency,
              fromAmount: balanceInfo.balance,
              toCurrency: 'USDT',
              toAddress: wallet.address
            });
          }
        } catch (error) {
          console.error(`Auto-conversion failed for user ${user.user_id}:`, error);
        }
      }
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT
        DATE(created_at) as date,
        chain,
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_usdt), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees,
        COUNT(DISTINCT user_id) as unique_users,
        COALESCE(AVG(amount_usdt), 0) as avg_transaction_value
      FROM ton_transactions
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at), chain
      ORDER BY date DESC, chain
    `;

    const result = await postgresDb.query(query, [startDate, endDate]);
    return result.rows;
  }

  /**
   * Get conversion history for user
   */
  async getUserConversionHistory(userId: number, limit: number = 50): Promise<any[]> {
    const query = `
      SELECT * FROM crypto_conversions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await postgresDb.query(query, [userId, limit]);
    return result.rows;
  }
}