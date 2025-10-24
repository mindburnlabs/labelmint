import { Bot, Context } from 'grammy';
import { apiService } from '../services/apiService.js';
import { clientBotKeyboards } from '../keyboards/clientKeyboards.js';
import { format } from 'date-fns';
import { logger } from '../utils/logger.js';

export const enhancedClientCommands = {
  // Enhanced start command with deep linking support
  start: async (ctx: Context) => {
    const user = ctx.from;
    if (!user) return;

    // Extract deep link parameters
    const text = ctx.message?.text || '';
    const match = text.match(/\/start\s?(.+)?/);
    const deepLink = match?.[1];

    try {
      // Check if user exists, create if not
      let userData = await apiService.getUser(user.id);

      if (!userData) {
        userData = await apiService.createUser({
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          language_code: user.language_code
        });
      }

      // Handle deep linking
      if (deepLink) {
        if (deepLink.startsWith('project_')) {
          const projectId = deepLink.replace('project_', '');
          await handleProjectDeepLink(ctx, projectId);
          return;
        } else if (deepLink === 'payment') {
          await ctx.reply(
            '💳 *Payment Required*\n\n' +
            'You need to add funds to continue using the service.',
            {
              parse_mode: 'Markdown',
              reply_markup: clientBotKeyboards.depositOptions()
            }
          );
          return;
        }
      }

      // Send welcome message
      await ctx.reply(
        `🎉 *Welcome to LabelMint, ${user.first_name}!*\n\n` +
        `Your AI-powered data labeling platform with Telegram integration.\n\n` +
        `🚀 *What you can do:*\n` +
        `• 📊 Create and manage labeling projects\n` +
        `• 💳 Handle payments with TON/USDT\n` +
        `• 📈 Track real-time progress\n` +
        `• 👥 Manage your team\n` +
        `• 📊 View detailed analytics\n\n` +
        `Choose an option below to get started:`,
        {
          parse_mode: 'Markdown',
          reply_markup: clientBotKeyboards.mainMenu()
        }
      );

    } catch (error) {
      logger.error('Error in start command:', error);
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  },

  // Enhanced projects command with pagination
  projects: async (ctx: Context) => {
    const page = parseInt(ctx.match?.[1] || '0');
    const limit = 5;

    try {
      const response = await apiService.getProjects(page, limit);
      const projects = response.data || [];

      if (projects.length === 0 && page === 0) {
        await ctx.reply(
          '📊 *My Projects*\n\n' +
          "You don't have any projects yet.\n\n" +
          'Create your first project to get started!',
          {
            parse_mode: 'Markdown',
            reply_markup: clientBotKeyboards.projectsList(false, 0)
          }
        );
        return;
      }

      let message = `📊 *My Projects* (Page ${page + 1})\n\n`;

      for (const project of projects) {
        const progress = project.total_tasks > 0
          ? Math.round((project.completed_tasks / project.total_tasks) * 100)
          : 0;

        const statusEmoji = {
          pending: '⏳',
          in_progress: '🔄',
          completed: '✅',
          paused: '⏸️'
        }[project.status] || '📊';

        message += `${statusEmoji} *${project.name}*\n` +
                  `📝 ${project.completed_tasks}/${project.total_tasks} tasks (${progress}%)\n` +
                  `💰 $${project.total_spent || 0} spent\n` +
                  `📅 ${format(new Date(project.created_at), 'MMM dd')}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.projectsList(
          projects.length === limit,
          page
        )
      });

    } catch (error) {
      logger.error('Error fetching projects:', error);
      await ctx.reply('❌ Failed to load projects. Please try again.');
    }
  },

  // Enhanced create command with wizard
  create: async (ctx: Context) => {
    await ctx.reply(
      '🆕 *Create New Project*\n\n' +
      'What type of labeling project do you want to create?',
      {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.createProjectType()
      }
    );
  },

  // Analytics command
  analytics: async (ctx: Context) => {
    try {
      const analytics = await apiService.getAnalytics();

      let message = '📈 *Your Analytics Overview*\n\n';

      // Project stats
      message += `📊 *Projects*\n` +
                `• Total: ${analytics.total_projects}\n` +
                `• Active: ${analytics.active_projects}\n` +
                `• Completed: ${analytics.completed_projects}\n\n`;

      // Financial stats
      message += `💰 *Financials*\n` +
                `• Total spent: $${analytics.total_spent.toFixed(2)}\n` +
                `• This month: $${analytics.monthly_spend.toFixed(2)}\n` +
                `• Average cost/label: $${analytics.avg_cost_per_label.toFixed(4)}\n\n`;

      // Performance stats
      message += `⚡ *Performance*\n` +
                `• Avg. completion time: ${analytics.avg_completion_time}min\n` +
                `• Average accuracy: ${(analytics.avg_accuracy * 100).toFixed(1)}%\n` +
                `• Workers involved: ${analytics.total_workers}\n\n`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.analyticsMenu()
      });

    } catch (error) {
      logger.error('Error fetching analytics:', error);
      await ctx.reply('❌ Failed to load analytics. Please try again.');
    }
  },

  // Billing command
  billing: async (ctx: Context) => {
    try {
      const billing = await apiService.getBillingInfo();

      let message = `💳 *Billing & Payments*\n\n` +
                   `💰 *Current Balance*: $${billing.balance.toFixed(2)}\n` +
                   `💵 *Pending Payments*: $${billing.pending.toFixed(2)}\n` +
                   `💸 *Total Spent*: $${billing.total_spent.toFixed(2)}\n\n`;

      if (billing.usage && billing.usage.length > 0) {
        message += `📊 *Recent Activity*\n`;
        for (const usage of billing.usage.slice(0, 3)) {
          message += `• ${usage.description}: $${usage.amount.toFixed(2)}\n`;
        }
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.billingMenu()
      });

    } catch (error) {
      logger.error('Error fetching billing info:', error);
      await ctx.reply('❌ Failed to load billing information.');
    }
  },

  // Notifications command
  notifications: async (ctx: Context) => {
    try {
      const notifications = await apiService.getNotifications();

      if (notifications.length === 0) {
        await ctx.reply(
          '🔔 *Notifications*\n\n' +
          'No new notifications.\n\n' +
          'You\'ll receive updates about your projects, payments, and team activity here.',
          {
            parse_mode: 'Markdown',
            reply_markup: clientBotKeyboards.quickActions()
          }
        );
        return;
      }

      let message = `🔔 *Notifications* (${notifications.length} new)\n\n`;

      for (const notif of notifications.slice(0, 10)) {
        const emoji = {
          task_completed: '✅',
          project_updated: '📊',
          payment_received: '💰',
          worker_assigned: '👥',
          quality_alert: '⚠️'
        }[notif.type] || '📢';

        message += `${emoji} ${notif.title}\n` +
                  `${notif.message}\n` +
                  `📅 ${format(new Date(notif.created_at), 'MMM dd, HH:mm')}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.quickActions(notifications[0]?.project_id)
      });

    } catch (error) {
      logger.error('Error fetching notifications:', error);
      await ctx.reply('❌ Failed to load notifications.');
    }
  },

  // Team command
  team: async (ctx: Context) => {
    try {
      const team = await apiService.getTeamMembers();

      if (team.length === 0) {
        await ctx.reply(
          '👥 *Team Management*\n\n' +
          'You haven\'t invited any team members yet.\n\n' +
          'Build a team to collaborate on your labeling projects!',
          {
            parse_mode: 'Markdown',
            reply_markup: clientBotKeyboards.teamMenu()
          }
        );
        return;
      }

      let message = `👥 *Your Team* (${team.length} members)\n\n`;

      for (const member of team) {
        const roleEmoji = {
          owner: '👑',
          admin: '🔧',
          member: '👤'
        }[member.role] || '👤';

        const statusEmoji = member.is_active ? '🟢' : '🔴';

        message += `${roleEmoji} ${member.first_name} @${member.username} ${statusEmoji}\n` +
                  `📧 ${member.email}\n` +
                  `🔑 ${member.role} • Joined ${format(new Date(member.joined_at), 'MMM dd')}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.teamMenu()
      });

    } catch (error) {
      logger.error('Error fetching team:', error);
      await ctx.reply('❌ Failed to load team information.');
    }
  },

  // Settings command
  settings: async (ctx: Context) => {
    try {
      const settings = await apiService.getUserSettings();

      await ctx.reply(
        '⚙️ *Settings*\n\n' +
        `🌐 Language: ${settings.language || 'English'}\n` +
        `🔔 Notifications: ${settings.notifications_enabled ? 'Enabled' : 'Disabled'}\n` +
        `🌙 Dark Mode: ${settings.dark_mode ? 'On' : 'Off'}\n` +
        `📊 Email Reports: ${settings.email_reports ? 'Weekly' : 'Never'}\n\n` +
        'Choose what you\'d like to configure:',
        {
          parse_mode: 'Markdown',
          reply_markup: clientBotKeyboards.settingsMenu()
        }
      );

    } catch (error) {
      logger.error('Error fetching settings:', error);
      await ctx.reply('❌ Failed to load settings.');
    }
  },

  // Enhanced help command
  help: async (ctx: Context) => {
    const helpText = `❓ *Help & Support*\n\n` +
      `🚀 *Quick Start:*\n` +
      `• Use /create to start a new project\n` +
      `• Upload your data (images or text)\n` +
      `• Set your categories and requirements\n` +
      `• Watch as workers label your data\n\n` +
      `📋 *Available Commands:*\n` +
      `/start - Main menu\n` +
      `/projects - View all projects\n` +
      `/create - Create new project\n` +
      `/analytics - View statistics\n` +
      `/billing - Payment information\n` +
      `/team - Manage team members\n` +
      `/settings - Configure preferences\n` +
      `/help - Show this message\n\n` +
      `💡 *Pro Tips:*\n` +
      `• Use clear instructions for better results\n` +
      `• Start with a small batch to test quality\n` +
      `• Monitor accuracy in real-time\n` +
      `• Invite team members for collaboration\n\n` +
      `🆘 *Need More Help?*\n` +
      `📧 Email: support@labelmint.io\n` +
      `🌐 Web App: https://app.labelmint.io\n` +
      `📖 Docs: https://docs.labelmint.io`;

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      reply_markup: clientBotKeyboards.mainMenu()
    });
  }
};

// Helper function for deep linking
async function handleProjectDeepLink(ctx: Context, projectId: string) {
  try {
    const project = await apiService.getProject(projectId);

    if (!project) {
      await ctx.reply('❌ Project not found.');
      return;
    }

    const progress = project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : 0;

    await ctx.reply(
      `📊 *Project: ${project.name}*\n\n` +
      `Status: ${project.status}\n` +
      `Progress: ${project.completed_tasks}/${project.total_tasks} (${progress}%)\n` +
      `Budget: $${project.budget || 0}\n` +
      `Spent: $${project.total_spent || 0}\n\n` +
      `What would you like to do?`,
      {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.projectMenu(projectId)
      }
    );

  } catch (error) {
    logger.error('Error handling deep link:', error);
    await ctx.reply('❌ Failed to load project.');
  }
}