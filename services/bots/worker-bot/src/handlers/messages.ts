import { Message } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { apiService } from '../services/apiService.js';
import { config } from '../config/config.js';

export const messageHandler = async (ctx: AuthContext) => {
  // Handle text messages that aren't commands
  if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
    const text = ctx.message.text.trim();

    // Check if user is responding to a withdrawal request
    if (ctx.session.withdrawalMethod) {
      await handleWithdrawalResponse(ctx, text);
      return;
    }

    // Provide helpful response
    await ctx.reply(
      '👋 I see you sent a message.\n\n' +
      'I\'m LabelMint\'s worker bot.\n\n' +
      'Use /help to see available commands,\n' +
      'or use /earn to start earning money!',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Start Earning', callback_data: 'earn' },
              { text: '❓ Help', callback_data: 'help' },
            ],
          ],
        },
      },
    );
    return;
  }

  // Log unhandled messages
  logger.debug(`Unhandled message from ${ctx.from?.id}: ${JSON.stringify(ctx.message)}`);
};

async function handleWithdrawalResponse(ctx: AuthContext, text: string) {
  const method = ctx.session.withdrawalMethod;

  try {
    if (method === 'telegram') {
      const amount = parseFloat(text);

      if (isNaN(amount) || amount < config.MIN_WITHDRAWAL_USD || amount > config.MAX_WITHDRAWAL_USD) {
        await ctx.reply(
          `❌ Invalid amount.\n\n` +
          `Please enter an amount between $${config.MIN_WITHDRAWAL_USD.toFixed(2)} and $${config.MAX_WITHDRAWAL_USD.toFixed(2)}:`,
        );
        return;
      }

      // Process Telegram wallet withdrawal
      await ctx.replyWithChatAction('typing');

      const withdrawal = await apiService.createWithdrawal(ctx.user!.id, {
        amount,
        method: 'TON_INTERNAL',
        address: 'telegram', // Special value for internal wallet
      });

      await ctx.reply(
        `✅ Withdrawal request submitted!\n\n` +
        `Amount: $${amount.toFixed(2)}\n` +
        `Method: Telegram Wallet\n` +
        `Status: Processing\n\n` +
        `💰 Funds will appear in your Telegram Wallet within 30 seconds.\n\n` +
        `Transaction ID: ${withdrawal.id}`,
      );

      logger.info(`Telegram withdrawal created: ${withdrawal.id} for user ${ctx.user!.id}, amount: $${amount}`);
    }
    else if (method === 'ton') {
      // Validate TON address
      if (!text.startsWith('EQ:') && !text.startsWith('0:')) {
        await ctx.reply(
          '❌ Invalid TON address.\n\n' +
          'Please enter a valid TON address:\n' +
          '• Should start with EQ: (bouncable) or 0: (non-bouncable)\n' +
          '• Length should be 66 characters',
        );
        return;
      }

      // Get amount (next message or from session)
      if (!ctx.session.withdrawalAmount) {
        ctx.session.tonAddress = text;
        await ctx.reply(
          '✅ Address received\n\n' +
          'Now enter the amount to withdraw:\n' +
          `Minimum: $5.00`,
        );
        return;
      }

      // Process withdrawal
      const withdrawal = await apiService.createWithdrawal(ctx.user!.id, {
        amount: ctx.session.withdrawalAmount,
        method: 'TON_EXTERNAL',
        address: text,
      });

      await ctx.reply(
        `✅ Withdrawal request submitted!\n\n` +
        `Amount: $${ctx.session.withdrawalAmount.toFixed(2)}\n` +
        `Method: TON Wallet\n` +
        `Address: ${text.slice(0, 10)}...${text.slice(-6)}\n` +
        `Status: Processing\n\n` +
        `💰 Funds will arrive within 60 seconds.\n` +
        `Network fee: ~0.002 TON\n\n` +
        `Transaction ID: ${withdrawal.id}`,
      );

      logger.info(`TON withdrawal created: ${withdrawal.id} for user ${ctx.user!.id}, amount: $${ctx.session.withdrawalAmount}`);
    }

    // Clear session
    delete ctx.session.withdrawalMethod;
    delete ctx.session.tonAddress;
    delete ctx.session.withdrawalAmount;

  } catch (error) {
    logger.error('Withdrawal response error:', error);
    await ctx.reply(
      '❌ Failed to process withdrawal.\n' +
      'Please try again or contact support.',
    );
  }
}