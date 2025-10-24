import { vi } from 'vitest'

/**
 * Mock services for testing
 */
export class MockServices {
  /**
   * Create mock database service
   */
  static createMockDatabase() {
    return {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0
      }),
      transaction: vi.fn().mockImplementation(fn => fn()),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn()
      }),
      end: vi.fn().mockResolvedValue(undefined)
    }
  }

  /**
   * Create mock Redis service
   */
  static createMockRedis() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      expire: vi.fn().mockResolvedValue(1),
      flushall: vi.fn().mockResolvedValue('OK'),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      hget: vi.fn().mockResolvedValue(null),
      hset: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),
      lpush: vi.fn().mockResolvedValue(1),
      rpop: vi.fn().mockResolvedValue(null),
      lrange: vi.fn().mockResolvedValue([])
    }
  }

  /**
   * Create mock email service
   */
  static createMockEmailService() {
    return {
      send: vi.fn().mockResolvedValue({
        messageId: 'mock-message-id',
        response: '250 OK'
      }),
      sendTemplate: vi.fn().mockResolvedValue({
        messageId: 'mock-template-id'
      }),
      sendBatch: vi.fn().mockResolvedValue({
        accepted: ['test@example.com'],
        rejected: [],
        messageId: 'mock-batch-id'
      })
    }
  }

  /**
   * Create mock payment service
   */
  static createMockPaymentService() {
    return {
      processDeposit: vi.fn().mockResolvedValue({
        success: true,
        transaction: {
          id: 'tx_123',
          amount: 100,
          status: 'completed'
        }
      }),
      processWithdrawal: vi.fn().mockResolvedValue({
        success: true,
        transaction: {
          id: 'tx_456',
          amount: 50,
          status: 'pending'
        }
      }),
      verifyTransaction: vi.fn().mockResolvedValue({
        valid: true,
        amount: 100,
        from: 'EQD_sender',
        to: 'EQD_recipient'
      }),
      getBalance: vi.fn().mockResolvedValue({
        amount: 1000,
        currency: 'USDT'
      })
    }
  }

  /**
   * Create mock Telegram bot service
   */
  static createMockTelegramBot() {
    return {
      api: {
        sendMessage: vi.fn().mockResolvedValue({
          message_id: 123,
          chat: { id: 456 }
        }),
        editMessageText: vi.fn().mockResolvedValue({
          message_id: 123,
          text: 'Updated message'
        }),
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        sendPhoto: vi.fn().mockResolvedValue({
          message_id: 124
        }),
        sendDocument: vi.fn().mockResolvedValue({
          document: { file_id: 'doc_123' }
        })
      },
      command: vi.fn(),
      on: vi.fn(),
      use: vi.fn(),
      callbackQuery: vi.fn()
    }
  }

  /**
   * Create mock file storage service
   */
  static createMockFileStorage() {
    return {
      upload: vi.fn().mockResolvedValue({
        url: 'https://example.com/file.jpg',
        key: 'uploads/file.jpg',
        size: 12345
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('file content')),
      delete: vi.fn().mockResolvedValue(true),
      getSignedUrl: vi.fn().mockResolvedValue({
        url: 'https://example.com/signed-url',
        expires: new Date(Date.now() + 3600000)
      }),
      listFiles: vi.fn().mockResolvedValue([
        {
          key: 'file1.jpg',
          size: 12345,
          lastModified: new Date()
        }
      ])
    }
  }

  /**
   * Create mock blockchain service
   */
  static createMockBlockchainService() {
    return {
      getBalance: vi.fn().mockResolvedValue({
        balance: '1000000000',
        pending: '0'
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        hash: '0x1234567890abcdef',
        blockNumber: 12345,
        blockHash: '0xabcdef1234567890'
      }),
      getTransaction: vi.fn().mockResolvedValue({
        hash: '0x1234567890abcdef',
        from: 'EQD_sender',
        to: 'EQD_recipient',
        value: '1000000000',
        status: 'success'
      }),
      estimateFee: vi.fn().mockResolvedValue({
        gasPrice: '1000000',
        gasLimit: '21000',
        totalFee: '21000000000'
      }),
      getBlock: vi.fn().mockResolvedValue({
        number: 12345,
        hash: '0xabcdef1234567890',
        timestamp: 1234567890
      })
    }
  }

  /**
   * Create mock analytics service
   */
  static createMockAnalyticsService() {
    return {
      trackEvent: vi.fn().mockResolvedValue(true),
      trackPageView: vi.fn().mockResolvedValue(true),
      trackUser: vi.fn().mockResolvedValue(true),
      getMetrics: vi.fn().mockResolvedValue({
        pageViews: 1000,
        uniqueVisitors: 500,
        bounceRate: 0.3,
        avgSessionDuration: 180
      }),
      createReport: vi.fn().mockResolvedValue({
        id: 'report_123',
        url: 'https://analytics.example.com/report_123'
      })
    }
  }

  /**
   * Create mock notification service
   */
  static createMockNotificationService() {
    return {
      sendPush: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'push_123'
      }),
      sendSMS: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'sms_123'
      }),
      sendInApp: vi.fn().mockResolvedValue({
        success: true,
        notificationId: 'inapp_123'
      }),
      getUnreadCount: vi.fn().mockResolvedValue(5),
      markAsRead: vi.fn().mockResolvedValue(true),
      markAllAsRead: vi.fn().mockResolvedValue(true)
    }
  }

  /**
   * Create mock AI/ML service
   */
  static createMockAIModelService() {
    return {
      predict: vi.fn().mockResolvedValue({
        prediction: 'cat',
        confidence: 0.95,
        probabilities: {
          cat: 0.95,
          dog: 0.04,
          bird: 0.01
        }
      }),
      classify: vi.fn().mockResolvedValue({
        label: 'spam',
        score: 0.98
      }),
      generate: vi.fn().mockResolvedValue({
        text: 'Generated text content',
        tokens: 150
      }),
      embed: vi.fn().mockResolvedValue({
        embedding: new Array(512).fill(0).map(() => Math.random()),
        dimensions: 512
      }),
      train: vi.fn().mockResolvedValue({
        modelId: 'model_123',
        accuracy: 0.92,
        loss: 0.08
      })
    }
  }

  /**
   * Create mock cache service
   */
  static createMockCacheService() {
    const cache = new Map()

    return {
      get: vi.fn().mockImplementation((key: string) => {
        return Promise.resolve(cache.get(key))
      }),
      set: vi.fn().mockImplementation((key: string, value: any, ttl?: number) => {
        cache.set(key, value)
        return Promise.resolve(true)
      }),
      delete: vi.fn().mockImplementation((key: string) => {
        return Promise.resolve(cache.delete(key))
      }),
      clear: vi.fn().mockImplementation(() => {
        cache.clear()
        return Promise.resolve(true)
      }),
      has: vi.fn().mockImplementation((key: string) => {
        return Promise.resolve(cache.has(key))
      }),
      keys: vi.fn().mockImplementation((pattern?: string) => {
        return Promise.resolve(Array.from(cache.keys()))
      }),
      size: vi.fn().mockImplementation(() => {
        return Promise.resolve(cache.size)
      })
    }
  }
}