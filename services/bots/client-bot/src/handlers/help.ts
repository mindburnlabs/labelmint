import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';

export const helpCommand = async (ctx: AuthContext) => {
  const helpText = `🏷️ <b>LabelMint Help</b> 🏷️\n\n` +
    `🎯 Your Telegram Data Labeling Platform\n\n` +
    `📋 <b>Available Commands:</b>\n\n` +
    `/start - Main menu and project overview\n` +
    `/newproject - Create a new labeling project\n` +
    `/projects - View all your projects\n` +
    `/status <id> - Check project status\n` +
    `/results <id> - Download project results\n` +
    `/balance - View account balance\n` +
    `/deposit - Add funds to your account\n` +
    `/help - Show this help message\n\n` +
    `💡 <b>Quick Tips:</b>\n\n` +
    `• Create projects with /newproject\n` +
    `• Upload datasets via file, URL, or CSV\n` +
    `• Choose from multiple task types:\n` +
    `  - Image Classification\n` +
    `  - Text Classification\n` +
    `  - RLHF Comparisons\n` +
    `  - Bounding Box Annotation\n` +
    `• Track progress in real-time\n` +
    `• Download results in CSV/JSON format\n\n` +
    `💳 <b>Payment:</b>\n\n` +
    `• Accept payments via Stripe\n` +
    `• Pay-as-you-go pricing\n` +
    `• No subscription required\n` +
    `• Volume discounts available\n\n` +
    `❓ <b>Need Help?</b>\n\n` +
    `Contact our support team:\n` +
    `📧 Email: support@labelmint.mindburn.org\n` +
    `💬 Telegram: @LabelMintSupport\n\n` +
    `🌐 Website: https://labelmint.mindburn.org`;

  await ctx.reply(helpText, {
    reply_markup: new InlineKeyboard()
      .text('🆕 Create Project', 'new_project')
      .text('📋 My Projects', 'my_projects')
      .row()
      .text('💳 Add Funds', 'add_funds')
      .text('📊 My Balance', 'my_balance')
      .row()
      .text('🌐 Website', 'https://labelmint.mindburn.org')
      .text('💬 Support', 'https://t.me/LabelMintSupport'),
    parse_mode: 'HTML',
  });
};