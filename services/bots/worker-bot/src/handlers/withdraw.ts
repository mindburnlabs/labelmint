import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

export const withdrawCommand = async (ctx: AuthContext) => {
  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  // Check cooldown
  const lastWithdrawal = await apiService.getLastWithdrawal(ctx.user.id);
  if (lastWithdrawal) {
    const hoursSince = (Date.now() - new Date(lastWithdrawal).getTime()) / (1000 * 60 * 60);
    if (hoursSince < config.WITHDRAWAL_COOLDOWN_HOURS) {
      const waitHours = Math.ceil(config.WITHDRAWAL_COOLDOWN_HOURS - hoursSince);
      await ctx.reply(
        `⏳ Withdrawal cooldown active\n\n` +
        `You can withdraw again in ${waitHours} hours.\n\n` +
        `This helps prevent fraud and ensures platform stability.`,
      );
      return;
    }
  }

  try {
    await ctx.replyWithChatAction('typing');

    const balance = await apiService.getUserBalance(ctx.user.id);
    const pendingWithdrawals = await apiService.getPendingWithdrawals(ctx.user.id);
    const availableBalance = balance - (pendingWithdrawals || 0);

    if (availableBalance < config.MIN_WITHDRAWAL_USD) {
      await ctx.reply(
        `💳 Withdrawal\n\n` +
        `❌ Insufficient balance\n\n` +
        `Minimum withdrawal: $${config.MIN_WITHDRAWAL_USD.toFixed(2)}\n` +
        `Your balance: $${availableBalance.toFixed(2)}\n\n` +
        `Keep completing tasks to earn more!\n` +
        `💡 You earn $0.025 - $0.05 per completed task.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Start Earning', callback_data: 'earn' }],
            ],
          },
        },
      );
      return;
    }

    // Check worker level
    if (ctx.user.trustScore < 0.75 && ctx.user.completedTasks < 10) {
      await ctx.reply(
        `💳 Withdrawal Requirements\n\n` +
        `⚠️ Complete more tasks to unlock withdrawals:\n\n` +
        `• Tasks completed: ${ctx.user.completedTasks}/10\n` +
        `• Accuracy: ${(ctx.user.accuracy * 100).toFixed(1)}% (need 75%+)\n\n` +
        `Keep working! You're almost there 🚀`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Start Earning', callback_data: 'earn' }],
            ],
          },
        },
      );
      return;
    }

    // Show withdrawal options
    const keyboard = new InlineKeyboard();

    if (config.ENABLE_TON_WITHDRAWALS && ctx.user.trustScore >= 0.75) {
      keyboard
        .text('💳 Telegram Wallet (Instant)', 'withdraw_telegram')
        .text('📱 TON Wallet', 'withdraw_ton')
        .row();
    }

    keyboard
      .text('💵 Fiat (Bank Transfer)', 'withdraw_fiat')
      .text('❌ Cancel', 'cancel_withdraw');

    await ctx.reply(
      `💳 Withdraw Funds\n\n` +
      `💰 Available Balance: $${availableBalance.toFixed(2)}\n` +
      `🏆 Trust Level: ${getTrustLevel(ctx.user.trustScore)}\n\n` +
      `Select withdrawal method:`,
      {
        reply_markup: keyboard,
      },
    );

  } catch (error) {
    logger.error('Failed to process withdrawal:', error);
    await ctx.reply(
      '❌ Failed to process withdrawal request.\n' +
      'Please try again later.',
    );
  }
};

export async function handleWithdrawalMethod(ctx: AuthContext, method: string) {
  if (!ctx.user) return;

  try {
    const balance = await apiService.getUserBalance(ctx.user.id);
    const pendingWithdrawals = await apiService.getPendingWithdrawals(ctx.user.id);
    const availableBalance = balance - (pendingWithdrawals || 0);

    switch (method) {
      case 'telegram':
        if (ctx.user.trustScore < 0.75) {
          await ctx.reply(
            '⚠️ Telegram Wallet withdrawals require Silver+ trust level.\n\n' +
            `Your level: ${getTrustLevel(ctx.user.trustScore)}\n\n` +
            'Complete more tasks with high accuracy to level up!',
          );
          return;
        }

        await ctx.reply(
          '💳 Telegram Wallet Withdrawal\n\n' +
          '✅ Instant withdrawal to your Telegram Wallet\n' +
          '✅ Zero fees\n' +
          '✅ $1.00 - $50.00 per transaction\n\n' +
          `Available: $${availableBalance.toFixed(2)}\n\n` +
          'Enter amount to withdraw:',
          {
            reply_markup: {
              force_reply: true,
              input_field_placeholder: `Amount ($1.00 - $${Math.min(50, availableBalance).toFixed(2)})`,
            },
          },
        );
        break;

      case 'ton':
        await ctx.reply(
          '📱 TON Wallet Withdrawal\n\n' +
          '⚡ Fast withdrawal to any TON address\n' +
          '📉 Network fee: ~0.002 TON\n' +
      '💰 Minimum: $5.00\n\n' +
          `Available: $${availableBalance.toFixed(2)}\n\n` +
          'Enter your TON address:',
          {
            reply_markup: {
              force_reply: true,
              input_field_placeholder: 'Your TON address (starts with EQ...)',
            },
          },
        );
        break;

      case 'fiat':
        await ctx.reply(
          '💵 Fiat Withdrawal (Bank Transfer)\n\n' +
          '🏦 Processed daily at 16:00 UTC\n' +
          '💰 Minimum: $20.00\n' +
          '📉 Fee: $2.00\n\n' +
          `Available: $${availableBalance.toFixed(2)}\n\n` +
          'To proceed, please contact:\n' +
          '💬 @LabelMintSupport\n\n' +
          'Mention your withdrawal amount and provide bank details.',
        );
        break;
    }
  } catch (error) {
    logger.error('Withdrawal method error:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
}

function getTrustLevel(trustScore: number): string {
  if (trustScore >= 0.96) return '🏆 Platinum';
  if (trustScore >= 0.9) return '🥇 Gold';
  if (trustScore >= 0.75) return '🥈 Silver';
  return '🥉 Bronze';
}