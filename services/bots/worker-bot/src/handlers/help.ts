import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';

export const helpCommand = async (ctx: AuthContext) => {
  const helpText = `🏷️ <b>LabelMint Worker Help</b> 🏷️\n\n` +
    `🎯 Earn money by completing simple labeling tasks!\n\n` +
    `📋 <b>Available Commands:</b>\n\n` +
    `/start - Main menu and your stats overview\n` +
    `/earn - Open the workbench to start tasks\n` +
    `/balance - View your earnings and balance\n` +
    `/withdraw - Withdraw your earnings\n` +
    `/stats - View detailed performance stats\n` +
    `/help - Show this help message\n\n` +
    `💡 <b>How It Works:</b>\n\n` +
    `1. Tap /earn to open the workbench\n` +
    `2. Complete simple labeling tasks:\n` +
    `   - Classify images\n` +
    `   - Label text\n` +
    `   - Compare options\n` +
    `   - Draw bounding boxes\n` +
    `3. Get paid instantly for each task\n` +
    `4. Withdraw earnings to TON/USDT or bank\n\n` +
    `💰 <b>Earning Rates:</b>\n\n` +
    `• Image Classification: $0.025/task\n` +
    `• Text Classification: $0.022/task\n` +
    `• RLHF Comparison: $0.030/task\n` +
    `• Bounding Box: $0.050/object\n\n` +
    `🏆 <b>Trust Levels & Bonuses:</b>\n\n` +
    `🥉 Bronze (<75% accuracy): Base rate\n` +
    `🥈 Silver (75-89%): 1.0x multiplier\n` +
    `🥇 Gold (90-96%): 1.1x multiplier\n` +
    `🏆 Platinum (>96%): 1.2x multiplier\n\n` +
    `🔥 <b>Streak Bonuses:</b>\n\n` +
    `• 3+ days: +5% earnings\n` +
    `• 7+ days: +10% earnings\n` +
    `• 30+ days: +20% earnings\n\n` +
    `💳 <b>Withdrawals:</b>\n\n` +
    `• Telegram Wallet: Instant, $1-50, no fee\n` +
    `• External TON: ~60s, $5+, network fee\n` +
    `• Bank Transfer: Daily batch, $20+, $2 fee\n\n` +
    `⚠️ <b>Important Rules:</b>\n\n` +
    `• Always read instructions carefully\n` +
    `• Don't use AI assistants\n` +
    `• Maintain accuracy >75%\n` +
    `• One account per person\n` +
    `• No VPNs or proxies allowed\n\n` +
    `❓ <b>Need Help?</b>\n\n` +
    `Contact our support team:\n` +
    `📧 Email: support@labelmint.mindburn.org\n` +
    `💬 Telegram: @LabelMintSupport\n\n` +
    `🌐 Website: https://labelmint.mindburn.org\n\n` +
    `Happy labeling! 🎉`;

  await ctx.reply(helpText, {
    reply_markup: new InlineKeyboard()
      .text('💰 Start Earning', 'earn')
      .text('💳 Check Balance', 'balance')
      .row()
      .text('📊 My Stats', 'stats')
      .text('💬 Support', 'https://t.me/LabelMintSupport'),
    parse_mode: 'HTML',
  });
};