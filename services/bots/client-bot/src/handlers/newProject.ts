import { Bot } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export const newProjectCommand = async (ctx: AuthContext) => {
  if (!config.ENABLE_PROJECT_CREATION) {
    await ctx.reply(
      '⚠️ Project creation is temporarily disabled.\n' +
      'Please try again later or contact support.'
    );
    return;
  }

  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  // Check user balance
  try {
    const balance = await ctx.api.getUserBalance(ctx.user.id);
    if (balance <= 0) {
      await ctx.reply(
        '💳 You need to add funds to create a project.\n\n' +
        'Use /deposit to add funds to your account.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Add Funds', callback_data: 'add_funds' }],
            ],
          },
        }
      );
      return;
    }
  } catch (error) {
    logger.error('Failed to check user balance:', error);
  }

  // Enter new project scene
  await ctx.scene.enter('newProject');
};