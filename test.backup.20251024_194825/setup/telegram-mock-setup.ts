import { vi } from 'vitest'

// Additional Telegram-specific mock setup
export function setupTelegramMocks() {
  // Mock node-telegram-bot-api or similar libraries
  const mockBot = {
    token: 'test-bot-token',
    options: {},
  }

  const mockTelegram = {
    // Core bot methods
    getMe: vi.fn().mockResolvedValue({
      id: 123456789,
      is_bot: true,
      first_name: 'LabelMint Bot',
      username: 'labelmint_bot',
    }),

    // Message methods
    sendMessage: vi.fn().mockResolvedValue({
      message_id: 12345,
      chat: { id: 987654321 },
      text: 'Response message',
    }),

    sendPhoto: vi.fn().mockResolvedValue({
      message_id: 12346,
      chat: { id: 987654321 },
      photo: [{ file_id: 'photo_file_123' }],
    }),

    sendDocument: vi.fn().mockResolvedValue({
      message_id: 12347,
      chat: { id: 987654321 },
      document: { file_id: 'doc_file_123' },
    }),

    sendChatAction: vi.fn().mockResolvedValue(true),

    // Inline methods
    answerInlineQuery: vi.fn().mockResolvedValue(true),

    // Callback methods
    answerCallbackQuery: vi.fn().mockResolvedValue(true),

    // Message editing
    editMessageText: vi.fn().mockResolvedValue({
      message_id: 12345,
      text: 'Edited message',
    }),

    editMessageReplyMarkup: vi.fn().mockResolvedValue({
      message_id: 12345,
    }),

    // Chat methods
    getChat: vi.fn().mockResolvedValue({
      id: 987654321,
      first_name: 'Test User',
      username: 'testuser',
      type: 'private',
    }),

    // File methods
    getFileLink: vi.fn().mockResolvedValue('https://api.telegram.org/file/bot<token>/<file_path>'),

    // Webhook methods
    setWebHook: vi.fn().mockResolvedValue(true),
    deleteWebHook: vi.fn().mockResolvedValue(true),
  }

  // Mock the bot constructor
  const mockBotConstructor = vi.fn(() => mockBot)

  // Add the API methods to the bot instance
  Object.assign(mockBot, mockTelegram)

  // Setup global mocks
  global.TelegramBot = mockBotConstructor as any
  global.telegramBot = mockBot

  return {
    mockBot,
    mockTelegram,
    cleanup: () => {
      vi.clearAllMocks()
    },
  }
}

// Auto-setup
const { mockBot, mockTelegram, cleanup } = setupTelegramMocks()

export { mockBot, mockTelegram, cleanup }