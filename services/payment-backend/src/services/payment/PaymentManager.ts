import { PaymentStrategy, PaymentType, Transaction, PaymentResult, TransferOptions, PaymentConfig } from './interfaces/PaymentStrategy';
import { TonWalletStrategy } from './strategies/TonWalletStrategy';
import { UsdtStrategy } from './strategies/UsdtStrategy';
import { TransactionHistoryService } from './TransactionHistoryService';
import { FeeCalculationService } from './FeeCalculationService';
import { PaymentValidationService, ValidationResult } from './PaymentValidationService';
import { Logger } from '../../utils/logger';

const logger = new Logger('PaymentManager');

export interface PaymentRequest {
  type: PaymentType;
  fromAddress: string;
  toAddress: string;
  amount: number;
  userId?: number;
  message?: string;
  options?: TransferOptions;
}

export interface BatchPaymentRequest {
  payments: PaymentRequest[];
  userId?: number;
  validateAll?: boolean;
  stopOnFirstError?: boolean;
}

export interface PaymentManagerConfig {
  network: 'mainnet' | 'testnet';
  enableValidation: boolean;
  enableCaching: boolean;
  defaultFeeMultiplier: number;
  maxRetries: number;
  timeoutMs: number;
}

export class PaymentManager {
  private strategies: Map<PaymentType, PaymentStrategy>;
  private transactionHistoryService: TransactionHistoryService;
  private feeCalculationService: FeeCalculationService;
  private validationService: PaymentValidationService;
  private config: PaymentManagerConfig;

  constructor(config: PaymentManagerConfig) {
    this.config = config;
    this.strategies = new Map();
    this.transactionHistoryService = new TransactionHistoryService();
    this.feeCalculationService = new FeeCalculationService();
    this.validationService = new PaymentValidationService();

    // Initialize default strategies
    this.initializeStrategies();
  }

  /**
   * Initialize payment strategies
   */
  private async initializeStrategies(): Promise<void> {
    const paymentConfig: PaymentConfig = {
      network: this.config.network,
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      feeMultiplier: this.config.defaultFeeMultiplier
    };

    // Initialize TON strategy
    const tonStrategy = new TonWalletStrategy(paymentConfig);
    await tonStrategy.initialize();
    this.strategies.set('TON', tonStrategy);

    // Initialize USDT strategy
    const usdtStrategy = new UsdtStrategy(paymentConfig);
    await usdtStrategy.initialize();
    this.strategies.set('USDT', usdtStrategy);

    logger.info(`Initialized ${this.strategies.size} payment strategies`);
  }

