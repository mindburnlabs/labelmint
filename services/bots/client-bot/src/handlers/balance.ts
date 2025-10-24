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
    const transactions = await apiService.getUserTransactions(ctx.user.id);

    const balanceText = `💰 Account Balance\n\n` +
      `💵 Current Balance: $${balance.toFixed(2)}\n\n`;

    if (transactions.length > 0) {
      const recentTransactions = transactions.slice(0, 5);

      balanceText += `📊 Recent Transactions:\n\n`;

      for (const tx of recentTransactions) {
        const type = tx.type;
        const amount = Math.abs(tx.amount);
        const sign = tx.amount < 0 ? '-' : '+';

        const typeEmoji = {
          DEPOSIT: '💳',
          WITHDRAWAL: '💸',
          EARNING: '💰',
          FEE: '💳',
          REFUND: '💵',
        }[type] || '📝';

        balanceText += `${typeEmoji} ${sign}$${amount.toFixed(2)} - ${type}\n`;
        balanceText += `   ${new Date(tx.createdAt).toLocaleDateString()}\n\n`;
      }

      if (transactions.length > 5) {
        balanceText += `... and ${transactions.length - 5} more transactions\n`;
      }
    } else {
      balanceText += '📝 No transactions yet.\n';
    }

    await ctx.reply(balanceText, {
      reply_markup: new InlineKeyboard()
        .text('💳 Add Funds', 'add_funds')
        .text('📊 Transaction History', 'transactions')
        .row()
        .text('📋 My Projects', 'my_projects'),
    });

  } catch (error) {
    logger.error('Failed to get balance:', error);
    await ctx.reply(
      '❌ Failed to load balance information.\n' +
      'Please try again later.',
    );
  }
};