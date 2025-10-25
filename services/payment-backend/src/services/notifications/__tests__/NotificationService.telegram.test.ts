import { NotificationService } from '../NotificationService';
import TelegramBot from 'node-telegram-bot-api';

// Mock the TelegramBot
jest.mock('node-telegram-bot-api');

// Mock the email service
jest.mock('../email/ProductionEmailService', () => ({
  productionEmailService: {
    sendEmailImmediate: jest.fn(),
    getStats: jest.fn().mockResolvedValue({ sent: 5, failed: 0 }),
    healthCheck: jest.fn().mockResolvedValue(true),
    templates: new Map()
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('NotificationService - Telegram Integration', () => {
  let notificationService: NotificationService;
  let mockTelegramBot: jest.Mocked<TelegramBot>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ADMIN_TELEGRAM_IDS;
    delete process.env.ADMIN_DASHBOARD_URL;

    // Mock TelegramBot constructor
    mockTelegramBot = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 })
    } as any;

    (TelegramBot as jest.Mock).mockImplementation(() => mockTelegramBot);
  });

  describe('Telegram Bot Initialization', () => {
    it('should initialize Telegram bot when token is provided', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

      notificationService = new NotificationService();

      expect(TelegramBot).toHaveBeenCalledWith('test-bot-token', {
        polling: false,
        request: {
          agentOptions: {
            keepAlive: true,
            timeout: 30000
          }
        }
      });
    });

    it('should not initialize Telegram bot when token is missing', () => {
      notificationService = new NotificationService();

      expect(TelegramBot).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'invalid-token';

      (TelegramBot as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      notificationService = new NotificationService();

      expect(TelegramBot).toHaveBeenCalled();
      // Service should still be created despite Telegram failure
      expect(notificationService).toBeInstanceOf(NotificationService);
    });
  });

  describe('Sending Telegram Alerts', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.ADMIN_TELEGRAM_IDS = '123456789';
      process.env.ADMIN_DASHBOARD_URL = 'https://admin.labelmint.it';

      notificationService = new NotificationService();
    });

    it('should send properly formatted Telegram alert', async () => {
      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123456789',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date('2024-01-01T10:00:00Z'),
        severity: 'high' as const
      };

      await notificationService.sendLowBalanceAlert(alertData.wallets);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('LabelMint Payment Alert'),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📊 Admin Dashboard', url: 'https://admin.labelmint.it/payments' },
                { text: '💳 Manage Wallets', url: 'https://admin.labelmint.it/wallets' }
              ]
            ]
          }
        }
      );
    });

    it('should handle multiple wallets in alert', async () => {
      const alertData = {
        wallets: [
          {
            address: 'EQD_test_address_123',
            balance: '2.00',
            currency: 'TON',
            threshold: '10.00'
          },
          {
            address: '0x_test_address_456',
            balance: '50.00',
            currency: 'USDT',
            threshold: '100.00'
          }
        ],
        timestamp: new Date(),
        severity: 'critical' as const
      };

      await notificationService.sendLowBalanceAlert(alertData.wallets);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('TON Wallet') &&
        expect.stringContaining('USDT Wallet'),
        expect.any(Object)
      );
    });

    it('should skip Telegram notifications when bot is not initialized', async () => {
      // Create service without Telegram token
      delete process.env.TELEGRAM_BOT_TOKEN;
      notificationService = new NotificationService();

      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'medium' as const
      };

      await notificationService.sendLowBalanceAlert(alertData.wallets);

      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.ADMIN_TELEGRAM_IDS = '123456789';

      notificationService = new NotificationService();
    });

    it('should handle user blocking bot (403 error)', async () => {
      const error = {
        response: {
          body: {
            error_code: 403,
            description: 'Forbidden: bot was blocked by the user'
          }
        }
      };

      mockTelegramBot.sendMessage.mockRejectedValue(error);

      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'high' as const
      };

      await expect(notificationService.sendLowBalanceAlert(alertData.wallets)).rejects.toThrow();
    });

    it('should handle invalid user ID (400 error)', async () => {
      const error = {
        response: {
          body: {
            error_code: 400,
            description: 'Bad Request: chat not found'
          }
        }
      };

      mockTelegramBot.sendMessage.mockRejectedValue(error);

      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'high' as const
      };

      await expect(notificationService.sendLowBalanceAlert(alertData.wallets)).rejects.toThrow();
    });

    it('should handle rate limiting (429 error)', async () => {
      const error = {
        response: {
          body: {
            error_code: 429,
            description: 'Too Many Requests: retry after 5 seconds'
          }
        }
      };

      mockTelegramBot.sendMessage.mockRejectedValue(error);

      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'high' as const
      };

      await expect(notificationService.sendLowBalanceAlert(alertData.wallets)).rejects.toThrow(
        'Telegram rate limit exceeded: Too Many Requests: retry after 5 seconds'
      );
    });

    it('should handle network timeouts', async () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'Request timeout'
      };

      mockTelegramBot.sendMessage.mockRejectedValue(error);

      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'high' as const
      };

      await expect(notificationService.sendLowBalanceAlert(alertData.wallets)).rejects.toThrow();
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.ADMIN_TELEGRAM_IDS = '123456789';

      notificationService = new NotificationService();
    });

    it('should include appropriate emojis for different severity levels', async () => {
      const testCases = [
        { severity: 'critical' as const, emoji: '🚨' },
        { severity: 'high' as const, emoji: '⚠️' },
        { severity: 'medium' as const, emoji: '⚡' },
        { severity: 'low' as const, emoji: 'ℹ️' }
      ];

      for (const testCase of testCases) {
        mockTelegramBot.sendMessage.mockClear();

        const alertData = {
          wallets: [{
            address: 'EQD_test_address_123',
            balance: '5.50',
            currency: 'TON',
            threshold: '10.00'
          }],
          timestamp: new Date(),
          severity: testCase.severity
        };

        await notificationService.sendLowBalanceAlert(alertData.wallets);

        expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
          '123456789',
          expect.stringContaining(testCase.emoji),
          expect.any(Object)
        );
      }
    });

    it('should truncate wallet addresses for readability', async () => {
      const longAddress = 'EQD_very_long_address_that_should_be_truncated_in_the_message_for_readability_123456789';

      const alertData = {
        wallets: [{
          address: longAddress,
          balance: '5.50',
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'medium' as const
      };

      await notificationService.sendLowBalanceAlert(alertData.wallets);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringMatching(/EQD_.*\.\.\..123456/),
        expect.any(Object)
      );
    });

    it('should calculate and display percentage of threshold', async () => {
      const alertData = {
        wallets: [{
          address: 'EQD_test_address_123',
          balance: '2.50',  // 25% of threshold
          currency: 'TON',
          threshold: '10.00'
        }],
        timestamp: new Date(),
        severity: 'medium' as const
      };

      await notificationService.sendLowBalanceAlert(alertData.wallets);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('25.0%'),
        expect.any(Object)
      );
    });
  });

  describe('Service Status', () => {
    it('should report Telegram service status correctly', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      notificationService = new NotificationService();

      const status = await notificationService.getStatus();

      expect(status.telegramService).toEqual({
        status: 'configured',
        botToken: 'set'
      });
    });

    it('should report Telegram as not configured when token is missing', async () => {
      notificationService = new NotificationService();

      const status = await notificationService.getStatus();

      expect(status.telegramService).toEqual({
        status: 'not_configured',
        botToken: 'not_set'
      });
    });
  });
});