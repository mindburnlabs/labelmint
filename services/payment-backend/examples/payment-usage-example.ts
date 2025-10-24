import { Bot } from 'grammy';
import { PaymentHandler } from '../bot/payment-handler';
import { TonClient } from '@ton/ton';
import { PaymentProcessor } from '../services/PaymentProcessor';

// Example: Complete payment flow setup

async function setupPaymentSystem() {
  // 1. Initialize bot
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

  // 2. Initialize TON client
  const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY
  });

  // 3. Initialize payment handler
  const paymentHandler = new PaymentHandler(
    bot,
    tonClient,
    process.env.PAYMENT_PROCESSOR_ADDRESS || 'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE'
  );

  // 4. Initialize payment handler
  await paymentHandler.initialize();

  return { bot, paymentHandler };
}

// Example: Task completion with payment
async function handleTaskCompletion(taskId: number, workerId: number, quality: number) {
  const { paymentHandler } = await setupPaymentSystem();

  // Get task details
  const task = await getTaskDetails(taskId);

  // Calculate payment based on task complexity and quality
  const payment = await paymentHandler.calculateTaskPayment(
    taskId,
    task.complexity,
    task.turnaround,
    quality
  );

  console.log(`Payment amount: ${payment.amount} USDT`);

  // Process payment
  const result = await paymentHandler.payWorker(
    workerId,
    taskId,
    task.complexity,
    task.turnaround
  );

  if (result.success) {
    console.log('✅ Payment successful!');

    // Send notification to worker
    await bot.api.sendMessage(workerId, `
🎉 Task completed successfully!

💰 Earned: ${payment.amount.toFixed(6)} USDT
📊 Quality Score: ${(quality * 100).toFixed(1)}%
📋 Task ID: ${taskId}

Your balance has been updated.
    `);
  } else {
    console.error('❌ Payment failed:', result.error);
  }
}

// Example: Batch withdrawal processing
async function processBatchWithdrawals() {
  const { paymentHandler } = await setupPaymentSystem();

  // Process pending withdrawals
  const result = await paymentHandler.processWithdrawalBatch();

  console.log(`Processed ${result.processed} withdrawals`);

  // Get withdrawal statistics
  const stats = await getWithdrawalStats();
  console.log('Withdrawal stats:', stats);
}

// Example: Worker balance management
async function manageWorkerBalance(workerId: number) {
  const { paymentHandler } = await setupPaymentSystem();

  // Get current balance
  const balance = await paymentHandler.getWorkerBalance(workerId);

  console.log(`Worker ${workerId} balance:`, {
    usdt: balance.balance,
    channel: balance.channelBalance,
    total: balance.balance + balance.channelBalance
  });

  // Check if worker needs payment channel
  if (balance.balance > 20 && !await paymentHandler.getPaymentChannel(workerId)) {
    // Create payment channel for high-volume worker
    const channel = await paymentHandler.createPaymentChannel(workerId, 50);
    console.log(`Created payment channel with capacity: ${channel.capacity} USDT`);
  }

  // Check if balance exceeds withdrawal threshold
  if (balance.balance >= 10) {
    console.log('Worker eligible for withdrawal');

    // Suggest withdrawal to worker
    await suggestWithdrawal(workerId, balance.balance);
  }
}

// Example: Payment channel operations
async function demonstratePaymentChannels() {
  const { paymentHandler } = await setupPaymentSystem();
  const workerId = 12345;

  // Create payment channel
  const channel = await paymentHandler.createPaymentChannel(workerId, 100);
  console.log('Created channel:', channel);

  // Process multiple payments through channel (zero fee)
  const payments = [
    { taskId: 1, complexity: 'simple', turnaround: 'standard' },
    { taskId: 2, complexity: 'medium', turnaround: 'priority' },
    { taskId: 3, complexity: 'complex', turnaround: 'urgent' }
  ];

  for (const payment of payments) {
    const result = await paymentHandler.payWorker(
      workerId,
      payment.taskId,
      payment.complexity,
      payment.turnaround
    );

    console.log(`Payment for task ${payment.taskId}:`, result);
  }

  // Check remaining channel capacity
  const updatedBalance = await paymentHandler.getWorkerBalance(workerId);
  console.log('Channel balance:', updatedBalance.channelBalance);
}

// Example: Quality-based payment adjustment
async function demonstrateQualityPayments() {
  const { paymentHandler } = await setupPaymentSystem();

  const qualityScores = [0.85, 0.92, 0.95, 0.98, 1.0];

  for (const quality of qualityScores) {
    const payment = await paymentHandler.calculateTaskPayment(
      1,
      'medium',
      'standard',
      quality
    );

    console.log(`Quality ${(quality * 100).toFixed(0)}%:`, {
      baseRate: payment.baseRate,
      multiplier: payment.multiplier,
      qualityBonus: payment.qualityBonus,
      totalAmount: payment.amount
    });
  }
}

