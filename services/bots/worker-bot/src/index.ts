import { Bot, GrammyError, HttpError, Context } from 'grammy';
import { hydrate } from '@grammyjs/hydrate';
import { I18n, I18nFlavors } from '@grammyjs/i18n';
import { autoQuote } from 'grammy-autoquote';
import { sessions } from '@grammyjs/sessions';
import { conversations } from '@grammyjs/conversations';
import { autoChatAction } from '@grammyjs/auto-chat-action';
import Redis from 'ioredis';

import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import handlers
import { workerCommands } from './handlers/workerCommands.js';
import { handleWorkerCallback } from './handlers/workerCallbacks.js';

// Import scenes
import { onboardingScene } from './scenes/onboarding.js';
import { withdrawScene } from './scenes/withdraw.js';

// Import services
import { WebSocketService } from './services/websocketService.js';
import { workerApiService } from './services/workerApiService.js';

// Initialize bot
const bot = new Bot(config.BOT_TOKEN);

// Bot configuration
bot.use(hydrate());
bot.use(autoQuote());
bot.use(autoChatAction());

// Session management with Redis
const redis = new Redis(config.REDIS_URL);
bot.use(
  sessions({
    initial: () => ({
      userId: null,
      workerId: null,
      isVerified: false,
      currentTask: null,
      pendingTask: null,
      streak: 0,
      xp: 0,
      level: 1,
      lastActive: null,
      preferences: {
        new_tasks: true,
        payments: true,
        achievements: true,
        daily_summary: false,
        task_reminders: true,
        rank_changes: true
      },
      stats: {
        total_completed: 0,
        total_earned: 0,
        avg_accuracy: 0,
        avg_time_per_task: 0,
        today_completed: 0,
        today_earned: 0
      }
    }),
    storage: {
      get: async (key) => {
        try {
          const data = await redis.get(`session:${key}`);
          return data ? JSON.parse(data) : undefined;
        } catch (error) {
          logger.error('Session get error:', error);
          return undefined;
        }
      },
      set: async (key, value) => {
        try {
          await redis.setex(`session:${key}`, 86400, JSON.stringify(value));
        } catch (error) {
          logger.error('Session set error:', error);
        }
      },
      delete: async (key) => {
        try {
          await redis.del(`session:${key}`);
        } catch (error) {
          logger.error('Session delete error:', error);
        }
      },
    },
  })
);

// Conversations
bot.use(conversations());

// Internationalization
const i18n = new I18n<I18nFlavors>({
  defaultLanguage: 'en',
  directory: 'locales',
  useSession: true,
  fluentBundleOptions: {
    useIsolating: false,
  },
});
bot.use(i18n);

// Initialize WebSocket service
const wsService = new WebSocketService(bot);

// Middleware
bot.use(authMiddleware);
bot.use(rateLimitMiddleware);
bot.use(errorHandler);

// WebSocket subscription middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    // Subscribe user to worker notifications
    wsService.subscribe(ctx.from.id.toString());

    // Update daily streak if needed
    const session = ctx.session;
    const lastActive = session.lastActive;
    const today = new Date().toDateString();

    if (lastActive !== today) {
      session.lastActive = today;

      // Check if it's consecutive day
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastActive === yesterday.toDateString()) {
        session.streak = (session.streak || 0) + 1;

        // Send streak notification
        if (session.streak > 1) {
          await ctx.reply(
            `🔥 *Daily Streak: ${session.streak} days!*\n\n` +
            `Keep it up to earn bonus rewards! 🎁`,
            { parse_mode: 'Markdown' }
          );
        }
      } else {
        session.streak = 1;
      }
    }
  }
  await next();
});

// Register scenes
bot.use(onboardingScene);
bot.use(withdrawScene);

// Commands
bot.command('start', workerCommands.start);
bot.command('tasks', workerCommands.tasks);
bot.command('earnings', workerCommands.earnings);
bot.command('withdraw', workerCommands.withdraw);
bot.command('profile', workerCommands.profile);
bot.command('leaderboard', workerCommands.leaderboard);
bot.command('achievements', workerCommands.achievements);
bot.command('training', workerCommands.training);
bot.command('help', workerCommands.help);

// Handle callback queries
bot.on('callback_query:data', handleWorkerCallback);

