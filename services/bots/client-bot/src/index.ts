import { Bot, GrammyError, HttpError } from 'grammy';
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

// Import enhanced handlers
import { enhancedClientCommands } from './handlers/enhancedCommands.js';
import { handleEnhancedCallback } from './handlers/enhancedCallbacks.js';
import { clientBotKeyboards } from './keyboards/clientKeyboards.js';

// Import scenes
import { newProjectScene } from './scenes/newProject.js';
import { depositScene } from './scenes/deposit.js';

// Import services
import { WebSocketService } from './services/websocketService.js';
import { enhancedApiService } from './services/enhancedApiService.js';

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
      projectType: null,
      projectId: null,
      wizardStep: null,
      preferences: {
        project_updates: true,
        payment_alerts: true,
        team_activity: true,
        daily_reports: false
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
    // Subscribe user to general notifications
    wsService.subscribe(ctx.from.id.toString());

    // Get user's active projects and subscribe
    try {
      const projects = await enhancedApiService.getProjects(0, 10);
      if (projects.data && projects.data.length > 0) {
        for (const project of projects.data) {
          if (project.status === 'in_progress') {
            wsService.subscribe(ctx.from.id.toString(), project.id);
          }
        }
      }
    } catch (error) {
      logger.error('Error subscribing to project updates:', error);
    }
  }
  await next();
});

// Register scenes
bot.use(newProjectScene);
bot.use(depositScene);

// Enhanced Commands
bot.command('start', enhancedClientCommands.start);
bot.command('projects', enhancedClientCommands.projects);
bot.command('create', enhancedClientCommands.create);
bot.command('analytics', enhancedClientCommands.analytics);
bot.command('billing', enhancedClientCommands.billing);
bot.command('team', enhancedClientCommands.team);
bot.command('notifications', enhancedClientCommands.notifications);
bot.command('settings', enhancedClientCommands.settings);
bot.command('help', enhancedClientCommands.help);

// Handle callback queries
bot.on('callback_query:data', handleEnhancedCallback);

// Handle text messages (for project creation wizard)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  // Handle project name input
  if (session.projectType && !session.projectName) {
    session.projectName = text;
    await ctx.reply(
      `📝 *Project Description*\n\n` +
      `Now, please provide a brief description of your project:\n\n` +
      `Project: ${text}\n` +
      `Type: ${session.projectType === 'image' ? '🖼️ Image Labeling' : '📝 Text Classification'}\n\n` +
      `Enter your description (or type "skip" to continue):`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel_create' }
        ]] }
      }
    );
    return;
  }

  // Handle project description input
  if (session.projectType && session.projectName && !session.projectDescription) {
    if (text.toLowerCase() !== 'skip') {
      session.projectDescription = text;
    }
    await ctx.reply(
      `🏷️ *Label Categories*\n\n` +
      `Enter the categories for labeling, separated by commas.\n\n` +
      `Examples:\n` +
      `• Image: cat, dog, bird, fish\n` +
      `• Text: positive, negative, neutral\n\n` +
      `Enter your categories (minimum 2, maximum 10):`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel_create' }
        ]] }
      }
    );
    return;
  }

  // Handle project categories input
  if (session.projectType && session.projectName && !session.projectCategories) {
    const categories = text.split(',').map(c => c.trim()).filter(c => c.length > 0);

    if (categories.length < 2) {
      await ctx.reply(
        '❌ *Error*\n\n' +
        'Please provide at least 2 categories separated by commas.\n\n' +
        'Example: cat, dog, bird',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (categories.length > 10) {
      await ctx.reply(
        '❌ *Error*\n\n' +
        'Maximum 10 categories allowed.\n\n' +
        'Please provide fewer categories.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    session.projectCategories = categories;

    // Create the project
    try {
      const project = await enhancedApiService.createProject({
        name: session.projectName,
        description: session.projectDescription || '',
        type: session.projectType as 'image' | 'text',
        categories: session.projectCategories,
        status: 'pending'
      });

      await ctx.reply(
        `✅ *Project Created Successfully!*\n\n` +
        `📊 Project: ${project.name}\n` +
        `📝 Description: ${project.description || 'No description'}\n` +
        `🏷️ Type: ${project.type}\n` +
        `📋 Categories: ${project.categories.join(', ')}\n` +
        `🆔 ID: ${project.id}\n\n` +
        `Next step: Upload your data to start labeling!\n\n` +
        `Choose an action:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📁 Upload Data', callback_data: `project_upload_${project.id}` },
                { text: '⚙️ Edit Project', callback_data: `edit_project_${project.id}` }
              ],
              [
                { text: '📊 View Status', callback_data: `project_status_${project.id}` },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]
            ]
          }
        }
      );

      // Clear session
      delete session.projectType;
      delete session.projectName;
      delete session.projectDescription;
      delete session.projectCategories;

    } catch (error) {
      logger.error('Error creating project:', error);
      await ctx.reply(
        '❌ *Error Creating Project*\n\n' +
        'Failed to create the project. Please try again later.',
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }

  // Handle other messages
  await ctx.reply(
    '🤖 *I didn\'t understand that.*\n\n' +
    'Use the menu buttons or type /help to see available commands.',
    {
      parse_mode: 'Markdown',
      reply_markup: clientBotKeyboards.mainMenu()
    }
  );
});

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

// Health check endpoint
bot.api.setMyCommands([
  { command: 'start', description: 'Start the bot and show main menu' },
  { command: 'projects', description: 'View your projects' },
  { command: 'create', description: 'Create a new project' },
  { command: 'analytics', description: 'View analytics and statistics' },
  { command: 'billing', description: 'View billing and payment information' },
  { command: 'team', description: 'Manage team members' },
  { command: 'notifications', description: 'View notifications' },
  { command: 'settings', description: 'Configure bot settings' },
  { command: 'help', description: 'Get help and support' }
]);

// Start bot
logger.info(`Starting LabelMint Client Bot...`);
logger.info(`Bot: @${bot.botInfo?.username}`);
logger.info(`Environment: ${config.ENVIRONMENT}`);

// Check API health before starting
const start = async () => {
  try {
    const health = await enhancedApiService.healthCheck();

    if (!health.labeling) {
      logger.warn('Labeling API is not available. Some features may not work.');
    }

    if (!health.payment) {
      logger.warn('Payment API is not available. Billing features may not work.');
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

export { bot, wsService, enhancedApiService };