import { Bot } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { config } from '../config/config.js';

export const depositCommand = async (ctx: AuthContext) => {
  if (!config.ENABLE_STRIPE_PAYMENTS) {
    await ctx.reply(
      '⚠️ Payment processing is temporarily disabled.\n' +
      'Please try again later or contact support.',
    );
    return;
  }

  if (!ctx.user) {
    await ctx.reply('❌ Authentication required. Please restart the bot with /start');
    return;
  }

  // Enter deposit scene
  await ctx.scene.enter('deposit');
};