  /**
   * Process a single payment
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      logger.info(`Processing ${request.type} payment: ${request.fromAddress} -> ${request.toAddress}, amount: ${request.amount}`);

      // Validate request if enabled
      if (this.config.enableValidation) {
        const validation = await this.validatePayment(request);
        if (!validation.isValid) {
          return {
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`,
            errorCode: 'VALIDATION_FAILED'
          };
        }

        if (validation.warnings.length > 0) {
          logger.warn(`Payment validation warnings: ${validation.warnings.join(', ')}`);
        }
      }

      // Get appropriate strategy
      const strategy = this.strategies.get(request.type);
      if (!strategy) {
        return {
          success: false,
          error: `Unsupported payment type: ${request.type}`,
          errorCode: 'UNSUPPORTED_TYPE'
        };
      }

      // Process payment with retries
      const transaction = await this.executeWithRetry(
        () => strategy.withdraw(request.amount, request.toAddress, request.options),
        this.config.maxRetries
      );

      // Record transaction if needed
      if (transaction) {
        await this.transactionHistoryService.storeTransaction(transaction);
      }

      return {
        success: true,
        transaction
      };
    } catch (error) {
      logger.error('Payment processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'PROCESSING_FAILED'
      };
    }
  }

  /**
   * Process batch payments
   */
  async processBatchPayments(request: BatchPaymentRequest): Promise<{
    results: PaymentResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalAmount: number;
    };
  }> {
    const results: PaymentResult[] = [];
    let successful = 0;
    let failed = 0;
    let totalAmount = 0;

    logger.info(`Processing batch payment with ${request.payments.length} payments`);

    // Validate all payments upfront if requested
    if (request.validateAll) {
      for (const payment of request.payments) {
        const validation = await this.validatePayment(payment);
        if (!validation.isValid) {
          results.push({
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`,
            errorCode: 'VALIDATION_FAILED'
          });
          failed++;
          if (request.stopOnFirstError) {
            break;
          }
        }
      }

      if (request.stopOnFirstError && failed > 0) {
        return {
          results,
          summary: { total: request.payments.length, successful, failed, totalAmount }
        };
      }
    }

    // Process payments
    for (let i = 0; i < request.payments.length; i++) {
      const payment = request.payments[i];

      // Skip if already validated and failed
      if (request.validateAll && results[i] && !results[i].success) {
        continue;
      }

      const result = await this.processPayment(payment);
      results.push(result);

      if (result.success) {
        successful++;
        totalAmount += payment.amount;
      } else {
        failed++;
        if (request.stopOnFirstError) {
          break;
        }
      }
    }

    const summary = {
      total: request.payments.length,
      successful,
      failed,
      totalAmount
    };

    logger.info(`Batch payment completed: ${successful}/${summary.total} successful, total amount: ${totalAmount}`);

    return { results, summary };
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string, tokenType: PaymentType): Promise<number> {
    const strategy = this.strategies.get(tokenType);
    if (!strategy) {
      throw new Error(`Unsupported payment type: ${tokenType}`);
    }

    return await strategy.getBalance(address);
  }

  /**
   * Get balances for multiple tokens
   */
  async getBalances(address: string, tokenTypes: PaymentType[]): Promise<Record<PaymentType, number>> {
    const balances: Partial<Record<PaymentType, number>> = {};
    const promises = tokenTypes.map(async (type) => {
      try {
        balances[type] = await this.getBalance(address, type);
      } catch (error) {
        logger.error(`Failed to get ${type} balance:`, error);
        balances[type] = 0;
      }
    });

    await Promise.all(promises);
    return balances as Record<PaymentType, number>;
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    address: string,
    tokenType?: PaymentType,
    limit: number = 50
  ): Promise<Transaction[]> {
    if (tokenType) {
      const strategy = this.strategies.get(tokenType);
      if (!strategy) {
        throw new Error(`Unsupported payment type: ${tokenType}`);
      }
      return await strategy.getTransactionHistory(address, limit);
    }

    // Get history for all token types
    const allTransactions: Transaction[] = [];
    for (const [type, strategy] of this.strategies) {
      try {
        const transactions = await strategy.getTransactionHistory(address, Math.ceil(limit / this.strategies.size));
        allTransactions.push(...transactions);
      } catch (error) {
        logger.error(`Failed to get ${type} transaction history:`, error);
      }
    }

    // Sort by timestamp and limit
    return allTransactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Estimate fee for payment
   */
  async estimateFee(request: PaymentRequest): Promise<number> {
    if (request.type === 'TON') {
      return await this.feeCalculationService.calculateTonTransferFee(
        request.fromAddress,
        request.toAddress,
        request.amount,
        request.message
      ).then(fee => fee.totalFee);
    } else if (request.type === 'USDT') {
      return await this.feeCalculationService.calculateUsdtTransferFee(
        request.fromAddress,
        request.toAddress,
        request.amount,
        request.message
      ).then(fee => fee.totalFee);
    }

    throw new Error(`Cannot estimate fee for payment type: ${request.type}`);
  }

  /**
   * Validate payment request
   */
  async validatePayment(request: PaymentRequest): Promise<ValidationResult> {
    return await this.validationService.validateTransfer({
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      amount: request.amount,
      tokenType: request.type,
      userId: request.userId,
      memo: request.message
    });
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(txHash: string, tokenType: PaymentType): Promise<Transaction> {
    const strategy = this.strategies.get(tokenType);
    if (!strategy) {
      throw new Error(`Unsupported payment type: ${tokenType}`);
    }

    return await strategy.checkTransactionStatus(txHash);
  }

  /**
   * Add new payment strategy
   */
  async addStrategy(type: PaymentType, strategy: PaymentStrategy): Promise<void> {
    await strategy.initialize();
    this.strategies.set(type, strategy);
    logger.info(`Added payment strategy: ${type}`);
  }

  /**
   * Remove payment strategy
   */
  removeStrategy(type: PaymentType): void {
    if (this.strategies.has(type)) {
      this.strategies.delete(type);
      logger.info(`Removed payment strategy: ${type}`);
    }
  }

  /**
   * Get available payment types
   */
  getAvailablePaymentTypes(): PaymentType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxRetries) {
          break;
        }

        logger.warn(`Payment attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        await this.sleep(delay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    throw lastError!;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PaymentManagerConfig>): void {
    Object.assign(this.config, updates);
    logger.info('Updated payment manager config:', updates);
  }

  /**
   * Get configuration
   */
  getConfig(): PaymentManagerConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    availableStrategies: PaymentType[];
    transactionStats: any;
    feeStats: any;
  }> {
    const transactionStats = await this.transactionHistoryService.getTransactionStats();
    const feeStats = await this.feeCalculationService.getFeeStats();

    return {
      availableStrategies: this.getAvailablePaymentTypes(),
      transactionStats,
      feeStats
    };
  }
}