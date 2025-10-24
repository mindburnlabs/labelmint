/**
 * Payment Service Runner
 * Orchestrates all payment-related services in production
 */

import { CronJob } from 'cron';
import { PrismaClient } from '@prisma/client';
import { TonClient } from '@ton/ton';
import { HttpApi } from '@ton/ton';
import { paymentMonitor } from './PaymentMonitorService';
import FeeOptimizationService from './FeeOptimizationService';
import { backupPaymentService } from './BackupPaymentService';
import { validateMainnetConfig, TON_MAINNET_CONFIG } from '@/config/ton-mainnet';

class PaymentServiceRunner {
  private prisma: PrismaClient;
  private tonClient: TonClient;
  private feeService: FeeOptimizationService;
  private isShuttingDown = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Payment Services for Production...');

      // Validate mainnet configuration
      validateMainnetConfig();
      console.log('✅ Mainnet configuration validated');

      // Initialize TON client
      this.tonClient = new TonClient({
        api: new HttpApi(TON_MAINNET_CONFIG.endpoints[0], {
          apiKey: process.env.TON_API_KEY
        })
      });
      console.log('✅ TON mainnet client initialized');

      // Initialize services
      console.log('🔧 Initializing payment services...');

      // Start payment monitoring
      await paymentMonitor.start();
      console.log('✅ Payment monitoring service started');

      // Initialize backup payments
      await backupPaymentService.initialize();
      console.log('✅ Backup payment service initialized');

      // Start fee optimization
      this.feeService = new FeeOptimizationService(this.tonClient);
      await this.feeService.start();
      console.log('✅ Fee optimization service started');

