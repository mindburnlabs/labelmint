import { Bot, Context } from 'grammy';
import { workerApiService } from '../services/workerApiService.js';
import { workerBotKeyboards } from '../keyboards/workerKeyboards.js';
import { format } from 'date-fns';
import { logger } from '../utils/logger.js';

export const workerCommands = {
  // Enhanced start command with onboarding
  start: async (ctx: Context) => {
    const user = ctx.from;
    if (!user) return;

    try {
      // Check if worker exists
      let worker = await workerApiService.getWorker(user.id);

      if (!worker) {
        // Start onboarding flow
        await ctx.reply(
          `👋 Welcome to LabelMint Workers, ${user.first_name}!\n\n` +
          `*Earn money by completing simple labeling tasks!*\n\n` +
          `🎯 What you'll be doing:\n` +
          `• Labeling images and text\n` +
          `• Helping AI models learn\n` +
          `• Getting paid for your work\n\n` +
          `Let's get you set up!`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Start Onboarding', callback_data: 'start_onboarding' }
              ]]
            }
          }
        );
        return;
      }

      // Check verification status
      if (!worker.is_verified) {
        await ctx.reply(
          `👋 Welcome back, ${user.first_name}!\n\n` +
          `Your account is pending verification.\n\n` +
          `Please complete the verification process to start earning.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Complete Verification', callback_data: 'complete_verification' }
              ]]
            }
          }
        );
        return;
      }

      // Update session
      ctx.session.workerId = worker.id;
      ctx.session.isVerified = worker.is_verified;

      // Show main menu
      await ctx.reply(
        `👋 Welcome back, ${worker.first_name}! 👷\n\n` +
        `🔥 *Daily Streak: ${ctx.session.streak || 1} days*\n` +
        `⭐ Level ${ctx.session.level || 1}\n` +
        `💰 Current Balance: $${worker.balance.toFixed(4)}\n\n` +
        `Ready to earn some money?`,
        {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.mainMenu()
        }
      );

    } catch (error) {
      logger.error('Error in start command:', error);
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  },

  // Tasks command
  tasks: async (ctx: Context) => {
    const page = parseInt(ctx.match?.[1] || '0');
    const limit = 10;
    const filters = ctx.session.filters || {};

    try {
      const response = await workerApiService.getAvailableTasks(page, limit, filters);
      const tasks = response.data || [];

      if (tasks.length === 0 && page === 0) {
        await ctx.reply(
          '📋 *Available Tasks*\n\n' +
          'No tasks available at the moment.\n\n' +
          '💡 *Tip: Check back later or enable notifications to be alerted when new tasks are available!',
          {
            parse_mode: 'Markdown',
            reply_markup: workerBotKeyboards.quickActions(false, false)
          }
        );
        return;
      }

      let message = `📋 *Available Tasks* (Page ${page + 1})\n\n`;

      for (const task of tasks) {
        const urgencyBadge = task.is_urgent ? '🔥 ' : '';
        const paymentBadge = task.high_payment ? '💰 ' : '';
        const timeEstimate = task.estimated_time ? ` (${task.estimated_time}min)` : '';

        message += `${urgencyBadge}${paymentBadge}*${task.title}*\n` +
                  `📝 ${task.description.substring(0, 60)}...\n` +
                  `💰 $${task.payment.toFixed(4)}${timeEstimate}\n` +
                  `🏷️ ${task.categories.join(', ')}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.tasksMenu(
          response.categories || [],
          filters.category
        )
      });

    } catch (error) {
      logger.error('Error fetching tasks:', error);
      await ctx.reply('❌ Failed to load tasks. Please try again.');
    }
  },

  // Earnings command
  earnings: async (ctx: Context) => {
    try {
      const earnings = await workerApiService.getWorkerEarnings();
      const balance = await workerApiService.getWorkerBalance();

      let message = `💰 *My Earnings*\n\n` +
                   `💳 *Current Balance*: $${balance.toFixed(4)}\n` +
                   `💵 *Total Earned*: $${earnings.total_earned.toFixed(2)}\n\n`;

      // Today's earnings
      const today = new Date().toISOString().split('T')[0];
      const todayEarnings = earnings.daily[today] || 0;
      message += `📅 *Today's Earnings*: $${todayEarnings.toFixed(4)}\n`;

      // This week
      const weekEarnings = Object.values(earnings.daily)
        .slice(-7)
        .reduce((sum: number, val: any) => sum + val, 0);
      message += `📈 *This Week*: $${weekEarnings.toFixed(2)}\n`;

      // This month
      const monthEarnings = Object.values(earnings.daily)
        .slice(-30)
        .reduce((sum: number, val: any) => sum + val, 0);
      message += `📅 *This Month*: $${monthEarnings.toFixed(2)}\n\n`;

      // Pending withdrawals
      if (earnings.pending_withdrawals > 0) {
        message += `⏳ *Pending Withdrawals*: $${earnings.pending_withdrawals.toFixed(4)}\n\n`;
      }

      message += `🎯 *Stats*\n` +
                `📝 Tasks Completed: ${ctx.session.stats.total_completed}\n` +
                `⭐ XP Points: ${ctx.session.xp}\n` +
                `🏆 Level: ${ctx.session.level}\n` +
                `🔥 Streak: ${ctx.session.streak} days`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.earningsMenu()
      });

    } catch (error) {
      logger.error('Error fetching earnings:', error);
      await ctx.reply('❌ Failed to load earnings information.');
    }
  },

  // Profile command
  profile: async (ctx: Context) => {
    try {
      const profile = await workerApiService.getWorkerProfile();
      const stats = await workerApiService.getWorkerStats();

      let message = `👤 *My Profile*\n\n` +
                   `👑 *${profile.first_name} ${profile.last_name || ''}*\n` +
                   `📧 ${profile.email || 'Not set'}\n` +
                   `🏅 ${profile.rank || 'Bronze Worker'}\n\n` +
                   `📊 *Performance Stats*\n` +
                   `⭐ Level ${ctx.session.level}\n` +
                   `🎯 XP: ${ctx.session.xp}/${ctx.session.level * 100}\n` +
                   `🔥 Streak: ${ctx.session.streak} days\n\n` +
                   `📈 *Work History*\n` +
                   `📝 Tasks Completed: ${stats.total_completed}\n` +
                   `🎯 Average Accuracy: ${(stats.avg_accuracy * 100).toFixed(1)}%\n` +
                   `⏱️ Avg. Time/Task: ${stats.avg_time_per_task}s\n` +
                   `💰 Total Earned: $${stats.total_earned.toFixed(2)}\n\n` +
                   `⭐ *Rating*: ${'⭐'.repeat(Math.floor(profile.rating || 0))} (${profile.rating?.toFixed(1) || '0.0'})`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.profileMenu()
      });

    } catch (error) {
      logger.error('Error fetching profile:', error);
      await ctx.reply('❌ Failed to load profile.');
    }
  },

  // Leaderboard command
  leaderboard: async (ctx: Context) => {
    const type = ctx.match?.[1] || 'earners';

    try {
      const leaderboard = await workerApiService.getLeaderboard(type, 20);

      let message = `🏆 *Leaderboard - ${type === 'earners' ? 'Top Earners' : type === 'speed' ? 'Fastest Workers' : 'Top Quality'}*\n\n`;

      // Find user's rank
      const userRank = leaderboard.findIndex(w => w.telegram_id === ctx.from?.id);
      const userEntry = userRank >= 0 ? leaderboard[userRank] : null;

      // Show top 10
      for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
        const worker = leaderboard[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
        const isUser = worker.telegram_id === ctx.from?.id;
        const value = type === 'earners'
          ? `$${worker.total_earned.toFixed(2)}`
          : type === 'speed'
          ? `${worker.avg_time}s`
          : `${(worker.accuracy * 100).toFixed(1)}%`;

        message += `${medal} ${i + 1}. ${isUser ? '**' : ''}${worker.first_name}${isUser ? '**' : ''} - ${value}\n`;
      }

      // Show user's position if not in top 10
      if (userEntry && userRank >= 10) {
        const value = type === 'earners'
          ? `$${userEntry.total_earned.toFixed(2)}`
          : type === 'speed'
          ? `${userEntry.avg_time}s`
          : `${(userEntry.accuracy * 100).toFixed(1)}%`;

        message += `\n📍 *Your Rank*: #${userRank + 1} - ${value}`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.leaderboardFilters()
      });

    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      await ctx.reply('❌ Failed to load leaderboard.');
    }
  },

  // Achievements command
  achievements: async (ctx: Context) => {
    try {
      const achievements = await workerApiService.getWorkerAchievements();

      if (achievements.length === 0) {
        await ctx.reply(
          '🏆 *Achievements*\n\n' +
          'Complete tasks to unlock achievements and earn rewards!\n\n' +
          '🎯 *First Achievements to Unlock:*\n' +
          '• 🌟 First Task - Complete your first task\n' +
          '• 🔥 Week Streak - Work 7 days in a row\n' +
          '• 💰 First Dollar - Earn your first dollar',
          {
            parse_mode: 'Markdown',
            reply_markup: workerBotKeyboards.quickActions(true, false)
          }
        );
        return;
      }

      let message = `🏆 *Your Achievements* (${achievements.length})\n\n`;

      for (const achievement of achievements) {
        const unlocked = achievement.is_unlocked ? '✅' : '🔒';
        const progress = achievement.progress ? ` (${achievement.progress}%)` : '';
        message += `${unlocked} *${achievement.icon} ${achievement.title}*${progress}\n` +
                  `${achievement.description}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🎯 View All Achievements', callback_data: 'view_all_achievements' },
            { text: '📊 Progress Stats', callback_data: 'achievement_progress' }
          ]]
        }
      });

    } catch (error) {
      logger.error('Error fetching achievements:', error);
      await ctx.reply('❌ Failed to load achievements.');
    }
  },

  // Training command
  training: async (ctx: Context) => {
    await ctx.reply(
      '🎓 *Training Center*\n\n' +
      'Improve your skills and earn more!\n\n' +
      '📚 *Available Modules:*\n' +
      '• 🚀 Getting Started - Learn the basics\n' +
      '• 🏷️ Image Labeling - Master image annotation\n' +
      '• 📝 Text Classification - Text labeling skills\n' +
      '• 💰 Payment Guide - Understand earnings\n' +
      '• ⭐ Quality Guide - Improve accuracy\n\n' +
      '🎁 *Complete training to earn bonus XP!*',
      {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.trainingModules()
      }
    );
  },

  // Withdraw command
  withdraw: async (ctx: Context) => {
    try {
      const balance = await workerApiService.getWorkerBalance();
      const minimum = 5.00; // Minimum withdrawal amount

      if (balance < minimum) {
        await ctx.reply(
          `💳 *Withdraw Funds*\n\n` +
          `❌ *Insufficient Balance*\n\n` +
          `Your balance: $${balance.toFixed(4)}\n` +
          `Minimum withdrawal: $${minimum.toFixed(2)}\n\n` +
          `💡 Keep working to reach the minimum withdrawal amount!`,
          {
            parse_mode: 'Markdown',
            reply_markup: workerBotKeyboards.quickActions(true, false)
          }
        );
        return;
      }

      await ctx.reply(
        `💳 *Withdraw Funds*\n\n` +
        `💰 *Available Balance*: $${balance.toFixed(4)}\n\n` +
        'Choose withdrawal method:',
        {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.withdrawOptions()
        }
      );

    } catch (error) {
      logger.error('Error checking balance for withdrawal:', error);
      await ctx.reply('❌ Failed to check balance. Please try again.');
    }
  },

  // Help command
  help: async (ctx: Context) => {
    const helpText = `❓ *Help & Support*\n\n` +
      `🚀 *How to Start:*\n` +
      `1. Complete onboarding and verification\n` +
      `2. Browse available tasks\n` +
      `3. Accept and complete tasks\n` +
      `4. Earn money and withdraw!\n\n` +
      `📋 *Available Commands:*\n` +
      `/start - Main menu and onboarding\n` +
      `/tasks - View available tasks\n` +
      `/earnings - Check your earnings\n` +
      `/withdraw - Withdraw funds\n` +
      `/profile - View your profile\n` +
      `/leaderboard - Top performers\n` +
      `/achievements - Your achievements\n` +
      `/training - Training modules\n` +
      `/help - Show this message\n\n` +
      `💡 *Tips for Success:*\n` +
      `• Maintain high accuracy for better ratings\n` +
      `• Complete tasks quickly for time bonuses\n` +
      `• Build a daily streak for rewards\n` +
      `• Focus on quality over quantity\n` +
      `• Learn from training modules\n\n` +
      `🆘 *Need Help?*\n` +
      `📧 Email: support@labelmint.io\n` +
      `💬 Chat: @LabelMintSupport\n` +
      `📖 FAQ: https://docs.labelmint.io/workers`;

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      reply_markup: workerBotKeyboards.mainMenu()
    });
  }
};