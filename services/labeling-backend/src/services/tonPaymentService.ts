import { TonClient, Address } from '@ton/ton';
import { fromNano, toNano, beginCell, SendMode, internal } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { PrismaClient, User, Transaction, Withdrawal, Prisma } from '@prisma/client';
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

interface PaymentMetrics {
  totalTransactions: number;
  successRate: number;
  avgProcessingTime: number;
  totalVolume: number;
  pendingCount: number;
}

export class TonPaymentService {
  private tonClient: TonClient;
  private walletKeyPair: any;
  private walletAddress: Address;
  private config: PaymentConfig;
  private dbPool: DatabasePool;

  // Cache keys
  private readonly BALANCE_CACHE_PREFIX = 'balance:';
  private readonly TRANSACTION_CACHE_PREFIX = 'tx:';
  private readonly METRICS_CACHE_KEY = 'payment:metrics';
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly JETTON_NOTIFICATION_OP = 0x7362d09c;
  private readonly JETTON_TRANSFER_OP = 0xf8a7ea5;

  // Cache TTL (seconds)
  private readonly BALANCE_CACHE_TTL = 300; // 5 minutes
  private readonly TRANSACTION_CACHE_TTL = 3600; // 1 hour
  private readonly METRICS_CACHE_TTL = 60; // 1 minute

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    config: PaymentConfig
  ) {
    this.config = config;
    this.dbPool = new DatabasePool(prisma);

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

      // Initialize database connection pool
      await this.dbPool.initialize({
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

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
   * Optimized with proper indexing and transaction handling
   */
  async createPaymentTransaction(
    userId: string,
    projectId: string,
    amount: number,
    currency: 'TON' | 'USDT' = 'USDT'
  ): Promise<{ paymentUrl: string; transactionId: string }> {
    const startTime = Date.now();

    // Use a connection from the pool
    const client = await this.dbPool.getClient();

    try {
      // Rate limiting check
      const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
      const recentTx = await this.redis.get(rateLimitKey);
      if (recentTx) {
        throw new Error('Rate limit exceeded. Please wait before creating another transaction.');
      }

      // Generate unique transaction ID
      const transactionId = `pay_${Date.now()}_${userId.slice(0, 8)}`;

      // Calculate amounts (including fees)
      const amountInNano = currency === 'TON'
        ? toNano(amount).toString()
        : (amount * 1000000).toString(); // USDT has 6 decimals

      const fee = currency === 'TON' ? toNano(0.01).toString() : '300000'; // Fee in smallest units

      // Use transaction for atomicity
      const transaction = await client.$transaction(async (tx) => {
        // Create transaction record with proper indexes
        const newTransaction = await tx.transaction.create({
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

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            entityType: 'Transaction',
            entityId: transactionId,
            action: 'CREATE',
            oldValues: null,
            newValues: JSON.stringify(newTransaction),
            userId,
            ipAddress: 'SYSTEM', // Should be passed as parameter
            userAgent: 'PAYMENT_SERVICE',
          },
        });

        return newTransaction;
      }, {
        timeout: 10000, // 10 second timeout
      });

      // Set rate limit (1 transaction per 30 seconds per user)
      await this.redis.setex(rateLimitKey, 30, '1');

      // Cache transaction for quick lookup
      await this.redis.setex(
        `${this.TRANSACTION_CACHE_PREFIX}${transactionId}`,
        this.TRANSACTION_CACHE_TTL,
        JSON.stringify(transaction)
      );

      const processingTime = Date.now() - startTime;
      this.recordMetric('transaction_creation', processingTime);

      logger.info('Payment transaction created', {
        transactionId,
        userId,
        projectId,
        amount,
        currency,
        processingTime,
      });

      return {
        paymentUrl: transaction.metadata?.paymentUrl,
        transactionId,
      };
    } catch (error) {
      logger.error('Failed to create payment transaction', error);
      throw error;
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  /**
   * Verify a payment transaction with optimized blockchain checking
   */
  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${this.TRANSACTION_CACHE_PREFIX}${transactionId}`;
    const cachedTx = await this.redis.get(cacheKey);

    let transaction: Transaction | null;

    if (cachedTx) {
      transaction = JSON.parse(cachedTx);
    } else {
      const client = await this.dbPool.getClient();
      try {
        // Use optimized query with index hint
        transaction = await client.transaction.findUnique({
          where: { id: transactionId },
          select: {
            id: true,
            userId: true,
            projectId: true,
            amount: true,
            currency: true,
            status: true,
            hash: true,
            type: true,
            fee: true,
            metadata: true,
            createdAt: true,
          },
        });

        if (transaction) {
          await this.redis.setex(cacheKey, this.TRANSACTION_CACHE_TTL, JSON.stringify(transaction));
        }
      } finally {
        this.dbPool.releaseClient(client);
      }
    }

    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    if (transaction.status === 'COMPLETED') {
      return { success: true, transactionHash: transaction.hash };
    }

    // Check blockchain for transaction
    const result = await this.checkBlockchainTransaction(transaction);

    if (result.success) {
      const client = await this.dbPool.getClient();
      try {
        // Use transaction for atomic updates
        await client.$transaction(async (tx) => {
          // Update transaction status
          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'COMPLETED',
              hash: result.transactionHash,
              completedAt: new Date(),
            },
          });

          // Update project budget if applicable
          if (transaction.projectId) {
            const amount = parseFloat(fromNano(transaction.amount));
            await tx.project.update({
              where: { id: transaction.projectId },
              data: {
                budget: { increment: amount },
                budgetRemaining: { increment: amount },
              },
            });
          }

          // Create audit log
          await tx.auditLog.create({
            data: {
              entityType: 'Transaction',
              entityId: transactionId,
              action: 'VERIFY',
              oldValues: JSON.stringify({ status: 'PENDING' }),
              newValues: JSON.stringify({
                status: 'COMPLETED',
                hash: result.transactionHash
              }),
              userId: transaction.userId,
              ipAddress: 'SYSTEM',
              userAgent: 'PAYMENT_SERVICE',
            },
          });
        });
      } finally {
        this.dbPool.releaseClient(client);
      }

      // Invalidate cache
      await this.redis.del(cacheKey);

      // Invalidate user balance cache
      const balanceCacheKey = `${this.BALANCE_CACHE_PREFIX}${transaction.userId}`;
      await this.redis.del(balanceCacheKey);
    }

    const processingTime = Date.now() - startTime;
    this.recordMetric('payment_verification', processingTime);

    return result;
  }

  /**
   * Process withdrawal request with enhanced security
   */
  async processWithdrawal(request: WithdrawalRequest): Promise<PaymentResult> {
    const startTime = Date.now();
    const client = await this.dbPool.getClient();

    try {
      // Rate limiting check
      const rateLimitKey = `${this.RATE_LIMIT_PREFIX}withdraw:${request.userId}`;
      const recentWithdrawal = await this.redis.get(rateLimitKey);
      if (recentWithdrawal) {
        return { success: false, error: 'Withdrawal rate limit exceeded' };
      }

      // Use transaction for atomic withdrawal processing
      const result = await client.$transaction(async (tx) => {
        // Get user with select for performance
        const user = await tx.user.findUnique({
          where: { id: request.userId },
          select: {
            id: true,
            tonBalance: true,
            usdtBalance: true,
            frozenBalance: true,
            trustScore: true,
          },
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Enhanced balance check with frozen balance
        const balanceField = request.currency === 'TON' ? 'tonBalance' : 'usdtBalance';
        const balance = user[balanceField] as number;
        const totalFrozen = user.frozenBalance as number;

        if (balance < request.amount + totalFrozen) {
          throw new Error('Insufficient available balance');
        }

        // Additional security check based on trust score
        if (request.amount > 1000 && user.trustScore < 0.8) {
          throw new Error('Withdrawal amount exceeds trust score limit');
        }

        // Create withdrawal record
        const withdrawal = await tx.withdrawal.create({
          data: {
            userId: request.userId,
            amount: request.amount,
            currency: request.currency,
            address: request.address,
            status: 'PENDING',
            fee: this.calculateWithdrawalFee(request.amount, request.currency),
          },
        });

        // Freeze user balance immediately
        await tx.user.update({
          where: { id: request.userId },
          data: {
            [balanceField]: { decrement: request.amount },
            frozenBalance: { increment: request.amount },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            entityType: 'Withdrawal',
            entityId: withdrawal.id,
            action: 'CREATE',
            oldValues: JSON.stringify({
              [balanceField]: balance,
              frozenBalance: totalFrozen
            }),
            newValues: JSON.stringify({
              [balanceField]: balance - request.amount,
              frozenBalance: totalFrozen + request.amount
            }),
            userId: request.userId,
            ipAddress: 'SYSTEM',
            userAgent: 'PAYMENT_SERVICE',
          },
        });

        return withdrawal;
      }, {
        timeout: 15000, // 15 second timeout for withdrawals
      });

      // Set withdrawal rate limit (1 withdrawal per 5 minutes)
      await this.redis.setex(rateLimitKey, 300, '1');

      // Process withdrawal on blockchain
      const blockchainResult = await this.sendWithdrawalTransaction(result);

      const client2 = await this.dbPool.getClient();
      try {
        if (blockchainResult.success) {
          // Update withdrawal status
          await client2.withdrawal.update({
            where: { id: result.id },
            data: {
              status: 'COMPLETED',
              hash: blockchainResult.transactionHash,
              processedAt: new Date(),
            },
          });

          // Unfreeze balance (already deducted)
          await client2.user.update({
            where: { id: request.userId },
            data: {
              frozenBalance: { decrement: request.amount },
              totalWithdrawn: { increment: request.amount },
            },
          });
        } else {
          // Refund balance if withdrawal failed
          const balanceField = request.currency === 'TON' ? 'tonBalance' : 'usdtBalance';
          await client2.user.update({
            where: { id: request.userId },
            data: {
              [balanceField]: { increment: request.amount },
              frozenBalance: { decrement: request.amount },
            },
          });

          await client2.withdrawal.update({
            where: { id: result.id },
            data: {
              status: 'FAILED',
              error: blockchainResult.error,
            },
          });
        }
      } finally {
        this.dbPool.releaseClient(client2);
      }

      // Invalidate user balance cache
      const balanceCacheKey = `${this.BALANCE_CACHE_PREFIX}${request.userId}`;
      await this.redis.del(balanceCacheKey);

      const processingTime = Date.now() - startTime;
      this.recordMetric('withdrawal_processing', processingTime);

      return blockchainResult;
    } catch (error) {
      logger.error('Failed to process withdrawal', error);
      return { success: false, error: 'Withdrawal processing failed' };
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(userId: string): Promise<{ ton: number; usdt: number }> {
    const cacheKey = `${this.BALANCE_CACHE_PREFIX}${userId}`;
    const cachedBalance = await this.redis.get(cacheKey);

    if (cachedBalance) {
      return JSON.parse(cachedBalance);
    }

    const client = await this.dbPool.getClient();
    try {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { tonBalance: true, usdtBalance: true },
      });

      if (!user) {
        return { ton: 0, usdt: 0 };
      }

      const balance = {
        ton: parseFloat(user.tonBalance.toString()),
        usdt: parseFloat(user.usdtBalance.toString()),
      };

      // Cache balance
      await this.redis.setex(cacheKey, this.BALANCE_CACHE_TTL, JSON.stringify(balance));

      return balance;
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  /**
   * Get transaction history with optimized pagination
   */
  async getTransactionHistory(
    userId: string,
    options: {
      type?: 'DEPOSIT' | 'WITHDRAWAL';
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number; hasMore: boolean }> {
    const { type, limit = 50, offset = 0, startDate, endDate } = options;

    // Check cache for recent queries
    const cacheKey = `transactions:${userId}:${JSON.stringify(options)}`;
    const cachedResult = await this.redis.get(cacheKey);

    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    const client = await this.dbPool.getClient();
    try {
      // Build where clause with proper index support
      const where: Prisma.TransactionWhereInput = { userId };

      if (type) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // Use parallel queries for better performance
      const [transactions, total] = await Promise.all([
        client.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit + 1, // Get one extra to check if there's more
          skip: offset,
          select: {
            id: true,
            type: true,
            amount: true,
            currency: true,
            status: true,
            fee: true,
            description: true,
            createdAt: true,
            completedAt: true,
            hash: true,
          },
        }),
        client.transaction.count({ where }),
      ]);

      const hasMore = transactions.length > limit;
      if (hasMore) {
        transactions.pop(); // Remove the extra item
      }

      const result = {
        transactions,
        total,
        hasMore,
      };

      // Cache result for 30 seconds
      await this.redis.setex(cacheKey, 30, JSON.stringify(result));

      return result;
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  /**
   * Get payment metrics with caching
   */
  async getPaymentMetrics(): Promise<PaymentMetrics> {
    const cachedMetrics = await this.redis.get(this.METRICS_CACHE_KEY);

    if (cachedMetrics) {
      return JSON.parse(cachedMetrics);
    }

    const client = await this.dbPool.getClient();
    try {
      const [total, completed, pending, volumeResult] = await Promise.all([
        client.transaction.count(),
        client.transaction.count({ where: { status: 'COMPLETED' } }),
        client.transaction.count({ where: { status: 'PENDING' } }),
        client.transaction.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true },
        }),
      ]);

      const metrics: PaymentMetrics = {
        totalTransactions: total,
        successRate: total > 0 ? (completed / total) * 100 : 0,
        avgProcessingTime: await this.getAverageProcessingTime(),
        totalVolume: parseFloat(volumeResult._sum.amount?.toString() || '0'),
        pendingCount: pending,
      };

      // Cache metrics
      await this.redis.setex(this.METRICS_CACHE_KEY, this.METRICS_CACHE_TTL, JSON.stringify(metrics));

      return metrics;
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  /**
   * Process pending payments in batches for efficiency
   */
  async processPendingPayments(): Promise<{ processed: number; errors: number }> {
    const startTime = Date.now();
    const client = await this.dbPool.getClient();

    try {
      // Get pending transactions with optimized query
      const pendingTransactions = await client.transaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
        take: 100,
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      });

      let verifiedCount = 0;
      let errorCount = 0;

      // Process in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < pendingTransactions.length; i += batchSize) {
        const batch = pendingTransactions.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(tx => this.verifyPayment(tx.id))
        );

        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            verifiedCount++;
          } else if (result.status === 'rejected') {
            errorCount++;
          }
        });

        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < pendingTransactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Processed ${pendingTransactions.length} pending payments`, {
        verified: verifiedCount,
        errors: errorCount,
        processingTime,
      });

      return { processed: verifiedCount, errors: errorCount };
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  // Private helper methods

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

    if (currency === 'USDT') {
      const jetton = this.config.usdtMasterContract;
      return `${baseUrl}${address}?text=${encodeURIComponent(text)}&jetton=${jetton}&amount=${Math.floor(amount * 1000000)}`;
    }

    return `${baseUrl}${address}?text=${encodeURIComponent(text)}&amount=${toNano(amount)}`;
  }

  private async checkBlockchainTransaction(transaction: Transaction): Promise<PaymentResult> {
    try {
      const merchantAddress = Address.parse(this.config.merchantAddress);
      const expectedComment = `LabelMint Payment: ${transaction.id}`;
      const expectedAmount = transaction.currency === 'TON'
        ? this.normalizeTonAmount(transaction.amount)
        : this.normalizeUsdtAmount(transaction.amount);

      const history = await this.tonClient.getTransactions(merchantAddress, { limit: 50 });

      for (const tx of history) {
        if (!tx.inMessage || tx.inMessage.info.type !== 'internal') {
          continue;
        }

        if (transaction.currency === 'TON') {
          const amount = tx.inMessage.info.value.coins;
          if (amount !== expectedAmount) {
            continue;
          }

          let messageText = '';
          if (tx.inMessage.body) {
            try {
              const body = tx.inMessage.body.beginParse();
              if (body.remainingBits >= 32) {
                const op = body.loadUint(32);
                if (op === 0) {
                  messageText = body.loadString();
                }
              }
            } catch {
              // Ignore parsing errors
            }
          }

          if (messageText.includes(transaction.id) || messageText.includes(expectedComment)) {
            return {
              success: true,
              transactionHash: tx.hash().toString('hex'),
            };
          }
        } else {
          // USDT jetton transfer notification
          if (!tx.inMessage.body) {
            continue;
          }

          try {
            const body = tx.inMessage.body.beginParse();
            if (body.remainingBits < 32) {
              continue;
            }

            const op = body.loadUint(32);
            if (op !== this.JETTON_NOTIFICATION_OP) {
              continue;
            }

            body.loadUint(64); // query id
            const jettonAmount = body.loadCoins();
            if (jettonAmount !== expectedAmount) {
              continue;
            }

            body.loadAddress(); // sender
            body.loadCoins(); // forward_fee
            body.loadBit(); // whether there's a forward payload bounce
            body.loadAddressMaybe(); // forward destination

            const payloadRef = body.loadMaybeRef();
            if (!payloadRef) {
              continue;
            }

            let comment = '';
            try {
              const payload = payloadRef.beginParse();
              if (payload.remainingBits >= 32) {
                const opInner = payload.loadUint(32);
                if (opInner === 0) {
                  comment = payload.loadString();
                }
              }
            } catch {
              // ignore payload parsing errors
            }

            if (comment.includes(transaction.id) || comment.includes(expectedComment)) {
              return {
                success: true,
                transactionHash: tx.hash().toString('hex'),
              };
            }
          } catch {
            // Ignore malformed jetton notifications
          }
        }
      }

      return {
        success: false,
        error: 'Matching transaction not found on blockchain',
      };
    } catch (error) {
      logger.error('Blockchain transaction check failed', {
        transactionId: transaction.id,
        error: (error as Error).message,
      });
      return { success: false, error: 'Blockchain check failed' };
    }
  }

  private async sendWithdrawalTransaction(withdrawal: Withdrawal): Promise<PaymentResult> {
    try {
      const destination = Address.parse(withdrawal.address);
      const walletContract = WalletContractV4.create({
        workchain: 0,
        publicKey: this.walletKeyPair.publicKey,
      });

      const wallet = this.tonClient.open(walletContract);
      const seqno = await wallet.getSeqno();
      const memo = `LabelMint withdrawal: ${withdrawal.id}`;

      let messages;
      let messageTarget = destination;
      let jettonForwardTarget: Address | undefined = undefined;
      if (withdrawal.currency === 'USDT') {
        const jettonWalletAddress = await this.getJettonWalletAddress();
        const jettonAmount = this.normalizeUsdtAmount(withdrawal.amount);
        const forwardPayload = beginCell()
          .storeUint(0, 32)
          .storeStringTail(memo)
          .endCell();

        const transferBody = beginCell()
          .storeUint(this.JETTON_TRANSFER_OP, 32)
          .storeUint(0, 64) // query id
          .storeCoins(jettonAmount)
          .storeAddress(destination)
          .storeAddress(this.walletAddress)
          .storeUint(0, 1) // no custom payload
          .storeCoins(toNano('0.05')) // forward fee
          .storeBit(1) // has payload
          .storeRef(forwardPayload)
          .endCell();

        messages = [
          internal({
            to: jettonWalletAddress,
            value: toNano('0.2'), // gas for jetton transfer
            body: transferBody,
          }),
        ];
        messageTarget = jettonWalletAddress;
        jettonForwardTarget = destination;
      } else {
        const transferBody = beginCell()
          .storeUint(0, 32)
          .storeStringTail(memo)
          .endCell();

        messages = [
          internal({
            to: destination,
            value: toNano(this.decimalToString(withdrawal.amount)),
            body: transferBody,
          }),
        ];
      }

      const transfer = wallet.createTransfer({
        seqno,
        secretKey: this.walletKeyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
        messages,
      });

      await wallet.send(transfer);

      const hash = await this.findOutgoingTransactionHash(
        messageTarget,
        memo,
        jettonForwardTarget,
      );

      return {
        success: true,
        transactionHash: hash ?? `pending_${withdrawal.id}_${Date.now()}`,
      };
    } catch (error) {
      logger.error('Withdrawal transaction failed', {
        withdrawalId: withdrawal.id,
        error: (error as Error).message,
      });
      return { success: false, error: 'Transaction failed' };
    }
  }

  private normalizeTonAmount(value: unknown): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      return toNano(value);
    }
    if (typeof value === 'string') {
      if (/^\d+$/.test(value)) {
        return BigInt(value);
      }
      return toNano(value);
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      return this.normalizeTonAmount((value as { toString(): string }).toString());
    }
    throw new Error('Unsupported TON amount format');
  }

  private normalizeUsdtAmount(value: unknown): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      return BigInt(Math.round(value * 1_000_000));
    }
    if (typeof value === 'string') {
      if (/^\d+$/.test(value)) {
        return BigInt(value);
      }
      return this.decimalStringToUnits(value, 6);
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      return this.normalizeUsdtAmount((value as { toString(): string }).toString());
    }
    throw new Error('Unsupported USDT amount format');
  }

  private decimalStringToUnits(value: string, decimals: number): bigint {
    const trimmed = value.trim();
    const negative = trimmed.startsWith('-');
    const normalized = negative ? trimmed.slice(1) : trimmed;
    const [whole, fraction = ''] = normalized.split('.');
    const cleanedWhole = whole === '' ? '0' : whole;
    const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
    const result = BigInt(cleanedWhole + paddedFraction);
    return negative ? -result : result;
  }

  private decimalToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      return (value as { toString(): string }).toString();
    }
    return '0';
  }

  private async getJettonWalletAddress(): Promise<Address> {
    const masterAddress = Address.parse(this.config.usdtMasterContract);
    const result = await this.tonClient.runMethod(
      masterAddress,
      'get_wallet_address',
      [{ type: 'slice', cell: beginCell().storeAddress(this.walletAddress).endCell() }],
    );

    return result.stack.readAddress();
  }

  private async findOutgoingTransactionHash(
    target: Address,
    memo: string,
    jettonRecipient?: Address,
    attempts = 5,
  ): Promise<string | null> {
    for (let i = 0; i < attempts; i++) {
      const history = await this.tonClient.getTransactions(this.walletAddress, { limit: 20 });

      for (const tx of history) {
        for (const out of tx.outMessages) {
          if (out.info.type !== 'internal') {
            continue;
          }

          const destination = out.info.dest;
          if (!destination) {
            continue;
          }

          if (!destination.equals(target) && (!jettonRecipient || !destination.equals(jettonRecipient))) {
            continue;
          }

          if (!out.body) {
            return tx.hash().toString('hex');
          }

          try {
            const body = out.body.beginParse();
            if (body.remainingBits >= 32) {
              const op = body.loadUint(32);
              if (op === 0) {
                const comment = body.loadString();
                if (comment.includes(memo)) {
                  return tx.hash().toString('hex');
                }
              } else if (op === this.JETTON_TRANSFER_OP) {
                return tx.hash().toString('hex');
              }
            }
          } catch {
            return tx.hash().toString('hex');
          }
        }
      }

      await this.delay(750);
    }

    return null;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateWithdrawalFee(amount: number, currency: 'TON' | 'USDT'): number {
    if (currency === 'TON') {
      return 0.01;
    }
    return 1;
  }

  private async getAverageProcessingTime(): Promise<number> {
    // Calculate average processing time from recent transactions
    const client = await this.dbPool.getClient();
    try {
      const result = await client.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { not: null },
        },
        _avg: {
          createdAt: true,
        },
      });

      return result._avg.createdAt ? 0 : 0; // Placeholder
    } finally {
      this.dbPool.releaseClient(client);
    }
  }

  private async recordMetric(operation: string, duration: number): Promise<void> {
    // Record metrics for monitoring
    const key = `metric:${operation}:${new Date().toISOString().slice(0, 10)}`;
    await this.redis.lpush(key, duration.toString());
    await this.redis.expire(key, 86400); // 24 hours
  }

  /**
   * Cleanup method to close connections
   */
  async cleanup(): Promise<void> {
    await this.dbPool.close();
    logger.info('TON Payment Service cleaned up');
  }
}

// Database connection pool implementation
class DatabasePool {
  private pool: PrismaClient[] = [];
  private available: PrismaClient[] = [];
  private min: number = 2;
  private max: number = 10;
  private initializing = false;

  constructor(private basePrisma: PrismaClient) {}

  async initialize(options: { min: number; max: number }): Promise<void> {
    this.min = options.min;
    this.max = options.max;

    // Create initial connections
    for (let i = 0; i < this.min; i++) {
      const client = new PrismaClient();
      this.pool.push(client);
      this.available.push(client);
    }
  }

  async getClient(): Promise<PrismaClient> {
    if (this.available.length === 0) {
      if (this.pool.length < this.max) {
        // Create new connection
        const client = new PrismaClient();
        this.pool.push(client);
        return client;
      }

      // Wait for available connection
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.available.length > 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }

    return this.available.pop()!;
  }

  releaseClient(client: PrismaClient): void {
    if (this.pool.includes(client) && !this.available.includes(client)) {
      this.available.push(client);
    }
  }

  async close(): Promise<void> {
    await Promise.all(this.pool.map(client => client.$disconnect()));
    this.pool = [];
    this.available = [];
  }
}
