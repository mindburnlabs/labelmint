import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export const earnCommand = async (ctx: AuthContext) => {
  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  // Check if worker is verified
  if (!ctx.user.isVerified) {
    await ctx.reply(
      '⚠️ You need to complete at least 5 tasks to unlock the mini-app.\n\n' +
      'Keep working on tasks sent to you directly, or contact support if you think this is an error.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 My Stats', callback_data: 'stats' }],
            [{ text: '💬 Contact Support', 'https://t.me/LabelMintSupport' }],
          ],
        },
      },
    );
    return;
  }

  // Check worker's current task status
  try {
    const hasActiveTask = await checkActiveTask(ctx.user.id);

    if (hasActiveTask) {
      await ctx.reply(
        '⏳ You have an active task!\n\n' +
        'Complete or skip it before starting a new one.\n\n' +
        'Click below to continue:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📱 Continue Task', url: config.MINIAPP_URL },
                { text: '⏭️ Skip Task', callback_data: 'skip_task' },
              ],
            ],
          },
        },
      );
    } else {
      // Open mini-app
      await openMiniApp(ctx);
    }
  } catch (error) {
    logger.error('Failed to check task status:', error);
    // Still allow opening mini-app
    await openMiniApp(ctx);
  }
};

async function checkActiveTask(userId: string): Promise<boolean> {
  try {
    // In real implementation, check if user has reserved task
    const response = await fetch(`${config.LABELING_API_URL}/api/tasks/active/${userId}`);
    const data = await response.json();
    return data.hasActiveTask || false;
  } catch {
    return false;
  }
}

async function openMiniApp(ctx: AuthContext) {
  // Create mini-app URL with user data
  const miniAppUrl = `${config.MINIAPP_URL}?userId=${ctx.user!.id}&telegramId=${ctx.user!.telegramId}`;

  const earningsToday = ctx.user?.earnings || 0;
  const accuracy = (ctx.user?.accuracy || 0) * 100;
  const trustMultiplier = ctx.user?.trustScore ? (ctx.user.trustScore >= 0.96 ? 1.2 : ctx.user.trustScore >= 0.9 ? 1.1 : 1.0) : 1.0;

  await ctx.reply(
    `🚀 Opening LabelMint Workbench...\n\n` +
    `📊 Your Stats:\n` +
    `• Accuracy: ${accuracy.toFixed(1)}%\n` +
    `• Trust Level: ${getTrustLevel(ctx.user?.trustScore || 0.8)}\n` +
    `• Multiplier: ${trustMultiplier}x\n` +
    `• Today's Earnings: $${earningsToday.toFixed(2)}\n\n` +
    `💡 Tips:\n` +
    `• Complete tasks quickly for bonuses\n` +
    `• Maintain high accuracy for better rates\n` +
    `• Build streaks for extra rewards\n\n` +
    `Tap the button below to start:`,
    {
      reply_markup: new InlineKeyboard()
        .webApp('📱 Open Workbench', miniAppUrl)
        .row()
        .text('📊 My Stats', 'stats')
        .text('❓ Help', 'help'),
    },
  );

  logger.info(`Worker ${ctx.user!.id} opened mini-app`);
}

function getTrustLevel(trustScore: number): string {
  if (trustScore >= 0.96) return '🏆 Platinum';
  if (trustScore >= 0.9) return '🥇 Gold';
  if (trustScore >= 0.75) return '🥈 Silver';
  return '🥉 Bronze';
}