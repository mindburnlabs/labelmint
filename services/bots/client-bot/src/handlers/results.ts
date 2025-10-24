import { Bot, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';

export const resultsCommand = async (ctx: AuthContext) => {
  const projectId = ctx.match;

  if (!projectId) {
    await ctx.reply(
      '❌ Please provide a project ID.\n\n' +
      'Usage: /results <project_id>\n' +
      'Example: /results 123e4567-e89b-12d3-a456-426614174000',
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

    if (project.status !== 'DONE') {
      await ctx.reply(
        `⚠️ Project is not completed yet.\n\n` +
        `Current status: ${project.status}\n` +
        `Progress: ${project.completedTasks}/${project.totalTasks} tasks\n\n` +
        `Use /status ${projectId} to track progress.`,
      );
      return;
    }

    if (project.completedTasks === 0) {
      await ctx.reply(
        '❌ No completed tasks found for this project.\n\n' +
        'This might indicate an issue with the project.\n' +
        'Please contact support if you think this is an error.',
      );
      return;
    }

    // Get download URL
    const downloadUrl = await apiService.getProjectResults(projectId);

    const responseText = `📥 Download Results\n\n` +
      `🏷️ Project: ${project.title}\n` +
      `🆔 ID: ${project.id}\n\n` +
      `📊 Summary:\n` +
      `• Total tasks: ${project.completedTasks}\n` +
      `• Accuracy: ${(project.accuracy * 100).toFixed(1)}%\n` +
      `• Labels: ${project.totalTasks}\n\n` +
      `💾 File formats available:\n` +
      `• CSV (default)\n` +
      `• JSON\n\n` +
      `Click below to download your results:`;

    await ctx.reply(responseText, {
      reply_markup: new InlineKeyboard()
        .url('📥 Download CSV', downloadUrl)
        .row()
        .url('📄 Download JSON', `${downloadUrl}&format=json`)
        .row()
        .text('📊 View Status', `status_${projectId}`)
        .text('📋 All Projects', 'my_projects'),
    });

    logger.info(`Results downloaded for project ${projectId} by user ${ctx.user.id}`);

  } catch (error) {
    logger.error('Failed to get project results:', error);
    await ctx.reply(
      '❌ Failed to download results.\n\n' +
      'Please ensure:\n' +
      '• Project is completed\n' +
      '• You own the project\n' +
      '• There are completed tasks\n\n' +
      'Contact support if the issue persists.',
    );
  }
};