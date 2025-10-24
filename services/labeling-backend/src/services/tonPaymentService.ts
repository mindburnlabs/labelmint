import { TonClient, Address } from '@ton/ton';
import { fromNano, toNano, beginCell, SendMode, internal } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { PrismaClient, User, Transaction, Withdrawal } from '@prisma/client';
import { logger } from '../utils/logger';
import { RedisClient } from '../lib/redis';

interface PaymentConfig {
  testnet: boolean;
  walletMnemonic: string[];
  merchantAddress: string;
  usdtMasterContract: string;
  tonApiEndpoint: string;
  toncenterApiKey: string;
}

interface WithdrawalRequest {
  userId: string;
  amount: number;
  address: string;
  currency: 'TON' | 'USDT';
}

interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class TonPaymentService {
  private tonClient: TonClient;
  private walletKeyPair: any;
  private walletAddress: Address;
  private config: PaymentConfig;

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    config: PaymentConfig
  ) {
    this.config = config;

    // Initialize TON client
    this.tonClient = new TonClient({
      endpoint: config.tonApiEndpoint,
      apiKey: config.toncenterApiKey,
    });
  }

  /**
   * Initialize the payment service
   */
  async initialize(): Promise<void> {
    try {
      // Derive wallet key pair from mnemonic
      this.walletKeyPair = await mnemonicToPrivateKey(this.config.walletMnemonic);

      // Initialize wallet contract
      const walletContract = WalletContractV4.create({
        workchain: 0,
        publicKey: this.walletKeyPair.publicKey,
      });

      this.walletAddress = walletContract.address;

      logger.info('TON Payment Service initialized', {
        testnet: this.config.testnet,
        merchantAddress: this.config.merchantAddress,
        walletAddress: this.walletAddress.toString(),
      });
    } catch (error) {
      logger.error('Failed to initialize TON Payment Service', error);
      throw error;
    }
  }

  /**
   * Create a payment transaction for project funding
   */
  async createPaymentTransaction(
    userId: string,
    projectId: string,
    amount: number,
    currency: 'TON' | 'USDT' = 'USDT'
  ): Promise<{ paymentUrl: string; transactionId: string }> {
    try {
      // Generate unique transaction ID
      const transactionId = `pay_${Date.now()}_${userId.slice(0, 8)}`;

      // Calculate amounts (including fees)
      const amountInNano = currency === 'TON'
        ? toNano(amount).toString()
        : (amount * 1000000).toString(); // USDT has 6 decimals

      const fee = currency === 'TON' ? toNano(0.01).toString() : '300000'; // Fee in smallest units

      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          id: transactionId,
          userId,
          projectId,
          type: 'DEPOSIT',
          amount: amountInNano,
          currency,
          fee,
          status: 'PENDING',
          description: `Funding project ${projectId}`,
          metadata: {
            paymentUrl: this.generatePaymentUrl(transactionId, amount, currency),
          },
        },
      });

      logger.info('Payment transaction created', {
        transactionId,
        userId,
        projectId,
        amount,
        currency,
      });

      return {
        paymentUrl: transaction.metadata?.paymentUrl,
        transactionId,
      };
    } catch (error) {
      logger.error('Failed to create payment transaction', error);
      throw error;
    }
  }

  /**
   * Generate payment URL for TON wallet
   */
  private generatePaymentUrl(
    transactionId: string,
    amount: number,
    currency: 'TON' | 'USDT'
  ): string {
    const baseUrl = this.config.testnet
      ? 'https://test.tonhub.com/transfer/'
      : 'https://tonhub.com/transfer/';

    const address = this.config.merchantAddress;
    const text = `LabelMint Payment: ${transactionId}`;

    // For USDT payments, we need to include the jetton master contract
    if (currency === 'USDT') {
      const jetton = this.config.usdtMasterContract;
      return `${baseUrl}${address}?text=${encodeURIComponent(text)}&jetton=${jetton}&amount=${Math.floor(amount * 1000000)}`;
    }

    return `${baseUrl}${address}?text=${encodeURIComponent(text)}&amount=${toNano(amount)}`;
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return { success: false, error: 'Transaction not found' };
      }

      if (transaction.status === 'COMPLETED') {
        return { success: true, transactionHash: transaction.hash };
      }

      // Check blockchain for transaction
      const result = await this.checkBlockchainTransaction(transaction);

      if (result.success) {
        // Update transaction status
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'COMPLETED',
            hash: result.transactionHash,
            completedAt: new Date(),
          },
        });

        // Update project budget
        if (transaction.projectId) {
          const amount = parseFloat(fromNano(transaction.amount));
          await this.prisma.project.update({
            where: { id: transaction.projectId },
            data: {
              budget: { increment: amount },
              budgetRemaining: { increment: amount },
            },
          });
        }

        logger.info('Payment verified and processed', {
          transactionId,
          hash: result.transactionHash,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to verify payment', { transactionId, error });
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Check transaction on blockchain
   */
  private async checkBlockchainTransaction(transaction: Transaction): Promise<PaymentResult> {
    try {
      logger.info('Checking blockchain transaction', {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
      });

      const merchantAddress = Address.parse(this.config.merchantAddress);

      // Get transaction history for merchant address
      const transactions = await this.tonClient.getTransactions(merchantAddress, {
        limit: 50,
        from_lt: 0,
        hash: undefined,
      });

      // Search for matching transaction
      const expectedAmount = transaction.amount;
      const transactionText = `LabelMint Payment: ${transaction.id}`;

      for (const tx of transactions) {
        // Check if transaction is incoming
        if (tx.inMessage?.info.type !== 'internal') continue;

        // For USDT transactions, we need to check jetton notifications
        if (transaction.currency === 'USDT') {
          const body = tx.inMessage.body.beginParse();
          try {
            // Check if it's a jetton notification
            const op = body.loadUint(32);
            if (op !== 0x7362d09c) continue; // Not a jetton notification

            // Skip queryId
            body.loadUint(64);

            // Check amount
            const jettonAmount = body.loadCoins();
            if (jettonAmount !== BigInt(expectedAmount)) continue;

            // Check from address
            const fromAddress = body.loadAddress();

            // Check jetton amount and merchant address in forward payload
            const forwardFee = body.loadCoins();
            body.loadBit(); // bounces
            body.loadAddressMaybe(); // forwarded to
            const forwardPayload = body.loadRef();

            // Parse forward payload to extract details
            const message = forwardPayload.beginParse();
            const comment = message.loadString();

            // Check if comment matches
            if (comment.includes(transaction.id)) {
              return {
                success: true,
                transactionHash: tx.hash().toString('hex'),
              };
            }
          } catch (e) {
            // Not a jetton notification, continue
            continue;
          }
        } else {
          // For TON transactions, check amount and message
          const amount = tx.inMessage.info.value.coins;
          if (amount !== BigInt(expectedAmount)) continue;

          // Parse message body for comment
          let messageText = '';
          if (tx.inMessage.body) {
            try {
              const body = tx.inMessage.body.beginParse();
              if (body.remainingBits > 32) {
                const op = body.loadUint(32);
                if (op === 0) {
                  // Plain comment
                  messageText = body.loadString();
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          // Check if message matches
          if (messageText.includes(transactionText)) {
            return {
              success: true,
              transactionHash: tx.hash().toString('hex'),
            };
          }
        }
      }

      // No matching transaction found
      return {
        success: false,
        error: 'Matching transaction not found on blockchain',
      };
    } catch (error) {
      logger.error('Blockchain transaction check failed', error);
      return { success: false, error: 'Blockchain check failed' };
    }
  }

  /**
   * Process withdrawal request
   */
  async processWithdrawal(request: WithdrawalRequest): Promise<PaymentResult> {
    try {
      // Check user balance
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const balanceField = request.currency === 'TON' ? 'tonBalance' : 'usdtBalance';
      const balance = user[balanceField] as number;

      if (balance < request.amount) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Create withdrawal record
      const withdrawal = await this.prisma.withdrawal.create({
        data: {
          userId: request.userId,
          amount: request.amount,
          currency: request.currency,
          address: request.address,
          status: 'PENDING',
          fee: this.calculateWithdrawalFee(request.amount, request.currency),
        },
      });

      // Lock user balance
      await this.prisma.user.update({
        where: { id: request.userId },
        data: {
          [balanceField]: { decrement: request.amount },
        },
      });

      // Process withdrawal on blockchain
      const result = await this.sendWithdrawalTransaction(withdrawal);

      if (result.success) {
        // Update withdrawal status
        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'COMPLETED',
            hash: result.transactionHash,
            processedAt: new Date(),
          },
        });

        logger.info('Withdrawal processed successfully', {
          withdrawalId: withdrawal.id,
          userId: request.userId,
          amount: request.amount,
          currency: request.currency,
        });
      } else {
        // Refund balance if withdrawal failed
        await this.prisma.user.update({
          where: { id: request.userId },
          data: {
            [balanceField]: { increment: request.amount },
          },
        });

        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'FAILED',
            error: result.error,
          },
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to process withdrawal', error);
      return { success: false, error: 'Withdrawal processing failed' };
    }
  }

  /**
   * Send withdrawal transaction
   */
  private async sendWithdrawalTransaction(withdrawal: Withdrawal): Promise<PaymentResult> {
    try {
      logger.info('Sending withdrawal transaction', {
        withdrawalId: withdrawal.id,
        amount: withdrawal.amount,
        address: withdrawal.address,
      });

      const toAddress = Address.parse(withdrawal.address);

      // Create wallet contract
      const walletContract = WalletContractV4.create({
        workchain: 0,
        publicKey: this.walletKeyPair.publicKey,
      });

      // Get wallet seqno
      const contract = this.tonClient.open(walletContract);
      const seqno = await contract.getSeqno();

      let message;

      if (withdrawal.currency === 'USDT') {
        // For USDT, create jetton transfer
        // This is a simplified version - in production, you need to:
        // 1. Find the user's jetton wallet address
        // 2. Create proper jetton transfer message
        message = beginCell()
          .storeUint(0, 32) // No op for now
          .storeStringTail(`USDT withdrawal: ${withdrawal.id}`)
          .endCell();
      } else {
        // For TON, simple transfer
        message = beginCell()
          .storeUint(0, 32) // No op
          .storeStringTail(`LabelMint withdrawal: ${withdrawal.id}`)
          .endCell();
      }

      // Create transfer
      const transfer = contract.createTransfer({
        seqno,
        secretKey: this.walletKeyPair.secretKey,
        messages: [
          internal({
            to: toAddress,
            value: withdrawal.currency === 'TON'
              ? toNano(withdrawal.amount)
              : toNano(0.05), // Small amount for USDT transfer
            body: message,
            init: seqno === 0 ? walletContract.init : undefined,
          })
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      });

      // Send transaction
      await contract.send(transfer);

      // Generate transaction hash (in production, get this from blockchain)
      const txHash = `withdrawal_${withdrawal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      logger.info('Withdrawal transaction sent', {
        withdrawalId: withdrawal.id,
        toAddress: toAddress.toString(),
        amount: withdrawal.amount,
        txHash,
      });

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error) {
      logger.error('Withdrawal transaction failed', error);
      return { success: false, error: 'Transaction failed' };
    }
  }

  /**
   * Calculate withdrawal fee
   */
  private calculateWithdrawalFee(amount: number, currency: 'TON' | 'USDT'): number {
    if (currency === 'TON') {
      return 0.01; // 0.01 TON fee
    }
    return 1; // 1 USDT fee
  }

  /**
   * Get user balance
   */
  async getUserBalance(userId: string): Promise<{ ton: number; usdt: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tonBalance: true, usdtBalance: true },
    });

    if (!user) {
      return { ton: 0, usdt: 0 };
    }

    return {
      ton: parseFloat(user.tonBalance.toString()),
      usdt: parseFloat(user.usdtBalance.toString()),
    };
  }

  /**
   * Update user balance (called when worker completes tasks)
   */
  async updateWorkerEarnings(
    userId: string,
    amount: number,
    currency: 'TON' | 'USDT' = 'USDT'
  ): Promise<void> {
    const balanceField = currency === 'TON' ? 'tonBalance' : 'usdtBalance';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        [balanceField]: { increment: amount },
        totalEarnings: { increment: amount },
      },
    });

    // Cache balance for quick access
    const cacheKey = `user:${userId}:balance`;
    await this.redis.setex(cacheKey, 300, JSON.stringify({
      [currency]: amount,
      updatedAt: new Date().toISOString(),
    }));

    logger.info('Worker earnings updated', {
      userId,
      amount,
      currency,
    });
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    options: {
      type?: 'DEPOSIT' | 'WITHDRAWAL';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Transaction[]> {
    const { type, limit = 50, offset = 0 } = options;

    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    return this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawalHistory(
    userId: string,
    options: {
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Withdrawal[]> {
    const { status, limit = 50, offset = 0 } = options;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get daily earnings for a worker
   */
  async getDailyEarnings(userId: string, days: number = 30): Promise<Array<{
    date: string;
    earnings: number;
    tasksCompleted: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const earnings = await this.prisma.taskAnswer.groupBy({
      by: ['createdAt'],
      where: {
        workerId: userId,
        createdAt: { gte: startDate },
        isCorrect: true,
      },
      _sum: {
        earnings: true,
      },
      _count: true,
    });

    // Group by date
    const dailyEarnings = earnings.reduce((acc, item) => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, earnings: 0, tasksCompleted: 0 };
      }
      acc[date].earnings += parseFloat(item._sum.earnings?.toString() || '0');
      acc[date].tasksCompleted += item._count;
      return acc;
    }, {} as Record<string, { date: string; earnings: number; tasksCompleted: number }>);

    return Object.values(dailyEarnings);
  }

  /**
   * Check for pending payments and verify them
   */
  async processPendingPayments(): Promise<number> {
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      take: 100,
    });

    let verifiedCount = 0;

    for (const transaction of pendingTransactions) {
      const result = await this.verifyPayment(transaction.id);
      if (result.success) {
        verifiedCount++;
      }
    }

    if (verifiedCount > 0) {
      logger.info(`Processed ${verifiedCount} pending payments`);
    }

    return verifiedCount;
  }
}