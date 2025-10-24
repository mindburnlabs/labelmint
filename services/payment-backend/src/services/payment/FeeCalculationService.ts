import { TonClient, Address } from '@ton/ton';
import { toNano } from '@ton/core';
import { postgresDb } from '../../database';
import { Logger } from '../../utils/logger';

const logger = new Logger('FeeCalculationService');

export interface FeeEstimate {
  gasFee: number;
  storageFee: number;
  forwardFee: number;
  totalFee: number;
  currency: 'TON';
  confidence: number; // 0-1, how confident we are in this estimate
}

export interface DynamicFeeConfig {
  baseFee: number;
  multiplier: number;
  surgeMultiplier: number;
  maxFee: number;
  minFee: number;
}

export interface NetworkLoadMetrics {
  averageGasPrice: number;
  networkUtilization: number;
  pendingTransactions: number;
  blockTime: number;
}

export class FeeCalculationService {
  private feeCache: Map<string, { estimate: FeeEstimate; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private readonly DEFAULT_FEES = {
    TON: {
      transfer: 0.005, // 0.005 TON for simple transfer
      smartContract: 0.02, // 0.02 TON for smart contract interaction
      jettonTransfer: 0.1 // 0.1 TON for jetton transfer
    },
    USDT: {
      transfer: 0.1, // 0.1 TON for USDT transfer (higher due to jetton)
      deploy: 0.2, // 0.2 TON for jetton wallet deployment
      mint: 0.15 // 0.15 TON for USDT mint operation
    }
  };

  private readonly dynamicConfig: DynamicFeeConfig = {
    baseFee: 0.005,
    multiplier: 1.0,
    surgeMultiplier: 2.0,
    maxFee: 1.0,
    minFee: 0.001
  };

  /**
   * Calculate fee for TON transfer
   */
  async calculateTonTransferFee(
    fromAddress: string,
    toAddress: string,
    amount: number,
    message?: string
  ): Promise<FeeEstimate> {
    const cacheKey = `ton:${fromAddress}:${toAddress}:${amount}`;

    // Check cache first
    const cached = this.getCachedFee(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Base gas fee for TON transfer
      let gasFee = this.DEFAULT_FEES.TON.transfer;

      // Add fee for message if present
      if (message && message.length > 0) {
        gasFee += 0.0001 * Math.ceil(message.length / 100); // 0.0001 TON per 100 chars
      }

      // Dynamic adjustment based on network load
      const networkLoad = await this.getNetworkLoadMetrics();
      const adjustedMultiplier = this.calculateFeeMultiplier(networkLoad);

      gasFee *= adjustedMultiplier;

      // Storage fee (minimal for regular transfer)
      const storageFee = 0.0001;

      // Forward fee for message
      const forwardFee = message ? 0.00005 : 0;

      const totalFee = Math.min(
        Math.max(gasFee + storageFee + forwardFee, this.dynamicConfig.minFee),
        this.dynamicConfig.maxFee
      );

      const estimate: FeeEstimate = {
        gasFee,
        storageFee,
        forwardFee,
        totalFee,
        currency: 'TON',
        confidence: 0.95
      };

      // Cache the estimate
      this.cacheFee(cacheKey, estimate);

      return estimate;
    } catch (error) {
      logger.error('Failed to calculate TON transfer fee:', error);
      return this.getDefaultTonFee();
    }
  }

  /**
   * Calculate fee for USDT transfer
   */
  async calculateUsdtTransferFee(
    fromAddress: string,
    toAddress: string,
    amount: number,
    message?: string
  ): Promise<FeeEstimate> {
    const cacheKey = `usdt:${fromAddress}:${toAddress}:${amount}`;

    // Check cache first
    const cached = this.getCachedFee(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Base fee for jetton transfer (higher than regular TON)
      let gasFee = this.DEFAULT_FEES.USDT.transfer;

      // Additional fee for amount (USDT operations are more complex)
      if (amount > 10000) {
        gasFee += 0.01; // Extra fee for large transfers
      }

      // Check if USDT wallet exists for recipient
      const needsWalletDeploy = await this.needsUsdtWalletDeploy(toAddress);
      if (needsWalletDeploy) {
        gasFee += this.DEFAULT_FEES.USDT.deploy;
      }

      // Dynamic adjustment
      const networkLoad = await this.getNetworkLoadMetrics();
      const adjustedMultiplier = this.calculateFeeMultiplier(networkLoad);

      gasFee *= adjustedMultiplier;

      // Storage fee (higher for jetton transfers)
      const storageFee = 0.0005;

      // Forward fee (required for jetton transfers)
      const forwardFee = 0.05; // 0.05 TON forward amount for notifications

      const totalFee = Math.min(
        Math.max(gasFee + storageFee + forwardFee, this.dynamicConfig.minFee),
        this.dynamicConfig.maxFee
      );

      const estimate: FeeEstimate = {
        gasFee,
        storageFee,
        forwardFee,
        totalFee,
        currency: 'TON',
        confidence: 0.90
      };

      // Cache the estimate
      this.cacheFee(cacheKey, estimate);

      return estimate;
    } catch (error) {
      logger.error('Failed to calculate USDT transfer fee:', error);
      return this.getDefaultUsdtFee();
    }
  }

  /**
   * Calculate fee for smart contract interaction
   */
  async calculateContractExecutionFee(
    contractAddress: string,
    methodName: string,
    payload?: any
  ): Promise<FeeEstimate> {
    try {
      // Base fee for contract interaction
      let gasFee = this.DEFAULT_FEES.TON.smartContract;

      // Adjust based on method complexity
      const methodComplexity = this.getMethodComplexity(methodName);
      gasFee *= methodComplexity;

      // Payload size affects fee
      if (payload) {
        const payloadSize = JSON.stringify(payload).length;
        gasFee += 0.0001 * Math.ceil(payloadSize / 1000);
      }

      // Dynamic adjustment
      const networkLoad = await this.getNetworkLoadMetrics();
      const adjustedMultiplier = this.calculateFeeMultiplier(networkLoad);

      gasFee *= adjustedMultiplier;

      // Storage and forward fees
      const storageFee = 0.001;
      const forwardFee = 0.0005;

      const totalFee = Math.min(
        Math.max(gasFee + storageFee + forwardFee, this.dynamicConfig.minFee),
        this.dynamicConfig.maxFee
      );

      return {
        gasFee,
        storageFee,
        forwardFee,
        totalFee,
        currency: 'TON',
        confidence: 0.85
      };
    } catch (error) {
      logger.error('Failed to calculate contract execution fee:', error);
      return {
        gasFee: this.DEFAULT_FEES.TON.smartContract,
        storageFee: 0.001,
        forwardFee: 0.0005,
        totalFee: this.DEFAULT_FEES.TON.smartContract + 0.0015,
        currency: 'TON',
        confidence: 0.5
      };
    }
  }

  /**
   * Batch fee calculation for multiple transfers
   */
  async calculateBatchFees(
    transfers: Array<{
      type: 'TON' | 'USDT';
      fromAddress: string;
      toAddress: string;
      amount: number;
      message?: string;
    }>
  ): Promise<FeeEstimate[]> {
    try {
      const promises = transfers.map(transfer => {
        if (transfer.type === 'TON') {
          return this.calculateTonTransferFee(
            transfer.fromAddress,
            transfer.toAddress,
            transfer.amount,
            transfer.message
          );
        } else {
          return this.calculateUsdtTransferFee(
            transfer.fromAddress,
            transfer.toAddress,
            transfer.amount,
            transfer.message
          );
        }
      });

      const estimates = await Promise.all(promises);

      // Apply batch discount (5% discount for 3+ transactions)
      if (transfers.length >= 3) {
        estimates.forEach(estimate => {
          estimate.totalFee *= 0.95;
          estimate.gasFee *= 0.95;
        });
      }

      return estimates;
    } catch (error) {
      logger.error('Failed to calculate batch fees:', error);
      return transfers.map(() => this.getDefaultTonFee());
    }
  }

  /**
   * Get current network load metrics
   */
  private async getNetworkLoadMetrics(): Promise<NetworkLoadMetrics> {
    try {
      // In a real implementation, this would query TON API or blockchain
      // For now, return simulated metrics
      return {
        averageGasPrice: 0.005,
        networkUtilization: 0.65, // 65% utilization
        pendingTransactions: 150,
        blockTime: 5.5 // seconds
      };
    } catch (error) {
      logger.error('Failed to get network load metrics:', error);
      return {
        averageGasPrice: this.dynamicConfig.baseFee,
        networkUtilization: 0.5,
        pendingTransactions: 100,
        blockTime: 5
      };
    }
  }

  /**
   * Calculate fee multiplier based on network load
   */
  private calculateFeeMultiplier(metrics: NetworkLoadMetrics): number {
    let multiplier = this.dynamicConfig.multiplier;

    // Adjust based on network utilization
    if (metrics.networkUtilization > 0.9) {
      multiplier = this.dynamicConfig.surgeMultiplier; // 2x multiplier during surge
    } else if (metrics.networkUtilization > 0.75) {
      multiplier = 1.5; // 1.5x multiplier during high load
    } else if (metrics.networkUtilization > 0.5) {
      multiplier = 1.2; // 1.2x multiplier during medium load
    }

    // Adjust based on pending transactions
    if (metrics.pendingTransactions > 1000) {
      multiplier *= 1.5;
    } else if (metrics.pendingTransactions > 500) {
      multiplier *= 1.2;
    }

    return multiplier;
  }

  /**
   * Check if USDT wallet needs deployment
   */
  private async needsUsdtWalletDeploy(address: string): Promise<boolean> {
    try {
      // Check if USDT wallet exists for the address
      const query = `
        SELECT 1 FROM jetton_wallets
        WHERE owner_address = $1 AND jetton_master = $2
        LIMIT 1
      `;

      const result = await postgresDb.query(query, [
        address,
        'EQD0vdSA_NedR9LvfdgY-drH6g3mFRRDyqLhQ7hF99ywSmBE' // USDT master
      ]);

      return result.rows.length === 0;
    } catch (error) {
      logger.error('Failed to check USDT wallet deployment:', error);
      return true; // Assume deployment needed to be safe
    }
  }

  /**
   * Get method complexity multiplier
   */
  private getMethodComplexity(methodName: string): number {
    const complexities: Record<string, number> = {
      'transfer': 1.0,
      'deploy': 2.0,
      'mint': 1.5,
      'burn': 1.5,
      'approve': 1.2,
      'transferFrom': 1.3,
      'batchTransfer': 1.8,
      'swap': 2.5,
      'addLiquidity': 2.2,
      'removeLiquidity': 2.3
    };

    return complexities[methodName] || 1.5; // Default complexity
  }

  /**
   * Get cached fee estimate
   */
  private getCachedFee(cacheKey: string): FeeEstimate | null {
    const cached = this.feeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.estimate;
    }
    return null;
  }

