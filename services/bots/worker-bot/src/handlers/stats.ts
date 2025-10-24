import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';

export const statsCommand = async (ctx: AuthContext) => {
  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');

    // Get detailed stats
    const detailedStats = await apiService.getDetailedWorkerStats(ctx.user.id);
    const weeklyStats = await apiService.getWeeklyStats(ctx.user.id);
    const achievements = await apiService.getWorkerAchievements(ctx.user.id);

    const trustLevel = getTrustLevel(ctx.user.trustScore);
    const trustMultiplier = ctx.user.trustScore >= 0.96 ? 1.2 : ctx.user.trustScore >= 0.9 ? 1.1 : 1.0;
    const nextMilestone = getNextMilestone(ctx.user.completedTasks);

    let statsText = `📊 Your Performance Stats\n\n` +
      `🏆 Trust Level: ${trustLevel}\n` +
      `💎 Multiplier: ${trustMultiplier}x\n\n` +
      `📈 Overall Performance:\n` +
      `• Total Tasks: ${ctx.user.completedTasks}\n` +
      `• Accuracy: ${(ctx.user.accuracy * 100).toFixed(1)}%\n` +
      `• Total Earnings: $${ctx.user.earnings.toFixed(2)}\n` +
      `• Current Streak: ${ctx.user.streak} days\n\n`;

    if (weeklyStats) {
      statsText += `📅 This Week:\n` +
        `• Tasks: ${weeklyStats.tasksCompleted}\n` +
        `• Earnings: $${weeklyStats.earnings.toFixed(2)}\n` +
        `• Avg Time/Task: ${weeklyStats.avgTimePerTask}s\n\n`;
    }

    if (achievements && achievements.length > 0) {
      statsText += `🏅 Recent Achievements:\n`;
      achievements.slice(0, 3).forEach(ach => {
        statsText += `• ${ach.icon} ${ach.name}\n`;
      });
      statsText += '\n';
    }

    statsText += `🎯 Next Milestone: ${nextMilestone.tasks - ctx.user.completedTasks} tasks\n\n`;

    if (detailedStats.position) {
      statsText += `🌟 You're in the top ${detailedStats.position}% of workers!\n\n`;
    }

    statsText += `💡 Tips to improve:\n`;
    if (ctx.user.accuracy < 0.9) {
      statsText += `• Focus on accuracy to unlock Gold tier\n`;
    }
    if (ctx.user.streak < 7) {
      statsText += `• Build a 7-day streak for +5% bonus\n`;
    }
    if (detailedStats.avgTimePerTask > 30) {
      statsText += `• Complete tasks faster for better ratings\n`;
    }

    await ctx.reply(statsText, {
      reply_markup: new InlineKeyboard()
        .text('💰 Start Earning', 'earn')
        .text('💳 Withdraw', 'withdraw')
        .row()
        .text('📜 Full History', 'history')
        .text('🏆 Achievements', 'achievements'),
    });

  } catch (error) {
    logger.error('Failed to get stats:', error);
    await ctx.reply(
      '❌ Failed to load statistics.\n' +
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

function getNextMilestone(completedTasks: number): { tasks: number; reward: string } {
  if (completedTasks < 100) return { tasks: 100, reward: 'Bronze Badge' };
  if (completedTasks < 500) return { tasks: 500, reward: 'Silver Badge' };
  if (completedTasks < 1000) return { tasks: 1000, reward: 'Gold Badge' };
  if (completedTasks < 5000) return { tasks: 5000, reward: 'Platinum Badge' };
  return { tasks: 10000, reward: 'Diamond Badge' };
}