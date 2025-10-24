import { Scenes, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

export const depositScene = new Scenes.Scene<AuthContext>('deposit');

depositScene.initial = async (ctx) => {
  await ctx.reply(
    '💳 Add Funds to Your Account\n\n' +
    'Choose amount to deposit:',
    {
      reply_markup: new InlineKeyboard()
        .text('$10', 'deposit_10')
        .text('$25', 'deposit_25')
        .text('$50', 'deposit_50')
        .row()
        .text('$100', 'deposit_100')
        .text('$250', 'deposit_250')
        .text('$500', 'deposit_500')
        .row()
        .text('💰 Custom Amount', 'deposit_custom')
        .text('❌ Cancel', 'cancel'),
    },
  );

  await ctx.scene.resume();
};

// Handle predefined amount selection
depositScene.wait('amount').callbackQuery(/^deposit_(.+)$/, async (ctx) => {
  const amount = ctx.match![1];

  if (amount === 'custom') {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      '💰 Enter custom amount (USD):\n\n' +
      'Minimum: $10\n' +
      'Maximum: $10,000\n\n' +
      'Example: 75.50',
    );
    await ctx.scene.wait('custom_amount');
    return;
  }

  const depositAmount = parseFloat(amount);
  await processDeposit(ctx, depositAmount);
});

// Handle custom amount
depositScene.wait('custom_amount').on('message:text', async (ctx) => {
  const amountText = ctx.message.text.trim();
  const amount = parseFloat(amountText);

  if (isNaN(amount) || amount < 10 || amount > 10000) {
    await ctx.reply(
      '❌ Invalid amount.\n\n' +
      'Please enter an amount between $10 and $10,000:\n' +
      'Example: 75.50',
    );
    return;
  }

  await processDeposit(ctx, amount);
});

// Process deposit
async function processDeposit(ctx: AuthContext, amount: number) {
  try {
    await ctx.reply('⏳ Creating payment link...');

    // Create Stripe payment intent
    const payment = await apiService.createStripePaymentIntent(
      ctx.user!.id,
      Math.round(amount * 100), // Convert to cents
    );

    await ctx.reply(
      `💳 Payment Link Created\n\n` +
      `Amount: $${amount.toFixed(2)}\n` +
      `Payment ID: ${payment.id}\n\n` +
      `Click the link below to complete your payment:\n` +
      `${payment.paymentUrl}\n\n` +
      `⚠️ This link will expire in 30 minutes.\n\n` +
      `After payment, your balance will be updated automatically.`,
      {
        reply_markup: new InlineKeyboard()
          .url('💳 Pay Now', payment.paymentUrl)
          .text('🔄 Check Payment', `check_payment_${payment.id}`)
          .row()
          .text('📊 My Balance', 'my_balance')
          .text('❌ Cancel', 'cancel'),
      },
    );

    // Store payment ID in session for checking
    ctx.scene.session.taskId = payment.id;

    logger.info(`Payment intent created: ${payment.id} for user ${ctx.user!.id}, amount: $${amount}`);

  } catch (error) {
    logger.error('Failed to create payment:', error);
    await ctx.reply(
      '❌ Failed to create payment link.\n' +
      'Please try again or contact support.\n\n' +
      'You can also try:\n' +
      '• Different amount\n' +
      '• Different payment method\n' +
      '• Contact support',
    );
  }
}

// Check payment status
depositScene.callbackQuery(/^check_payment_(.+)$/, async (ctx) => {
  const paymentId = ctx.match![1];
  await ctx.answerCallbackQuery();

  await ctx.reply(
    '⏳ Checking payment status...\n\n' +
    'Please wait a moment.',
  );

  // In real implementation, check Stripe payment status
  // For now, simulate checking
  setTimeout(async () => {
    await ctx.reply(
      '⏳ Payment is being processed.\n\n' +
      'This usually takes a few seconds.\n' +
      'You will receive a notification once the payment is confirmed.\n\n' +
      'Your balance will be updated automatically.',
      {
        reply_markup: new InlineKeyboard()
          .text('🔄 Check Again', `check_payment_${paymentId}`)
          .text('📊 My Balance', 'my_balance'),
      },
    );
  }, 2000);
});

// Handle cancel
depositScene.command('cancel', async (ctx) => {
  await ctx.reply('❌ Deposit cancelled.');
  await ctx.scene.exit();
});

depositScene.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('❌ Deposit cancelled.');
  await ctx.scene.exit();
});