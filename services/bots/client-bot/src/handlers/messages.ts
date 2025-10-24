import { Message } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const messageHandler = async (ctx: AuthContext) => {
  // Handle text messages that aren't commands
  if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
    // Check if user is in a scene
    if (ctx.scene?.active) {
      return; // Let scene handle the message
    }

    // Provide helpful response
    await ctx.reply(
      '👋 I see you sent a message.\n\n' +
      'I\'m LabelMint\'s project management bot.\n\n' +
      'Use /help to see available commands,\n' +
      'or use /start to see the main menu.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Main Menu', callback_data: 'start' },
              { text: '❓ Help', callback_data: 'help' },
            ],
          ],
        },
      },
    );
    return;
  }

  // Handle file uploads outside of scenes
  if (ctx.message?.document || ctx.message?.photo) {
    await ctx.reply(
      '📁 Please start a project creation first.\n\n' +
      'Use /newproject to create a project,\n' +
      'then you\'ll be prompted to upload your dataset.',
    );
    return;
  }

  // Log unhandled messages
  logger.debug(`Unhandled message from ${ctx.from?.id}: ${JSON.stringify(ctx.message)}`);
};