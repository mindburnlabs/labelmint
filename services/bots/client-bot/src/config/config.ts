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

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Admin IDs
  ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS?.split(',').map(Number) || [],

  // Feature Flags
  ENABLE_STRIPE_PAYMENTS: process.env.ENABLE_STRIPE_PAYMENTS === 'true',
  ENABLE_PROJECT_CREATION: process.env.ENABLE_PROJECT_CREATION === 'true',
  ENABLE_DATASET_UPLOAD: process.env.ENABLE_DATASET_UPLOAD === 'true',

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 30,

  // File Upload
  MAX_DATASET_SIZE_MB: Number(process.env.MAX_DATASET_SIZE_MB) || 500,
  ALLOWED_DATASET_TYPES: process.env.ALLOWED_DATASET_TYPES?.split(',') || ['zip', 'csv', 'json', 'jpg', 'jpeg', 'png'],

  // Google Drive
  GOOGLE_DRIVE_API_KEY: process.env.GOOGLE_DRIVE_API_KEY || '',
  GOOGLE_DRIVE_CLIENT_ID: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
  GOOGLE_DRIVE_CLIENT_SECRET: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
};