      // Setup cron jobs
      this.setupCronJobs();
      console.log('✅ Cron jobs configured');

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log('🎉 All payment services are running!');
      console.log('========================================');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`TON Network: Mainnet`);
      console.log(`USDT Contract: ${TON_MAINNET_CONFIG.contracts.usdt}`);
      console.log('========================================');

      // Start health check server
      this.startHealthServer();

    } catch (error) {
      console.error('❌ Failed to start payment services:', error);
      process.exit(1);
    }
  }

  private setupCronJobs(): void {
    // Daily reconciliation at 2 AM UTC
    new CronJob('0 2 * * *', async () => {
      if (this.isShuttingDown) return;
      await this.performDailyReconciliation();
    }, null, true, 'UTC');

    // Hourly gas price optimization
    new CronJob('0 * * * *', async () => {
      if (this.isShuttingDown) return;
      await this.optimizeGasPrices();
    }, null, true, 'UTC');

    // Every 15 minutes - check stuck transactions
    new CronJob('*/15 * * * *', async () => {
      if (this.isShuttingDown) return;
      await this.checkStuckTransactions();
    }, null, true, 'UTC');

    // Every 5 minutes - update metrics
    new CronJob('*/5 * * * *', async () => {
      if (this.isShuttingDown) return;
      await this.updateMetrics();
    }, null, true, 'UTC');

    // Weekly security audit (Sunday at 3 AM UTC)
    new CronJob('0 3 * * 0', async () => {
      if (this.isShuttingDown) return;
      await this.performSecurityAudit();
    }, null, true, 'UTC');
  }

  private async performDailyReconciliation(): Promise<void> {
    console.log('📊 Starting daily reconciliation...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all transactions from yesterday
      const [transactions, volume, fees] = await Promise.all([
        this.prisma.tonTransaction.count({
          where: {
            createdAt: { gte: yesterday, lt: today }
          }
        }),
        this.prisma.tonTransaction.aggregate({
          where: {
            status: 'COMPLETED',
            createdAt: { gte: yesterday, lt: today }
          },
          _sum: { amount: true }
        }),
        this.prisma.tonTransaction.aggregate({
          where: {
            status: 'COMPLETED',
            createdAt: { gte: yesterday, lt: today }
          },
          _sum: { fee: true }
        })
      ]);

      console.log(`📈 Daily Summary:`);
      console.log(`   Transactions: ${transactions}`);
      console.log(`   Volume: ${volume._sum.amount || 0} USDT`);
      console.log(`   Fees: ${fees._sum.fee || 0} nanoTON`);

      // Create daily snapshot
      await this.prisma.balanceSnapshot.create({
        data: {
          date: yesterday,
          totalVolume: volume._sum.amount || '0',
          totalTransactions: transactions,
          totalFees: fees._sum.fee || '0',
          metadata: {
            reconciliationDate: new Date(),
            network: 'mainnet'
          }
        }
      });

      console.log('✅ Daily reconciliation completed');

    } catch (error) {
      console.error('❌ Daily reconciliation failed:', error);
    }
  }

  private async optimizeGasPrices(): Promise<void> {
    console.log('⛽ Optimizing gas prices...');

    try {
      // The fee optimization service is already running
      // This is just to log current optimization status
      const gasPrice = this.feeService.getCurrentGasPrice();

      console.log(`   Current gas price: ${gasPrice.baseFee} nanoTON`);
      console.log(`   Network congestion: ${(gasPrice.networkCongestion * 100).toFixed(1)}%`);
      console.log(`   Recommended fee: ${gasPrice.recommendedFee} nanoTON`);

    } catch (error) {
      console.error('❌ Gas price optimization failed:', error);
    }
  }

  private async checkStuckTransactions(): Promise<void> {
    try {
      const stuckTxs = await this.prisma.tonTransaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: new Date(Date.now() - TON_MAINNET_CONFIG.limits.confirmationTimeout)
          }
        },
        take: 10
      });

      if (stuckTxs.length > 0) {
        console.log(`⚠️ Found ${stuckTxs.length} stuck transactions`);

        // Record metrics for each stuck transaction
        stuckTxs.forEach(tx => {
          paymentMonitor.recordMetric({
            timestamp: new Date(),
            type: 'timeout',
            transactionId: tx.id,
            userId: tx.userId,
            amount: tx.amount,
            error: 'Transaction stuck in pending state'
          });
        });

        // Try to process backup payments for critical transactions
        for (const tx of stuckTxs) {
          const amount = parseFloat(tx.amount || '0');
          if (amount > 1000000000) { // > 1000 USDT
            console.log(`🔄 Initiating backup payment for large transaction: ${tx.id}`);
            await backupPaymentService.processBackupPayment(
              tx.id,
              tx.amount || '0',
              tx.userId
            );
          }
        }
      }

    } catch (error) {
      console.error('❌ Checking stuck transactions failed:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Update real-time metrics
      const stats = await paymentMonitor.getPaymentStats('hour');

      // Emit custom CloudWatch metrics
      if (process.env.AWS_REGION) {
        const { CloudWatchClient, PutMetricDataCommand } = await import('@aws-sdk/client-cloudwatch');

        const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

        await cloudwatch.send(new PutMetricDataCommand({
          Namespace: 'Deligate/Payments',
          MetricData: [
            {
              MetricName: 'TransactionCount',
              Value: stats.totalTransactions,
              Unit: 'Count',
              Timestamp: new Date()
            },
            {
              MetricName: 'SuccessRate',
              Value: stats.successRate,
              Unit: 'Percent',
              Timestamp: new Date()
            },
            {
              MetricName: 'PendingTransactions',
              Value: await this.prisma.tonTransaction.count({ where: { status: 'PENDING' } }),
              Unit: 'Count',
              Timestamp: new Date()
            },
            {
              MetricName: 'TotalVolume',
              Value: parseFloat(stats.totalVolume) / 1000000, // Convert to USDT
              Unit: 'None',
              Timestamp: new Date()
            }
          ]
        }));
      }

    } catch (error) {
      console.error('❌ Updating metrics failed:', error);
    }
  }

  private async performSecurityAudit(): Promise<void> {
    console.log('🔒 Performing weekly security audit...');

    try {
      // Check for suspicious patterns
      const [suspiciousUsers, largeTransactions, failedTransactions] = await Promise.all([
        // Users with many failed transactions
        this.prisma.$queryRaw`
          SELECT "userId", COUNT(*) as fail_count
          FROM "ton_transactions"
          WHERE status = 'FAILED'
            AND "createdAt" >= NOW() - INTERVAL '24 hours'
          GROUP BY "userId"
          HAVING COUNT(*) >= ${TON_MAINNET_CONFIG.security.suspiciousActivityThreshold}
        `,
        // Large transactions requiring review
        this.prisma.tonTransaction.findMany({
          where: {
            amount: { gte: TON_MAINNET_CONFIG.security.multisigThreshold },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          take: 10
        }),
        // Failed transactions by error type
        this.prisma.$queryRaw`
          SELECT metadata->>'error' as error_type, COUNT(*) as count
          FROM "ton_transactions"
          WHERE status = 'FAILED'
            AND "createdAt" >= NOW() - INTERVAL '7 days'
            AND metadata->>'error' IS NOT NULL
          GROUP BY metadata->>'error'
          ORDER BY count DESC
          LIMIT 10
        `
      ]);

      console.log(`🔍 Security Audit Results:`);
      console.log(`   Suspicious users: ${suspiciousUsers.length}`);
      console.log(`   Large transactions: ${largeTransactions.length}`);
      console.log(`   Failed transaction types: ${failedTransactions.length}`);

      // Create security alert if needed
      if (suspiciousUsers.length > 0 || largeTransactions.length > 10) {
        paymentMonitor.emit('alert', {
          type: 'warning',
          message: 'Security audit detected anomalies requiring review',
          metrics: [],
          threshold: 1,
          currentValue: suspiciousUsers.length + largeTransactions.length
        });
      }

      console.log('✅ Security audit completed');

    } catch (error) {
      console.error('❌ Security audit failed:', error);
    }
  }

  private startHealthServer(): void {
    const http = require('http');

    const server = http.createServer(async (req: any, res: any) => {
      if (req.url === '/health') {
        try {
          // Check database connection
          await this.prisma.$queryRaw`SELECT 1`;

          // Check TON connection
          await this.tonClient.getMasterchainInfo();

          const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
              paymentMonitor: paymentMonitor.isRunning,
              feeOptimization: this.feeService ? true : false,
              backupPayments: true
            },
            network: 'mainnet',
            uptime: process.uptime()
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(health, null, 2));

        } catch (error) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'unhealthy',
            error: error.message
          }));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(3001, () => {
      console.log('🏥 Health check server listening on port 3001');
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;

      try {
        // Stop all services
        await paymentMonitor.stop();
        if (this.feeService) {
          await this.feeService.stop();
        }

        // Close database connection
        await this.prisma.$disconnect();

        console.log('✅ All services stopped successfully');
        process.exit(0);

      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start the services
if (require.main === module) {
  const runner = new PaymentServiceRunner();
  runner.start().catch(error => {
    console.error('❌ Failed to start payment services:', error);
    process.exit(1);
  });
}

export default PaymentServiceRunner;