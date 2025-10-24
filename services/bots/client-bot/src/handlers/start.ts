import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const startCommand = async (ctx: AuthContext) => {
  const telegramId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'there';

  logger.info(`Start command from user ${telegramId}`);

  const keyboard = new InlineKeyboard()
    .text('🆕 Create Project', 'new_project')
    .text('📋 My Projects', 'my_projects')
    .row()
    .text('💳 Add Funds', 'add_funds')
    .text('💰 My Balance', 'my_balance')
    .row()
    .text('❓ Help', 'help');

  const welcomeText = ctx.user?.role === 'ADMIN'
    ? `👋 Welcome back, Admin ${firstName}!\n\n` +
      `🔧 You have administrative privileges.\n\n` +
      `What would you like to do today?`
    : `👋 Welcome to LabelMint, ${firstName}! 🏷️\n\n` +
      `🎯 Your Telegram Data Labeling Platform\n` +
      `✨ Powered by TON/USDT micropayments\n\n` +
      `Create projects, track progress, and get high-quality labels within hours.\n\n` +
      `Ready to start?`;

  await ctx.reply(welcomeText, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });

  // Track user activity
  if (ctx.user) {
    logger.info(`User ${ctx.user.id} (${telegramId}) accessed the bot`);
  }
};