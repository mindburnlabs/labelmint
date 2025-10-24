import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';

export const statusCommand = async (ctx: AuthContext) => {
  const projectId = ctx.match;

  if (!projectId) {
    await ctx.reply(
      '❌ Please provide a project ID.\n\n' +
      'Usage: /status <project_id>\n' +
      'Example: /status 123e4567-e89b-12d3-a456-426614174000\n\n' +
      'Or use /projects to see all your projects.',
    );
    return;
  }

  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');

    const project = await apiService.getProject(projectId);

    // Verify project ownership
    // In real implementation, check if project.clientId === ctx.user.id

    const statusEmoji = {
      DRAFT: '📝',
      RUNNING: '🔄',
      PAUSED: '⏸️',
      DONE: '✅',
      CANCELLED: '❌',
    }[project.status] || '❓';

    const statusText = {
      DRAFT: 'Draft',
      RUNNING: 'Running',
      PAUSED: 'Paused',
      DONE: 'Completed',
      CANCELLED: 'Cancelled',
    }[project.status] || 'Unknown';

    const progress = project.totalTasks > 0
      ? Math.round((project.completedTasks / project.totalTasks) * 100)
      : 0;

    const remaining = project.totalTasks - project.completedTasks;
    const eta = remaining > 0 && project.accuracy > 0
      ? Math.round(remaining / 10) // Simple ETA calculation
      : 0;

    let responseText = `📊 Project Status\n\n`;
    responseText += `🏷️ ${project.title}\n`;
    responseText += `🆔 ID: ${project.id}\n\n`;
    responseText += `${statusEmoji} Status: ${statusText}\n\n`;
    responseText += `📈 Progress: ${progress}%\n`;
    responseText += `   Completed: ${project.completedTasks}/${project.totalTasks} tasks\n`;
    responseText += `   Remaining: ${remaining} tasks\n\n`;
    responseText += `🎯 Accuracy: ${(project.accuracy * 100).toFixed(1)}%\n`;

    if (eta > 0) {
      responseText += `⏱️ ETA: ~${eta} minutes\n`;
    }

    responseText += `\n💰 Budget: $${project.budget.toFixed(2)}`;
    responseText += `\n📅 Created: ${new Date(project.createdAt).toLocaleDateString()}`;

    const keyboard = new InlineKeyboard();

    if (project.status === 'RUNNING') {
      keyboard.text('⏸️ Pause', `pause_${project.id}`).text('🔄 Refresh', `status_${project.id}`);
    } else if (project.status === 'PAUSED') {
      keyboard.text('▶️ Resume', `resume_${project.id}`).text('🔄 Refresh', `status_${project.id}`);
    }

    if (project.status === 'DONE' && project.completedTasks > 0) {
      keyboard.text('📥 Download Results', `results_${project.id}`);
    }

    if (keyboard.inlineKeyboard.length > 0) {
      keyboard.row();
    }

    keyboard.text('📋 All Projects', 'my_projects');

    await ctx.reply(responseText, {
      reply_markup: keyboard,
    });

  } catch (error) {
    logger.error('Failed to get project status:', error);
    await ctx.reply(
      '❌ Failed to load project status.\n' +
      'Please check the project ID and try again.',
    );
  }
};