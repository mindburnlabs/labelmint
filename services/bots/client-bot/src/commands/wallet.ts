import { Bot, GrammyContext, session } from '../bot';
import { prisma } from '../lib/prisma';
import { tonPaymentService } from '../lib/tonPayment';
import { createWalletKeyboard, walletMenuKeyboard } from '../keyboards';
import { formatNumber } from '../utils/format';

export async function setupWalletCommands(bot: Bot) {
  // Wallet command
  bot.command('wallet', async (ctx: GrammyContext) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) {
      await ctx.reply('Please start the bot first with /start');
      return;
    }

    const balances = await tonPaymentService.getUserBalance(user.id);

    const message = `💳 *Your Wallet*

🪙 *TON Balance*: ${formatNumber(balances.ton)} TON
💵 *USDT Balance*: $${formatNumber(balances.usdt)} USDT

Choose an action:`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: walletMenuKeyboard,
    });
  });

  // Deposit command
  bot.callbackQuery('deposit', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    await ctx.reply('💰 *Deposit Funds*\n\nChoose the currency you want to deposit:', {
      parse_mode: 'Markdown',
      reply_markup: createWalletKeyboard('deposit'),
    });
  });

  // Deposit TON
  bot.callbackQuery('deposit_ton', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    // Create a unique deposit address or use the merchant address
    const depositAddress = process.env.MERCHANT_ADDRESS;

    const message = `🪙 *Deposit TON*\n\nSend TON to this address:\n\`${depositAddress}\`\n\n⚠️ *Important*: Include your username @${ctx.from?.username} in the transaction comment to automatically credit your account.\n\nMinimum deposit: 0.1 TON`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  });

  // Deposit USDT
  bot.callbackQuery('deposit_usdt', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    const depositAddress = process.env.MERCHANT_ADDRESS;
    const usdtMasterContract = process.env.USDT_MASTER_CONTRACT;

    const message = `💵 *Deposit USDT*\n\nSend USDT to this address:\n\`${depositAddress}\`\n\nJetton: \`${usdtMasterContract}\`\n\n⚠️ *Important*: Include your username @${ctx.from?.username} in the transaction comment to automatically credit your account.\n\nMinimum deposit: 1 USDT`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  });

  // Withdraw command
  bot.callbackQuery('withdraw', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    // Check if user has withdrawal address
    if (!user.tonAddress) {
      await ctx.reply('❌ Please set your withdrawal address first using /setaddress');
      return;
    }

    const balances = await tonPaymentService.getUserBalance(user.id);

    const message = `💸 *Withdraw Funds*\n\nYour balance:\n🪙 TON: ${formatNumber(balances.ton)}\n💵 USDT: $${formatNumber(balances.usdt)}\n\nChoose currency to withdraw:`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: createWalletKeyboard('withdraw'),
    });
  });

  // Withdraw TON
  bot.callbackQuery('withdraw_ton', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    if (!user.tonAddress) {
      await ctx.reply('❌ Please set your withdrawal address first using /setaddress');
      return;
    }

    // Set session state for amount input
    await ctx.session.set('action', 'withdraw_ton');

    await ctx.reply('🪙 *Withdraw TON*\n\nEnter the amount of TON to withdraw:\n\nMinimum: 0.1 TON\nFee: 0.01 TON', {
      parse_mode: 'Markdown',
    });
  });

  // Withdraw USDT
  bot.callbackQuery('withdraw_usdt', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    if (!user.tonAddress) {
      await ctx.reply('❌ Please set your withdrawal address first using /setaddress');
      return;
    }

    // Set session state for amount input
    await ctx.session.set('action', 'withdraw_usdt');

    await ctx.reply('💵 *Withdraw USDT*\n\nEnter the amount of USDT to withdraw:\n\nMinimum: 1 USDT\nFee: 1 USDT', {
      parse_mode: 'Markdown',
    });
  });

  // Set withdrawal address
  bot.command('setaddress', async (ctx: GrammyContext) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) {
      await ctx.reply('Please start the bot first with /start');
      return;
    }

    // Set session state for address input
    await ctx.session.set('action', 'set_address');

    await ctx.reply('📮 *Set Withdrawal Address*\n\nSend your TON wallet address (starts with "EQ" or "0Q"):\n\nExample: `EQD...`', {
      parse_mode: 'Markdown',
    });
  });

  // Transaction history
  bot.callbackQuery('transactions', async (ctx: GrammyContext) => {
    ctx.answerCallbackQuery();

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    const transactions = await tonPaymentService.getTransactionHistory(user.id, { limit: 10 });

    if (transactions.length === 0) {
      await ctx.reply('📄 *Transaction History*\n\nNo transactions found', {
        parse_mode: 'Markdown',
      });
      return;
    }

    let message = '📄 *Recent Transactions*\n\n';

    for (const tx of transactions) {
      const status = tx.status === 'COMPLETED' ? '✅' : '⏳';
      const type = tx.type === 'DEPOSIT' ? '➕' : '➖';
      const amount = parseFloat(tx.amount) / (tx.currency === 'TON' ? 1e9 : 1e6);
      const date = tx.createdAt.toLocaleDateString();

      message += `${status} ${type} ${formatNumber(amount)} ${tx.currency}\n${date} - ${tx.description || 'No description'}\n\n`;
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  });

  // Handle text input for withdrawal amount and address
  bot.on('message:text', async (ctx: GrammyContext) => {
    const sessionData = await ctx.session.get();
    const action = sessionData?.action;

    if (!action) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) return;

    if (action === 'set_address') {
      const address = ctx.message.text.trim();

      // Basic address validation
      if (!address.startsWith('EQ') && !address.startsWith('0Q')) {
        await ctx.reply('❌ Invalid address format. Please send a valid TON address starting with "EQ" or "0Q"');
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { tonAddress: address },
      });

      await ctx.reply(`✅ Withdrawal address updated: \`${address}\``, {
        parse_mode: 'Markdown',
      });

      await ctx.session.delete('action');
    } else if (action === 'withdraw_ton' || action === 'withdraw_usdt') {
      const amount = parseFloat(ctx.message.text.trim());
      const currency = action === 'withdraw_ton' ? 'TON' : 'USDT';
      const minAmount = currency === 'TON' ? 0.1 : 1;

      if (isNaN(amount) || amount < minAmount) {
        await ctx.reply(`❌ Invalid amount. Minimum withdrawal is ${minAmount} ${currency}`);
        return;
      }

      // Check balance
      const balances = await tonPaymentService.getUserBalance(user.id);
      const userBalance = currency === 'TON' ? balances.ton : balances.usdt;

      if (amount > userBalance) {
        await ctx.reply(`❌ Insufficient balance. Your ${currency} balance: ${formatNumber(userBalance)}`);
        return;
      }

      // Process withdrawal
      await ctx.reply(`⏳ Processing withdrawal of ${formatNumber(amount)} ${currency}...`);

      const result = await tonPaymentService.processWithdrawal({
        userId: user.id,
        amount,
        address: user.tonAddress!,
        currency: currency as 'TON' | 'USDT',
      });

      if (result.success) {
        await ctx.reply(`✅ Withdrawal successful!\n\nAmount: ${formatNumber(amount)} ${currency}\nAddress: \`${user.tonAddress}\`\nTransaction: \`${result.transactionHash}\`\n\nPlease allow 2-5 minutes for the transaction to complete.`, {
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.reply(`❌ Withdrawal failed: ${result.error || 'Unknown error'}`);
      }

      await ctx.session.delete('action');
    }
  });

  // Balance command shortcut
  bot.command('balance', async (ctx: GrammyContext) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
    });

    if (!user) {
      await ctx.reply('Please start the bot first with /start');
      return;
    }

    const balances = await tonPaymentService.getUserBalance(user.id);

    const message = `💳 *Balance*\n\n🪙 ${formatNumber(balances.ton)} TON\n💵 $${formatNumber(balances.usdt)} USDT`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
  });
}