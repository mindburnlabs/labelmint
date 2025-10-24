import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';

export const balanceCommand = async (ctx: AuthContext) => {
  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');

    const balance = await apiService.getUserBalance(ctx.user.id);
    const pendingWithdrawals = await apiService.getPendingWithdrawals(ctx.user.id);
    const todayEarnings = await apiService.getTodayEarnings(ctx.user.id);

    const availableBalance = balance - (pendingWithdrawals || 0);

    const trustLevel = getTrustLevel(ctx.user.trustScore);
    const trustMultiplier = ctx.user.trustScore >= 0.96 ? 1.2 : ctx.user.trustScore >= 0.9 ? 1.1 : 1.0;

    let balanceText = `💰 Account Balance\n\n` +
      `💵 Available: $${availableBalance.toFixed(2)}\n` +
      `📊 Today's Earnings: $${todayEarnings.toFixed(2)}\n` +
      `🏆 Total Earnings: $${ctx.user.earnings.toFixed(2)}\n\n` +
      `⭐ Trust Level: ${trustLevel}\n` +
      `💎 Multiplier: ${trustMultiplier}x\n`;

    if (pendingWithdrawals > 0) {
      balanceText += `\n⏳ Pending Withdrawals: $${pendingWithdrawals.toFixed(2)}\n`;
    }

    balanceText += `\n📈 Stats:\n` +
      `• Tasks Completed: ${ctx.user.completedTasks}\n` +
      `• Accuracy: ${(ctx.user.accuracy * 100).toFixed(1)}%\n` +
      `• Current Streak: ${ctx.user.streak} days\n`;

    const keyboard = new InlineKeyboard();

    if (availableBalance >= 1.0) {
      keyboard.text('💳 Withdraw', 'withdraw');
    }

    keyboard
      .text('💰 Start Earning', 'earn')
      .row()
      .text('📊 Full Stats', 'stats')
      .text('📜 Transaction History', 'transactions');

    await ctx.reply(balanceText, {
      reply_markup: keyboard,
    });

  } catch (error) {
    logger.error('Failed to get balance:', error);
    await ctx.reply(
      '❌ Failed to load balance information.\n' +
      'Please try again later.',
    );
  }
};

function getTrustLevel(trustScore: number): string {
  if (trustScore >= 0.96) return '🏆 Platinum';
  if (trustScore >= 0.9) return '🥇 Gold';
  if (trustScore >= 0.75) return '🥈 Silver';
  return '🥉 Bronze';
}