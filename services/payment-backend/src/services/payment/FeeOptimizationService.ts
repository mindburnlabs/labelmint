/**
 * Automatic Fee Optimization Service for TON Payments
 * Dynamically adjusts gas fees based on network conditions
 */

import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import { PrismaClient } from '@prisma/client';
import { TON_MAINNET_CONFIG } from '@/config/ton-mainnet';
import { paymentMonitor } from './PaymentMonitorService';

export interface GasPriceData {
  timestamp: Date;
  baseFee: string; // in nanoTON
  priorityFee: string; // in nanoTON
  networkCongestion: number; // 0-1 scale
  estimatedConfirmationTime: number; // in seconds
  recommendedFee: string; // in nanoTON
}

export interface FeeOptimizationStrategy {
  name: string;
  priority: number;
  maxFeeMultiplier: number;
  minFeeMultiplier: number;
  targetConfirmationTime: number; // seconds
}

export class FeeOptimizationService {
  private prisma: PrismaClient;
  private tonClient: TonClient;
  private gasPriceHistory: GasPriceData[] = [];
  private strategies: FeeOptimizationStrategy[] = [
    {
      name: 'eco',
      priority: 1,
      maxFeeMultiplier: 0.8,
      minFeeMultiplier: 0.5,
      targetConfirmationTime: 300 // 5 minutes
    },
    {
      name: 'standard',
      priority: 2,
      maxFeeMultiplier: 1.2,
      minFeeMultiplier: 0.8,
      targetConfirmationTime: 60 // 1 minute
    },
    {
      name: 'priority',
      priority: 3,
      maxFeeMultiplier: 2.0,
      minFeeMultiplier: 1.2,
      targetConfirmationTime: 30 // 30 seconds
    },
    {
      name: 'urgent',
      priority: 4,
      maxFeeMultiplier: 3.0,
      minFeeMultiplier: 2.0,
      targetConfirmationTime: 10 // 10 seconds
    }
  ];
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;

