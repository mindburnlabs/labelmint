import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';

export const projectsCommand = async (ctx: AuthContext) => {
  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');

    const projects = await apiService.getUserProjects(ctx.user.id);

    if (projects.length === 0) {
      await ctx.reply(
        '📋 You don\'t have any projects yet.\n\n' +
        'Create your first project with /newproject',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🆕 Create Project', callback_data: 'new_project' }],
            ],
          },
        },
      );
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const project of projects) {
      const statusEmoji = {
        DRAFT: '📝',
        RUNNING: '🔄',
        PAUSED: '⏸️',
        DONE: '✅',
        CANCELLED: '❌',
      }[project.status] || '❓';

      const progress = project.totalTasks > 0
        ? Math.round((project.completedTasks / project.totalTasks) * 100)
        : 0;

      keyboard
        .text(`${statusEmoji} ${project.title} (${progress}%)`, `project_${project.id}`)
        .row();
    }

    await ctx.reply(
      `📋 Your Projects (${projects.length})\n\n` +
      'Select a project to view details:',
      { reply_markup: keyboard },
    );

  } catch (error) {
    logger.error('Failed to fetch projects:', error);
    await ctx.reply(
      '❌ Failed to load projects.\n' +
      'Please try again later.',
    );
  }
};