import { CallbackQuery } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { earnCommand } from './earn.js';
import { balanceCommand } from './balance.js';
import { statsCommand } from './stats.js';
import { helpCommand } from './help.js';
import { handleWithdrawalMethod } from './withdraw.js';

export const callbackQueryHandler = async (ctx: AuthContext) => {
  const data = ctx.callbackQuery.data;

  try {
    switch (data) {
      // Navigation callbacks
      case 'earn':
        await ctx.answerCallbackQuery();
        await earnCommand(ctx);
        break;

      case 'balance':
        await ctx.answerCallbackQuery();
        await balanceCommand(ctx);
        break;

      case 'stats':
        await ctx.answerCallbackQuery();
        await statsCommand(ctx);
        break;

      case 'help':
        await ctx.answerCallbackQuery();
        await helpCommand(ctx);
        break;

      // Withdrawal callbacks
      case 'withdraw':
        await ctx.answerCallbackQuery();
        ctx.reply = ctx.reply as any;
        await import('./withdraw.js').then(m => m.withdrawCommand(ctx));
        break;

      case 'withdraw_telegram':
        await ctx.answerCallbackQuery();
        await handleWithdrawalMethod(ctx, 'telegram');
        break;

      case 'withdraw_ton':
        await ctx.answerCallbackQuery();
        await handleWithdrawalMethod(ctx, 'ton');
        break;

      case 'withdraw_fiat':
        await ctx.answerCallbackQuery();
        await handleWithdrawalMethod(ctx, 'fiat');
        break;

      case 'cancel_withdraw':
        await ctx.answerCallbackQuery();
        await ctx.reply('❌ Withdrawal cancelled.');
        break;

      // Task callbacks
      case 'skip_task':
        await ctx.answerCallbackQuery();
        await handleSkipTask(ctx);
        break;

      // Other callbacks
      case 'transactions':
        await ctx.answerCallbackQuery({
          text: 'Transaction history coming soon!',
          show_alert: true,
        });
        break;

      case 'history':
        await ctx.answerCallbackQuery({
          text: 'Full history coming soon!',
          show_alert: true,
        });
        break;

      case 'achievements':
        await ctx.answerCallbackQuery({
          text: 'Achievements system coming soon!',
          show_alert: true,
        });
        break;

      default:
        await ctx.answerCallbackQuery({
          text: '❓ Unknown action',
          show_alert: true,
        });
        logger.warn(`Unknown callback: ${data}`);
    }
  } catch (error) {
    logger.error(`Callback handler error for ${data}:`, error);
    await ctx.answerCallbackQuery({
      text: '❌ An error occurred',
      show_alert: true,
    });
  }
};

async function handleSkipTask(ctx: AuthContext) {
  try {
    // In real implementation, call API to skip current task
    await ctx.reply(
      '⏭️ Task skipped\n\n' +
      'Note: Skipping too many tasks may affect your accuracy rating.\n\n' +
      'Ready for the next task?',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 Continue', callback_data: 'earn' },
              { text: '📊 Stats', callback_data: 'stats' },
            ],
          ],
        },
      },
    );

    logger.info(`Worker ${ctx.user?.id} skipped a task`);
  } catch (error) {
    logger.error('Failed to skip task:', error);
    await ctx.reply(
      '❌ Failed to skip task.\n' +
      'Please try completing it instead.',
    );
  }
}