// Example: Telegram bot command handlers
function setupBotCommands(bot: Bot, paymentHandler: PaymentHandler) {
  // /earnings command
  bot.command('earnings', async (ctx) => {
    const workerId = ctx.from?.id;
    if (!workerId) return;

    const earnings = await getWorkerEarnings(workerId);

    const message = `
📊 Your Earnings Summary:

💰 Total Earned: ${earnings.totalEarned.toFixed(6)} USDT
💵 Current Balance: ${earnings.balance.toFixed(6)} USDT
📈 Today: ${earnings.today.toFixed(6)} USDT
📅 This Week: ${earnings.week.toFixed(6)} USDT
📆 This Month: ${earnings.month.toFixed(6)} USDT

🏆 Rank: #${earnings.rank}
✅ Tasks Completed: ${earnings.tasksCompleted}
⭐ Average Rating: ${earnings.averageRating.toFixed(2)}/5.0
    `;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Withdraw', callback_data: 'withdraw_menu' }],
          [{ text: '📊 Statistics', callback_data: 'stats_menu' }]
        ]
      }
    });
  });

  // /tasks command
  bot.command('tasks', async (ctx) => {
    const workerId = ctx.from?.id;
    if (!workerId) return;

    const availableTasks = await getAvailableTasks(workerId);

    if (availableTasks.length === 0) {
      await ctx.reply('No tasks available at the moment. Check back later!');
      return;
    }

    let message = '📋 Available Tasks:\n\n';

    availableTasks.forEach((task, index) => {
      const payment = calculateTaskPayment(task);
      message += `${index + 1}. ${task.title}\n`;
      message += `   💰 ${payment.amount.toFixed(6)} USDT\n`;
      message += `   📊 ${task.complexity} | ⏱️ ${task.turnaround}\n\n`;
    });

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: availableTasks.map((task, index) => [{
          text: `Start Task ${index + 1}`,
          callback_data: `start_task_${task.id}`
        }])
      }
    });
  });

  // /payout command
  bot.command('payout', async (ctx) => {
    const workerId = ctx.from?.id;
    if (!workerId) return;

    const balance = await paymentHandler.getWorkerBalance(workerId);

    if (balance.balance < 1) {
      await ctx.reply('❌ Insufficient balance for withdrawal.\nMinimum: 1 USDT');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Withdraw 5 USDT', callback_data: 'withdraw_5' },
          { text: 'Withdraw 10 USDT', callback_data: 'withdraw_10' }
        ],
        [
          { text: 'Withdraw 25 USDT', callback_data: 'withdraw_25' },
          { text: 'Withdraw 50 USDT', callback_data: 'withdraw_50' }
        ],
        [
          { text: 'Withdraw All', callback_data: `withdraw_${balance.balance}` }
        ]
      ]
    };

    await ctx.reply(
      `💳 Withdrawal Options\n\n` +
      `Current Balance: ${balance.balance.toFixed(6)} USDT\n` +
      `Withdrawal Fee: 0.1 USDT per withdrawal\n\n` +
      'Select amount:',
      keyboard
    );
  });
}

// Helper functions
async function getTaskDetails(taskId: number) {
  // Implementation to fetch task details from database
  return {
    id: taskId,
    complexity: 'medium',
    turnaround: 'standard'
  };
}

async function getWithdrawalStats() {
  // Implementation to fetch withdrawal statistics
  return {
    totalProcessed: 150,
    totalAmount: 1250.50,
    averageAmount: 8.34,
    feesCollected: 15.00
  };
}

async function getWorkerEarnings(workerId: number) {
  // Implementation to fetch worker earnings
  return {
    totalEarned: 125.75,
    balance: 15.25,
    today: 5.50,
    week: 35.00,
    month: 125.75,
    rank: 42,
    tasksCompleted: 342,
    averageRating: 4.8
  };
}

async function getAvailableTasks(workerId: number) {
  // Implementation to fetch available tasks for worker
  return [
    {
      id: 1,
      title: 'Image Classification',
      complexity: 'simple',
      turnaround: 'standard'
    },
    {
      id: 2,
      title: 'Text Annotation',
      complexity: 'medium',
      turnaround: 'priority'
    }
  ];
}

function calculateTaskPayment(task: any) {
  // Calculate payment based on task
  const rates = {
    simple: 0.02,
    medium: 0.05,
    complex: 0.15,
    expert: 0.75
  };

  const multipliers = {
    standard: 1,
    priority: 1.5,
    urgent: 2.5
  };

  const baseRate = rates[task.complexity] || 0.02;
  const multiplier = multipliers[task.turnaround] || 1;

  return {
    amount: baseRate * multiplier,
    baseRate,
    multiplier
  };
}

async function suggestWithdrawal(workerId: number, amount: number) {
  // Implementation to send withdrawal suggestion
  console.log(`Suggesting withdrawal of ${amount} USDT to worker ${workerId}`);
}

// Export for use in main application
export {
  setupPaymentSystem,
  handleTaskCompletion,
  processBatchWithdrawals,
  manageWorkerBalance,
  demonstratePaymentChannels,
  demonstrateQualityPayments,
  setupBotCommands
};