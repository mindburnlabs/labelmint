import { Bot, Context } from 'grammy';
import { apiService } from '../services/apiService.js';
import { clientBotKeyboards } from '../keyboards/clientKeyboards.js';
import { format } from 'date-fns';
import { logger } from '../utils/logger.js';

export const enhancedCallbackHandler = {
  // Main menu navigation
  main_menu: async (ctx: Context) => {
    await ctx.editMessageText(
      '🏠 *Main Menu*\n\n' +
      'Welcome to LabelMint! Choose an option below:',
      {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.mainMenu()
      }
    );
  },

  // Projects callbacks
  view_projects: async (ctx: Context) => {
    const page = 0;
    const limit = 5;

    try {
      const response = await apiService.getProjects(page, limit);
      const projects = response.data || [];

      if (projects.length === 0) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.projectsList(
          projects.length === limit,
          page
        )
      });

    } catch (error) {
      logger.error('Error in view_projects callback:', error);
      await ctx.answerCallbackQuery('Failed to load projects');
    }
  },

  // Project status
  project_status: async (ctx: Context) => {
    const projectId = ctx.callbackQuery?.data?.split('_')[2];

    if (!projectId) {
      await ctx.answerCallbackQuery('Project not found');
      return;
    }

    try {
      const project = await apiService.getProject(projectId);

      if (!project) {
        await ctx.answerCallbackQuery('Project not found');
        return;
      }

      const progress = project.total_tasks > 0
        ? Math.round((project.completed_tasks / project.total_tasks) * 100)
        : 0;

      let message = `📊 *${project.name}*\n\n` +
                   `📈 Status: ${project.status}\n` +
                   `📝 Progress: ${project.completed_tasks}/${project.total_tasks} (${progress}%)\n` +
                   `⏱️ Avg. time per task: ${project.avg_time_per_task || 0}s\n` +
                   `🎯 Accuracy: ${((project.accuracy || 0) * 100).toFixed(1)}%\n\n` +
                   `💰 *Financials*\n` +
                   `💸 Spent: $${project.total_spent || 0}\n` +
                   `💵 Budget: $${project.budget || 'Not set'}\n` +
                   `💳 Cost/label: $${project.cost_per_label || 0}\n\n` +
                   `👥 *Workers*\n` +
                   `🤖 Active: ${project.active_workers || 0}\n` +
                   `📊 Total: ${project.total_workers || 0}`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.projectMenu(projectId)
      });

    } catch (error) {
      logger.error('Error fetching project status:', error);
      await ctx.answerCallbackQuery('Failed to load project status');
    }
  },

  // Create project
  create_project: async (ctx: Context) => {
    await ctx.editMessageText(
      '🆕 *Create New Project*\n\n' +
      'What type of labeling project do you want to create?',
      {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.createProjectType()
      }
    );
  },

  // Project type selection
  type_image: async (ctx: Context) => {
    // Store project type in session
    ctx.session.projectType = 'image';
    await ctx.editMessageText(
      '🖼️ *Image Labeling Project*\n\n' +
      'Great choice! Image labeling is perfect for:\n' +
      '• Object detection\n' +
      '• Image classification\n' +
      '• Segmentation masks\n' +
      '• Landmark annotation\n\n' +
      'Please enter your project name:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel_create' }
        ]] }
      }
    );
  },

  type_text: async (ctx: Context) => {
    // Store project type in session
    ctx.session.projectType = 'text';
    await ctx.editMessageText(
      '📝 *Text Classification Project*\n\n' +
      'Great choice! Text classification is perfect for:\n' +
      '• Sentiment analysis\n' +
      '• Content moderation\n' +
      '• Topic classification\n' +
      '• Entity recognition\n\n' +
      'Please enter your project name:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel_create' }
        ]] }
      }
    );
  },

  // Billing callbacks
  view_billing: async (ctx: Context) => {
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.billingMenu()
      });

    } catch (error) {
      logger.error('Error fetching billing info:', error);
      await ctx.answerCallbackQuery('Failed to load billing info');
    }
  },

  deposit_funds: async (ctx: Context) => {
    await ctx.editMessageText(
      '💳 *Deposit Funds*\n\n' +
      'Choose your preferred payment method:',
      {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.depositOptions()
      }
    );
  },

  // Analytics callbacks
  view_analytics: async (ctx: Context) => {
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.analyticsMenu()
      });

    } catch (error) {
      logger.error('Error fetching analytics:', error);
      await ctx.answerCallbackQuery('Failed to load analytics');
    }
  },

  // Team callbacks
  view_team: async (ctx: Context) => {
    try {
      const team = await apiService.getTeamMembers();

      if (team.length === 0) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.teamMenu()
      });

    } catch (error) {
      logger.error('Error fetching team:', error);
      await ctx.answerCallbackQuery('Failed to load team');
    }
  },

  // Settings callbacks
  view_settings: async (ctx: Context) => {
    try {
      const settings = await apiService.getUserSettings();

      await ctx.editMessageText(
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
      await ctx.answerCallbackQuery('Failed to load settings');
    }
  },

  // Notifications callbacks
  view_notifications: async (ctx: Context) => {
    try {
      const notifications = await apiService.getNotifications();

      if (notifications.length === 0) {
        await ctx.editMessageText(
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.quickActions(notifications[0]?.project_id)
      });

    } catch (error) {
      logger.error('Error fetching notifications:', error);
      await ctx.answerCallbackQuery('Failed to load notifications');
    }
  },

  // Help callback
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

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: clientBotKeyboards.mainMenu()
    });
  },

  // Pagination callbacks
  projects_page: async (ctx: Context) => {
    const page = parseInt(ctx.callbackQuery?.data?.split('_')[2] || '0');
    const limit = 5;

    try {
      const response = await apiService.getProjects(page, limit);
      const projects = response.data || [];

      if (projects.length === 0) {
        await ctx.answerCallbackQuery('No more projects');
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

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: clientBotKeyboards.projectsList(
          projects.length === limit,
          page
        )
      });

    } catch (error) {
      logger.error('Error in pagination:', error);
      await ctx.answerCallbackQuery('Failed to load page');
    }
  }
};

// Generic callback handler
export async function handleEnhancedCallback(ctx: Context) {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData) {
    await ctx.answerCallbackQuery('Invalid callback');
    return;
  }

  // Parse callback data
  const [action, ...params] = callbackData.split('_');

  // Find the appropriate handler
  const handlerKey = callbackData.replace(/_(\d+)$/, ''); // Remove numeric IDs
  const handler = enhancedCallbackHandler[handlerKey as keyof typeof enhancedCallbackHandler];

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