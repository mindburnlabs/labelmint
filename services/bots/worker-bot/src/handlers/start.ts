import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

export const startCommand = async (ctx: AuthContext) => {
  const telegramId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'there';

  logger.info(`Start command from worker ${telegramId}`);

  // Check worker status
  const isVerified = ctx.user?.isVerified || false;
  const accuracy = ctx.user?.accuracy || 0;
  const earnings = ctx.user?.earnings || 0;
  const streak = ctx.user?.streak || 0;

  const keyboard = new InlineKeyboard()
    .text('💰 Start Earning', 'earn')
    .text('💳 Withdraw', 'withdraw')
    .row()
    .text('📊 My Stats', 'stats')
    .text('💰 Balance', 'balance')
    .row()
    .text('❓ Help', 'help');

  // Welcome message with different text based on status
  let welcomeText = `👋 Welcome to LabelMint, ${firstName}! 🏷️\n\n`;

  if (ctx.user?.role === 'ADMIN') {
    welcomeText = `👋 Welcome back, Admin ${firstName}!\n\n` +
                  `🔧 You have administrative privileges.\n\n`;
  } else if (!isVerified) {
    welcomeText += `🎯 Start earning by completing simple labeling tasks!\n\n` +
                  `⚠️ Complete a few tasks to unlock full features.\n\n`;
  } else if (accuracy >= 0.9) {
    welcomeText += `⭐ You're a top performer! ${(accuracy * 100).toFixed(1)}% accuracy\n\n` +
                  `🏆 Keep up the great work!\n\n`;
  } else {
    welcomeText += `📈 Your accuracy: ${(accuracy * 100).toFixed(1)}%\n` +
                  `💰 Total earnings: $${earnings.toFixed(2)}\n`;

    if (streak > 0) {
      welcomeText += `🔥 ${streak} day streak!\n`;
    }

    welcomeText += `\nReady to earn more?\n\n`;
  }

  welcomeText += `✨ Earn $2-5/hr with flexible hours\n` +
                 `💸 Instant withdrawals to TON/USDT\n` +
                 `🎮 Simple and fun tasks\n\n` +
                 `Tap "Start Earning" to begin!`;

  await ctx.reply(welcomeText, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });

  // Track user activity
  if (ctx.user) {
    logger.info(`Worker ${ctx.user.id} (${telegramId}) accessed the bot`);
  }
};