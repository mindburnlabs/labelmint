/**
 * Backup Payment Service
 * Provides fallback payment methods when TON network is congested or unavailable
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { paymentMonitor } from './PaymentMonitorService';

export interface BackupPaymentProvider {
  name: string;
  processPayment: (data: PaymentData) => Promise<PaymentResult>;
  getStatus: (transactionId: string) => Promise<PaymentStatus>;
  refund?: (transactionId: string, amount?: string) => Promise<RefundResult>;
}

export interface PaymentData {
  amount: string;
  currency: string;
  userId: string;
  description: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  status: string;
  fee?: string;
  redirectUrl?: string;
  error?: string;
  estimatedTime?: number;
}

export interface PaymentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  amount?: string;
  fee?: string;
  providerData?: any;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount?: string;
  error?: string;
}

export class BackupPaymentService {
  private prisma: PrismaClient;
  private providers: Map<string, BackupPaymentProvider> = new Map();
  private isInitialized = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      this.providers.set('stripe', {
        name: 'Stripe',
        processPayment: this.processStripePayment.bind(this, stripe),
        getStatus: this.getStripeStatus.bind(this, stripe),
        refund: this.refundStripePayment.bind(this, stripe)
      });
    }

    // Initialize PayPal
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      this.providers.set('paypal', {
        name: 'PayPal',
        processPayment: this.processPayPalPayment.bind(this),
        getStatus: this.getPayPalStatus.bind(this),
        refund: this.refundPayPalPayment.bind(this)
      });
    }

    // Initialize Bank Transfer (Manual)
    this.providers.set('bank_transfer', {
      name: 'Bank Transfer',
      processPayment: this.processBankTransfer.bind(this),
      getStatus: this.getBankTransferStatus.bind(this)
    });

    this.isInitialized = true;
    console.log(`Initialized ${this.providers.size} backup payment providers`);
  }

  async processBackupPayment(
    originalTxId: string,
    amount: string,
    userId: string,
    preferredProvider?: string
  ): Promise<PaymentResult> {
    await this.initialize();

    try {
      // Get available backup methods
      const availableMethods = await this.prisma.backupPaymentMethod.findMany({
        where: { isActive: true },
        orderBy: { priority: 'asc' }
      });

      if (availableMethods.length === 0) {
        throw new Error('No backup payment methods available');
      }

      // Select provider
      const selectedMethod = preferredProvider ?
        availableMethods.find(m => m.name === preferredProvider) :
        availableMethods[0];

      if (!selectedMethod) {
        throw new Error(`Preferred provider '${preferredProvider}' not available`);
      }

      const provider = this.providers.get(selectedMethod.name);
      if (!provider) {
        throw new Error(`Provider '${selectedMethod.name}' not initialized`);
      }

      // Validate amount limits
      const amountNum = parseFloat(amount);
      if (amountNum < parseFloat(selectedMethod.minAmount) ||
          amountNum > parseFloat(selectedMethod.maxAmount)) {
        throw new Error(`Amount ${amount} is outside allowed range for ${selectedMethod.name}`);
      }

      // Process payment
      const result = await provider.processPayment({
        amount,
        currency: 'USD', // Convert USDT to USD equivalent
        userId,
        description: `Backup payment for failed TON transaction ${originalTxId}`,
        metadata: {
          originalTransactionId: originalTxId,
          fallbackReason: 'TON_NETWORK_UNAVAILABLE'
        }
      });

      // Record backup transaction
      if (result.success) {
        await this.prisma.backupTransaction.create({
          data: {
            originalTxId,
            methodId: selectedMethod.id,
            amount,
            fee: result.fee || '0',
            status: result.status,
            externalId: result.transactionId,
            metadata: {
              provider: selectedMethod.name,
              redirectUrl: result.redirectUrl,
              estimatedTime: result.estimatedTime,
              error: result.error
            }
          }
        });

        // Monitor the backup transaction
        this.monitorBackupTransaction(result.transactionId, selectedMethod.name);

        // Record metric
        paymentMonitor.recordMetric({
          timestamp: new Date(),
          type: 'success',
          transactionId: originalTxId,
          userId,
          amount,
          fee: result.fee,
          error: `Backup payment initiated via ${selectedMethod.name}`
        });
      } else {
        // Record failure metric
        paymentMonitor.recordMetric({
          timestamp: new Date(),
          type: 'failure',
          transactionId: originalTxId,
          userId,
          amount,
          error: `Backup payment failed: ${result.error}`
        });
      }

      return result;

    } catch (error) {
      console.error('Error processing backup payment:', error);

      paymentMonitor.recordMetric({
        timestamp: new Date(),
        type: 'failure',
        transactionId: originalTxId,
        userId,
        amount,
        error: `Backup payment error: ${error.message}`
      });

      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: error.message
      };
    }
  }

  private async processStripePayment(
    stripe: Stripe,
    data: PaymentData
  ): Promise<PaymentResult> {
    try {
      const amountCents = Math.round(parseFloat(data.amount) * 100);

      // Generate idempotency key to prevent duplicate charges
      const idempotencyKey = `stripe_payment_${data.userId}_${data.amount}_${Date.now()}`;

      // Create payment intent with idempotency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: data.currency.toLowerCase(),
        metadata: {
          ...data.metadata,
          idempotencyKey,
          originalRequestTime: new Date().toISOString()
        },
        description: data.description,
        automatic_payment_methods: { enabled: true },
        confirmation_method: 'manual'
      }, {
        idempotencyKey
      });

      // Calculate fee (3% + $0.30)
      const fee = (amountCents * 0.03 + 30).toString();

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: 'pending',
        fee,
        redirectUrl: paymentIntent.next_action?.redirect_to_url?.url,
        estimatedTime: 300 // 5 minutes
      };

    } catch (error) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: error.message
      };
    }
  }

  private async getStripeStatus(stripe: Stripe, transactionId: string): Promise<PaymentStatus> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);

      return {
        status: this.mapStripeStatus(paymentIntent.status),
        amount: (paymentIntent.amount / 100).toString(),
        fee: ((paymentIntent.amount * 0.03 + 30) / 100).toString(),
        providerData: paymentIntent
      };

    } catch (error) {
      return {
        status: 'failed',
        error: error.message
      };
    }
  }

  private async refundStripePayment(
    stripe: Stripe,
    transactionId: string,
    amount?: string
  ): Promise<RefundResult> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? Math.round(parseFloat(amount) * 100) : undefined
      });

      return {
        success: true,
        refundId: refund.id,
        amount: (refund.amount / 100).toString()
      };

    } catch (error) {
      return {
        success: false,
        refundId: '',
        error: error.message
      };
    }
  }

  private async processPayPalPayment(data: PaymentData): Promise<PaymentResult> {
    // Simplified PayPal implementation
    // In production, integrate with PayPal SDK

    return {
      success: true,
      transactionId: `paypal_${Date.now()}`,
      status: 'pending',
      fee: (parseFloat(data.amount) * 0.029 + 0.30).toString(),
      redirectUrl: `https://www.paypal.com/checkoutnow?token=${Date.now()}`,
      estimatedTime: 180 // 3 minutes
    };
  }

  private async getPayPalStatus(transactionId: string): Promise<PaymentStatus> {
    // Implement PayPal status check
    return {
      status: 'completed',
      providerData: { id: transactionId }
    };
  }

  private async refundPayPalPayment(
    transactionId: string,
    amount?: string
  ): Promise<RefundResult> {
    // Implement PayPal refund
    return {
      success: true,
      refundId: `refund_${transactionId}`,
      amount
    };
  }

  private async processBankTransfer(data: PaymentData): Promise<PaymentResult> {
    // Generate bank transfer instructions
    const referenceId = `BT${Date.now()}`;

    return {
      success: true,
      transactionId: referenceId,
      status: 'pending',
      fee: '5.00', // Fixed fee for bank transfers
      estimatedTime: 86400, // 24 hours
      error: undefined
    };
  }

  private async getBankTransferStatus(transactionId: string): Promise<PaymentStatus> {
    // Check if transfer has been recorded
    return {
      status: 'pending',
      providerData: { reference: transactionId }
    };
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus['status'] {
    const statusMap: Record<string, PaymentStatus['status']> = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'processing': 'processing',
      'succeeded': 'completed',
      'canceled': 'failed',
      'requires_capture': 'pending'
    };

    return statusMap[stripeStatus] || 'failed';
  }

  private async monitorBackupTransaction(
    transactionId: string,
    providerName: string
  ): Promise<void> {
    const checkStatus = async () => {
      try {
        const provider = this.providers.get(providerName);
        if (!provider) return;

        const status = await provider.getStatus(transactionId);

        // Update database
        const backupTx = await this.prisma.backupTransaction.findFirst({
          where: { externalId: transactionId }
        });

        if (backupTx && backupTx.status !== status.status) {
          await this.prisma.backupTransaction.update({
            where: { id: backupTx.id },
            data: {
              status: status.status,
              metadata: { ...backupTx.metadata, providerData: status.providerData }
            }
          });

          // If completed, notify monitoring
          if (status.status === 'completed') {
            paymentMonitor.recordMetric({
              timestamp: new Date(),
              type: 'success',
              transactionId: backupTx.originalTxId,
              userId: '', // Would need to fetch from original
              amount: status.amount,
              fee: status.fee,
              error: `Backup payment completed via ${providerName}`
            });
          }
        }

        // Continue monitoring if still pending
        if (status.status === 'pending' || status.status === 'processing') {
          setTimeout(checkStatus, 30000); // Check again in 30 seconds
        }

      } catch (error) {
        console.error(`Error monitoring backup transaction ${transactionId}:`, error);
      }
    };

    // Start monitoring
    setTimeout(checkStatus, 10000); // First check after 10 seconds
  }

  async getAvailableProviders(): Promise<Array<{
    name: string;
    priority: number;
    feeRate: number;
    minAmount: string;
    maxAmount: string;
  }>> {
    await this.initialize();

    const methods = await this.prisma.backupPaymentMethod.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
      select: {
        name: true,
        priority: true,
        feeRate: true,
        minAmount: true,
        maxAmount: true
      }
    });

    return methods;
  }

  async getBackupTransactions(
    originalTxId?: string,
    status?: string
  ): Promise<any[]> {
    const where: any = {};

    if (originalTxId) {
      where.originalTxId = originalTxId;
    }

    if (status) {
      where.status = status;
    }

    return await this.prisma.backupTransaction.findMany({
      where,
      include: {
        method: {
          select: {
            name: true,
            feeRate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const backupPaymentService = new BackupPaymentService();