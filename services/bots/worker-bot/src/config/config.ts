import { config as envConfig } from 'dotenv';

envConfig();

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',

  // API URLs
  LABELING_API_URL: process.env.LABELING_API_URL || 'http://localhost:3001',
  PAYMENT_API_URL: process.env.PAYMENT_API_URL || 'http://localhost:3000',
  WEBAPP_URL: process.env.WEBAPP_URL || 'http://localhost:5173',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',

  // Mini-App Configuration
  MINIAPP_URL: process.env.MINIAPP_URL || 'https://labelmint.mindburn.org/worker',

  // Admin IDs
  ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS?.split(',').map(Number) || [],

  // Feature Flags
  ENABLE_TASK_NOTIFICATIONS: process.env.ENABLE_TASK_NOTIFICATIONS === 'true',
  ENABLE_EARNINGS_NOTIFICATIONS: process.env.ENABLE_EARNINGS_NOTIFICATIONS === 'true',
  ENABLE_REFERRAL_SYSTEM: process.env.ENABLE_REFERRAL_SYSTEM === 'true',

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 30,

  // Task Configuration
  TASK_TIMEOUT_SECONDS: Number(process.env.TASK_TIMEOUT_SECONDS) || 30,
  MAX_CONCURRENT_TASKS: Number(process.env.MAX_CONCURRENT_TASKS) || 1,

  // Withdrawal Configuration
  MIN_WITHDRAWAL_USD: Number(process.env.MIN_WITHDRAWAL_USD) || 1.00,
  MAX_WITHDRAWAL_USD: Number(process.env.MAX_WITHDRAWAL_USD) || 50.00,
  WITHDRAWAL_COOLDOWN_HOURS: Number(process.env.WITHDRAWAL_COOLDOWN_HOURS) || 24,

  // TON Configuration
  ENABLE_TON_WITHDRAWALS: process.env.ENABLE_TON_WITHDRAWALS === 'true',
};