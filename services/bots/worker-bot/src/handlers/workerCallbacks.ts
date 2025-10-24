import { Bot, Context } from 'grammy';
import { workerApiService } from '../services/workerApiService.js';
import { workerBotKeyboards } from '../keyboards/workerKeyboards.js';
import { format } from 'date-fns';
import { logger } from '../utils/logger.js';

export const workerCallbackHandlers = {
  // Main menu
  main_menu: async (ctx: Context) => {
    const session = ctx.session;
    const worker = await workerApiService.getWorker(ctx.from!.id);

    await ctx.editMessageText(
      `🏠 *Main Menu*\n\n` +
      `👋 Welcome back, ${worker?.first_name || 'Worker'}!\n` +
      `🔥 Streak: ${session.streak || 1} days\n` +
      `⭐ Level ${session.level || 1}\n` +
      `💰 Balance: $${worker?.balance.toFixed(4) || '0.0000'}\n\n` +
      `What would you like to do?`,
      {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.mainMenu()
      }
    );
  },

  // Available tasks
  available_tasks: async (ctx: Context) => {
    const page = 0;
    const limit = 10;
    const filters = ctx.session.filters || {};

    try {
      const response = await workerApiService.getAvailableTasks(page, limit, filters);
      const tasks = response.data || [];

      if (tasks.length === 0) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.tasksMenu(
          response.categories || [],
          filters.category
        )
      });

    } catch (error) {
      logger.error('Error in available_tasks callback:', error);
      await ctx.answerCallbackQuery('Failed to load tasks');
    }
  },

  // Task details
  task_details: async (ctx: Context) => {
    const taskId = ctx.callbackQuery?.data?.split('_')[2];

    if (!taskId) {
      await ctx.answerCallbackQuery('Task not found');
      return;
    }

    try {
      const task = await workerApiService.getTaskDetails(taskId);

      if (!task) {
        await ctx.answerCallbackQuery('Task not found');
        return;
      }

      let message = `📋 *${task.title}*\n\n` +
                   `📝 *Description*\n${task.description}\n\n` +
                   `💰 *Payment*: $${task.payment.toFixed(4)}\n` +
                   `⏱️ *Time Limit*: ${task.time_limit || 'No limit'}\n` +
                   `📊 *Difficulty*: ${'⭐'.repeat(task.difficulty || 1)}\n\n` +
                   `🏷️ *Categories*: ${task.categories.join(', ')}\n\n` +
                   `📌 *Instructions*\n${task.instructions || 'No specific instructions'}`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.taskDetails(taskId, false)
      });

    } catch (error) {
      logger.error('Error fetching task details:', error);
      await ctx.answerCallbackQuery('Failed to load task');
    }
  },

  // Accept task
  accept_task: async (ctx: Context) => {
    const taskId = ctx.callbackQuery?.data?.split('_')[2];

    if (!taskId) {
      await ctx.answerCallbackQuery('Task not found');
      return;
    }

    try {
      const result = await workerApiService.acceptTask(taskId, ctx.from!.id);

      if (result.success) {
        const task = result.task;

        // Update session
        ctx.session.currentTask = task;

        let message = `✅ *Task Accepted!*\n\n` +
                     `📋 *${task.title}*\n\n` +
                     `💰 You'll earn: $${task.payment.toFixed(4)}\n` +
                     `⏱️ Time limit: ${task.time_limit || 'No limit'}\n\n` +
                     `📌 *Instructions*\n${task.instructions || 'Start working on the task!'}`;

        // If task has data to process
        if (task.data) {
          message += `\n\n📝 *Task Data*\n${task.data}`;
          message += `\n\n💬 *Enter your response below:*\n`;
          ctx.session.awaitingInput = true;
        } else {
          message += `\n\n🚀 Click 'Start Task' to begin!`;
        }

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.taskInterface(taskId)
        });

        // Start timer
        ctx.session.taskStartTime = Date.now();

      } else {
        await ctx.answerCallbackQuery(result.error || 'Failed to accept task');
      }

    } catch (error) {
      logger.error('Error accepting task:', error);
      await ctx.answerCallbackQuery('Failed to accept task');
    }
  },

  // Start task
  start_task: async (ctx: Context) => {
    const taskId = ctx.callbackQuery?.data?.split('_')[2];

    if (!taskId) {
      await ctx.answerCallbackQuery('Task not found');
      return;
    }

    try {
      const task = await workerApiService.startTask(taskId, ctx.from!.id);

      if (task) {
        let message = `🚀 *Task Started!*\n\n` +
                     `📋 *${task.title}*\n\n` +
                     `📝 *Task Data*\n${task.data}\n\n` +
                     `💬 *Enter your response below:*`;

        ctx.session.awaitingInput = true;
        ctx.session.taskStartTime = Date.now();

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.taskInterface(taskId)
        });

      } else {
        await ctx.answerCallbackQuery('Failed to start task');
      }

    } catch (error) {
      logger.error('Error starting task:', error);
      await ctx.answerCallbackQuery('Failed to start task');
    }
  },

  // Submit task
  submit_task: async (ctx: Context) => {
    const taskId = ctx.callbackQuery?.data?.split('_')[2];

    if (!taskId) {
      await ctx.answerCallbackQuery('Task not found');
      return;
    }

    if (!ctx.session.awaitingInput) {
      await ctx.answerCallbackQuery('Please enter your response first');
      return;
    }

    await ctx.answerCallbackQuery('Please submit your response as a text message');
  },

  // My earnings
  my_earnings: async (ctx: Context) => {
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.earningsMenu()
      });

    } catch (error) {
      logger.error('Error fetching earnings:', error);
      await ctx.answerCallbackQuery('Failed to load earnings');
    }
  },

  // Withdraw
  withdraw: async (ctx: Context) => {
    try {
      const balance = await workerApiService.getWorkerBalance();
      const minimum = 5.00;

      if (balance < minimum) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(
        `💳 *Withdraw Funds*\n\n` +
        `💰 *Available Balance*: $${balance.toFixed(4)}\n\n` +
        'Choose withdrawal method:',
        {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.withdrawOptions()
        }
      );

    } catch (error) {
      logger.error('Error in withdraw callback:', error);
      await ctx.answerCallbackQuery('Failed to load withdrawal options');
    }
  },

  // Withdraw all
  withdraw_all: async (ctx: Context) => {
    try {
      const balance = await workerApiService.getWorkerBalance();

      if (balance < 5) {
        await ctx.answerCallbackQuery('Insufficient balance');
        return;
      }

      await ctx.editMessageText(
        `💸 *Confirm Withdrawal*\n\n` +
        `Amount: $${balance.toFixed(4)}\n` +
        `Method: USDT (TON)\n` +
        `Fee: $0.50\n` +
        `You'll receive: $${(balance - 0.50).toFixed(4)}\n\n` +
        `Are you sure?`,
        {
          parse_mode: 'Markdown',
          reply_markup: workerBotKeyboards.confirmAction('withdraw_all')
        }
      );

    } catch (error) {
      logger.error('Error preparing withdrawal:', error);
      await ctx.answerCallbackQuery('Failed to prepare withdrawal');
    }
  },

  // My profile
  my_profile: async (ctx: Context) => {
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.profileMenu()
      });

    } catch (error) {
      logger.error('Error fetching profile:', error);
      await ctx.answerCallbackQuery('Failed to load profile');
    }
  },

  // Leaderboard
  leaderboard: async (ctx: Context) => {
    try {
      const leaderboard = await workerApiService.getLeaderboard('earners', 20);

      let message = `🏆 *Leaderboard - Top Earners*\n\n`;

      const userRank = leaderboard.findIndex(w => w.telegram_id === ctx.from?.id);
      const userEntry = userRank >= 0 ? leaderboard[userRank] : null;

      for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
        const worker = leaderboard[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
        const isUser = worker.telegram_id === ctx.from?.id;

        message += `${medal} ${i + 1}. ${isUser ? '**' : ''}${worker.first_name}${isUser ? '**' : ''} - $${worker.total_earned.toFixed(2)}\n`;
      }

      if (userEntry && userRank >= 10) {
        message += `\n📍 *Your Rank*: #${userRank + 1} - $${userEntry.total_earned.toFixed(2)}`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: workerBotKeyboards.leaderboardFilters()
      });

    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      await ctx.answerCallbackQuery('Failed to load leaderboard');
    }
  },

  // Achievements
  achievements: async (ctx: Context) => {
    try {
      const achievements = await workerApiService.getWorkerAchievements();

      if (achievements.length === 0) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(message, {
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
      await ctx.answerCallbackQuery('Failed to load achievements');
    }
  },

  // Training
  training: async (ctx: Context) => {
    await ctx.editMessageText(
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

  // Help
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

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: workerBotKeyboards.mainMenu()
    });
  }
};

// Generic callback handler
export async function handleWorkerCallback(ctx: Context) {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData) {
    await ctx.answerCallbackQuery('Invalid callback');
    return;
  }

  // Parse callback data
  const [action, ...params] = callbackData.split('_');

  // Find the appropriate handler
  const handlerKey = callbackData.replace(/_(\d+)$/, ''); // Remove numeric IDs
  const handler = workerCallbackHandlers[handlerKey as keyof typeof workerCallbackHandlers];

  if (handler) {
    try {
      await handler(ctx);
    } catch (error) {
      logger.error(`Error in callback handler ${handlerKey}:`, error);
      await ctx.answerCallbackQuery('An error occurred');
    }
  } else {
    logger.warn(`No handler found for callback: ${callbackData}`);
    await ctx.answerCallbackQuery('Action not recognized');
  }
}