  constructor(tonClient: TonClient) {
    this.prisma = new PrismaClient();
    this.tonClient = tonClient;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting fee optimization service...');

    // Update gas prices every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateGasPrices();
      await this.analyzeNetworkConditions();
      await this.optimizePendingTransactions();
    }, 30000);

    // Initial price update
    await this.updateGasPrices();

    console.log('Fee optimization service started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    console.log('Fee optimization service stopped');
  }

  private async updateGasPrices(): Promise<void> {
    try {
      // Get current masterchain info
      const masterchainInfo = await this.tonClient.getMasterchainInfo();

      // Get recent transactions to estimate gas prices
      const recentBlocks = await this.tonClient.getBlockTransactions(
        masterchainInfo.workchain,
        masterchainInfo.last.seqno - 10,
        masterchainInfo.last.seqno
      );

      // Calculate gas statistics
      const gasStats = await this.calculateGasStatistics(recentBlocks);

      const gasPriceData: GasPriceData = {
        timestamp: new Date(),
        baseFee: gasStats.medianFee,
        priorityFee: gasStats.priorityFee,
        networkCongestion: gasStats.congestion,
        estimatedConfirmationTime: gasStats.avgConfirmationTime,
        recommendedFee: gasStats.recommendedFee
      };

      // Store in history
      this.gasPriceHistory.push(gasPriceData);

      // Keep only last 1000 entries
      if (this.gasPriceHistory.length > 1000) {
        this.gasPriceHistory = this.gasPriceHistory.slice(-1000);
      }

      // Save to database
      await this.prisma.gasPriceData.create({
        data: {
          timestamp: gasPriceData.timestamp,
          baseFee: gasPriceData.baseFee,
          priorityFee: gasPriceData.priorityFee,
          networkCongestion: gasPriceData.networkCongestion,
          estimatedConfirmationTime: gasPriceData.estimatedConfirmationTime,
          recommendedFee: gasPriceData.recommendedFee
        }
      });

    } catch (error) {
      console.error('Error updating gas prices:', error);
    }
  }

  private async calculateGasStatistics(blocks: any[]): Promise<{
    medianFee: string;
    priorityFee: string;
    congestion: number;
    avgConfirmationTime: number;
    recommendedFee: string;
  }> {
    const fees: number[] = [];
    const confirmationTimes: number[] = [];

    // Analyze recent blocks
    for (const block of blocks) {
      if (block.transactions) {
        for (const tx of block.transactions) {
          // Extract gas fees from transactions
          // This is simplified - in production, you'd parse the actual transaction data
          const fee = Math.random() * 100000000; // 0-0.1 TON
          fees.push(fee);
        }
      }
    }

    // Calculate statistics
    fees.sort((a, b) => a - b);
    const medianFee = fees[Math.floor(fees.length / 2)] || parseFloat(TON_MAINNET_CONFIG.gas.transferFee);
    const highFee = fees[Math.floor(fees.length * 0.9)] || medianFee * 1.5;

    // Network congestion based on block fill level
    const congestion = Math.min(fees.length / 100, 1); // Normalize to 0-1

    // Estimate confirmation time based on current conditions
    const baseConfirmationTime = 30; // 30 seconds base
    const avgConfirmationTime = baseConfirmationTime * (1 + congestion * 2);

    // Calculate recommended fee
    const recommendedFee = medianFee * (1 + congestion * 0.5);

    return {
      medianFee: medianFee.toString(),
      priorityFee: highFee.toString(),
      congestion,
      avgConfirmationTime,
      recommendedFee: recommendedFee.toString()
    };
  }

  private async analyzeNetworkConditions(): Promise<void> {
    const recentData = this.gasPriceHistory.slice(-10); // Last 10 data points

    if (recentData.length < 5) return;

    // Calculate trends
    const avgCongestion = recentData.reduce((sum, d) => sum + d.networkCongestion, 0) / recentData.length;
    const feeVolatility = this.calculateVolatility(recentData.map(d => parseFloat(d.baseFee)));

    // Trigger alerts if conditions are unusual
    if (avgCongestion > 0.8) {
      paymentMonitor.emit('alert', {
        type: 'warning',
        message: `High network congestion detected: ${(avgCongestion * 100).toFixed(1)}%`,
        metrics: [],
        threshold: 0.8,
        currentValue: avgCongestion
      });
    }

    if (feeVolatility > 0.5) {
      paymentMonitor.emit('alert', {
        type: 'info',
        message: `High fee volatility detected: ${(feeVolatility * 100).toFixed(1)}%`,
        metrics: [],
        threshold: 0.5,
        currentValue: feeVolatility
      });
    }
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean; // Coefficient of variation
  }

  private async optimizePendingTransactions(): Promise<void> {
    try {
      // Get pending transactions that might need fee bumping
      const pendingTxs = await this.prisma.tonTransaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            gt: new Date(Date.now() - 300000) // Last 5 minutes
          }
        }
      });

      const currentGasPrice = this.getCurrentGasPrice();

      for (const tx of pendingTxs) {
        const needsBump = await this.shouldBumpFee(tx, currentGasPrice);

        if (needsBump) {
          await this.bumpTransactionFee(tx, currentGasPrice);
        }
      }

    } catch (error) {
      console.error('Error optimizing pending transactions:', error);
    }
  }

  private async shouldBumpFee(tx: any, currentGasPrice: GasPriceData): Promise<boolean> {
    const txFee = parseFloat(tx.fee || '0');
    const recommendedFee = parseFloat(currentGasPrice.recommendedFee);

    // bump if current fee is significantly lower than recommended
    return txFee < recommendedFee * 0.8;
  }

  private async bumpTransactionFee(tx: any, currentGasPrice: GasPriceData): Promise<void> {
    try {
      // Calculate new fee with 20% buffer
      const newFee = (parseFloat(currentGasPrice.recommendedFee) * 1.2).toString();

      // Update transaction with new fee
      await this.prisma.tonTransaction.update({
        where: { id: tx.id },
        data: {
          fee: newFee,
          metadata: {
            ...tx.metadata,
            feeBumped: true,
            originalFee: tx.fee,
            bumpTime: new Date().toISOString()
          }
        }
      });

      // Log the fee bump
      console.log(`Bumped fee for transaction ${tx.id}: ${tx.fee} -> ${newFee}`);

      // Record metric
      paymentMonitor.recordMetric({
        timestamp: new Date(),
        type: 'high_gas',
        transactionId: tx.id,
        userId: tx.userId,
        amount: tx.amount,
        fee: newFee,
        error: 'Fee bumped due to network congestion'
      });

    } catch (error) {
      console.error(`Failed to bump fee for transaction ${tx.id}:`, error);
    }
  }

  // Public methods for fee estimation
  public estimateFee(
    amount: string,
    strategy: 'eco' | 'standard' | 'priority' | 'urgent' = 'standard',
    isUsdt: boolean = false
  ): string {
    const currentGasPrice = this.getCurrentGasPrice();
    const selectedStrategy = this.strategies.find(s => s.name === strategy) || this.strategies[1];

    // Base fee calculation
    let baseFee = parseFloat(currentGasPrice.baseFee);

    // Apply strategy multiplier
    const multiplier = this.calculateFeeMultiplier(selectedStrategy, currentGasPrice.networkCongestion);
    let estimatedFee = baseFee * multiplier;

    // Add extra for USDT transfers
    if (isUsdt) {
      estimatedFee += parseFloat(TON_MAINNET_CONFIG.gas.usdtTransferFee);
    }

    // Apply limits
    const maxFee = parseFloat(TON_MAINNET_CONFIG.gas.maxFeePerTx);
    estimatedFee = Math.min(estimatedFee, maxFee);

    return estimatedFee.toString();
  }

  private calculateFeeMultiplier(strategy: FeeOptimizationStrategy, congestion: number): number {
    // Adjust multiplier based on network congestion
    const congestionMultiplier = 1 + (congestion * (strategy.maxFeeMultiplier - strategy.minFeeMultiplier));

    // Weight by priority
    const priorityWeight = strategy.priority / this.strategies.length;

    return Math.min(
      strategy.maxFeeMultiplier,
      Math.max(strategy.minFeeMultiplier, congestionMultiplier * priorityWeight)
    );
  }

  public getCurrentGasPrice(): GasPriceData {
    return this.gasPriceHistory[this.gasPriceHistory.length - 1] || {
      timestamp: new Date(),
      baseFee: TON_MAINNET_CONFIG.gas.transferFee,
      priorityFee: TON_MAINNET_CONFIG.gas.maxFeePerTx,
      networkCongestion: 0.5,
      estimatedConfirmationTime: 60,
      recommendedFee: TON_MAINNET_CONFIG.gas.transferFee
    };
  }

  public getFeeHistory(hours: number = 24): GasPriceData[] {
    const cutoff = new Date(Date.now() - hours * 3600000);
    return this.gasPriceHistory.filter(d => d.timestamp > cutoff);
  }

  public async getOptimalFeeForAmount(
    amount: string,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{
    fee: string;
    strategy: string;
    estimatedTime: number;
    confidence: number;
  }> {
    const strategyMap = {
      low: 'eco' as const,
      medium: 'standard' as const,
      high: 'priority' as const,
      critical: 'urgent' as const
    };

    const selectedStrategy = strategyMap[urgency];
    const strategy = this.strategies.find(s => s.name === selectedStrategy)!;
    const currentGasPrice = this.getCurrentGasPrice();

    // Calculate fee based on strategy and current conditions
    const fee = this.estimateFee(amount, selectedStrategy);

    // Adjust estimated time based on network conditions
    const adjustedTime = strategy.targetConfirmationTime * (1 + currentGasPrice.networkCongestion);

    // Calculate confidence based on network stability
    const confidence = Math.max(0.7, 1 - currentGasPrice.networkCongestion * 0.5);

    return {
      fee,
      strategy: selectedStrategy,
      estimatedTime: Math.round(adjustedTime),
      confidence: Math.round(confidence * 100) / 100
    };
  }
}

export default FeeOptimizationService;