  /**
   * Cache fee estimate
   */
  private cacheFee(cacheKey: string, estimate: FeeEstimate): void {
    this.feeCache.set(cacheKey, {
      estimate,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.feeCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.feeCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.feeCache.delete(key);
      }
    }
  }

  /**
   * Get default TON fee
   */
  private getDefaultTonFee(): FeeEstimate {
    return {
      gasFee: this.DEFAULT_FEES.TON.transfer,
      storageFee: 0.0001,
      forwardFee: 0,
      totalFee: this.DEFAULT_FEES.TON.transfer + 0.0001,
      currency: 'TON',
      confidence: 0.5
    };
  }

  /**
   * Get default USDT fee
   */
  private getDefaultUsdtFee(): FeeEstimate {
    return {
      gasFee: this.DEFAULT_FEES.USDT.transfer,
      storageFee: 0.0005,
      forwardFee: 0.05,
      totalFee: this.DEFAULT_FEES.USDT.transfer + 0.0505,
      currency: 'TON',
      confidence: 0.5
    };
  }

  /**
   * Update dynamic fee configuration
   */
  updateDynamicConfig(config: Partial<DynamicFeeConfig>): void {
    Object.assign(this.dynamicConfig, config);
    logger.info('Updated dynamic fee configuration:', config);
  }

  /**
   * Get current fee statistics
   */
  async getFeeStats(): Promise<{
    averageTonFee: number;
    averageUsdtFee: number;
    currentMultiplier: number;
    networkLoad: NetworkLoadMetrics;
  }> {
    const networkLoad = await this.getNetworkLoadMetrics();
    const currentMultiplier = this.calculateFeeMultiplier(networkLoad);

    return {
      averageTonFee: this.DEFAULT_FEES.TON.transfer * currentMultiplier,
      averageUsdtFee: this.DEFAULT_FEES.USDT.transfer * currentMultiplier,
      currentMultiplier,
      networkLoad
    };
  }
}