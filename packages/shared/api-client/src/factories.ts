/**
 * API Client Factory Functions
 * Provides convenient factory functions for creating context-specific API clients
 */

import { ApiClient } from './client';
import { UserService } from './services/user-service';
import { TaskService } from './services/task-service';
import { ProjectService } from './services/project-service';
import { PaymentService } from './services/payment-service';
import { AuthType } from './auth/types';
import { LocalStorageTokenStorage, SessionStorageTokenStorage, MemoryTokenStorage } from './auth/token-storage';

/**
 * Create API client for Web Application
 */
export function createWebApiClient(config: { baseURL: string; tokenStorage?: 'localStorage' | 'sessionStorage' }) {
  const tokenStorage = config.tokenStorage === 'sessionStorage'
    ? new SessionStorageTokenStorage()
    : new LocalStorageTokenStorage();

  return new ApiClient({
    baseURL: config.baseURL,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    auth: {
      type: AuthType.JWT,
      tokenStorage,
      refreshEndpoint: '/auth/refresh'
    }
  });
}

/**
 * Create API client for Admin Application
 */
export function createAdminApiClient(config: { baseURL: string }) {
  return new ApiClient({
    baseURL: config.baseURL,
    timeout: 25000,
    retries: 2,
    retryDelay: 1500,
    auth: {
      type: AuthType.JWT,
      tokenStorage: new LocalStorageTokenStorage('admin_access_token', 'admin_refresh_token'),
      refreshEndpoint: '/admin/auth/refresh'
    }
  });
}

/**
 * Create API client for Telegram Mini App
 */
export function createTelegramApiClient(config: {
  baseURL: string;
  telegramService: any;
}) {
  return new ApiClient({
    baseURL: config.baseURL,
    timeout: 20000,
    retries: 2,
    retryDelay: 1000,
    auth: {
      type: AuthType.TELEGRAM,
      telegramService: config.telegramService
    }
  });
}

/**
 * Create API client for Bot Services
 */
export function createBotApiClient(config: {
  baseURL: string;
  botToken: string;
  customHeaders?: Record<string, string>;
}) {
  return new ApiClient({
    baseURL: config.baseURL,
    timeout: 15000,
    retries: 1,
    retryDelay: 500,
    auth: {
      type: AuthType.BOT_TOKEN,
      botToken: config.botToken,
      customHeaders: config.customHeaders
    }
  });
}

/**
 * Create API client for External APIs (Stripe, OpenAI, etc.)
 */
export function createExternalApiClient(config: {
  baseURL: string;
  apiKey: string;
  timeout?: number;
}) {
  return new ApiClient({
    baseURL: config.baseURL,
    timeout: config.timeout || 10000,
    retries: 3,
    retryDelay: 2000,
    apiKey: config.apiKey,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    }
  });
}

/**
 * Create a complete service client with all services
 */
export function createServiceClient(apiClient: ApiClient) {
  return {
    api: apiClient,
    users: new UserService(apiClient),
    tasks: new TaskService(apiClient),
    projects: new ProjectService(apiClient),
    payments: new PaymentService(apiClient)
  };
}

/**
 * Create Web Application client with all services
 */
export function createWebAppClient(config: { baseURL: string; tokenStorage?: 'localStorage' | 'sessionStorage' }) {
  const apiClient = createWebApiClient(config);
  return createServiceClient(apiClient);
}

/**
 * Create Admin Application client with all services
 */
export function createAdminAppClient(config: { baseURL: string }) {
  const apiClient = createAdminApiClient(config);
  return createServiceClient(apiClient);
}

/**
 * Create Telegram Mini App client with all services
 */
export function createTelegramAppClient(config: {
  baseURL: string;
  telegramService: any;
}) {
  const apiClient = createTelegramApiClient(config);
  return createServiceClient(apiClient);
}

/**
 * Create Bot service client with all services
 */
export function createBotServiceClient(config: {
  baseURL: string;
  botToken: string;
  customHeaders?: Record<string, string>;
}) {
  const apiClient = createBotApiClient(config);
  return createServiceClient(apiClient);
}