// Handle text messages for task input
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  // Handle task completion input
  if (session.currentTask && session.awaitingInput) {
    await handleTaskInput(ctx, text);
    return;
  }

  // Handle other messages
  await ctx.reply(
    '🤖 *I didn\'t understand that.*\n\n' +
    'Use the menu buttons or type /help to see available commands.',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '📋 Main Menu', callback_data: 'main_menu' }
      ]] }
    }
  );
});

// Helper function to handle task input
async function handleTaskInput(ctx: Context, input: string) {
  const session = ctx.session;

  try {
    // Submit the task
    const result = await workerApiService.submitTask(
      session.currentTask.id,
      input
    );

    if (result.success) {
      // Update stats
      session.stats.total_completed++;
      session.stats.today_completed++;
      session.stats.total_earned += result.earned;
      session.stats.today_earned += result.earned;
      session.xp += result.xp || 10;

      // Check for level up
      const newLevel = Math.floor(session.xp / 100) + 1;
      if (newLevel > session.level) {
        session.level = newLevel;
        await ctx.reply(
          `🎉 *LEVEL UP!*\n\n` +
          `You've reached level ${newLevel}! 🎊\n` +
          `Keep up the great work!`,
          { parse_mode: 'Markdown' }
        );
      }

      await ctx.reply(
        `✅ *Task Completed!*\n\n` +
        `💰 Earned: $${result.earned.toFixed(4)}\n` +
        `⭐ XP: +${result.xp || 10}\n` +
        `🎯 Accuracy: ${(result.accuracy * 100).toFixed(1)}%\n\n` +
        `Great job! Ready for the next task?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 Next Task', callback_data: 'next_task' },
              { text: '⏸️ Take a Break', callback_data: 'take_break' }
            ]]
          }
        }
      );

      // Clear current task
      session.currentTask = null;
      session.awaitingInput = false;

    } else {
      await ctx.reply(
        `❌ *Submission Failed*\n\n` +
        `${result.error || 'An error occurred. Please try again.'}`,
        { parse_mode: 'Markdown' }
      );
    }

  } catch (error) {
    logger.error('Error submitting task:', error);
    await ctx.reply(
      '❌ *Error*\n\n' +
      'Failed to submit task. Please try again.',
      { parse_mode: 'Markdown' }
    );
  }
}

// Error handling
bot.catch((err) => {
  logger.error('Bot error:', err);

  if (err instanceof GrammyError) {
    logger.error(`Error in request: ${err.description}`);
  } else if (err instanceof HttpError) {
    logger.error(`Could not contact Telegram: ${err}`);
  } else {
    logger.error('Unknown error:', err);
  }
});

// Set bot commands
bot.api.setMyCommands([
  { command: 'start', description: 'Start the bot and onboarding' },
  { command: 'tasks', description: 'View available tasks' },
  { command: 'earnings', description: 'View your earnings and balance' },
  { command: 'withdraw', description: 'Withdraw your earnings' },
  { command: 'profile', description: 'View your profile and statistics' },
  { command: 'leaderboard', description: 'View top performers' },
  { command: 'achievements', description: 'View your achievements' },
  { command: 'training', description: 'Access training modules' },
  { command: 'help', description: 'Get help and support' }
]);

// Start bot
logger.info(`Starting LabelMint Worker Bot...`);
logger.info(`Bot: @${bot.botInfo?.username}`);
logger.info(`Environment: ${config.ENVIRONMENT}`);

const start = async () => {
  try {
    const health = await workerApiService.healthCheck();

    if (!health.labeling) {
      logger.warn('Labeling API is not available. Some features may not work.');
    }

    if (!health.payment) {
      logger.warn('Payment API is not available. Withdrawal features may not work.');
    }

    await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query', 'chat_member'],
    });
    logger.info('Bot started successfully!');

    // Log WebSocket status
    setTimeout(() => {
      const wsStatus = wsService.getStatus();
      logger.info(`WebSocket Status: Connected=${wsStatus.connected}, Subscriptions=${wsStatus.subscriptions.length}`);
    }, 5000);

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Stopping bot...');
  bot.stop();
  wsService.close();
  redis.disconnect();
});

process.once('SIGTERM', () => {
  logger.info('Stopping bot...');
  bot.stop();
  wsService.close();
  redis.disconnect();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the bot
start();

export { bot, wsService, workerApiService };