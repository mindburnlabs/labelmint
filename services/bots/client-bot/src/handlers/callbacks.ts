import { CallbackQuery } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { projectsCommand } from './projects.js';
import { statusCommand } from './status.js';
import { resultsCommand } from './results.js';
import { balanceCommand } from './balance.js';
import { newProjectCommand } from './newProject.js';
import { depositCommand } from './deposit.js';
import { helpCommand } from './help.js';

export const callbackQueryHandler = async (ctx: AuthContext) => {
  const data = ctx.callbackQuery.data;

  try {
    switch (data) {
      // Navigation callbacks
      case 'new_project':
        await ctx.answerCallbackQuery();
        await newProjectCommand(ctx);
        break;

      case 'my_projects':
        await ctx.answerCallbackQuery();
        await projectsCommand(ctx);
        break;

      case 'my_balance':
        await ctx.answerCallbackQuery();
        await balanceCommand(ctx);
        break;

      case 'add_funds':
        await ctx.answerCallbackQuery();
        await depositCommand(ctx);
        break;

      case 'help':
        await ctx.answerCallbackQuery();
        await helpCommand(ctx);
        break;

      // Project-specific callbacks
      case /^status_(.+)$/:
        await ctx.answerCallbackQuery();
        const statusId = data.split('_')[1];
        ctx.match = statusId;
        await statusCommand(ctx);
        break;

      case /^results_(.+)$/:
        await ctx.answerCallbackQuery();
        const resultsId = data.split('_')[1];
        ctx.match = resultsId;
        await resultsCommand(ctx);
        break;

      case /^project_(.+)$/:
        await ctx.answerCallbackQuery();
        const projectId = data.split('_')[1];
        ctx.match = projectId;
        await statusCommand(ctx);
        break;

      case /^pause_(.+)$/:
        await ctx.answerCallbackQuery();
        await handleProjectControl(ctx, 'pause', data.split('_')[1]);
        break;

      case /^resume_(.+)$/:
        await ctx.answerCallbackQuery();
        await handleProjectControl(ctx, 'resume', data.split('_')[1]);
        break;

      case /^deposit_(.+)$/:
        await ctx.answerCallbackQuery();
        // Handled by deposit scene
        break;

      default:
        await ctx.answerCallbackQuery({
          text: '❓ Unknown action',
          show_alert: true,
        });
        logger.warn(`Unknown callback: ${data}`);
    }
  } catch (error) {
    logger.error(`Callback handler error for ${data}:`, error);
    await ctx.answerCallbackQuery({
      text: '❌ An error occurred',
      show_alert: true,
    });
  }
};

async function handleProjectControl(ctx: AuthContext, action: 'pause' | 'resume', projectId: string) {
  try {
    // In real implementation, call API to pause/resume project
    await ctx.reply(
      `⏳ ${action === 'pause' ? 'Pausing' : 'Resuming'} project...\n\n` +
      'This may take a moment.',
    );

    // Simulate API call
    setTimeout(async () => {
      await ctx.reply(
        `✅ Project ${action === 'pause' ? 'paused' : 'resumed'} successfully!\n\n` +
        'Workers will ' + (action === 'pause' ? 'stop receiving tasks' : 'start receiving tasks again') + '.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Refresh Status', callback_data: `status_${projectId}` },
                { text: '📋 All Projects', callback_data: 'my_projects' },
              ],
            ],
          },
        },
      );
    }, 1000);

    logger.info(`Project ${projectId} ${action}d by user ${ctx.user?.id}`);
  } catch (error) {
    logger.error(`Failed to ${action} project:`, error);
    await ctx.reply(
      `❌ Failed to ${action} project.\n\n` +
      'Please try again later.',
    );
  }
}